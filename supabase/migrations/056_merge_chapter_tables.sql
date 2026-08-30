-- ============================================================
-- 原石航路 Studio
-- 章の表を1つにする（写す）
--
-- ★ 何も消しません。足すだけです。
--   箱B（novel_chapters）はそのまま残します。
--   しばらく様子を見て、何も起きないことを確かめてから
--   消すかどうかを決めます。
--
-- ------------------------------------------------------------
-- 下調べの結果
--
--   id のぶつかり      0     写せる
--   箱A（chapters）    51章
--   箱B（novel_chapters） 10章
--   箱Bを指す話        42話   写せば箱Aで見つかる
--   どちらにも無い話    0     迷子の話は無い
--
-- ------------------------------------------------------------
-- 写し方
--
--   id をそのまま持っていく。
--   話の札（episodes.chapter_id）が指す先は変わらないので、
--   話の所属は 1 つも動かない。
--
--   並び順は、箱Aの後ろへ回す。
--   箱Aに既にある 51 章と番号がぶつかると、
--   並びが入り混じって作者が驚く。
-- ============================================================

insert into public.chapters (
    id, novel_id, title, sort_order, parent_id, is_part, created_at, updated_at
)
select
    b.id,
    b.novel_id,
    coalesce(b.title, ''),

    /*
     * 並び順は、その作品の箱Aの一番後ろから続ける。
     *
     * 箱Bの中での順（order_num）は保つ。
     * 作品ごとに数え直すので、他の作品には影響しない。
     */
    coalesce(
        (select max(a.sort_order) from public.chapters as a
         where a.novel_id = b.novel_id),
        -1
    ) + 1 + coalesce(b.order_num, 0),

    /* 部には入れない。ただの章として入る */
    null,
    false,

    coalesce(b.created_at, now()),
    now()

from public.novel_chapters as b

/* 既に箱Aにあるものは写さない。何度実行しても増えない */
where not exists (
    select 1 from public.chapters as a where a.id = b.id
);

notify pgrst, 'reload schema';


-- ============================================================
-- 確認
-- ============================================================

/* 箱Bの章が、全部 箱Aにあること */
select
    (select count(*) from public.novel_chapters)                     as 箱Bの章,
    (select count(*) from public.novel_chapters as b
     where exists (select 1 from public.chapters as a where a.id = b.id)) as うち箱Aにもあるもの,
    case
        when (select count(*) from public.novel_chapters as b
              where not exists (select 1 from public.chapters as a where a.id = b.id)) = 0
        then '写せました'
        else '写しきれていません ← 確認してください'
    end                                                              as 状態;

/* 話の札が、全部 箱Aで見つかること */
select
    count(*) filter (where e.chapter_id is null)              as 章に入れていない話,
    count(*) filter (where a.id is not null)                  as 箱Aで見つかる話,
    count(*) filter (where e.chapter_id is not null
                       and a.id is null)                      as 見つからない話
from public.episodes as e
left join public.chapters as a on a.id = e.chapter_id;
