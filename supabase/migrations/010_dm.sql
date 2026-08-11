-- ============================================================
-- 原石航路 Studio
-- DM（書き手どうしのやりとり）
--
-- 貼り付けの途中で消える記号は使っていない。
-- 何度実行しても壊れない。
--
-- ------------------------------------------------------------
-- 作りの考え方
--
-- 会話（conversations）と発言（direct_messages）に分ける。
-- 発言だけで持つと、まだ一言も交わしていない相手との
-- 「開いたが何も書いていない」状態を表せない。
--
-- 1 対 1 に絞る。3 人以上のやりとりは、
-- 誰が読んだかの管理が急に重くなる。
-- 必要になってから足す。
-- ============================================================

do $$
begin
    if to_regclass('public.profiles') is null then
        raise exception 'profiles がありません。先に 002 を流してください。';
    end if;
end $$;


-- ------------------------------------------------------------
-- 1. 会話
--
-- 2 人ぶんの id を持つ。
-- 同じ 2 人で会話が 2 つできないよう、
-- 小さいほうを user_a に入れる決まりにする。
-- ------------------------------------------------------------
create table if not exists public.conversations (
    id         uuid primary key default gen_random_uuid(),
    user_a     uuid not null,
    user_b     uuid not null,
    -- 一覧を新しい順に並べるため、最後の発言の時刻を持つ
    last_at    timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint conversations_pair unique (user_a, user_b),
    constraint conversations_order check (user_a < user_b)
);

create index if not exists conversations_a_idx
    on public.conversations (user_a, last_at desc);
create index if not exists conversations_b_idx
    on public.conversations (user_b, last_at desc);


-- ------------------------------------------------------------
-- 2. 発言
-- ------------------------------------------------------------
create table if not exists public.direct_messages (
    id              uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_id       uuid not null,
    body            text not null default '',
    is_read         boolean not null default false,
    created_at      timestamptz not null default now()
);

create index if not exists direct_messages_conv_idx
    on public.direct_messages (conversation_id, created_at);


-- ------------------------------------------------------------
-- 3. 読み書きの許可
--
-- 会話に入っている 2 人だけが読める。
-- ------------------------------------------------------------
alter table public.conversations   enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists conversations_read   on public.conversations;
drop policy if exists conversations_write  on public.conversations;
drop policy if exists conversations_update on public.conversations;
drop policy if exists dm_read              on public.direct_messages;
drop policy if exists dm_write             on public.direct_messages;
drop policy if exists dm_update            on public.direct_messages;

create policy conversations_read on public.conversations for select
    using (auth.uid() = user_a or auth.uid() = user_b);

create policy conversations_write on public.conversations for insert
    with check (auth.uid() = user_a or auth.uid() = user_b);

create policy conversations_update on public.conversations for update
    using (auth.uid() = user_a or auth.uid() = user_b);

create policy dm_read on public.direct_messages for select
    using (exists (
        select 1 from public.conversations c
        where c.id = conversation_id
          and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    ));

create policy dm_write on public.direct_messages for insert
    with check (auth.uid() = sender_id and exists (
        select 1 from public.conversations c
        where c.id = conversation_id
          and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    ));

-- 既読を付けるのは、受け取った側
create policy dm_update on public.direct_messages for update
    using (exists (
        select 1 from public.conversations c
        where c.id = conversation_id
          and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    ));


-- ------------------------------------------------------------
-- 4. 通知が誰でも読めないようにする
--
-- 002 で表は作ったが、許可を入れていなかった可能性がある。
-- ------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_read   on public.notifications;
drop policy if exists notifications_update on public.notifications;

create policy notifications_read on public.notifications for select
    using (auth.uid() = user_id);

create policy notifications_update on public.notifications for update
    using (auth.uid() = user_id);


notify pgrst, 'reload schema';


-- ============================================================
-- 5. 確認
-- ============================================================
select
    '表' as 種類,
    t.name as 名前,
    case
        when to_regclass(format('public.%I', t.name)) is null then '無い ← 失敗'
        else 'ある'
    end as 状態
from (values ('conversations'), ('direct_messages'), ('notifications')) as t(name)

union all

select
    '許可',
    tablename,
    concat(count(1), ' 個')
from pg_policies
where schemaname = 'public'
  and tablename in ('conversations', 'direct_messages', 'notifications')
group by tablename

order by 1, 2;
