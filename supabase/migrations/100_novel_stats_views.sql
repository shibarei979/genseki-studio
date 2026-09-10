-- ============================================================
-- 原石航路 Studio
-- 閲覧数を、ひとつの数え方にそろえる
--
-- ------------------------------------------------------------
-- 何が起きていたか
--
-- 同じ作品に、2 つの数があった。
--
--   novel_views.view_count   作品の頁・ランキング・おすすめ
--   page_views の件数        マイページ・作者の分析
--
-- 突き合わせたところ、差はきれいに説明が付いた。
--
--   ちがい ＝ 作者自身が開いた数 ＋ 見回りの機械が開いた数
--
-- novel_views は、page_views の行を
-- 作者も機械も含めて全部数えていた。
--
-- ------------------------------------------------------------
-- どちらに寄せるか
--
-- page_views のほうに寄せる。
--
--   ・作者・機械・訪れた人の札を、すべて持っている
--   ・話ごとに分けられる（novel_views は作品の合計だけ）
--   ・この作りの中で書いているので、何を数えているか分かる
--
-- ★ 数は下がる。減ったのではなく、これまでが過大だった。
--   クラフトアルケミストなら 1451 → 457。
--   作者から見れば「PV が 3 分の 1 になった」なので、
--   出すときは、お知らせを添えること。
--
-- ------------------------------------------------------------
-- novel_views は消さない
--
-- 何が書いているのか、まだ分かっていない（仕掛けか、外の仕組みか）。
-- 消すと、そちらが落ちるかもしれない。
-- 見るのをやめるだけにする。
-- ============================================================

create or replace view public.novel_stats as
select
    n.id as novel_id,

    /*
     * いいね。作品への♡と、話への♡を足す。
     * 押される場所が 2 つあるため。
     */
    (
        (select count(*) from public.likes as l where l.novel_id = n.id)
        +
        (
            select count(*)
            from public.episode_likes as el
            join public.episodes as e on e.id = el.episode_id
            where e.novel_id = n.id
        )
    ) as like_count,

    (select count(*) from public.bookmarks as b where b.novel_id = n.id)
        as bookmark_count,

    /*
     * 閲覧。人が本文を開いた数。
     *
     * ★ 作者自身のぶんは数えない。
     *   自分で開いた数が自分の作品の数字に入ると、
     *   確かめるたびに増えて、読まれた量が分からなくなる。
     *
     * ★ 見回りの機械も数えない。
     *   印の無い古い記録（null）は人として数える。
     *   is_bot = false で絞ると、印を付ける前のぶんが丸ごと消える。
     */
    (
        select count(*)
        from public.page_views as v
        join public.episodes as e on e.id = v.episode_id
        where e.novel_id = n.id
          and v.is_author = false
          and v.is_bot is not true
    ) as view_count

from public.novels as n;

alter view public.novel_stats set (security_invoker = off);

grant select on public.novel_stats to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認：新しい数と、これまでの数を並べる
-- ============================================================
select
    n.title                      as 作品,
    coalesce(nv.view_count, 0)   as これまでのPV,
    s.view_count                 as これからのPV,
    coalesce(nv.view_count, 0) - s.view_count as 減るぶん
from public.novel_stats as s
join public.novels as n on n.id = s.novel_id
left join public.novel_views as nv on nv.novel_id = n.id
where n.visibility = 'public'
order by coalesce(nv.view_count, 0) desc
limit 20;
