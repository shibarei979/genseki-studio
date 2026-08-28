-- ============================================================
-- 原石航路 Studio
-- 部に印を付ける
--
-- これまで「部かどうか」は、子を持つかどうかで決めていた。
-- そのため中の章がすべて出ていくと、部はただの章に戻った。
--
-- 作者にとって部は入れ物であって、
-- 中身が空になった瞬間に消えるものではない。
-- 印を 1 つ持たせて、部は部のままにする。
--
-- いまある章のうち、子を持つものは部だったので、
-- そこに印を立てる。見え方は変わらない。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.chapters
    add column if not exists is_part boolean not null default false;

/*
 * いまある部に、あとから印を立てる。
 *
 * 子を持つ章が、これまでの部。
 * ここを飛ばすと、既存の作品から部が消える。
 */
update public.chapters as parent
set is_part = true
where parent.is_part = false
  and exists (
      select 1
      from public.chapters as child
      where child.parent_id = parent.id
  );

/*
 * 子は部ではない。
 *
 * 2 段までしか使わないので、
 * 親を持つ章に印が立つことはない。
 */
update public.chapters
set is_part = false
where is_part = true
  and parent_id is not null;

create index if not exists chapters_is_part_idx
    on public.chapters (is_part);

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'chapters'
              and column_name = 'is_part'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;

select
    count(*) filter (where is_part)                         as 部の数,
    count(*) filter (where parent_id is not null)           as 部の中の章,
    count(*) filter (where not is_part and parent_id is null) as どの部にも入っていない章
from public.chapters;
