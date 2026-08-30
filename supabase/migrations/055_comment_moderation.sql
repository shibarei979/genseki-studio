-- ============================================================
-- 原石航路 Studio
-- コメントの手当て
--
--   1  作者が自分の作品のコメントを消せるようにする
--   2  作者がコメントを固定できるようにする
--   3  禁止語を含むコメントを、運営以外から見えなくする
--
-- ============================================================


-- ------------------------------------------------------------
-- 1  作者もコメントを消せる
--
--    いま  auth.uid() = user_id     書いた本人だけ
--
--    画面には作者にも「削除」が出るが、表の側で弾かれていた。
--    しかも失敗を確かめずに画面から先に消していたので、
--    消えたように見えて、開き直すと戻ってきていた。
--
--    嫌がらせのコメントを消したつもりで、消せていない。
-- ------------------------------------------------------------
drop policy if exists comments_delete on public.comments;

create policy comments_delete on public.comments
    for delete
    using (
        auth.uid() = user_id
        or public.is_admin()
        or exists (
            select 1 from public.novels as n
            where n.id = comments.novel_id
              and n.author_id = auth.uid()
        )
    );


-- ------------------------------------------------------------
-- 2  作者がコメントを固定できる
--
--    「書き換える」の決まりが 1 つも無かった。
--    作者が固定を押しても、何も起きていない。
--
--    ★ 書いた本人は入れない。
--      あとから中身を変えられると、返信と食い違う。
--      消して書き直してもらう。
-- ------------------------------------------------------------
drop policy if exists comments_update on public.comments;

create policy comments_update on public.comments
    for update
    using (
        public.is_admin()
        or exists (
            select 1 from public.novels as n
            where n.id = comments.novel_id
              and n.author_id = auth.uid()
        )
    )
    with check (
        public.is_admin()
        or exists (
            select 1 from public.novels as n
            where n.id = comments.novel_id
              and n.author_id = auth.uid()
        )
    );


-- ------------------------------------------------------------
-- 3  禁止語を含むコメントを隠す
--
--    「パクリ」「盗作」と書かれて傷つくのは作者。
--    作者の目に触れさせない形にする。
--
--    ★ 表の側で確かめる。
--      画面の側だけだと、直接叩けば通ってしまう。
-- ------------------------------------------------------------
alter table public.comments
    add column if not exists is_hidden boolean not null default false;

alter table public.comments
    add column if not exists hidden_word text;

create index if not exists comments_hidden_idx
    on public.comments (is_hidden) where is_hidden;

/*
 * 入る前に確かめて、当たったら隠す。
 *
 * 弾かずに通すのは、書いた人に気づかせないため。
 * 弾くと、言い換えて何度も書き直される。
 *
 * security definer で作る。
 * そうしないと admin_ng_words の決まりに阻まれて、
 * 一般の人が書いたときに中を見られない。
 */
create or replace function public.hide_comment_with_ng_word()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    hit text;
begin
    select w.word into hit
    from public.admin_ng_words as w
    where length(trim(w.word)) > 0
      and new.body ilike '%' || trim(w.word) || '%'
    limit 1;

    if hit is not null then
        new.is_hidden := true;
        new.hidden_word := hit;
    end if;

    return new;
end;
$$;

drop trigger if exists comments_ng_word_check on public.comments;

create trigger comments_ng_word_check
    before insert on public.comments
    for each row
    execute function public.hide_comment_with_ng_word();


/*
 * 隠したコメントは、運営だけが見られる。
 *
 * 書いた本人にも見せない（案C）。
 * 本人に見せると、隠されたことに気づかれないぶん
 * 繰り返されにくいが、「反映されない」と
 * 問い合わせが来ることがある。
 *
 * 本人にも見せたくなったら、下の 1 行を足す。
 *     or auth.uid() = user_id
 */
drop policy if exists comments_select on public.comments;

create policy comments_select on public.comments
    for select
    using (is_hidden = false or public.is_admin());


-- ------------------------------------------------------------
-- 最初の言葉を入れておく
--
--    管理画面（禁止語）から、あとで足したり消したりできる。
-- ------------------------------------------------------------
insert into public.admin_ng_words (word)
select w
from (values ('パクリ'), ('ぱくり'), ('盗作'), ('パクり'), ('パクリ疑惑'),
             ('無断転載'), ('丸パクリ'), ('コピペ作品')) as t(w)
where not exists (
    select 1 from public.admin_ng_words as e where e.word = t.w
);


notify pgrst, 'reload schema';


-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (select 1 from pg_trigger where tgname = 'comments_ng_word_check')
         and exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='comments'
                       and column_name='is_hidden')
        then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;

select count(*) as 登録した禁止語 from public.admin_ng_words;

select
    count(*)                              as コメントぜんぶ,
    count(*) filter (where is_hidden)     as 隠れているコメント
from public.comments;
