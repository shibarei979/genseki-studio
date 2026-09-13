-- ============================================================
-- 原石航路 Studio
-- 知らせの設定を入れる列を足す
--
-- ------------------------------------------------------------
-- 何が起きていたか
--
-- 作品の公開設定に、こういう項目が並んでいる。
--
--   フォロワーに知らせる
--   公開したときに知らせる
--   知らせる時機（すぐ／まとめて／知らせない）
--
-- ところが表に入れる場所が無く、押しても消えていた。
--
-- ------------------------------------------------------------
-- それぞれの意味
--
-- ★ notify_followers
--   この作品の更新を、フォロワーに知らせるか。
--   切ると、静かに出せる。
--
-- ★ notify_on_publish
--   話を公開したときに知らせるか。
--   予約投稿で出たときも含む。
--
-- ★ notify_timing
--   immediate  出たらすぐ
--   daily      その日のぶんをまとめて
--   none       知らせない
--
-- ★ 既定は「知らせる・すぐ」。
--   いまの動きを変えない。
-- ============================================================

alter table public.novels
    add column if not exists notify_followers boolean not null default true;

alter table public.novels
    add column if not exists notify_on_publish boolean not null default true;

alter table public.novels
    add column if not exists notify_timing text not null default 'immediate';

alter table public.novels
    drop constraint if exists novels_notify_timing_check;

alter table public.novels
    add constraint novels_notify_timing_check
    check (notify_timing in ('immediate', 'daily', 'none'));

comment on column public.novels.notify_followers is
    'この作品の更新を、フォロワーに知らせるか';
comment on column public.novels.notify_on_publish is
    '話を公開したときに知らせるか';
comment on column public.novels.notify_timing is
    '知らせる時機。immediate すぐ / daily まとめて / none 知らせない';

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select column_name as 列, data_type as 型, column_default as 初めの値
from information_schema.columns
where table_schema = 'public' and table_name = 'novels'
  and column_name in (
    'allow_bookmarks', 'allow_comments', 'allow_likes', 'allow_shares',
    'moderate_comments', 'notify_followers', 'notify_on_publish',
    'notify_timing', 'serial_status', 'visibility'
  )
order by column_name;
