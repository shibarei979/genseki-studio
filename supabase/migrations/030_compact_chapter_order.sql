-- ============================================================
-- 原石航路 Studio
-- 章の並び順を詰め直す
--
-- 章を消したあとも番号が飛んだまま残る（0,2,4 のように）。
-- そのままでも並ぶ順は変わらないが、
-- 番号と実際の順が食い違うと、次に作った章の番号が
-- 既にある章と重なることがあった。
--
-- いまの並び順を保ったまま、0,1,2… に詰め直す。
--
-- 何度実行しても壊れない。
-- ============================================================

with 並び as (
    select
        id,
        row_number() over (
            partition by novel_id
            order by sort_order, created_at, id
        ) - 1 as 新しい順
    from public.chapters
)
update public.chapters c
   set sort_order = 並び.新しい順
  from 並び
 where c.id = 並び.id
   and c.sort_order is distinct from 並び.新しい順;

-- ============================================================
-- 確認
-- ============================================================
select
    n.title as 作品,
    c.sort_order as 並び順,
    c.title as 章
from public.chapters c
join public.novels n on n.id = c.novel_id
order by n.title, c.sort_order;
