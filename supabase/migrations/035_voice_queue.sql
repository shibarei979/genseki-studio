-- ============================================================
-- 原石航路 Studio
-- AI 朗読を、裏で少しずつ作る
--
-- これまでは、読者が押したときに作っていた。
-- 待たせるうえ、費用がいつ出るか読めない。
--
-- これからは裏で作り置きし、
-- できた話にだけ「聴く」を出す。
--
-- 1 日 3 万字ずつ、投稿の古い順に進める。
-- 声は 2 つ（女性A・男性A）。
--   1 話 8,000 字 × 2 声 = 16,000 字
--   1 日 2 話ほど、1 か月で 56 話ほど
--
-- 何度実行しても壊れない。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 作る順番の記録
--
-- どこまで進んだかを覚えておく。
-- 途中で止まっても、続きから再開できる。
-- ------------------------------------------------------------
create table if not exists public.voice_queue (
    episode_id uuid primary key,

    /* 投稿された日時。この順に作る */
    published_at timestamptz,

    /* 何字あるか。1 日の上限を計るのに使う */
    char_count integer not null default 0,

    /*
     * 作れたか。
     *   waiting  まだ
     *   done     できた
     *   skipped  短すぎる・本文が無いなど
     *   failed   作れなかった
     */
    status text not null default 'waiting',

    /* 作った日時 */
    processed_at timestamptz,
    /* 作れなかったときの理由 */
    error text,

    created_at timestamptz not null default now()
);

create index if not exists voice_queue_order_idx
    on public.voice_queue (status, published_at);

-- ------------------------------------------------------------
-- 2. いまある話を、順番待ちに入れる
--
-- 公開されていて、本文のある話だけ。
-- すでに入っているものは飛ばす。
-- ------------------------------------------------------------
insert into public.voice_queue (episode_id, published_at, char_count)
select
    e.id,
    coalesce(e.published_at, e.created_at),
    coalesce(length(e.body), 0)
from public.episodes e
where (e.is_published = true or e.published = true)
  and coalesce(length(e.body), 0) >= 200
on conflict (episode_id) do nothing;

-- ------------------------------------------------------------
-- 3. すでに音声のある話は、できた扱いにする
-- ------------------------------------------------------------
update public.voice_queue q
set status = 'done', processed_at = now()
where q.status = 'waiting'
  and exists (
      select 1 from public.episode_voices v
      where v.episode_id = q.episode_id
  );

-- ------------------------------------------------------------
-- 4. 決まりごと
-- ------------------------------------------------------------
alter table public.voice_queue enable row level security;

/* できたかどうかは、誰でも読める（聴けるか出すのに要る） */
drop policy if exists voice_queue_select on public.voice_queue;
create policy voice_queue_select on public.voice_queue
    for select using (true);

/* 書けるのはサーバーだけ */
grant select, insert, update on public.voice_queue to service_role;
grant select on public.voice_queue to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    status as 状態,
    count(*) as 話数,
    sum(char_count) as 字数
from public.voice_queue
group by status
order by status;
