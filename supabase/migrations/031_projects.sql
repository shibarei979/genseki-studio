-- ============================================================
-- 原石航路 Studio
-- 自主企画
--
-- 利用者が自分で立てる企画。運営のコンテストとは別。
-- 賞も審査も無く、集まって読み合うためのもの。
--
-- 参加はタグで決まる。
-- 企画ごとに合言葉（タグ）を決め、
-- そのタグを付けた作品が企画のページに並ぶ。
-- 承認は要らない。
--
-- 何度実行しても壊れない。
-- ============================================================

create table if not exists public.projects (
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
     * 大文字小文字の違いで別物にならないよう、小文字で持つ。
     */
    tag text not null,

    /* 期間。終わりを決めない企画もある */
    starts_at date,
    ends_at date,

    /* 表に出すか */
    is_published boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

/* 合言葉は重複させない */
create unique index if not exists projects_tag_key
    on public.projects (lower(tag));

/* 立てた人で引く */
create index if not exists projects_owner_idx
    on public.projects (owner_id);

/* 新しい順に並べる */
create index if not exists projects_created_idx
    on public.projects (created_at desc);

-- ============================================================
-- 決まりごと（RLS）
-- ============================================================

alter table public.projects enable row level security;

/* 表に出ているものは誰でも読める */
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
    for select using (is_published = true or owner_id = auth.uid());

/* 立てられるのはログインした人だけ。自分名義でのみ */
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
    for insert with check (owner_id = auth.uid());

/* 直せるのは立てた人だけ */
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
    for update using (owner_id = auth.uid());

/* 消せるのも立てた人だけ */
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
    for delete using (owner_id = auth.uid());

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'projects'
        ) then '自主企画の置き場を用意できました'
        else '作れませんでした ← 失敗'
    end as 状態;
