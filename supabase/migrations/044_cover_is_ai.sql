-- ============================================================
-- 原石航路 Studio
-- 表紙に AI を使ったかを持たせる
--
-- 絵を見ただけでは、AI で作ったものかどうか分からない。
-- 読む人がそれを知りたい以上、作者に申告してもらうほかない。
--
-- 印が立っている作品は、表紙の右上にハンコを出す。
--
-- 本文のほうの ai_usage とは別。
-- 本文は自分で書き、表紙だけ AI という人がいる。
-- ひとつにまとめると、その区別が付かない。
--
-- 既定は false。いまある作品は「使っていない」のまま。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.novels
    add column if not exists cover_is_ai boolean not null default false;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'novels'
              and column_name = 'cover_is_ai'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;

select
    count(*)                              as 作品の数,
    count(*) filter (where cover_is_ai)   as 表紙にAIを使った作品
from public.novels
where deleted_at is null;
