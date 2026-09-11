-- ============================================================
-- 原石航路 Studio
-- 関係の線に、形を持たせる
--
-- ------------------------------------------------------------
-- 何のために足すか
--
-- いまの線は、変化の記録があれば実線、
-- 無ければ破線、と決め打ちになっている。
--
-- 作者が決められるようにする。
--
--   dashed  破線
--   solid   実線
--   arrow   矢印（向きのある関係）
--
-- 「AはBを慕っている」のような片側だけの関係を、
-- 矢印で表せるようになる。
--
-- ------------------------------------------------------------
-- 決めていない線は、これまでどおり
--
-- null なら、変化の記録の有無で決める。
-- 何もしなくても、見た目は変わらない。
-- ============================================================

alter table public.resource_relations
    add column if not exists line_style text;

comment on column public.resource_relations.line_style is
    '線の形。dashed 破線 / solid 実線 / arrow 矢印。null なら変化の記録で決める';

alter table public.resource_relations
    drop constraint if exists resource_relations_line_style_check;

alter table public.resource_relations
    add constraint resource_relations_line_style_check
    check (line_style is null or line_style in ('dashed', 'solid', 'arrow'));

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'resource_relations'
              and column_name = 'line_style'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
