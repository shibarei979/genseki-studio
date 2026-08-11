-- ============================================================
-- 原石航路 Studio
-- つぶやきの拡張
--
--   1. 返信への返信
--   2. アンケート
--   3. 通知（フォロー・いいね・返信）
--
-- 貼り付けの途中で消える記号は使っていない。
-- 何度実行しても壊れない。
-- ============================================================

do $$
begin
    if to_regclass('public.tweets') is null then
        raise exception 'tweets がありません。';
    end if;
end $$;


-- ------------------------------------------------------------
-- 1. 返信への返信
--
-- 返信の表に「どの返信への返信か」を持たせる。
-- 別の表を作ると、1 件のつぶやきに紐づくものが
-- 2 か所に散らばって数えにくくなる。
--
-- 深さは 1 段まで。返信の返信の返信は、元をたどれなくなる。
-- ------------------------------------------------------------
alter table public.tweet_comments
    add column if not exists parent_id uuid references public.tweet_comments(id) on delete cascade;

create index if not exists tweet_comments_parent_idx
    on public.tweet_comments (parent_id);


-- ------------------------------------------------------------
-- 2. アンケート
--
-- つぶやき 1 件に、選択肢を複数ぶら下げる。
-- 票は誰が何に入れたかを 1 行ずつ持つ。
-- 数だけ持つと、入れ直しができない。
-- ------------------------------------------------------------
create table if not exists public.tweet_poll_options (
    id         uuid primary key default gen_random_uuid(),
    tweet_id   uuid not null references public.tweets(id) on delete cascade,
    label      text not null default '',
    -- 並び順。書いた順に出す
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists tweet_poll_options_tweet_idx
    on public.tweet_poll_options (tweet_id, sort_order);

create table if not exists public.tweet_poll_votes (
    tweet_id   uuid not null references public.tweets(id) on delete cascade,
    option_id  uuid not null references public.tweet_poll_options(id) on delete cascade,
    user_id    uuid not null,
    created_at timestamptz not null default now(),
    -- 1 人 1 票。入れ直すときは、この行を書き換える
    primary key (tweet_id, user_id)
);

create index if not exists tweet_poll_votes_option_idx
    on public.tweet_poll_votes (option_id);

-- 締め切り。null なら締めない
alter table public.tweets
    add column if not exists poll_closes_at timestamptz;


-- ------------------------------------------------------------
-- 3. 読み書きの許可
-- ------------------------------------------------------------
alter table public.tweet_poll_options enable row level security;
alter table public.tweet_poll_votes   enable row level security;

drop policy if exists poll_options_read   on public.tweet_poll_options;
drop policy if exists poll_options_write  on public.tweet_poll_options;
drop policy if exists poll_votes_read     on public.tweet_poll_votes;
drop policy if exists poll_votes_write    on public.tweet_poll_votes;
drop policy if exists poll_votes_update   on public.tweet_poll_votes;
drop policy if exists poll_votes_delete   on public.tweet_poll_votes;

-- 選択肢は誰でも読める。作れるのは、そのつぶやきを書いた人
create policy poll_options_read
    on public.tweet_poll_options for select using (true);

create policy poll_options_write
    on public.tweet_poll_options for insert
    with check (exists (
        select 1 from public.tweets t
        where t.id = tweet_id and t.user_id = auth.uid()
    ));

-- 票は誰でも読める。数を出すため
create policy poll_votes_read
    on public.tweet_poll_votes for select using (true);

create policy poll_votes_write
    on public.tweet_poll_votes for insert
    with check (auth.uid() = user_id);

create policy poll_votes_update
    on public.tweet_poll_votes for update
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy poll_votes_delete
    on public.tweet_poll_votes for delete
    using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 4. 通知を自動で作る
--
-- 画面側から書くのではなく、表が変わったときに作る。
-- 画面側に任せると、書き忘れた経路だけ通知が来なくなる。
--
-- 自分の行いには通知しない。
-- 自分でいいねを押して自分に通知が来ても意味がない。
-- ------------------------------------------------------------

-- フォローされた
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer as $fn$
declare
    who text;
begin
    if new.follower_id = new.following_id then
        return new;
    end if;

    select display_name into who
    from public.profiles where user_id = new.follower_id;

    insert into public.notifications (user_id, type, message, link)
    values (
        new.following_id,
        'follow',
        concat(coalesce(who, '誰か'), ' さんにフォローされました'),
        concat('/author/', new.follower_id)
    );
    return new;
end $fn$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
    after insert on public.follows
    for each row execute function public.notify_on_follow();


-- つぶやきにいいねが付いた
create or replace function public.notify_on_tweet_like()
returns trigger language plpgsql security definer as $fn$
declare
    owner_id uuid;
    who text;
    body_text text;
begin
    select user_id, body into owner_id, body_text
    from public.tweets where id = new.tweet_id;

    if owner_id is null or owner_id = new.user_id then
        return new;
    end if;

    select display_name into who
    from public.profiles where user_id = new.user_id;

    insert into public.notifications (user_id, type, message, link)
    values (
        owner_id,
        'like',
        concat(coalesce(who, '誰か'), ' さんがあなたのつぶやきにいいねしました：', left(coalesce(body_text, ''), 20)),
        '/rooms'
    );
    return new;
end $fn$;

drop trigger if exists tweet_likes_notify on public.tweet_likes;
create trigger tweet_likes_notify
    after insert on public.tweet_likes
    for each row execute function public.notify_on_tweet_like();


-- つぶやきに返信が付いた
create or replace function public.notify_on_tweet_comment()
returns trigger language plpgsql security definer as $fn$
declare
    owner_id uuid;
    who text;
begin
    select user_id into owner_id
    from public.tweets where id = new.tweet_id;

    select display_name into who
    from public.profiles where user_id = new.user_id;

    -- つぶやいた人へ
    if owner_id is not null and owner_id <> new.user_id then
        insert into public.notifications (user_id, type, message, link)
        values (
            owner_id,
            'comment',
            concat(coalesce(who, '誰か'), ' さんが返信しました：', left(new.body, 20)),
            '/rooms'
        );
    end if;

    -- 返信の相手へ。つぶやいた人と同じなら送らない
    if new.parent_id is not null then
        declare
            parent_user uuid;
        begin
            select user_id into parent_user
            from public.tweet_comments where id = new.parent_id;

            if parent_user is not null
               and parent_user <> new.user_id
               and parent_user <> owner_id then
                insert into public.notifications (user_id, type, message, link)
                values (
                    parent_user,
                    'comment',
                    concat(coalesce(who, '誰か'), ' さんが返信しました：', left(new.body, 20)),
                    '/rooms'
                );
            end if;
        end;
    end if;

    return new;
end $fn$;

drop trigger if exists tweet_comments_notify on public.tweet_comments;
create trigger tweet_comments_notify
    after insert on public.tweet_comments
    for each row execute function public.notify_on_tweet_comment();


notify pgrst, 'reload schema';


-- ============================================================
-- 5. 確認
-- ============================================================
select
    '1_表' as 種類,
    t.name as 名前,
    case
        when to_regclass(format('public.%I', t.name)) is null then '無い ← 失敗'
        else 'ある'
    end as 状態
from (values ('tweet_poll_options'), ('tweet_poll_votes')) as t(name)

union all

select
    '2_列',
    concat(c.tbl, '.', c.col),
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = c.tbl and column_name = c.col
        ) then 'ある'
        else '無い ← 失敗'
    end
from (values
    ('tweet_comments', 'parent_id'),
    ('tweets', 'poll_closes_at')
) as c(tbl, col)

union all

select
    '3_通知の仕掛け',
    tgname,
    'ある'
from pg_trigger
where tgname in ('follows_notify', 'tweet_likes_notify', 'tweet_comments_notify')

order by 1, 2;
