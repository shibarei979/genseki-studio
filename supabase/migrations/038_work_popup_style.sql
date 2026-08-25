-- ============================================================
-- 原石航路 Studio
-- 作品を押したときの見せ方を覚える
--
-- 札（情報が多く、すぐ読める）か、
-- 本の見開き（読み物らしい）かを選べるようにする。
--
-- 決めていない人は札。
-- 初めて来た人には、情報が多いほうが親切。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.profiles
    add column if not exists work_popup_style text default 'card';

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
              and column_name = 'work_popup_style'
        ) then '作品の見せ方を覚える欄を用意できました'
        else '欄がありません ← 失敗'
    end as 状態;
