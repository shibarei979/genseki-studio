-- ============================================================
-- 原石航路 Studio
-- コメントに「承認」を持たせる
--
-- ------------------------------------------------------------
-- 何のために
--
-- 投稿画面に「承認後に公開」という選び具があるのに、
-- 選んでも動く先が無かった。
--
--   画面      選べる
--   保存      されていなかった（109 で直した）
--   読者の側  見ていない
--   作者の側  承認する画面が無い
--
-- ここで、残りを作る。
--
-- ------------------------------------------------------------
-- 決め方
--
-- ★ 既定は「承認済み」。
--
--   いま入っているコメントを、全部隠してはいけない。
--   これまで見えていたものが、ある日消えることになる。
--
-- ★ 承認が要るかどうかは、作品の設定で決まる。
--
--   novels.moderate_comments が true の作品にだけ、
--   未承認のコメントができる。
--
-- ★ 作者と運営は、未承認も読める。
--   読めないと、承認しようがない。
--
-- ★ 書いた本人も、自分のものは読める。
--   自分の書き込みが消えたように見えると、
--   二重に書き込むことになる。
-- ============================================================

alter table public.comments
    add column if not exists is_approved boolean not null default true;

comment on column public.comments.is_approved is
    '作者が認めたコメントか。承認制の作品でだけ false になりうる';

/* 未承認のものを引くので、そこで絞れるようにする */
create index if not exists comments_approval_idx
    on public.comments (novel_id, is_approved)
    where is_approved = false;

-- ------------------------------------------------------------
-- 読む決まり
--
-- ★ 承認済みは、これまでどおり誰でも読める。
-- ★ 未承認は、作者・書いた本人・運営だけ。
-- ------------------------------------------------------------

drop policy if exists comments_read_approved on public.comments;

create policy comments_read_approved
    on public.comments for select
    to anon, authenticated
    using (
        is_approved = true
        or user_id = auth.uid()
        or exists (
            select 1 from public.novels n
            where n.id = comments.novel_id
              and n.author_id = auth.uid()
        )
        or exists (
            select 1 from public.profiles p
            where p.user_id = auth.uid() and p.is_admin = true
        )
    );

-- ------------------------------------------------------------
-- 承認する決まり
--
-- ★ 直せるのは、作品の作者と運営だけ。
--   書いた本人が自分で承認できてはいけない。
-- ------------------------------------------------------------

drop policy if exists comments_approve_by_author on public.comments;

create policy comments_approve_by_author
    on public.comments for update
    to authenticated
    using (
        exists (
            select 1 from public.novels n
            where n.id = comments.novel_id
              and n.author_id = auth.uid()
        )
        or exists (
            select 1 from public.profiles p
            where p.user_id = auth.uid() and p.is_admin = true
        )
    )
    with check (
        exists (
            select 1 from public.novels n
            where n.id = comments.novel_id
              and n.author_id = auth.uid()
        )
        or exists (
            select 1 from public.profiles p
            where p.user_id = auth.uid() and p.is_admin = true
        )
    );

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    (select count(*) from public.comments)                      as コメントの総数,
    (select count(*) from public.comments where is_approved)    as 承認済み,
    (select count(*) from public.comments where not is_approved) as 未承認;

select policyname as 決まり, cmd as 対象
from pg_policies
where schemaname = 'public' and tablename = 'comments'
order by cmd, policyname;
