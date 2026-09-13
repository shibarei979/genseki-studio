-- ============================================================
-- 原石航路 Studio
-- 無料ポイント
--
-- ------------------------------------------------------------
-- 何のために作るか
--
-- ミッションや招待でポイントを配り、
-- 公式アイテム（スタンプ・飾り・栞）と交換できるようにする。
--
-- 収益の柱にはしない。
-- 「余っているポイントを使う」「もう少し楽しむ」程度のもの。
--
-- ------------------------------------------------------------
-- 決めたこと
--
-- ★ 無料と有料は、別の財布にする。
--
--   あとから分けるのは、ほぼできない。
--   使ってしまったポイントを、遡って区別できないため。
--   最初から分けておけば、選択肢が残る。
--
--   有料でできることは、無料でもできる。
--   逆は無い（有料だけの機能がある）。
--
-- ★ 期限は半年。
--
--   貯め込まれて使われないのを避ける。
--   ただし「消えた」という声が必ず来るので、
--   いつ消えるかを画面に出せるようにしておく。
--
-- ★ 古いものから使う。
--
--   期限が近いものを先に減らす。
--   新しいほうから使うと、古いものが期限切れで捨てられる。
--   持ち主にとって損。
--
-- ★ 履歴を必ず残す。
--
--   「減った」「増えない」という声が来たとき、
--   履歴が無いと確かめようがない。
--   不正が見つかったときに、取り消すためにも要る。
-- ============================================================

-- ------------------------------------------------------------
-- ① ポイントの束
--
-- ★ まとめて 1 つの数字にしない。
--
--   期限があるので、いつ入ったかで分けて持つ。
--   「500 pt 持っている」ではなく、
--   「9/13 に入った 50 pt が 3/13 まで」という持ち方。
--
--   いま何 pt あるかは、期限内の束を足して出す。
-- ------------------------------------------------------------

/*
 * ★ 途中まで入っていても、流し直せるようにする。
 *
 *   一度失敗したとき、中途半端に残った表が邪魔になる。
 *   まだ誰も使っていないうちなら、作り直すのが早い。
 */
drop table if exists public.free_point_lots cascade;

create table if not exists public.free_point_lots (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,

    /* 入った数 */
    amount      integer not null check (amount > 0),

    /*
     * 使った数。amount まで増える。
     *
     * ★ 決まりに名前を付けない。
     *
     *   列に check を書くと、
     *   free_point_lots_used_check という名前が自動で付く。
     *   下で同じ名前を付けると、ぶつかって止まる。
     */
    used        integer not null default 0,

    /* 何で入ったか。mission / invite / invited / admin */
    source      text not null,

    /* 出どころの細かい印。ミッションの id など */
    source_ref  text,

    /* いつ消えるか */
    expires_at  timestamptz not null,

    created_at  timestamptz not null default now(),

    /* 使った数は、入った数を超えない。0 より小さくもならない */
    constraint free_point_lots_used_range
        check (used >= 0 and used <= amount)
);

create index if not exists free_point_lots_user_idx
    on public.free_point_lots (user_id, expires_at);

comment on table public.free_point_lots is
    '無料ポイントの束。期限があるので、入った回ごとに分けて持つ';

-- ------------------------------------------------------------
-- ② 履歴
--
-- ★ 増えた・減った・消えた、すべて残す。
--   束の増減だけでは、あとから追えない。
-- ------------------------------------------------------------

drop table if exists public.free_point_events cascade;

create table if not exists public.free_point_events (
    id          bigserial primary key,
    user_id     uuid not null references auth.users(id) on delete cascade,

    /* earn 増えた / spend 使った / expire 消えた / revoke 取り消した */
    kind        text not null,

    /* 動いた数。減るときも正の数で入れる */
    amount      integer not null check (amount > 0),

    /* 何について。ミッションの id、アイテムの id など */
    reason      text not null,
    reason_ref  text,

    created_at  timestamptz not null default now()
);

create index if not exists free_point_events_user_idx
    on public.free_point_events (user_id, created_at desc);

comment on table public.free_point_events is
    '無料ポイントの履歴。増えた・使った・消えた、すべて残す';

-- ------------------------------------------------------------
-- ③ 招待
--
-- ★ 1 人につき 10 人まで。
-- ★ 招待された人が「1 話投稿する」か「5 話読む」まで、
--   ポイントは渡さない。
--
--   口座を作っただけで渡すと、いくらでも増やせる。
-- ------------------------------------------------------------

drop table if exists public.invites cascade;

create table if not exists public.invites (
    id          uuid primary key default gen_random_uuid(),

    /* 招待した人 */
    inviter_id  uuid not null references auth.users(id) on delete cascade,

    /* 招待された人。使われるまでは空 */
    invitee_id  uuid references auth.users(id) on delete set null,

    /* 招待の合言葉。住所に付ける */
    code        text not null unique,

    /* 条件を満たして、ポイントが渡ったか */
    rewarded_at timestamptz,

    created_at  timestamptz not null default now()
);

create index if not exists invites_inviter_idx
    on public.invites (inviter_id);

create index if not exists invites_invitee_idx
    on public.invites (invitee_id);

comment on table public.invites is
    '招待。1 人 10 人まで。条件を満たすまでポイントは渡さない';

-- ------------------------------------------------------------
-- ④ 公式アイテム
--
-- ★ 何を売るかは、ここで決める。
--   コードを直さずに増やせるようにしておく。
-- ------------------------------------------------------------

drop table if exists public.shop_items cascade;

create table if not exists public.shop_items (
    id          uuid primary key default gen_random_uuid(),

    /* stamp / frame / background / name_style / badge / bookmark / cover / shelf */
    kind        text not null,

    name        text not null,
    description text not null default '',

    /* 見た目。絵の住所や、色の指定など */
    asset_url   text,
    asset_data  jsonb,

    /* 無料ポイントでの値段。null なら無料ポイントでは買えない */
    free_price  integer,

    /* 並び順。小さいほど上 */
    sort_order  integer not null default 0,

    /* 出すかどうか。作りかけを隠せるように */
    is_active   boolean not null default false,

    /* 期間限定のもの。null なら常設 */
    available_from timestamptz,
    available_to   timestamptz,

    /* 受賞作品との連携。その作品の id */
    novel_id    uuid references public.novels(id) on delete set null,

    created_at  timestamptz not null default now()
);

create index if not exists shop_items_active_idx
    on public.shop_items (is_active, kind, sort_order);

comment on table public.shop_items is
    '公式アイテム。無料ポイントで交換できるもの';

-- ------------------------------------------------------------
-- ⑤ 持ち物
-- ------------------------------------------------------------

drop table if exists public.user_items cascade;

create table if not exists public.user_items (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    item_id     uuid not null references public.shop_items(id) on delete cascade,

    /* 交換したときの値段。あとで値段が変わっても、記録は残す */
    paid_free   integer not null default 0,

    /* いま使っているか。飾りは 1 つだけ使える */
    is_equipped boolean not null default false,

    created_at  timestamptz not null default now(),

    unique (user_id, item_id)
);

create index if not exists user_items_user_idx
    on public.user_items (user_id);

comment on table public.user_items is
    '持ち物。誰が何を交換したか';

-- ============================================================
-- 決まり
--
-- ★ 自分のものだけ読める。ほかの人のポイントは見えない。
-- ★ 書き込みは、運営の鍵を通した入口からだけ。
--   画面から直に増やせると、いくらでも作れてしまう。
-- ============================================================

alter table public.free_point_lots   enable row level security;
alter table public.free_point_events enable row level security;
alter table public.invites           enable row level security;
alter table public.user_items        enable row level security;
alter table public.shop_items        enable row level security;

drop policy if exists free_point_lots_read on public.free_point_lots;
create policy free_point_lots_read
    on public.free_point_lots for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists free_point_events_read on public.free_point_events;
create policy free_point_events_read
    on public.free_point_events for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists invites_read on public.invites;
create policy invites_read
    on public.invites for select
    to authenticated
    using (inviter_id = auth.uid() or invitee_id = auth.uid());

drop policy if exists user_items_read on public.user_items;
create policy user_items_read
    on public.user_items for select
    to anon, authenticated
    using (true);

/* 品物の一覧は、出すと決めたものだけ誰でも見える */
drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read
    on public.shop_items for select
    to anon, authenticated
    using (is_active = true);

notify pgrst, 'reload schema';

-- ============================================================
-- いま持っているポイントを出す
--
-- ★ 期限の切れていない束の、残りを足す。
-- ============================================================

create or replace function public.free_points_of(target uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(sum(amount - used), 0)::int
    from public.free_point_lots
    where user_id = target
      and expires_at > now();
$$;

-- ============================================================
-- 確認
-- ============================================================
select table_name as 表
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'free_point_lots', 'free_point_events', 'invites',
    'shop_items', 'user_items'
  )
order by table_name;
