-- ============================================================
-- 原石航路 Studio
-- X の連携
--
-- 作者ページから、その人の X へ飛べるようにする。
-- 持つのは「@なしの id」1 つだけ。
-- URL ごと持つと、http と https や余計な問い符が混ざる。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.profiles
    add column if not exists x_account text;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'profiles'
              and column_name = 'x_account'
        ) then '列は用意できました'
        else '列がありません ← 失敗'
    end as 状態;
