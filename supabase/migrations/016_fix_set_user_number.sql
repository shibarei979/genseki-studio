-- ============================================================
-- 原石航路 Studio
-- 新規登録が落ちるのを直す
--
-- 症状:
--   X で初めてログインすると合鍵が発行されず、
--   ログイン画面へ戻される（no-session）。
--   Auth Logs には
--     relation "profiles" does not exist
--   と残る。
--
-- 原因:
--   set_user_number() の中で profiles を裸で書いている。
--   この関数は SECURITY DEFINER の引き金から呼ばれるため、
--   検索経路が固定されず、名前だけでは表を見つけられない。
--
--   Google と GitHub で気づかなかったのは、
--   既にいる利用者として入っていて
--   新規作成の引き金が動かなかったため。
--   メールでの新規登録も同じ穴に落ちる。
--
-- 直し:
--   public. を付け、検索経路も固定する。
--   ついでに番号の振り方も競争に強くする
--   （同時に 2 人が登録すると同じ番号になり得た）。
--
-- 何度実行しても壊れない。
-- ============================================================

create or replace function public.set_user_number()
returns trigger
language plpgsql
-- 呼ばれ方によらず public を見る
set search_path = public
as $function$
begin
    /*
     * 番号が既に入っていれば触らない。
     * 移行などで自分で番号を決めたいときのため。
     */
    if new.user_number is not null then
        return new;
    end if;

    /*
     * 表を名指しで押さえてから数える。
     * 押さえないと、同時に 2 人が登録したとき
     * 同じ番号を配ってしまう。
     */
    lock table public.profiles in exclusive mode;

    select coalesce(max(user_number), 0) + 1
      into new.user_number
      from public.profiles;

    return new;
end;
$function$;

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when pg_get_functiondef('public.set_user_number()'::regprocedure)
             like '%from public.profiles%'
        then '直りました'
        else '直っていません ← 見せてください'
    end as 状態;
