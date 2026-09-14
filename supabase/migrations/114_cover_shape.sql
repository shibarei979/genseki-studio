-- ============================================================
-- 原石航路 Studio
-- 表紙の形を、作者が選べるようにする
--
-- ------------------------------------------------------------
-- 何が起きているか
--
-- 作者用ホームの本棚は、縦長の本の形で固定していた。
-- 正方形や横長の表紙を作った人は、左右が落ちる。
--
--   「表紙四角と横長にもご対応いただけると嬉しいです。
--     ちょっと切ないことになっているので…」
--
-- ------------------------------------------------------------
-- どうするか
--
-- ★ 形を、作者が選ぶ。
--
--     tall    縦長（これまでどおり。本らしい形）
--     wide    横長
--
-- ★ 決めていなければ縦長。
--   いまの見え方を変えない。
--
-- ★ 棚の高さは変えない。
--   本ごとに高さが違うと、棚板が波打って見える。
--   高さは揃えたまま、幅だけ変える。
-- ============================================================

alter table public.novels
    add column if not exists cover_shape text not null default 'tall';

alter table public.novels
    drop constraint if exists novels_cover_shape_check;

alter table public.novels
    add constraint novels_cover_shape_check
    check (cover_shape in ('tall', 'wide'));

comment on column public.novels.cover_shape is
    '本棚での表紙の形。tall 縦長 / wide 横長';

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select column_name as 列, data_type as 型, column_default as 初めの値
from information_schema.columns
where table_schema = 'public' and table_name = 'novels'
  and column_name = 'cover_shape';
