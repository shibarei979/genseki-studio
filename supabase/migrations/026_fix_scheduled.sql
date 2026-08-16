-- ============================================================
-- 原石航路 Studio
-- 予約をそろえて、時間の過ぎたものを公開する
--
-- 分かったこと:
--   予約の時刻が 2 か所にある。
--     scheduled_at  公開の見回りが見るほう
--     publish_at    画面が使うほう
--   直す前に予約したものは publish_at にしか入っておらず、
--   見回りが拾えないまま残っていた。
--
-- ここでやること:
--   1. 片方しか入っていない予約を、両方そろえる
--   2. 時間の過ぎた予約を、その場で公開する
--
-- 何度実行しても壊れない。
-- ============================================================

-- 1. 片方しか無い予約をそろえる
update public.episodes
   set scheduled_at = publish_at
 where is_published is not true
   and scheduled_at is null
   and publish_at is not null;

update public.episodes
   set publish_at = scheduled_at
 where is_published is not true
   and publish_at is null
   and scheduled_at is not null;

-- 2. 時間の過ぎた予約を公開する
update public.episodes
   set is_published = true,
       published    = true,
       scheduled_at = null,
       publish_at   = null
 where is_published is not true
   and scheduled_at is not null
   and scheduled_at <= now();

-- 3. 話が出た作品は、作品も公開にする
--    作品が下書きのままだと、話だけ出しても読めない
update public.novels n
   set published = true
 where n.published is not true
   and exists (
       select 1 from public.episodes e
       where e.novel_id = n.id and e.is_published = true
   );

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    title as 話,
    is_published as 公開済み,
    scheduled_at as 予約の時刻,
    case
        when is_published then '公開しました'
        when scheduled_at is null then '予約なし'
        when scheduled_at > now() then 'これから公開'
        else 'まだ出ていません ← 見せてください'
    end as 状態
from public.episodes
where scheduled_at is not null or is_published = true
order by scheduled_at nulls last
limit 20;
