-- 記帳 App 資料庫結構
-- 在 Supabase Dashboard → SQL Editor 貼上整份執行。
-- 可以重複執行：已存在的資料表與資料不會受影響，更新版本後再跑一次即可補上新的資料表。

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
  -- 預留給之後的定位功能
  latitude     double precision,
  longitude    double precision,
  created_at   timestamptz not null default now()
);

create index if not exists expenses_user_spent_on_idx
  on public.expenses (user_id, spent_on desc);
create index if not exists expenses_category_idx
  on public.expenses (category_id);

-- ── Row Level Security：只能讀寫自己的資料 ───────────────────
alter table public.categories enable row level security;
alter table public.expenses   enable row level security;

drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own expenses" on public.expenses;
create policy "own expenses" on public.expenses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.expenses   to authenticated;

-- ── 沒有花費的日子（讓連續記帳天數不會因為沒花錢而中斷）─────────
create table if not exists public.no_spend_days (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.no_spend_days enable row level security;

drop policy if exists "own no-spend days" on public.no_spend_days;
create policy "own no-spend days" on public.no_spend_days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, delete on public.no_spend_days to authenticated;
