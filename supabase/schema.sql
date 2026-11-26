-- 記帳 App 資料庫結構
-- 在 Supabase Dashboard → SQL Editor 貼上整份執行。
-- 可以重複執行：已存在的資料表與資料不會受影響，更新版本後再跑一次即可補上新的結構。

-- ── 分類（一筆支出只屬於一個分類）────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 20),
  emoji       text not null default '',
  color       smallint not null default 1 check (color between 1 and 8),
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ── 支出 ────────────────────────────────────────────────────
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount       numeric(12, 2) not null check (amount > 0),
  category_id  uuid not null references public.categories (id) on delete restrict,
  note         text,
  spent_on     date not null default current_date,
  private      boolean not null default false,  -- true：不分享給其他人
  created_at   timestamptz not null default now()
);
alter table public.expenses add column if not exists private boolean not null default false;

create index if not exists expenses_user_spent_on_idx
  on public.expenses (user_id, spent_on desc);
create index if not exists expenses_category_idx
  on public.expenses (category_id);

-- ── 支出的位置（只有自己看得到，不分享）───────────────────────
create table if not exists public.expense_locations (
  expense_id  uuid primary key references public.expenses (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  latitude    double precision not null,
  longitude   double precision not null,
  created_at  timestamptz not null default now()
);
create index if not exists expense_locations_user_lat_idx
  on public.expense_locations (user_id, latitude);

-- 舊版把位置存在 expenses 上：搬過來後移除那兩欄
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'expenses' and column_name = 'latitude') then
    insert into public.expense_locations (expense_id, user_id, latitude, longitude, created_at)
      select id, user_id, latitude, longitude, created_at from public.expenses
      where latitude is not null and longitude is not null
      on conflict (expense_id) do nothing;
    alter table public.expenses drop column latitude, drop column longitude;
  end if;
end $$;

-- ── 沒有花費的日子（讓連續記帳天數不會因為沒花錢而中斷）─────────
create table if not exists public.no_spend_days (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, day)
);

-- ── 共享：owner 的帳可以被 viewer 看到（設定方式見 supabase/pair.sql）──
create table if not exists public.shares (
  owner_id   uuid not null references auth.users (id) on delete cascade,
  viewer_id  uuid not null references auth.users (id) on delete cascade,
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

-- ── 顯示名稱 ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 20)
);

-- 目前登入的人能不能看 target 的資料
create or replace function public.can_view(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
      or exists (select 1 from public.shares s where s.owner_id = target and s.viewer_id = auth.uid());
$$;

-- 連續記帳天數（含隱藏記錄與沒花錢的日子，但只回傳天數）
create or replace function public.streak_stats(target uuid, today date)
returns table (current_streak integer, longest_streak integer, logged_today boolean)
language sql stable security definer set search_path = public as $$
  with days as (
    select spent_on as d from public.expenses where user_id = target
    union
    select day from public.no_spend_days where user_id = target
  ),
  islands as (
    select min(d) as s, max(d) as e, count(*)::integer as len
    from (select d, d - (row_number() over (order by d))::integer as grp from days) runs
    group by grp
  )
  select
    coalesce((select len from islands where e >= today - 1 and s <= today order by e desc limit 1), 0),
    coalesce((select max(len) from islands), 0),
    exists (select 1 from days where d = today)
  where public.can_view(target);
$$;

revoke execute on function public.can_view(uuid) from public, anon;
revoke execute on function public.streak_stats(uuid, date) from public, anon;
grant execute on function public.can_view(uuid) to authenticated;
grant execute on function public.streak_stats(uuid, date) to authenticated;

-- ── Row Level Security ──────────────────────────────────────
-- 讀取：自己的，或分享給我的（隱藏的支出除外）；寫入：只能寫自己的。
alter table public.categories        enable row level security;
alter table public.expenses          enable row level security;
alter table public.expense_locations enable row level security;
alter table public.no_spend_days     enable row level security;
alter table public.shares            enable row level security;
alter table public.profiles          enable row level security;

drop policy if exists "own categories"   on public.categories;
drop policy if exists "read categories"  on public.categories;
drop policy if exists "write categories" on public.categories;
create policy "read categories" on public.categories
  for select to authenticated using (public.can_view(user_id));
create policy "write categories" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own expenses"   on public.expenses;
drop policy if exists "read expenses"  on public.expenses;
drop policy if exists "write expenses" on public.expenses;
create policy "read expenses" on public.expenses
  for select to authenticated
  using (user_id = (select auth.uid()) or (not private and public.can_view(user_id)));
create policy "write expenses" on public.expenses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own locations" on public.expense_locations;
create policy "own locations" on public.expense_locations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own no-spend days"   on public.no_spend_days;
drop policy if exists "read no-spend days"  on public.no_spend_days;
drop policy if exists "write no-spend days" on public.no_spend_days;
create policy "read no-spend days" on public.no_spend_days
  for select to authenticated using (public.can_view(user_id));
create policy "write no-spend days" on public.no_spend_days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "read shares" on public.shares;
create policy "read shares" on public.shares
  for select to authenticated
  using (owner_id = (select auth.uid()) or viewer_id = (select auth.uid()));

drop policy if exists "read profiles"  on public.profiles;
drop policy if exists "write profiles" on public.profiles;
create policy "read profiles" on public.profiles
  for select to authenticated using (public.can_view(id));
create policy "write profiles" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select, insert, update, delete on public.categories        to authenticated;
grant select, insert, update, delete on public.expenses          to authenticated;
grant select, insert, update, delete on public.expense_locations to authenticated;
grant select, insert, delete         on public.no_spend_days     to authenticated;
grant select                         on public.shares            to authenticated;
grant select, insert, update         on public.profiles          to authenticated;
