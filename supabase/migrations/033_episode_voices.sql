-- ============================================================
-- 原石航路 Studio
-- AI 音声（Google WaveNet）
--
-- 作った音声は保存して使い回す。
-- 同じ話・同じ声なら 1 回だけ作り、2 人目からは無料。
--
-- あわせて、使った字数を記録する。
-- 無料枠（月 100 万字）に近づいたら止めるため。
--
-- 何度実行しても壊れない。
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. 作った音声
-- ------------------------------------------------------------
create table if not exists public.episode_voices (
    id uuid primary key default gen_random_uuid(),

    episode_id uuid not null,
    /* ja-JP-Wavenet-A など */
    voice text not null,

    /* 保存先の道 */
    audio_path text not null,
    /* 作ったときの字数。集計に使う */
    char_count integer not null default 0,

    created_at timestamptz not null default now()
);

/* 同じ話・同じ声は 1 つだけ */
create unique index if not exists episode_voices_key
    on public.episode_voices (episode_id, voice);

-- ------------------------------------------------------------
-- 2. 使った字数
--
-- 月ごとに 1 行。無料枠の残りを見るのに使う。
-- ------------------------------------------------------------
create table if not exists public.voice_usage (
    /* YYYY-MM */
    month text primary key,
    char_count bigint not null default 0,
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. 誰がいつ使ったか
--
-- 1 人あたりの回数を数えるのに使う。
-- ------------------------------------------------------------
create table if not exists public.voice_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    episode_id uuid not null,
    voice text not null,
    created_at timestamptz not null default now()
);

create index if not exists voice_requests_user_idx
    on public.voice_requests (user_id, created_at desc);

-- ------------------------------------------------------------
-- 4. 決まりごと（RLS）
-- ------------------------------------------------------------
alter table public.episode_voices enable row level security;
alter table public.voice_usage enable row level security;
alter table public.voice_requests enable row level security;

/* 音声は誰でも読める。作るのはサーバーだけ */
drop policy if exists episode_voices_select on public.episode_voices;
create policy episode_voices_select on public.episode_voices
    for select using (true);

/* 使った量は自分の分だけ読める */
drop policy if exists voice_requests_select on public.voice_requests;
create policy voice_requests_select on public.voice_requests
    for select using (user_id = auth.uid());

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when (select count(*) from information_schema.tables
               where table_schema = 'public'
                 and table_name in ('episode_voices','voice_usage','voice_requests')) = 3
        then 'AI音声の置き場を用意できました'
        else '足りない表があります ← 失敗'
    end as 状態;
