-- ============================================================
-- 原石航路 Studio
-- 運営が選ぶ作品の置き場
--
-- ------------------------------------------------------------
-- 何のために作るか
--
-- ホームに「受賞作品」の枠を置く。
-- 受賞作品が無いあいだは「運営のおすすめ」を出す。
--
-- 置く形は同じなので、表も 1 つにまとめる。
-- kind で見分ける。
-- ============================================================

create table if not exists public.featured_novels (
    id          uuid primary key default gen_random_uuid(),

    novel_id    uuid not null references public.novels(id) on delete cascade,

    /*
     * 種類。
     *
     *   award  受賞作品
     *   pick   運営のおすすめ
     *
     * ★ 受賞が 1 つでもあれば、ホームは受賞だけを出す。
     *   受賞とただの推薦が混ざると、
     *   どれが賞を取ったのか分からなくなる。
     */
    kind        text not null default 'pick',

    /*
     * 賞の名前。受賞のときだけ使う。
     *   例  第一回プレリリースコンテスト 大賞
     *
     * 出さないと、ただの推薦と見分けが付かない。
     */
    label       text not null default '',

    /* 並び順。小さいほど先に出す */
    sort_order  integer not null default 0,

    /* 下げたいときは false にする。消さずに残せる */
    is_visible  boolean not null default true,

    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

/* 同じ作品を同じ種類で二度登録しない */
create unique index if not exists featured_novels_unique
    on public.featured_novels (novel_id, kind);

create index if not exists featured_novels_order
    on public.featured_novels (kind, sort_order) where is_visible;

alter table public.featured_novels enable row level security;

/*
 * 読むのは誰でも。ホームに出すもの。
 * 下げたものは出さない。
 */
drop policy if exists featured_novels_select on public.featured_novels;
create policy featured_novels_select on public.featured_novels
    for select
    using (is_visible = true or public.is_admin());

/* 選べるのは運営だけ */
drop policy if exists featured_novels_write on public.featured_novels;
create policy featured_novels_write on public.featured_novels
    for all
    using (public.is_admin())
    with check (public.is_admin());

/*
 * 運営用の鍵にも許可を配る。
 * 配り忘れると、管理画面で 0 件のままになる。
 */
grant select on public.featured_novels to service_role;
grant select on public.featured_novels to anon, authenticated;
grant insert, update, delete on public.featured_novels to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'featured_novels'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
