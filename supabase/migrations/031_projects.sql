-- ============================================================
-- 原石航路 Studio
-- 自主企画の置き場を作り直す
--
-- 同じ名前の表が別の用途で先にあった。
--   theme / deadline / host_id
-- host_id は空を許さない列なので、
-- こちらの形で入れようとすると必ず弾かれる。
--
-- 中身は 0 行。失われるものは無い。
-- 一度消して、きれいに作り直す。
--
-- 何度実行しても壊れない。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 念のため、中身が空かを確かめる
--
-- 1 行でも入っていたら、ここで止まる。
-- 消してよいのは、空のときだけ。
-- ------------------------------------------------------------
do $$
declare
    残り int;
begin
    select count(*) into 残り from public.projects;
    if 残り > 0 then
        raise exception '中身が % 行あります。消さずに止めました', 残り;
    end if;
end $$;

-- ------------------------------------------------------------
-- 2. 消して作り直す
-- ------------------------------------------------------------
drop table if exists public.projects cascade;

create extension if not exists pgcrypto;

create table public.projects (
    id uuid primary key default gen_random_uuid(),

    /* 立てた人 */
    owner_id uuid not null,

    title text not null,
    description text not null default '',

    /*
     * 合言葉。
     *
     * これを作品のタグに付けると参加になる。
     * 早い者勝ちなので、同じものは作れない。
     */
    tag text not null,

    /* 期間。決めない企画もある */
    starts_at date,
    ends_at date,

    is_published boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. 索引
-- ------------------------------------------------------------
create unique index projects_tag_key on public.projects (lower(tag));
create index projects_owner_idx on public.projects (owner_id);
create index projects_created_idx on public.projects (created_at desc);

-- ------------------------------------------------------------
-- 4. 決まりごと（RLS）
-- ------------------------------------------------------------
alter table public.projects enable row level security;

create policy projects_select on public.projects
    for select using (is_published = true or owner_id = auth.uid());

create policy projects_insert on public.projects
    for insert with check (owner_id = auth.uid());

create policy projects_update on public.projects
    for update using (owner_id = auth.uid());

create policy projects_delete on public.projects
    for delete using (owner_id = auth.uid());

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'projects') as 列の数,
    case
        when (select count(*) from information_schema.columns
               where table_schema = 'public' and table_name = 'projects') = 10
        then '作り直せました'
        else '列の数が合いません ← 確認してください'
    end as 状態;
