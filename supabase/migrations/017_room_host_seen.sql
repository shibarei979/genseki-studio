-- ============================================================
-- 原石航路 Studio
-- 主が去った部屋を畳む
--
-- 部屋を立てた人が出ていったら、5 分後に部屋を消す。
--
-- 在室は Realtime で持っているが、これは一時的なもので
-- サーバーからは見えない。そこで「主が最後にいた時刻」を
-- 表に残し、それを見て畳む。
--
-- 何度実行しても壊れない。
-- ============================================================

-- 主が最後にいた時刻
alter table public.writing_rooms
    add column if not exists host_seen_at timestamptz;

-- いまある部屋は、今この瞬間に主がいたことにする。
-- null のままだと、次の掃除で全部消える。
update public.writing_rooms
   set host_seen_at = now()
 where host_seen_at is null;

-- ------------------------------------------------------------
-- 畳む処理
--
-- 誰が呼んでも安全なように、消す条件は関数の中に閉じ込める。
-- 画面側から「この部屋を消して」と言われて消すのではなく、
-- 「古い部屋を畳んで」と頼む形にする。
-- ------------------------------------------------------------
create or replace function public.close_stale_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
    closed integer;
begin
    with gone as (
        delete from public.writing_rooms
         where host_seen_at is not null
           and host_seen_at < now() - interval '5 minutes'
        returning 1
    )
    select count(*) into closed from gone;

    return closed;
end;
$function$;

-- 誰でも呼べるようにする。消す条件は関数が持っているので、
-- 好きな部屋を消させることにはならない。
grant execute on function public.close_stale_rooms() to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'writing_rooms'
              and column_name = 'host_seen_at'
        ) then '列は用意できました'
        else '列がありません ← 失敗'
    end as 状態;
