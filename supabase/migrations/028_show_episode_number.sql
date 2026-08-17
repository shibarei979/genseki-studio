-- ============================================================
-- 原石航路 Studio
-- 話の一覧で「第◯話」を出すかどうか
--
-- 「第3話　湖のほとり」の番号を消して、
-- 題名だけで並べたい人のため。
-- 執筆画面の一覧の見え方だけで、読者側は変わらない。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.work_display_settings
    add column if not exists show_episode_number boolean not null default true;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'work_display_settings'
              and column_name = 'show_episode_number'
        ) then '列は用意できました'
        else '列がありません ← 失敗'
    end as 状態;
