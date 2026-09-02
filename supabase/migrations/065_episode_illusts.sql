-- ============================================================
-- 原石航路 Studio
-- 挿絵（話の中の好きな場所へ）
--
-- ------------------------------------------------------------
-- 何をするものか
--
-- これまで挿絵は 1 話に 1 枚、本文の頭に固定だった。
-- ここから先は、何枚でも、好きな場所へ置ける。
--
-- ★ 場所は「何文目の後ろか」で持つ。
--
--   行ではなく文で数える。
--   本文は縦書きでも横書きでも、画面の幅で行が変わる。
--   文なら、どこで見ても同じ場所を指す。
--   付箋（episode_marks）と同じ数え方にしてある。
--
--   0 は「本文の頭」。これまでと同じ置き方。
--
-- ★ そのときの文も一緒に控える。
--
--   作者が前のほうに文を足すと、番号がずれる。
--   控えた文を新しい本文から探し直して、番号を付け替える。
--   見つからなければ、その場に残す。
-- ============================================================

create table if not exists public.episode_illusts (
    id          uuid primary key default gen_random_uuid(),

    novel_id    uuid not null references public.novels(id)   on delete cascade,
    episode_id  uuid not null references public.episodes(id) on delete cascade,

    /* 絵の置き場所 */
    url         text not null,

    /* AI で作った絵かどうか。読む人に示す印になる */
    is_ai       boolean not null default false,

    /* 何文目の後ろに置くか。0 は本文の頭 */
    after_sentence integer not null default 0,

    /* 置いたときの、その文。ずれを直すために控える */
    anchor_text text not null default '',

    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

/* 話を開いたとき、その話ぶんを置き場所の順に読む */
create index if not exists episode_illusts_by_episode
    on public.episode_illusts (episode_id, after_sentence);

alter table public.episode_illusts enable row level security;

/*
 * 読むのは誰でも。
 *
 * 挿絵は本文と同じく、読者に見せるもの。
 * 本文が読めるなら、絵も読めなければ意味がない。
 */
drop policy if exists episode_illusts_read on public.episode_illusts;
create policy episode_illusts_read on public.episode_illusts
    for select
    using (true);

/* 書き換えられるのは、その作品の作者と運営だけ */
drop policy if exists episode_illusts_write on public.episode_illusts;
create policy episode_illusts_write on public.episode_illusts
    for all
    using (
        exists (
            select 1
            from public.novels as n
            where n.id = episode_illusts.novel_id
              and n.author_id = auth.uid()
        )
        or public.is_admin()
    )
    with check (
        exists (
            select 1
            from public.novels as n
            where n.id = episode_illusts.novel_id
              and n.author_id = auth.uid()
        )
    );

grant select on public.episode_illusts to anon;
grant select on public.episode_illusts to service_role;
grant select, insert, update, delete on public.episode_illusts to authenticated;

-- ------------------------------------------------------------
-- いまある 1 枚を、この表へ移す
--
-- ★ episodes.illust_url は消さない。
--
--   消すと、古い画面から見たときに挿絵が丸ごと消える。
--   新しい画面が行き渡るまで、両方を残しておく。
--   読む側は、この表にあればそちらを使う。
-- ------------------------------------------------------------
insert into public.episode_illusts (novel_id, episode_id, url, is_ai, after_sentence)
select e.novel_id, e.id, e.illust_url, coalesce(e.illust_is_ai, false), 0
from public.episodes as e
where e.illust_url is not null
  and e.illust_url <> ''
  and not exists (
      select 1 from public.episode_illusts as i where i.episode_id = e.id
  );

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'episode_illusts'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態,
    (select count(*) from public.episode_illusts) as 移した枚数;
