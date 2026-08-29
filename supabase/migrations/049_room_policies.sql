-- ============================================================
-- 原石航路 Studio
-- 執筆室を、ログインした本人だけの記録にする
--
-- ★ コードを先に送ってください。
--
--   1  zip を送る（ログインしていない人は入れなくなる）
--   2  反映を待つ（1〜2分）
--   3  この SQL を流す        ← いまここ
--
--   先にこれを流すと、いまゲストで入っている人が
--   書けなくなり、理由の分からないエラーになります。
--
-- ------------------------------------------------------------
-- いま何が起きているか
--
--   room_members   読む・足す・書き換える・消す が全部 true
--   room_messages  読む・足す が true
--
--   誰でも他人を執筆室から追い出せる。
--   誰でも他人の名を騙って部屋の会話に書き込める。
--   部屋に入っていない人でも、中の会話が読める。
--   誰がどの部屋で何文字書いたかが、外から見える。
--
-- ------------------------------------------------------------
-- なぜ縛れなかったか
--
--   参加者の目印（member_id）が、ログインしていない人では
--   端末の中で作った適当な文字列でした。
--   本人かどうかを DB の側で確かめる手立てがありません。
--
--   コード側でログイン必須にしたので、
--   member_id は必ず本人の id になります。
--   ここで初めて縛れます。
-- ============================================================


-- ------------------------------------------------------------
-- 1  参加の記録は、本人だけが書ける
--
--    追い出せるのは、本人と部屋主と運営。
-- ------------------------------------------------------------
drop policy if exists room_members_write  on public.room_members;
drop policy if exists room_members_update on public.room_members;
drop policy if exists room_members_delete on public.room_members;

create policy room_members_write on public.room_members
    for insert
    with check (auth.uid()::text = member_id);

create policy room_members_update on public.room_members
    for update
    using      (auth.uid()::text = member_id)
    with check (auth.uid()::text = member_id);

/*
 * 出るのは本人。追い出せるのは部屋主と運営。
 *
 * 部屋主を含めないと、荒らしを追い出せない。
 * 誰でも追い出せるままにすると、荒らしの道具になる。
 */
create policy room_members_delete on public.room_members
    for delete
    using (
        auth.uid()::text = member_id
        or public.is_admin()
        or exists (
            select 1 from public.writing_rooms as r
            where r.id = room_members.room_id
              and r.host_id = auth.uid()::text
        )
    );


-- ------------------------------------------------------------
-- 2  会話は、本人の名前でしか書けない
-- ------------------------------------------------------------
drop policy if exists room_messages_write on public.room_messages;

create policy room_messages_write on public.room_messages
    for insert
    with check (auth.uid()::text = member_id);


-- ------------------------------------------------------------
-- 3  読むほうは、いまは変えない
--
--    room_members_read と room_messages_read は true のまま。
--
--    「部屋にいる人だけが読める」に絞りたいが、
--    room_messages の決まりから room_members を引くと、
--    room_members 側の決まりと絡んで
--    本人も読めなくなることがある。
--
--    書き込みを塞ぐほうが先。
--    読みは、動くことを確かめてから別に手を入れる。
-- ------------------------------------------------------------


notify pgrst, 'reload schema';


-- ============================================================
-- 確認
-- ============================================================
select
    c.relname                                      as 表,
    pol.polname                                    as 決まりの名前,
    case pol.polcmd
        when 'r' then '読む'   when 'a' then '足す'
        when 'w' then '書き換える' when 'd' then '消す'
        when '*' then 'すべて'
    end                                            as 対象,
    coalesce(
        pg_get_expr(pol.polwithcheck, pol.polrelid),
        pg_get_expr(pol.polqual,      pol.polrelid)
    )                                              as 条件
from pg_policy as pol
join pg_class as c on c.oid = pol.polrelid
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('room_members', 'room_messages')
order by c.relname, pol.polcmd;
