-- ============================================================
-- 原石航路 Studio
-- 作品ごとの「いつも出す時刻」
--
-- ------------------------------------------------------------
-- 何のために足すか
--
-- 予約公開の日時を、毎回ゼロから選んでいる。
-- 何十話もまとめて予約する人は、そのたびに
-- 日と時刻を選び直すことになる。
--
-- 出す時刻は、たいてい作品ごとに決まっている。
-- 一度覚えておけば、次の予定は一押しで入る。
--
-- ------------------------------------------------------------
-- 「◯日ごとに自動で投稿」は、まだ作らない
--
-- 自動で入れると、書けていない話にも予定が付く。
-- まず「次の予定を一押しで入れる」まで作り、
-- 使ってみてから、その先を決める。
-- ============================================================

alter table public.novels
    add column if not exists default_publish_time text,
    add column if not exists default_publish_days smallint;

comment on column public.novels.default_publish_time is
    'いつも出す時刻。"19:00" の形。決めていなければ null';

comment on column public.novels.default_publish_days is
    '何日ごとに出すか。最後の予約の何日あとを次の予定にするか';

/*
 * 形を決めておく。
 *
 *   時刻   00:00 〜 23:59 の 5 文字だけ
 *   日数   1 〜 60 日
 *
 * 入っていない（null）のは構わない。決めていない、という意味。
 */
alter table public.novels
    drop constraint if exists novels_default_publish_time_form;

alter table public.novels
    add constraint novels_default_publish_time_form
    check (
        default_publish_time is null
        or default_publish_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    );

alter table public.novels
    drop constraint if exists novels_default_publish_days_range;

alter table public.novels
    add constraint novels_default_publish_days_range
    check (
        default_publish_days is null
        or default_publish_days between 1 and 60
    );

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when (
            select count(*) from information_schema.columns
            where table_schema = 'public'
              and table_name = 'novels'
              and column_name in ('default_publish_time', 'default_publish_days')
        ) = 2 then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
