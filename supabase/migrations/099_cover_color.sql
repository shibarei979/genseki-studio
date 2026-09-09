-- ============================================================
-- 原石航路 Studio
-- 本棚での、本の色
--
-- ------------------------------------------------------------
-- 何のために足すか
--
-- 本棚に並ぶ本の色は、これまで題名から決めていた。
-- 同じ題名ならいつも同じ色になるので、
-- 自分の本を見失うことはない。
--
-- ただ、色そのものは選べなかった。
-- 作品の雰囲気に合う色を、作者が選べるようにする。
--
-- ------------------------------------------------------------
-- なぜ色の文字ではなく、番号で持つか
--
-- 「#fffdf6」のような文字で持つと、
-- あとから色の一覧を差し替えたときに、
-- その作品だけ古い色のまま取り残される。
--
-- 番号なら、一覧を直せば全部が一緒に変わる。
-- 選べる色を増やすときも、番号だけ増やせばよい。
--
-- ------------------------------------------------------------
-- 決めていないとき
--
-- null にしておく。これまでどおり、題名から決まる。
-- 既にある作品は、すべて null なので見た目は変わらない。
-- ============================================================

alter table public.novels
    add column if not exists cover_color smallint;

comment on column public.novels.cover_color is
    '本棚での本の色。色の一覧（COVERS）の番号。null なら題名から決める';

/*
 * 番号の範囲。
 *
 * ★ 一覧を増やしたら、ここの数も一緒に増やす。
 *   増やし忘れると、選べるのに控えられない色ができる。
 */
alter table public.novels
    drop constraint if exists novels_cover_color_range;

alter table public.novels
    add constraint novels_cover_color_range
    check (cover_color is null or cover_color between 0 and 11);

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'novels'
              and column_name = 'cover_color'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
