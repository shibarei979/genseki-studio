-- ============================================================
-- 原石航路 Studio
-- ジャンルを変えた日を持たせる
--
-- 公開したあとのジャンルは、週に 1 回までにする。
--
-- ランキングの空いているジャンルへ移し、
-- 上位に出たらまた戻す、という使い方ができてしまう。
-- 読む人にとっては、探した棚に無い作品が増えるだけになる。
--
-- 公開する前は何度でも変えられる。
-- 決めかねている段階で縛る理由がない。
--
-- 一度も変えていなければ null。
-- いまある作品は、次の 1 回をすぐ使える。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.novels
    add column if not exists genre_changed_at timestamptz;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'novels'
              and column_name = 'genre_changed_at'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;

select
    count(*)                                    as 作品の数,
    count(genre_changed_at)                     as ジャンルを変えたことのある作品
from public.novels
where deleted_at is null;
