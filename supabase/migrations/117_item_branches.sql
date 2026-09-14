-- ============================================================
-- 原石航路 Studio
-- アイテムツリーを、枝分かれさせる
--
-- ------------------------------------------------------------
-- いまの形
--
-- 段の中を左から右へ一本に繋いでいた。
--
--   ①→②→③→④
--   ↓
--   ①→②→③→④→⑤
--
-- これだと「どれを取ると何が開くか」の選択が無い。
-- 左端から順に取るしかなく、道が一本しかない。
--
-- ------------------------------------------------------------
-- 変える形
--
--            START
--           ／  ｜  ＼
--         ①    ②    ③        Lv.1
--        ／＼  ／＼   ｜
--      ①   ②    ③   ④        Lv.2
--       ＼  ｜   ／
--         ゴール
--
-- ★ START から、3 つへ分かれる。
--
--   はじめに「どれを取るか」を選べる。
--   選ばせることが、進んでいる感じを作る。
--
-- ★ 親を持つ子が、2 つずつ。
--
--   1 つ取ると、次が 2 つ開く。
--   取るほど道が広がる。
--
-- ★ 最後の 1 つは、いくつかの枝から辿り着く。
--
--   どの道を通っても、いつかはゴールに着く。
--   一本道で塞がれると、そこで止まってしまう。
-- ============================================================

-- ------------------------------------------------------------
-- 下ごしらえ。いったん全部の繋がりを外す
-- ------------------------------------------------------------

update public.shop_items set requires_item_id = null;

-- ------------------------------------------------------------
-- Lv.1 は、START の子。親を持たない
--
-- ★ 4 つとも親なし。どれからでも始められる。
-- ------------------------------------------------------------

-- （上で null にしてあるので、何もしない）

-- ------------------------------------------------------------
-- Lv.2 は、Lv.1 のどれかから
--
--   Lv2-0 ← Lv1-0
--   Lv2-1 ← Lv1-0   （1 つ取ると 2 つ開く）
--   Lv2-2 ← Lv1-1
--   Lv2-3 ← Lv1-2
--   Lv2-4 ← Lv1-3
-- ------------------------------------------------------------

update public.shop_items set requires_item_id =
    (select id from public.shop_items where tier = 1 and position = 0)
where tier = 2 and position in (0, 1);

update public.shop_items set requires_item_id =
    (select id from public.shop_items where tier = 1 and position = 1)
where tier = 2 and position = 2;

update public.shop_items set requires_item_id =
    (select id from public.shop_items where tier = 1 and position = 2)
where tier = 2 and position = 3;

update public.shop_items set requires_item_id =
    (select id from public.shop_items where tier = 1 and position = 3)
where tier = 2 and position = 4;

-- ------------------------------------------------------------
-- Lv.3 は、Lv.2 のどれかから
--
--   Lv3-0 ← Lv2-0
--   Lv3-1 ← Lv2-1
--   Lv3-2 ← Lv2-2
--   Lv3-3 ← Lv2-3
--   Lv3-4 ← Lv2-4
-- ------------------------------------------------------------

update public.shop_items as later set requires_item_id = earlier.id
from public.shop_items as earlier
where later.tier = 3
  and earlier.tier = 2
  and earlier.position = later.position;

-- ------------------------------------------------------------
-- Lv.4 は、Lv.3 のどれかから。少し寄せる
--
--   Lv4-0 ← Lv3-0
--   Lv4-1 ← Lv3-1
--   Lv4-2 ← Lv3-2
--   Lv4-3 ← Lv3-3
--   Lv4-4 ← Lv3-4
-- ------------------------------------------------------------

update public.shop_items as later set requires_item_id = earlier.id
from public.shop_items as earlier
where later.tier = 4
  and earlier.tier = 3
  and earlier.position = later.position;

-- ------------------------------------------------------------
-- Lv.5 は、真ん中の枝から
--
-- ★ どこか 1 つに絞る。
--   ここがゴールなので、辿り着く道を決めておく。
-- ------------------------------------------------------------

update public.shop_items set requires_item_id =
    (select id from public.shop_items where tier = 4 and position = 2)
where tier = 5;

-- ============================================================
-- 確認
-- ============================================================
select
    n.tier     as 段,
    n.position as 並び,
    n.name     as 名前,
    coalesce('Lv' || p.tier || '-' || p.position, '（START から）') as 前の品物
from public.shop_items n
left join public.shop_items p on p.id = n.requires_item_id
order by n.tier, n.position;
