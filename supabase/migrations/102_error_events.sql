-- ============================================================
-- 原石航路 Studio
-- 不具合の記録
--
-- ------------------------------------------------------------
-- 何のために残すか
--
-- いまは、読者から声が届いて初めて気づく。
-- 声を上げてくれる人は、ごく一部。
-- 黙って帰った人のぶんは、こちらには何も残らない。
--
-- 落ちた瞬間に、こちらへ残す。
--
-- ------------------------------------------------------------
-- 何を残すか
--
--   何が起きたか   落ちたときの言葉
--   どこで         その画面の住所
--   いつ           時刻
--   何回目か       同じものが何度も起きているか
--
-- ★ 誰かは残さない。
--   直すのに要らない。要らないものは持たない。
--
-- ★ 本文や題名は残さない。
--   落ちた言葉に本文が混じることがあるので、
--   受け口の側で切り詰める。
-- ============================================================

create table if not exists public.error_events (
    id          bigserial primary key,

    /* 落ちたときの言葉。長いものは切る */
    message     text not null,

    /* どこで落ちたか */
    path        text,

    /*
     * どういう落ち方か。
     *
     *   render   画面の組み立てに失敗
     *   client   画面が動いている最中に落ちた
     *   promise  裏で走らせた仕事が落ちた
     */
    kind        text,

    /* Next が付ける印。ログと突き合わせるのに使う */
    digest      text,

    created_at  timestamptz not null default now()
);

create index if not exists error_events_created_idx
    on public.error_events (created_at desc);

comment on table public.error_events is
    '不具合の記録。誰かは残さない。何が・どこで・いつ、だけ';

/*
 * 決まり。
 *
 * ★ 書くのは、運営の鍵を持つ入口だけ。
 *   表を直に叩けるようにすると、いたずらで埋まる。
 * ★ 読むのは運営だけ。
 */
alter table public.error_events enable row level security;

notify pgrst, 'reload schema';

-- ============================================================
-- 読むための問い合わせ
-- ============================================================

/* ① 直近に起きたもの */
select
    created_at at time zone 'Asia/Tokyo' as 時刻,
    kind                                 as 落ち方,
    path                                 as 画面,
    message                              as 中身
from public.error_events
order by created_at desc
limit 30;

/* ② 同じものが何度起きているか。多い順 */
select
    message                              as 中身,
    path                                 as 画面,
    count(*)                             as 回数,
    max(created_at) at time zone 'Asia/Tokyo' as 最後に起きた
from public.error_events
where created_at > now() - interval '7 days'
group by message, path
order by 回数 desc
limit 20;

/* ③ 日ごとの数。増えていないか */
select
    (created_at at time zone 'Asia/Tokyo')::date as 日,
    count(*)                                     as 件数
from public.error_events
group by 1
order by 1 desc
limit 14;
