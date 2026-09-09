-- ============================================================
-- 原石航路 Studio
-- 作品ごとの数（いいね・保存）を、数だけ読めるようにする
--
-- ------------------------------------------------------------
-- 何が起きていたか
--
-- likes の決まりは、こうなっている。
--
--   likes_all   ALL   auth.uid() = user_id
--
-- 「自分が押したいいね」しか読めない。
-- だから作者は自分の作品へのいいねを数えられず、
-- マイページも作品の頁もランキングも、いつも 0 だった。
--
-- ------------------------------------------------------------
-- なぜ決まりを緩めないか
--
-- 誰でも読めるようにすれば数は出る。
-- だが、その表には user_id が入っている。
-- 「誰が何にいいねしたか」「誰が何を保存したか」まで
-- 外から読めるようになる。保存は特に、
-- 読んでいるものが知られる。
--
-- 数だけを返す入れ物を作り、そちらを読ませる。
-- 中の行は、これまでどおり本人しか読めない。
-- ============================================================

/*
 * 作品ごとの数。
 *
 *   like_count      作品への♡ ＋ 話への♡
 *   bookmark_count  保存
 *
 * ★ ♡を 2 つ足すのは、押される場所が 2 つあるため。
 *
 *     likes           作品の頁の♡
 *     episode_likes   本文の下の♡
 *
 *   読者は読み終えた所の♡を押す。
 *   作品の頁まで戻って押す人は多くない。
 *
 * ★ 同じ人が作品にも各話にも押せる。数は重なる。
 *   「何回押されたか」であって「何人が押したか」ではない。
 */
create or replace view public.novel_stats as
select
    n.id as novel_id,

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
        as bookmark_count

from public.novels as n;

/*
 * ★ 中の行の決まりを素通りさせる。
 *
 *   security_invoker を off にすると、この入れ物は
 *   作った人の権限で数える。だから数は正しく出る。
 *   返すのは数だけなので、誰が押したかは漏れない。
 *
 *   PostgreSQL 15 より前は既定で off。
 *   新しい版でも、はっきり書いておく。
 */
alter view public.novel_stats set (security_invoker = off);

grant select on public.novel_stats to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    n.title as 作品,
    s.like_count as いいね,
    s.bookmark_count as 保存
from public.novel_stats as s
join public.novels as n on n.id = s.novel_id
order by s.like_count desc
limit 10;
