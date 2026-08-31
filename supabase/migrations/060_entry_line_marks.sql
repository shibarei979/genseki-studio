-- ============================================================
-- 原石航路 Studio
-- 資料の行の覚え書き
--
-- ------------------------------------------------------------
-- 何のために作るか
--
-- 資料の「言及・行動・台詞」は、本文を読んで
-- 毎回その場で数え直している（scanMentions）。
-- 表に保存されていないので、消しても次に開くとまた出る。
--
-- 「この行は消した」を覚える場所が要る。
--
-- ------------------------------------------------------------
-- あとで作るもの
--
-- 蛍光ペンで本文を選び、資料に入れる機能を予定している。
-- そちらも「その行を資料でどう扱うか」の記録なので、
-- 同じ表で受けられるように kind を持たせてある。
--
--   hidden  数え直しに出てきたが、消した
--   picked  自分で選んで、資料に入れた
--
-- 表を作り直さずに足せる。
-- ============================================================

create table if not exists public.entry_line_marks (
    id          uuid primary key default gen_random_uuid(),

    /* どの資料（人物・場所など）か */
    entry_id    uuid not null references public.resource_entries(id) on delete cascade,

    /* どの話の、何行目か */
    episode_id  uuid not null references public.episodes(id) on delete cascade,
    line        integer not null,

    /*
     * 扱い。
     *
     *   hidden  消した
     *   picked  自分で入れた（あとで作る）
     */
    kind        text not null default 'hidden',

    /*
     * そのときの本文。
     *
     * ★ 行の番号だけでは足りない。
     *
     *   104 行目を消したあとで、作者が前のほうに
     *   段落を足すと、その行は 105 行目になる。
     *   番号だけで覚えていると、別の行を消してしまう。
     *
     *   本文も一緒に覚えて、照らし合わせる。
     *   同じなら消す。違っていたら、この記録は捨てる。
     */
    text        text not null default '',

    created_at  timestamptz not null default now()
);

/* 同じ行を二重に覚えない */
create unique index if not exists entry_line_marks_unique
    on public.entry_line_marks (entry_id, episode_id, line, kind);

/* 資料を開いたとき、その資料ぶんをまとめて読む */
create index if not exists entry_line_marks_by_entry
    on public.entry_line_marks (entry_id, kind);

alter table public.entry_line_marks enable row level security;

/*
 * 作品の作者だけが読み書きできる。
 *
 * 資料は書く人のためのもの。
 * 読者に見せる場所ではない。
 */
drop policy if exists entry_line_marks_all on public.entry_line_marks;
create policy entry_line_marks_all on public.entry_line_marks
    for all
    using (
        exists (
            select 1
            from public.resource_entries as e
            join public.novels as n on n.id = e.novel_id
            where e.id = entry_line_marks.entry_id
              and n.author_id = auth.uid()
        )
        or public.is_admin()
    )
    with check (
        exists (
            select 1
            from public.resource_entries as e
            join public.novels as n on n.id = e.novel_id
            where e.id = entry_line_marks.entry_id
              and n.author_id = auth.uid()
        )
    );

/*
 * 運営用の鍵にも許可を配る。
 * 配り忘れると、管理画面から読めない。
 */
grant select on public.entry_line_marks to service_role;
grant select, insert, update, delete on public.entry_line_marks to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'entry_line_marks'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;
