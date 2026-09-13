-- ============================================================
-- 原石航路 Studio
-- 限定公開を、実際に動くようにする
--
-- ------------------------------------------------------------
-- 何が起きていたか
--
-- 「限定公開」を選ぶと、誰も読めなくなっていた。
-- 住所を直に打っても「このページはありません」。
-- 作者本人だけが読める、下書きと同じ状態。
--
-- ------------------------------------------------------------
-- なぜ起きたか
--
-- 選び具と説明文はあったが、中身が作られていなかった。
--
--   画面    「限定公開」が選べる
--           「URLを知っている人だけが読めます」と出る
--   保存    published = false になる
--   決まり  published = true でないと読ませない
--
-- 選んだ瞬間に、誰にも読めなくなる作りだった。
--
-- ------------------------------------------------------------
-- どうするか
--
-- ★ 住所を知っていれば、誰でも読める。
--
--   説明文のとおりにする。
--   合言葉は付けない。そこまで求められていない。
--
-- ★ 探せる場所には出さない。
--
--   検索・ランキング・ホームは published = true で絞っている。
--   限定公開は published = false のままなので、自然に外れる。
--   決まりを変えても、そこは変わらない。
--
-- ★ 話も同じ扱いにする。
--
--   作品だけ読めても、話が読めなければ意味がない。
-- ============================================================

-- ------------------------------------------------------------
-- 作品を読む決まり
-- ------------------------------------------------------------

drop policy if exists novels_select on public.novels;

create policy novels_select
    on public.novels for select
    to anon, authenticated
    using (
        published = true
        /* 限定公開。住所を知っている人だけが辿り着ける */
        or visibility = 'limited'
        or auth.uid() = author_id
    );

-- ------------------------------------------------------------
-- 話を読む決まり
--
-- ★ 作品が読めるだけでは足りない。
--   話が読めないと、目次だけ出て中身が無い。
-- ------------------------------------------------------------

drop policy if exists episodes_select on public.episodes;

create policy episodes_select
    on public.episodes for select
    to anon, authenticated
    using (
        exists (
            select 1 from public.novels n
            where n.id = episodes.novel_id
              and (
                  n.author_id = auth.uid()
                  or (
                      (n.published = true or n.visibility = 'limited')
                      and episodes.is_published = true
                  )
              )
        )
    );

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select policyname as 決まり, cmd as 対象, qual as 条件
from pg_policies
where schemaname = 'public'
  and tablename in ('novels', 'episodes')
  and cmd = 'SELECT'
order by tablename;

select
    visibility as 公開の向き,
    count(*)   as 作品数
from public.novels
where deleted_at is null
group by visibility
order by 作品数 desc;
