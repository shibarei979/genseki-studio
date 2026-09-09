-- ============================================================
-- 原石航路 Studio
-- 予約の時刻を、2 つの列でそろえ直す
--
-- ------------------------------------------------------------
-- 何が起きていたか
--
-- 予約の時刻は、episodes の 2 つの列に入っている。
--
--   publish_at    投稿画面が書くもの
--   scheduled_at  読む側と定時の見回りが見るもの
--
-- 投稿画面は publish_at にしか書いていなかった。
-- 予約を取り消しても、非公開に戻しても、
-- scheduled_at には前の時刻が残ったままになる。
--
-- その時刻はもう過ぎているので、
-- 誰かが作品の頁を開いた瞬間、あるいは次の見回りで、
-- その話は公開されてしまう。
--
--   「非公開にしたのに、勝手に投稿された」
--   「予約し直したのに、すぐ出た」
--
-- ------------------------------------------------------------
-- この SQL ですること
--
--   ① いま残っている食い違いを直す
--   ② どちらが本命かを、列の説明として書き残す
--
-- 画面の側も、両方そろえて書くように直してある。
-- SQL だけ、画面だけ、のどちらか片方では直らない。
-- ============================================================

-- ------------------------------------------------------------
-- 流す前に、どれだけ食い違っているかを見る
-- ------------------------------------------------------------
select
    count(*) filter (
        where is_published is not true
          and scheduled_at is not null
          and publish_at is null
    ) as 予約が消えたのに時刻が残っている,

    count(*) filter (
        where is_published is not true
          and scheduled_at is not null
          and publish_at is not null
          and scheduled_at <> publish_at
    ) as 二つの時刻が違う,

    count(*) filter (
        where is_published is not true
          and scheduled_at is not null
          and scheduled_at <= now()
    ) as 過ぎた時刻が残っている
from public.episodes;

-- ------------------------------------------------------------
-- ① 直す
-- ------------------------------------------------------------

/*
 * 予約が生きているもの。
 * publish_at を本命として、scheduled_at をそろえる。
 */
update public.episodes
set scheduled_at = publish_at
where is_published is not true
  and publish_at is not null
  and (scheduled_at is distinct from publish_at);

/*
 * 予約が消えているのに、時刻だけ残っているもの。
 *
 * ★ ここがいちばん危ない。
 *   過ぎた時刻が残っていると、開いた瞬間に公開される。
 */
update public.episodes
set scheduled_at = null
where is_published is not true
  and publish_at is null
  and scheduled_at is not null;

/*
 * すでに出ている話に、時刻が残っているもの。
 * 出たあとは、どちらも要らない。
 */
update public.episodes
set scheduled_at = null,
    publish_at = null
where is_published is true
  and (scheduled_at is not null or publish_at is not null);

-- ------------------------------------------------------------
-- ② 書き残す
-- ------------------------------------------------------------
comment on column public.episodes.publish_at is
    '公開する日時。投稿画面が書く。scheduled_at と必ずそろえる';

comment on column public.episodes.scheduled_at is
    '公開する日時。読む側と見回りが見る。publish_at と必ずそろえる';

notify pgrst, 'reload schema';

-- ============================================================
-- 確認（全部 0 になっていれば直っています）
-- ============================================================
select
    count(*) filter (
        where is_published is not true
          and scheduled_at is not null
          and publish_at is null
    ) as 予約が消えたのに時刻が残っている,

    count(*) filter (
        where is_published is not true
          and scheduled_at is distinct from publish_at
    ) as 二つの時刻が違う,

    count(*) filter (
        where is_published is true
          and (scheduled_at is not null or publish_at is not null)
    ) as 出たのに時刻が残っている
from public.episodes;
