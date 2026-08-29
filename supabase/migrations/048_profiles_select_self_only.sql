-- ============================================================
-- 原石航路 Studio
-- 【2つめ】profiles を本人と運営だけに閉じる
--
-- ★ 順番があります。
--
--   1  「1つめ」の SQL を流す（公開用の見え方を作る）
--   2  コードを送る（他人の名前は見え方から読むようになる）
--   3  この SQL を流す        ← いまここ
--
--   先にこれを流すと、作品ページの作者名、
--   コメントの名前とアイコン、作品検索の作者名が
--   すべて消えます。
--
-- ------------------------------------------------------------
-- 何を直すか
--
--   前   profiles_select   読む   誰に {}   読む条件 true
--   後   profiles_select   読む   本人と運営だけ
--
-- 「誰に {}」は全員の意味でした。
-- ログインしていない人でも、公開鍵ひとつで
-- 全員分の email・生年月日・管理者かどうかが読めていました。
-- ============================================================

/*
 * 本人と運営だけが読める。
 *
 * 運営の分は profiles_admin_read が別に持っているが、
 * ここにも入れておく。片方を消したときに
 * 運営が自分の一覧を見られなくなるのを防ぐ。
 */
drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles
    for select
    using (auth.uid() = user_id or public.is_admin());

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================

/* 読む条件が true のものが残っていないこと */
select
    pol.polname                                as 決まりの名前,
    pg_get_expr(pol.polqual, pol.polrelid)     as 読む条件,
    case
        when pg_get_expr(pol.polqual, pol.polrelid) = 'true'
        then '素通し ← 直っていません'
        else 'よい'
    end                                        as 判定
from pg_policy as pol
join pg_class as c on c.oid = pol.polrelid
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'profiles'
  and pol.polcmd in ('r', '*');

/* 外に出ている列に、隠すべきものが混ざっていないこと */
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'public_profiles'
              and column_name in ('email', 'birthdate', 'login_provider',
                                  'is_admin', 'user_role', 'gender')
        ) then '危険 ← 見え方に隠すべき列が入っています'
        else '用意できました'
    end as 状態;
