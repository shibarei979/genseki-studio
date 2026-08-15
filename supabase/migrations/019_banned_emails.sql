-- ============================================================
-- 原石航路 Studio
-- BAN の記録
--
-- BAN したメールアドレスを覚えておく。
-- 覚えないと、消して作り直せば戻ってこられる。
--
-- 住所そのものではなく、伏せた形（ハッシュ）でも持てるが、
-- 運営が「誰を BAN したか」を確かめられなくなるので、
-- ここは住所のまま持つ。読めるのは運営だけにする。
--
-- 何度実行しても壊れない。
-- ============================================================

create table if not exists public.banned_emails (
    email       text primary key,
    reason      text,
    banned_at   timestamptz not null default now(),
    banned_by   uuid
);

alter table public.banned_emails enable row level security;

-- 読み書きは運営だけ。ふつうの人からは触れない
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'banned_emails'
          and policyname = 'banned_emails admin only'
    ) then
        create policy "banned_emails admin only"
        on public.banned_emails
        for all
        to authenticated
        using (
            exists (
                select 1 from public.profiles p
                where p.user_id = auth.uid() and p.is_admin = true
            )
        )
        with check (
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
select
    case
        when to_regclass('public.banned_emails') is not null
        then '表は用意できました'
        else '表がありません ← 失敗'
    end as 状態;
