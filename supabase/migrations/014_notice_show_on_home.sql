-- ============================================================
-- 原石航路 Studio
-- お知らせを帯に出すかの列
--
-- 画像付きのお知らせを、ホームの流れる帯に
-- 出すかどうかを運営が選べるようにする。
-- 既にあるものは「出す」から始める。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.admin_notices
    add column if not exists show_on_home boolean not null default true;

alter table public.announcements
    add column if not exists show_on_home boolean not null default true;

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
              and c.column_name = 'show_on_home'
        ) then 'ある'
        else '無い ← 失敗'
    end as show_on_home列
from (values ('admin_notices'), ('announcements')) as t(table_name);
