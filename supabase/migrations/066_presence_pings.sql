-- ============================================================
-- 原石航路 Studio
-- いま開いている人を数える
--
-- ------------------------------------------------------------
-- 考え方
--
-- ★ 画面のほうから 30 秒ごとに「まだ見ています」と送る。
--
--   合図が届いた時刻だけを持っておき、
--   直近 1 分に合図のあった数を「いまの人数」とする。
--
-- ★ 誰が見ているかは持たない。
--
--   入っている人かどうかだけを持つ。
--   誰がどの画面をいつ見ていたか、までは残さない。
--
-- ★ 書き込みは運営用の繋ぎ口だけが行う。
--
--   画面から直に書けるようにすると、
--   数をいくらでも水増しできてしまう。
-- ============================================================

create table if not exists public.presence_pings (
    /* 開いている画面ごとの札。同じ人が 2 枚開けば 2 行 */
    key         text primary key,

    /* 入っている人かどうか。誰かまでは持たない */
    signed_in   boolean not null default false,

    last_seen   timestamptz not null default now()
);

/* 直近の合図を数えるための並び */
create index if not exists presence_pings_by_seen
    on public.presence_pings (last_seen desc);

alter table public.presence_pings enable row level security;

/* 見られるのは運営だけ */
drop policy if exists presence_pings_read on public.presence_pings;
create policy presence_pings_read on public.presence_pings
    for select
    using (public.is_admin());

/*
 * 書き込みの決まりは置かない。
 * 運営用の繋ぎ口（service role）だけが書く。
 */

grant select on public.presence_pings to authenticated;
grant select, insert, update, delete on public.presence_pings to service_role;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'presence_pings'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
