-- ============================================================
-- 原石航路 Studio
-- つぶやきまわりの決まりを入れる
--
-- 症状:
--   いいねを押しても、読み直すと外れている。
--   つぶやきを消しても消えない。
--
-- 原因:
--   tweets・tweet_likes・tweet_comments に決まりが 1 つも無い。
--   RLS が効いている表で決まりが無いと、誰も読み書きできない。
--   （tweet_bookmarks だけは入っていた）
--
-- 方針:
--   読むのは誰でも。つぶやきは見せるためのもの。
--   書き足す・消すのは本人だけ。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.tweets          enable row level security;
alter table public.tweet_likes     enable row level security;
alter table public.tweet_comments  enable row level security;

do $$
begin
    -- ------------------------------------------------------------
    -- つぶやき
    -- ------------------------------------------------------------
    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweets' and policyname='tweets_read') then
        create policy "tweets_read" on public.tweets
        for select to anon, authenticated using (true);
    end if;

    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweets' and policyname='tweets_write') then
        create policy "tweets_write" on public.tweets
        for insert to authenticated with check (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweets' and policyname='tweets_update_own') then
        create policy "tweets_update_own" on public.tweets
        for update to authenticated
        using (auth.uid() = user_id) with check (auth.uid() = user_id);
    end if;

    /* 消せるのは本人と運営。運営は荒れたものを片づける必要がある */
    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweets' and policyname='tweets_delete_own') then
        create policy "tweets_delete_own" on public.tweets
        for delete to authenticated
        using (
            auth.uid() = user_id
            or exists (
                select 1 from public.profiles p
                where p.user_id = auth.uid() and p.is_admin = true
            )
        );
    end if;

    -- ------------------------------------------------------------
    -- いいね
    --
    -- 数を出すので、読むのは誰でも。
    -- 付ける・外すは自分のぶんだけ。
    -- ------------------------------------------------------------
    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweet_likes' and policyname='tweet_likes_read') then
        create policy "tweet_likes_read" on public.tweet_likes
        for select to anon, authenticated using (true);
    end if;

    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweet_likes' and policyname='tweet_likes_write') then
        create policy "tweet_likes_write" on public.tweet_likes
        for insert to authenticated with check (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweet_likes' and policyname='tweet_likes_delete') then
        create policy "tweet_likes_delete" on public.tweet_likes
        for delete to authenticated using (auth.uid() = user_id);
    end if;

    -- ------------------------------------------------------------
    -- 返信
    -- ------------------------------------------------------------
    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweet_comments' and policyname='tweet_comments_read') then
        create policy "tweet_comments_read" on public.tweet_comments
        for select to anon, authenticated using (true);
    end if;

    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweet_comments' and policyname='tweet_comments_write') then
        create policy "tweet_comments_write" on public.tweet_comments
        for insert to authenticated with check (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='tweet_comments' and policyname='tweet_comments_delete_own') then
        create policy "tweet_comments_delete_own" on public.tweet_comments
        for delete to authenticated
        using (
            auth.uid() = user_id
            or exists (
                select 1 from public.profiles p
                where p.user_id = auth.uid() and p.is_admin = true
            )
        );
    end if;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select tablename as 表, policyname as 決まりの名前, cmd as 何に効くか
from pg_policies
where schemaname = 'public'
  and tablename in ('tweets', 'tweet_likes', 'tweet_comments', 'tweet_bookmarks')
order by tablename, cmd, policyname;
