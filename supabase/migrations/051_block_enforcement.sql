-- ============================================================
-- 原石航路 Studio
-- ブロックした相手から DM が届かないようにする
--
-- ------------------------------------------------------------
-- なぜ画面の側では作れないか
--
-- 「誰が自分をブロックしたか」は読めません。
-- 知られると報復を招くので、決まりの側で閉じてあります。
--
-- ブロックされた側の画面には、その情報がありません。
-- だから「送る前に確かめる」ができません。
--
-- 表の決まりで止めます。
-- ------------------------------------------------------------

/*
 * 相手にブロックされているか。
 *
 * security definer で作る。
 * そうしないと user_blocks の決まりに阻まれて、
 * 中を見られず、いつも false になる。
 *
 * 分かるのは「この相手にブロックされているか」だけ。
 * 誰にブロックされているかの一覧は出せない。
 */
create or replace function public.is_blocked_by(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.user_blocks
        where blocker_id = other
          and blocked_id = auth.uid()
    );
$$;

revoke all on function public.is_blocked_by(uuid) from public;
grant execute on function public.is_blocked_by(uuid) to authenticated;


/*
 * DM を送れない相手を決める。
 *
 * as restrictive で足す。
 * ふつうの決まりは「どれか 1 つ通れば通る」だが、
 * restrictive は「これも通らないと通さない」になる。
 *
 * いまある決まりの名前も中身も知らずに足せるので、
 * 既にある送信の決まりを壊さない。
 */
drop policy if exists direct_messages_not_blocked on public.direct_messages;

create policy direct_messages_not_blocked on public.direct_messages
    as restrictive
    for insert
    with check (
        not exists (
            select 1
            from public.conversations as c
            where c.id = direct_messages.conversation_id
              and public.is_blocked_by(
                  case when c.user_a = auth.uid() then c.user_b else c.user_a end
              )
        )
    );

notify pgrst, 'reload schema';


-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'is_blocked_by'
        )
        and exists (
            select 1 from pg_policy
            where polname = 'direct_messages_not_blocked'
        )
        then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
