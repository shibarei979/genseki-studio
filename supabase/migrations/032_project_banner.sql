-- ============================================================
-- 原石航路 Studio
-- 自主企画に画像の欄を足す
--
-- 任意。無くても企画は立てられる。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.projects
    add column if not exists banner_url text;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'banner_url'
        ) then '画像の欄を用意できました'
        else '欄がありません ← 失敗'
    end as 状態;
