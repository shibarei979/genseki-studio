-- ============================================================
-- 原石航路 Studio
-- 受賞の見せ場の動き
--
-- ------------------------------------------------------------
-- 何のために作るか
--
-- 受賞作品が 3 冊を超えると、板に載りきらなかった。
-- 横のボタンで送れるようにしたので、
-- 「一度に何冊並べるか」「ひとりでに送るか」を
-- 運営が管理画面で決められるようにする。
--
-- ------------------------------------------------------------
-- なぜ admin_feature_flags に入れないか
--
-- あちらは入／切だけの表。数字が入らない。
-- 状態の文字に数字を詰めることもできるが、
-- あとから読むときに何の数か分からなくなる。
-- ============================================================

create table if not exists public.featured_settings (
    /*
     * 行は 1 つだけ。
     *
     * ★ id を真偽値にして、真しか入らないようにする。
     *   増えると、どれが効いているのか分からなくなる。
     */
    id           boolean primary key default true,

    /*
     * 一度に並べる冊数。
     *
     * 6 冊以上は板からはみ出す。0 冊は何も出ない。
     */
    per_view     smallint not null default 3,

    /*
     * ひとりでに送る間隔（秒）。
     *
     *   0    送らない。横のボタンを押したときだけ
     *   4〜  その秒ごとに次の頁へ
     *
     * 3 秒より短いと、題名を読み終える前に変わる。
     */
    auto_seconds smallint not null default 0,

    updated_at   timestamptz not null default now(),

    constraint featured_settings_one_row
        check (id),
    constraint featured_settings_per_view
        check (per_view between 1 and 5),
    constraint featured_settings_auto_seconds
        check (auto_seconds = 0 or auto_seconds between 4 and 60)
);

/*
 * 初めの 1 行を入れておく。
 * 空のままだと、管理画面で触るまで何も控えられない。
 */
insert into public.featured_settings (id, per_view, auto_seconds)
values (true, 3, 0)
on conflict (id) do nothing;

alter table public.featured_settings enable row level security;

/* 読むのは誰でも。ホームの見せ場がこれを見て動く */
drop policy if exists featured_settings_select on public.featured_settings;
create policy featured_settings_select on public.featured_settings
    for select
    using (true);

/* 決めるのは運営だけ */
drop policy if exists featured_settings_write on public.featured_settings;
create policy featured_settings_write on public.featured_settings
    for all
    using (public.is_admin())
    with check (public.is_admin());

/*
 * 鍵に許可を配る。
 * 配り忘れると、管理画面で選んでも控えられない。
 */
grant select on public.featured_settings to service_role;
grant select on public.featured_settings to anon, authenticated;
grant insert, update on public.featured_settings to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from public.featured_settings where id
        ) then '用意できました（' || (select per_view from public.featured_settings where id) || ' 冊）'
        else '失敗 ← 確認してください'
    end as 状態;
