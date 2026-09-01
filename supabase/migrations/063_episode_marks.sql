-- ============================================================
-- 原石航路 Studio
-- 付箋（話の中のしおり）
--
-- ------------------------------------------------------------
-- 何をするものか
--
-- 読んでいる途中の文に、しるしを付けておく。
-- あとで押すと、その場所へ戻れる。
--
-- ★ 1 話に何枚でも置ける。
--   気になった台詞、あとで読み返したい場面、
--   続きから読む場所。用途がいくつもある。
--
-- ★ 表に保存する。
--   端末に覚えると、携帯で付けた付箋が
--   パソコンで見えない。
-- ============================================================

create table if not exists public.episode_marks (
    id          uuid primary key default gen_random_uuid(),

    user_id     uuid not null references auth.users(id) on delete cascade,
    novel_id    uuid not null references public.novels(id) on delete cascade,
    episode_id  uuid not null references public.episodes(id) on delete cascade,

    /*
     * 何文目か。
     *
     * ★ 行ではなく文で数える。
     *   本文は縦書きでも横書きでも、
     *   画面の幅で行が変わる。
     *   文なら、どこで見ても同じ場所を指す。
     */
    sentence    integer not null,

    /*
     * そのときの文。
     *
     * ★ 番号だけでは足りない。
     *
     *   作者が前のほうに文を足すと、番号がずれる。
     *   照らし合わせて、違っていたら
     *   「その文はもうありません」と伝える。
     */
    text        text not null default '',

    created_at  timestamptz not null default now()
);

/* 同じ文に二重に付けない */
create unique index if not exists episode_marks_unique
    on public.episode_marks (user_id, episode_id, sentence);

/* 話を開いたとき、その話ぶんをまとめて読む */
create index if not exists episode_marks_by_episode
    on public.episode_marks (user_id, episode_id);

/* マイページで、付けた順に並べる */
create index if not exists episode_marks_by_user
    on public.episode_marks (user_id, created_at desc);

alter table public.episode_marks enable row level security;

/*
 * 自分の付箋だけ。
 *
 * 付箋は読んだ跡なので、
 * 誰がどこに付けたかは他人に見せない。
 */
drop policy if exists episode_marks_all on public.episode_marks;
create policy episode_marks_all on public.episode_marks
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

grant select, insert, update, delete on public.episode_marks to authenticated;

notify pgrst, 'reload schema';


-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'episode_marks'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
