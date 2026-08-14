-- ============================================================
-- 原石航路 Studio
-- 表示順の列
--
-- お知らせとコンテストに、運営が決める並び順を持たせる。
-- 数字の小さいものが上。空(null)のものは日付の順で後ろに続く。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.admin_notices
    add column if not exists sort_order integer;

alter table public.announcements
    add column if not exists sort_order integer;

alter table public.contests
    add column if not exists sort_order integer;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    table_name as 表,
    case
        when exists (
            select 1 from information_schema.columns c
            where c.table_schema = 'public'
              and c.table_name = t.table_name
              and c.column_name = 'sort_order'
        ) then 'ある'
        else '無い ← 失敗'
    end as sort_order列
from (values ('admin_notices'), ('announcements'), ('contests')) as t(table_name);
