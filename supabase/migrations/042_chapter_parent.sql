-- ============================================================
-- 原石航路 Studio
-- 章を 2 段にする
--
-- 大きな章の下に、小さな章（節）を置けるようにする。
-- 長い作品では「第一部 → 第一章」のように
-- 2 段で束ねたい人がいる。
--
-- 親を持たない章が「大きい章」、
-- 親を持つ章が「小さい章」。
-- 列を 1 つ足すだけで、両方を表せる。
--
-- いまある章はすべて親なし＝大きい章になる。
-- これまでの作品は、見え方が変わらない。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.chapters
    add column if not exists parent_id uuid;

/*
 * 親が消えたら、子は親なし（大きい章）に戻す。
 *
 * 一緒に消すと、中の話ごと行方が分からなくなる。
 */
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'chapters_parent_fk'
    ) then
        alter table public.chapters
            add constraint chapters_parent_fk
            foreign key (parent_id) references public.chapters(id)
            on delete set null;
    end if;
end $$;

create index if not exists chapters_parent_idx
    on public.chapters (parent_id);

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    count(*) as 章の数,
    count(parent_id) as 小さい章,
    count(*) - count(parent_id) as 大きい章
from public.chapters;
