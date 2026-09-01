-- ============================================================
-- 原石航路 Studio
-- 栞の色
--
-- ------------------------------------------------------------
-- なぜ要るか
--
-- 栞は 1 話にいくつも挟める。
-- 全部同じ色だと、どれが何のための栞か分からない。
--
--   気になった台詞      桜
--   あとで読み返す場面   若草
--   続きから読む場所     山吹
--
-- 色で意味を分けられるようにする。
--
-- ★ はさむときに選ぶ。
--   あとから変えるより、その場で決めるほうが早い。
-- ============================================================

alter table public.episode_marks
    add column if not exists color text not null default 'yellow';

/*
 * 決められた 5 色以外を入れさせない。
 *
 * 入れられると、画面側で「どれでもない」場合の
 * 処理を書く羽目になる。
 */
alter table public.episode_marks
    drop constraint if exists episode_marks_color_check;

alter table public.episode_marks
    add constraint episode_marks_color_check
    check (color in ('yellow', 'sakura', 'wakaba', 'sora', 'fuji'));

comment on column public.episode_marks.color is
    '栞の色。yellow / sakura / wakaba / sora / fuji';

notify pgrst, 'reload schema';


-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'episode_marks'
              and column_name = 'color'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
