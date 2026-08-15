-- ============================================================
-- 原石航路 Studio
-- 問い合わせほか、決まりの無い表に決まりを入れる
--
-- 症状:
--   お問い合わせフォームを送ると「送信失敗」になる。
--
-- 原因:
--   contact_messages に決まりが 1 つも無い。
--   RLS が効いている表で決まりが無いと、誰も読み書きできない。
--   つぶやきのいいねと同じ穴。
--
-- ついでに、同じ状態だった表もまとめて塞ぐ。
--
-- 何度実行しても壊れない。
-- ============================================================

do $$
begin
    -- ------------------------------------------------------------
    -- 問い合わせ
    --
    -- 送るのは誰でも（ログインしていない人からの報告も受ける）。
    -- 読むのは運営だけ。他人の問い合わせを見せない。
    -- ------------------------------------------------------------
    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='contact_messages' and policyname='contact_write') then
        create policy "contact_write" on public.contact_messages
        for insert to anon, authenticated with check (true);
    end if;

    if not exists (select 1 from pg_policies
        where schemaname='public' and tablename='contact_messages' and policyname='contact_admin') then
        create policy "contact_admin" on public.contact_messages
        for all to authenticated
        using (exists (select 1 from public.profiles p
                       where p.user_id = auth.uid() and p.is_admin = true))
        with check (exists (select 1 from public.profiles p
                            where p.user_id = auth.uid() and p.is_admin = true));
    end if;

    -- ------------------------------------------------------------
    -- コメントへのいいね
    -- 数を出すので読むのは誰でも。付け外しは自分のぶんだけ。
    -- ------------------------------------------------------------
    if to_regclass('public.comment_likes') is not null then
        if not exists (select 1 from pg_policies
            where schemaname='public' and tablename='comment_likes' and policyname='comment_likes_read') then
            create policy "comment_likes_read" on public.comment_likes
            for select to anon, authenticated using (true);
        end if;

        if not exists (select 1 from pg_policies
            where schemaname='public' and tablename='comment_likes' and policyname='comment_likes_write') then
            create policy "comment_likes_write" on public.comment_likes
            for insert to authenticated with check (auth.uid() = user_id);
        end if;

        if not exists (select 1 from pg_policies
            where schemaname='public' and tablename='comment_likes' and policyname='comment_likes_delete') then
            create policy "comment_likes_delete" on public.comment_likes
            for delete to authenticated using (auth.uid() = user_id);
        end if;
    end if;

    -- ------------------------------------------------------------
    -- 禁止語
    -- 投稿するとき照らし合わせるので、読むのは誰でも。
    -- 直せるのは運営だけ。
    -- ------------------------------------------------------------
    if to_regclass('public.ng_words') is not null then
        if not exists (select 1 from pg_policies
            where schemaname='public' and tablename='ng_words' and policyname='ng_words_read') then
            create policy "ng_words_read" on public.ng_words
            for select to anon, authenticated using (true);
        end if;

        if not exists (select 1 from pg_policies
            where schemaname='public' and tablename='ng_words' and policyname='ng_words_admin') then
            create policy "ng_words_admin" on public.ng_words
            for all to authenticated
            using (exists (select 1 from public.profiles p
                           where p.user_id = auth.uid() and p.is_admin = true))
            with check (exists (select 1 from public.profiles p
                                where p.user_id = auth.uid() and p.is_admin = true));
        end if;
    end if;

    -- ------------------------------------------------------------
    -- AI 審査
    -- 運営だけ。
    -- ------------------------------------------------------------
    if to_regclass('public.ai_reviews') is not null then
        if not exists (select 1 from pg_policies
            where schemaname='public' and tablename='ai_reviews' and policyname='ai_reviews_admin') then
            create policy "ai_reviews_admin" on public.ai_reviews
            for all to authenticated
            using (exists (select 1 from public.profiles p
                           where p.user_id = auth.uid() and p.is_admin = true))
            with check (exists (select 1 from public.profiles p
                                where p.user_id = auth.uid() and p.is_admin = true));
        end if;
    end if;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select tablename as 表, policyname as 決まりの名前, cmd as 何に効くか
from pg_policies
where schemaname='public'
  and tablename in ('contact_messages','comment_likes','ng_words','ai_reviews')
order by tablename, cmd, policyname;
