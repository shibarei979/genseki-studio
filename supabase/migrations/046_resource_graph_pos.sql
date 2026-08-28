-- ============================================================
-- 原石航路 Studio
-- 関係図の置き場所を覚える
--
-- 関係図の丸は、いままで輪の形に自動で並べていた。
-- 指で動かすことはできたが、離すと元の輪に戻っていた。
-- 置いた場所を覚える所が、どこにも無かったため。
--
-- 主人公たちを左に、敵を右に、というような
-- 目で見て分かる並べ方は、作者にしか決められない。
-- 機械が並べ替えると、その意図が消える。
--
-- {"x": 120, "y": 240} の形で持つ。
-- 入っていなければ、これまでどおり輪に並べる。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.resource_entries
    add column if not exists graph_pos jsonb;

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
              and table_name = 'resource_entries'
              and column_name = 'graph_pos'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;

select
    count(*)                    as 資料の項目,
    count(graph_pos)            as 置き場所を決めたもの
from public.resource_entries;
