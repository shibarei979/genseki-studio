-- ============================================================
-- 原石航路 Studio
-- コミュニティー（つぶやきの拡張）
--
-- 貼り付けの途中で消える記号は使っていない。
--   縦棒 2 本 → format と concat
--   アスタリスク → count(1)、列名を明記
--
-- 何度実行しても壊れない。すでにあるものは飛ばす。
-- ============================================================


-- ------------------------------------------------------------
-- 0. 前提
-- ------------------------------------------------------------
do $$
begin
    if to_regclass('public.tweets') is null then
        raise exception
            'tweets がありません。つぶやきの表を先に作ってください。';
    end if;
end $$;


-- ------------------------------------------------------------
-- 1. テーマ
--
-- つぶやきに 1 つだけ付ける。
-- 複数付けられるようにすると、付ける側が迷う。
-- 迷った結果、誰も付けなくなる。
-- ------------------------------------------------------------
create table if not exists public.tweet_topics (
    key         text primary key,
    label       text not null,
    -- 並び順。小さいほど上
    sort_order  integer not null default 100,
    -- 運営だけが立てられる印。募集や告知に使う
    is_official boolean not null default false,
    created_at  timestamptz not null default now()
);

insert into public.tweet_topics (key, label, sort_order, is_official)
values
    ('chat',      '雑談',           10, false),
    ('trouble',   '創作の悩み',     20, false),
    ('plot',      'プロット・設定', 30, false),
    ('technique', '執筆テクニック', 40, false),
    ('favorite',  '推し・感想',     50, false),
    ('recruit',   '企画・募集',     60, false),
    ('other',     'その他',         90, false),
    ('notice',    'お知らせ',        5, true)
on conflict (key) do nothing;

-- つぶやき側にテーマを持たせる
alter table public.tweets
    add column if not exists topic text;


-- ------------------------------------------------------------
-- 2. ブックマーク
--
-- あとで読み返したいつぶやきを控える。
-- ------------------------------------------------------------
create table if not exists public.tweet_bookmarks (
    tweet_id   uuid not null references public.tweets(id) on delete cascade,
    user_id    uuid not null,
    created_at timestamptz not null default now(),
    primary key (tweet_id, user_id)
);

create index if not exists tweet_bookmarks_user_idx
    on public.tweet_bookmarks (user_id, created_at desc);


-- ------------------------------------------------------------
-- 3. 読み書きの許可
-- ------------------------------------------------------------
alter table public.tweet_topics    enable row level security;
alter table public.tweet_bookmarks enable row level security;

drop policy if exists tweet_topics_read      on public.tweet_topics;
drop policy if exists tweet_bookmarks_read   on public.tweet_bookmarks;
drop policy if exists tweet_bookmarks_write  on public.tweet_bookmarks;
drop policy if exists tweet_bookmarks_delete on public.tweet_bookmarks;

-- テーマは誰でも読める。増やすのは運営だけ
create policy tweet_topics_read
    on public.tweet_topics for select using (true);

-- 控えは自分のものだけ読み書きできる
create policy tweet_bookmarks_read
    on public.tweet_bookmarks for select
    using (auth.uid() = user_id);

create policy tweet_bookmarks_write
    on public.tweet_bookmarks for insert
    with check (auth.uid() = user_id);

create policy tweet_bookmarks_delete
    on public.tweet_bookmarks for delete
    using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 4. 表の一覧を作り直す
-- ------------------------------------------------------------
notify pgrst, 'reload schema';


-- ============================================================
-- 5. 確認
-- ============================================================
with
tables as (
    select
        '1_表' as 種類,
        t.name as 名前,
        case
            when to_regclass(format('public.%I', t.name)) is null
                then '無い ← 失敗'
            else 'ある'
        end as 状態
    from (values ('tweet_topics'), ('tweet_bookmarks'), ('tweets')) as t(name)
),
topic_col as (
    select
        '2_列' as 種類,
        'tweets.topic' as 名前,
        case
            when exists (
                select 1 from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'tweets'
                  and column_name = 'topic'
            ) then 'ある'
            else '無い ← 失敗'
        end as 状態
),
topics as (
    select
        '3_テーマ' as 種類,
        label as 名前,
        concat(sort_order, ' 番目') as 状態
    from public.tweet_topics
)
select 種類, 名前, 状態 from tables
union all select 種類, 名前, 状態 from topic_col
union all select 種類, 名前, 状態 from topics
order by 種類, 名前;
