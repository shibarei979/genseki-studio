-- ============================================================
-- 原石航路 Studio
-- ランキングの点を、表に溜めておく
--
-- ------------------------------------------------------------
-- 何のために作るか
--
-- いまは、ランキングを開くたびに数え直している。
--
--   いいね・保存・星・読まれた数・続けて読んだ人
--   これを全作品ぶん、その場で集める。
--
-- 作品が増えるほど重くなり、
-- 1000 行の頭打ちにも当たりやすくなる。
-- 実際、195 作品が 73 件しか出ない不具合が起きた。
--
-- あらかじめ数えておけば、画面は 1 回読むだけで済む。
--
-- ------------------------------------------------------------
-- 数え直す間隔
--
--   15 分ごと  日間・週間      動きが速い
--   30 分ごと  月間・四半期    そこまで速くない
--   1 日 1 回  年間・累計      ほとんど動かない
--
-- 短い期間を長く放っておくと、
-- 投稿した人が「反応が見えない」と感じる。
-- 長い期間を細かく数え直しても、順位は動かない。
--
-- ------------------------------------------------------------
-- 点の付け方（いまの画面と同じ）
--
--   星       × 1（1 人 1 話につき 5 まで）
--   いいね   × 2
--   保存     × 2   ← 「あとで読む」の印で、読んだ証しではない
--   続けて   × 1.3 ← 続きを読みに戻った人。面白さを強く表す
--   読まれた × 0.2
--
-- ★ 数え方を変えるときは、ここと画面の両方を直すこと。
--   片方だけ直すと、溜めた点と出す点が食い違う。
-- ============================================================

create table if not exists public.ranking_points (
    novel_id    uuid not null references public.novels(id) on delete cascade,

    /* daily / weekly / monthly / quarterly / yearly / all */
    period      text not null,

    /* 点。並べ替えに使う */
    points      numeric not null default 0,

    /* 内訳。画面に出す数 */
    like_count      integer not null default 0,
    bookmark_count  integer not null default 0,
    star_sum        integer not null default 0,
    view_count      integer not null default 0,
    continued_count integer not null default 0,

    updated_at  timestamptz not null default now(),

    primary key (novel_id, period)
);

/* 期間ごとに、点の高い順で引く */
create index if not exists ranking_points_period_idx
    on public.ranking_points (period, points desc);

comment on table public.ranking_points is
    'ランキングの点。期間ごとに溜めておく。画面はここを読むだけ';

/*
 * 決まり。
 *
 * ★ 読むのは誰でもよい。ランキングは公開のもの。
 * ★ 書くのは運営の鍵だけ。
 */
alter table public.ranking_points enable row level security;

drop policy if exists ranking_points_read on public.ranking_points;
create policy ranking_points_read
    on public.ranking_points for select
    to anon, authenticated
    using (true);

notify pgrst, 'reload schema';

-- ============================================================
-- 数え直す
--
-- ★ 期間を渡すと、その期間の点を数え直す。
--
--   select public.refresh_ranking_points('daily');
--
-- ★ 1 話も出していない作品は入れない。
--   押しても読むものがない。
--
-- ★ 作者自身と見回りの機械は、読まれた数から外す。
-- ============================================================

create or replace function public.refresh_ranking_points(target text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    since timestamptz;
    wrote integer;
begin
    /* その期間の始まり。all は全期間 */
    since := case target
        when 'daily'     then now() - interval '1 day'
        when 'weekly'    then now() - interval '7 days'
        when 'monthly'   then now() - interval '30 days'
        when 'quarterly' then now() - interval '90 days'
        when 'yearly'    then now() - interval '365 days'
        else '-infinity'::timestamptz
    end;

    /* いったん消して、入れ直す */
    delete from public.ranking_points where period = target;

    with 対象 as (
        select n.id
        from public.novels n
        where n.published = true
          and n.deleted_at is null
          and exists (
              select 1 from public.episodes e
              where e.novel_id = n.id and e.is_published
          )
    ),
    いいね as (
        select novel_id, count(*)::int as c
        from public.likes
        where created_at >= since
        group by novel_id
    ),
    保存 as (
        select novel_id, count(*)::int as c
        from public.bookmarks
        where created_at >= since
        group by novel_id
    ),
    /*
     * 星。1 人 1 話につき 5 まで。
     * 同じ人が同じ話に何度付けても、いちばん高いものだけ数える。
     */
    星 as (
        select novel_id, sum(best)::int as c
        from (
            select novel_id, user_id, episode_id,
                   least(5, max(rating)) as best
            from public.comments
            where rating is not null
              and created_at >= since
            group by novel_id, user_id, episode_id
        ) as t
        group by novel_id
    ),
    読まれた as (
        select e.novel_id, count(*)::int as c
        from public.page_views v
        join public.episodes e on e.id = v.episode_id
        where v.viewed_at >= since
          and v.is_author = false
          and (v.is_bot is null or v.is_bot = false)
        group by e.novel_id
    ),
    /*
     * 続けて読んだ人。同じ人が、その作品の 2 話以上を読んだ数。
     *
     * ★ 期間で絞る。
     *   日間なのに去年の記録まで数えると、
     *   「いま読まれている」を表さない。
     */
    続けて as (
        select novel_id, count(*)::int as c
        from (
            select novel_id, user_id
            from public.read_episodes
            where user_id is not null
              and created_at >= since
            group by novel_id, user_id
            having count(distinct episode_id) >= 2
        ) as t
        group by novel_id
    )
    insert into public.ranking_points (
        novel_id, period, points,
        like_count, bookmark_count, star_sum, view_count, continued_count
    )
    select
        対象.id,
        target,
        /*
         * ★ 画面と同じ重みにすること。
         *   片方だけ変えると、溜めた点と出す点が食い違う。
         */
        coalesce(星.c, 0) * 1
            + coalesce(いいね.c, 0) * 2
            + coalesce(保存.c, 0) * 2
            + round(coalesce(続けて.c, 0) * 1.3)
            + round(coalesce(読まれた.c, 0) * 0.2),
        coalesce(いいね.c, 0),
        coalesce(保存.c, 0),
        coalesce(星.c, 0),
        coalesce(読まれた.c, 0),
        coalesce(続けて.c, 0)
    from 対象
    left join いいね   on いいね.novel_id   = 対象.id
    left join 保存     on 保存.novel_id     = 対象.id
    left join 星       on 星.novel_id       = 対象.id
    left join 読まれた on 読まれた.novel_id = 対象.id
    left join 続けて   on 続けて.novel_id   = 対象.id;

    get diagnostics wrote = row_count;
    return wrote;
end;
$$;

-- ============================================================
-- 最初の一回。全部の期間を数える
-- ============================================================
select
    public.refresh_ranking_points('daily')     as 日間,
    public.refresh_ranking_points('weekly')    as 週間,
    public.refresh_ranking_points('monthly')   as 月間,
    public.refresh_ranking_points('quarterly') as 四半期,
    public.refresh_ranking_points('yearly')    as 年間,
    public.refresh_ranking_points('all')       as 累計;

-- ============================================================
-- 確認
-- ============================================================
select period as 期間, count(*) as 作品数,
       count(*) filter (where points > 0) as 点のあるもの
from public.ranking_points
group by period
order by period;
