-- ============================================================
-- 原石航路 Studio
-- 公開設定の、足りない列を足す
--
-- ------------------------------------------------------------
-- 何が起きていたか
--
-- 投稿画面の右側にある設定を押しても、何も起きない。
-- 「承認後に公開」を選んでも、すべて公開のままになる。
--
-- ------------------------------------------------------------
-- なぜ起きたか
--
-- 画面には項目が並んでいるのに、
-- 表には入れる場所が無かった。
--
--   あった   allow_comments / allow_likes
--   無かった moderate_comments
--
-- 保存する側も、この 2 つしか書いていなかった。
-- 押した内容は、どこにも残らずに消えていた。
--
-- ------------------------------------------------------------
-- moderate_comments とは
--
-- コメントを、作者が見てから公開するかどうか。
--
--   false  書かれたらすぐ出る（これまでどおり）
--   true   作者が認めるまで出ない
--
-- ★ 既定は false。
--   いまの作品の見え方を変えない。
-- ============================================================

alter table public.novels
    add column if not exists moderate_comments boolean not null default false;

comment on column public.novels.moderate_comments is
    'コメントを、作者が認めてから公開するか。false なら書かれたらすぐ出る';

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select column_name as 列, data_type as 型, column_default as 初めの値
from information_schema.columns
where table_schema = 'public' and table_name = 'novels'
  and column_name in ('allow_comments', 'allow_likes', 'moderate_comments')
order by column_name;
