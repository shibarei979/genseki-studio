-- ============================================================
-- 原石航路 Studio
-- 運営からのお知らせを、本人が読めるようにする
--
-- これまで送る側（運営）しか無かったので、
-- 本人が読む許可が付いていない可能性がある。
--
-- 何度実行しても壊れない。
-- ============================================================

do $$
begin
    if to_regclass('public.admin_messages') is null then
        raise exception 'admin_messages がありません。';
    end if;
end $$;

alter table public.admin_messages enable row level security;

drop policy if exists admin_messages_read_own   on public.admin_messages;
drop policy if exists admin_messages_update_own on public.admin_messages;

-- 自分あてのものだけ読める
create policy admin_messages_read_own
    on public.admin_messages for select
    using (auth.uid() = to_user_id);

-- 読んだ印を付けられる。
-- 他の列まで書き換えられないよう、宛先が自分であることを両側で確かめる。
create policy admin_messages_update_own
    on public.admin_messages for update
    using (auth.uid() = to_user_id)
    with check (auth.uid() = to_user_id);

notify pgrst, 'reload schema';

-- 確認
select
    '許可' as 種類,
    cmd as 対象,
    policyname as 決まり
from pg_policies
where schemaname = 'public'
  and tablename = 'admin_messages'
order by cmd, policyname;
