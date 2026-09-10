-- ============================================================
-- 原石航路 Studio
-- 作家人生ゲームの記録
--
-- ------------------------------------------------------------
-- 何のために残すか
--
-- いまは、直す場所を勘で決めている。
--
--   何人が始めたか
--   何問目で帰ったか
--   何人が結果まで来たか
--   何人が「この題名で書き始める」を押したか
--
-- どれも分からない。
-- 5 問目で半分帰っているなら、そこを直すのが先。
-- 結果まで来て誰も押さないなら、結果の作りが悪い。
--
-- ------------------------------------------------------------
-- 誰かは記録しない
--
-- ★ 登録なしで遊べる場所なので、user_id は取らない。
--
--   代わりに、1 回の遊びごとの札（play_id）だけ持つ。
--   同じ人が 2 回遊んだら、別の札になる。
--   誰が何を選んだかは、こちらには分からない。
--
-- ★ 選んだ札の中身も残さない。
--   何問目まで来たか、と、結果の組だけ。
--   それで、直す場所は決められる。
-- ============================================================

create table if not exists public.game_events (
    id          bigserial primary key,

    /* 1 回の遊びごとの札。誰かは分からない */
    play_id     text not null,

    /*
     * 何が起きたか。
     *
     *   start   始めた
     *   step    1 問答えた（at に何問目か）
     *   result  結果まで来た（place / core が入る）
     *   write   「この題名で書き始める」を押した
     *   share   「Xにつぶやく」を押した
     *   again   もう一度やる
     */
    kind        text not null,

    /* step のとき、何問目か */
    at          smallint,

    /* result のとき、出た組 */
    place       text,
    core        text,

    created_at  timestamptz not null default now()
);

/* 日ごとに数えるので、時刻で引けるようにする */
create index if not exists game_events_created_idx
    on public.game_events (created_at desc);

create index if not exists game_events_play_idx
    on public.game_events (play_id);

comment on table public.game_events is
    '作家人生ゲームの記録。誰かは残さない。1 回ごとの札と、何が起きたかだけ';

/*
 * 決まり。
 *
 * ★ 書くのは誰でもよい。登録なしで遊べる場所なので。
 * ★ 読むのは運営だけ。遊んだ人が他人の記録を見る意味はない。
 */
alter table public.game_events enable row level security;

drop policy if exists game_events_insert on public.game_events;
create policy game_events_insert
    on public.game_events for insert
    to anon, authenticated
    with check (true);

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'game_events'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
