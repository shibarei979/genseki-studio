-- ============================================================
-- 原石航路 Studio
-- 個別の便りを送れるようにする
--
-- 症状:
--   運営から個別の便りを送ると「送信に失敗しました」。
--
-- 原因:
--   admin_messages には書き込みの決まりが 1 つも無かった。
--   そこへ「本人の返信だけ許す」決まりを足したので、
--   それが唯一の許しになり、運営が他人あてに送る道が塞がった。
--
-- 直し:
--   運営が誰にでも送れる決まりを足す。
--   本人の返信の決まりはそのまま残す（両方あってよい。
--   insert はどれか 1 つを満たせば通る）。
--
-- 何度実行しても壊れない。
-- ============================================================

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'admin_messages'
          and policyname = 'admin_messages insert by admin'
    ) then
        create policy "admin_messages insert by admin"
        on public.admin_messages
        for insert
        to authenticated
        with check (
            exists (
                select 1 from public.profiles p
                where p.user_id = auth.uid() and p.is_admin = true
            )
        );
    end if;

    /* 運営は送ったものを読み返せる（届いたか確かめるため） */
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'admin_messages'
          and policyname = 'admin_messages read by admin'
    ) then
        create policy "admin_messages read by admin"
        on public.admin_messages
        for select
        to authenticated
        using (
            exists (
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
select policyname as 決まりの名前, cmd as 何に効くか
from pg_policies
where schemaname = 'public' and tablename = 'admin_messages'
order by cmd, policyname;
