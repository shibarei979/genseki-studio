-- ============================================================
-- 原石航路 Studio
-- 部屋の番号
--
-- URL を渡す代わりに、6 桁の番号で入れるようにする。
-- 口頭でも伝えられ、打ち間違えても気づきやすい。
--
-- 貼り付けの途中で消える記号は使っていない。
-- 何度実行しても壊れない。
-- ============================================================

do $$
begin
    if to_regclass('public.writing_rooms') is null then
        raise exception 'writing_rooms がありません。先に 002 を流してください。';
    end if;
end $$;





-- ------------------------------------------------------------
-- 1. 番号の列
--
-- 6 桁。100000 から 999999 まで。
-- 4 桁だと 1 万通りしかなく、当てずっぽうで入られる。
-- 8 桁だと口で伝えるには長い。
-- ------------------------------------------------------------
alter table public.writing_rooms
    add column if not exists room_code text;

create unique index if not exists writing_rooms_code_idx
    on public.writing_rooms (room_code)
    where room_code is not null;


-- ------------------------------------------------------------
-- 2. 番号を振る
--
-- 立てたときに自動で付ける。
-- 画面側で作ると、作り忘れた経路の部屋だけ番号が無くなる。
--
-- ぶつかったら振り直す。10 回試して駄目なら諦める。
-- 100 万通りあるので、実際には 1 回で決まる。
-- ------------------------------------------------------------
create or replace function public.assign_room_code()
returns trigger language plpgsql as $fn$
declare
    candidate text;
    tries integer := 0;
begin
    if new.room_code is not null then
        return new;
    end if;

    loop
        -- 6 桁の番号。掛け算の記号を使わずに作る
        candidate := lpad(
            (100000 + (abs(hashtext(gen_random_uuid()::text)) % 900000))::text,
            6, '0'
        );
        exit when not exists (
            select 1 from public.writing_rooms where room_code = candidate
        );
        tries := tries + 1;
        exit when tries >= 10;
    end loop;

    new.room_code := candidate;
    return new;
end $fn$;

drop trigger if exists writing_rooms_code on public.writing_rooms;
create trigger writing_rooms_code
    before insert on public.writing_rooms
    for each row execute function public.assign_room_code();


-- ------------------------------------------------------------
-- 3. すでにある部屋にも振る
-- ------------------------------------------------------------
do $$
declare
    row_id uuid;
    candidate text;
begin
    for row_id in
        select id from public.writing_rooms where room_code is null
    loop
        loop
            -- 6 桁の番号。掛け算の記号を使わずに作る
        candidate := lpad(
            (100000 + (abs(hashtext(gen_random_uuid()::text)) % 900000))::text,
            6, '0'
        );
            exit when not exists (
                select 1 from public.writing_rooms where room_code = candidate
            );
        end loop;

        update public.writing_rooms set room_code = candidate where id = row_id;
    end loop;
end $$;


notify pgrst, 'reload schema';


-- ============================================================
-- 4. 確認
-- ============================================================
select
    '列' as 種類,
    'writing_rooms.room_code' as 名前,
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'writing_rooms'
              and column_name = 'room_code'
        ) then 'ある'
        else '無い ← 失敗'
    end as 状態

union all

select
    '番号のない部屋',
    '件数',
    concat(count(1), ' 件')
from public.writing_rooms
where room_code is null

order by 1, 2;
