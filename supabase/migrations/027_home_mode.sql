-- ============================================================
-- 原石航路 Studio
-- 執筆に集中するモード
--
-- 数字や他の人の痕跡を隠して書けるようにする。
-- 消すのではなく、モードの間だけ隠す。切り替えれば戻る。
--
-- user_role は運営かどうかの権限に使っている列なので、
-- そこには入れない。別に持つ。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.profiles
    add column if not exists home_mode text;

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
              and column_name = 'home_mode'
        ) then '列は用意できました'
        else '列がありません ← 失敗'
    end as 状態;
