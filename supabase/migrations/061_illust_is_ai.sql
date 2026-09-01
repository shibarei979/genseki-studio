-- ============================================================
-- 原石航路 Studio
-- 挿絵が AI で作られたかどうかの印
--
-- ------------------------------------------------------------
-- なぜ要るか
--
-- 表紙には既に cover_is_ai がある。
-- 話ごとの挿絵にも、同じ印を付けられるようにする。
--
-- ★ 印そのものは、作品ページの表紙と同じ絵を使う。
--   同じ意味の印が 2 通りあると、見た人が別のものだと思う。
-- ============================================================

alter table public.episodes
    add column if not exists illust_is_ai boolean not null default false;

comment on column public.episodes.illust_is_ai is
    '挿絵を AI で作ったか。読む画面で、絵の隅に印を出す';

notify pgrst, 'reload schema';


-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'episodes'
              and column_name = 'illust_is_ai'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
