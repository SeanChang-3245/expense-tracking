-- 讓兩個帳號互相看到彼此的記帳（不含位置與隱藏的記錄）。
-- 先執行 schema.sql，並在 Authentication → Users 建好兩個帳號，
-- 把下面兩個 email 換成你們的，然後在 SQL Editor 執行。

with a as (select id from auth.users where email = 'you@example.com'),
     b as (select id from auth.users where email = 'partner@example.com')
insert into public.shares (owner_id, viewer_id)
select a.id, b.id from a, b
union all
select b.id, a.id from a, b
on conflict do nothing;

-- 確認：應該看到兩列
select o.email as owner, v.email as viewer
from public.shares s
join auth.users o on o.id = s.owner_id
join auth.users v on v.id = s.viewer_id;

-- 取消共享：
-- delete from public.shares;
