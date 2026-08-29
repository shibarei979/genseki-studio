-- ============================================================
-- 原石航路 Studio
-- つぶやきを、書いた本人だけが直せるようにする
--
-- ------------------------------------------------------------
-- なぜ「修正済み」を出すか
--
-- 直せるようにするだけだと、あとから中身を書き換えて
-- 「そんなことは言っていない」と言えてしまう。
--
-- 返信やいいねが付いたあとに書き換えられると、
-- 読んだ人の記憶と食い違う。
--
-- 直した事実は残す。中身は変えてよいが、
-- 変えたことは隠さない。
-- ============================================================

alter table public.tweets
    add column if not exists edited_at timestamptz;

/*
 * 直せるのは書いた本人だけ。
 *
 * user_id は書き換えさせない。
 * 変えられると、他人の投稿にできてしまう。
 */
drop policy if exists tweets_update on public.tweets;

create policy tweets_update on public.tweets
    for update
    using      (auth.uid() = user_id)
    with check (auth.uid() = user_id);

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'tweets'
              and column_name = 'edited_at'
        )
        and exists (
            select 1 from pg_policy where polname = 'tweets_update'
        )
        then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
