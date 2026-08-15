-- ============================================================
-- 原石航路 Studio
-- 個別のやりとりに、返信を足す
--
-- いまは運営から一方通行。
-- 受け取った人が返せるようにする。
--
-- 別の表を作らず、admin_messages に「誰から」を足す。
-- 別表にすると、一つのやりとりが 2 か所に分かれて
-- 順に並べるのが面倒になる。
--
-- 何度実行しても壊れない。
-- ============================================================

-- 誰が書いたか。null なら運営（今までのものは全部そう）
alter table public.admin_messages
    add column if not exists from_user_id uuid;

-- どのやりとりに属するか。最初の 1 通は自分自身が親
alter table public.admin_messages
    add column if not exists parent_id uuid;

-- 運営が読んだか（相手からの返信用）
alter table public.admin_messages
    add column if not exists read_by_admin boolean not null default false;

create index if not exists admin_messages_parent_idx
    on public.admin_messages (parent_id);

-- ------------------------------------------------------------
-- 本人が返信を書けるようにする
--
-- 自分あてのやりとりに、自分名義で足す場合だけ許す。
-- ------------------------------------------------------------
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'admin_messages'
          and policyname = 'admin_messages reply by owner'
    ) then
        create policy "admin_messages reply by owner"
        on public.admin_messages
        for insert
        to authenticated
        with check (
            from_user_id = auth.uid()
            and to_user_id = auth.uid()
        );
    end if;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'admin_messages'
              and column_name = 'from_user_id'
        ) then '列は用意できました'
        else '列がありません ← 失敗'
    end as 状態;
