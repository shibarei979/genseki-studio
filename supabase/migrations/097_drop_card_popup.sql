-- ============================================================
-- 原石航路 Studio
-- 作品を押したときの見せ方から「札」をやめる
--
-- ------------------------------------------------------------
-- 何をするか
--
-- 見せ方は 3 つあった。
--
--   card  札。あらすじやタグをまとめて出す小窓
--   book  本の見開き
--   none  小窓を出さず、そのまま作品の頁へ
--
-- 札をやめ、見開きと「出さない」の 2 つにする。
-- 札を選んでいた人と、まだ決めていない人は、見開きへ移す。
--
-- ------------------------------------------------------------
-- なぜ札をやめるか
--
-- 同じものを 2 通りに出す道具が 2 つあると、
-- 直すたびに両方を回ることになる。
-- 実際、あらすじの出し方を直すときも二重に手が要った。
--
-- 見開きのほうが読み物らしく、あらすじも長く読める。
-- ============================================================

update public.profiles
set work_popup_style = 'book'
where work_popup_style is null
   or work_popup_style = 'card';

/*
 * これから登録する人も見開きから始める。
 */
alter table public.profiles
    alter column work_popup_style set default 'book';

comment on column public.profiles.work_popup_style is
    '作品を押したときの見せ方。book（見開き）／ none（出さない）';

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    coalesce(work_popup_style, '（空）') as 見せ方,
    count(*) as 人数
from public.profiles
group by work_popup_style
order by 人数 desc;
