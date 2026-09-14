-- ============================================================
-- 原石航路 Studio
-- アイテムツリー
--
-- ------------------------------------------------------------
-- 何を足すか
--
-- 品物を、格子のように並べる。
-- 前のものを取らないと、次が買えない。
--
--   Lv.1   ①  ②  ③  ④
--   Lv.2   ⑤  ⑥  ⑦  ⑧  ⑨
--   Lv.3   ⑩  ⑪  ⑫  ⑬  ⑭
--
-- ------------------------------------------------------------
-- 足す列
--
-- ★ tier      何段目（1〜5）
-- ★ position  その段の何番目（左から）
--
--   運営が決める。値段の順に勝手に並べると、
--   絵のような形にならない。
--
-- ★ requires_item_id  これを取らないと買えない
--
--   絵の線が、これ。
--   空なら、誰でもいつでも買える。
--
-- ★ is_secret  買うまで中身を見せない
--
--   名前も絵も伏せて「？」で出す。
--   何があるか分からないほうが、集める気になる。
--
-- ★ 中身がまだ決まっていない品物
--
--   is_active を false のままにしておく。
--   画面には「？？？」と出て、押せない。
--   運営が中身を入れて is_active を true にすると出る。
-- ============================================================

alter table public.shop_items
    add column if not exists tier smallint not null default 1;

alter table public.shop_items
    add column if not exists position smallint not null default 0;

alter table public.shop_items
    add column if not exists requires_item_id uuid
        references public.shop_items(id) on delete set null;

alter table public.shop_items
    add column if not exists is_secret boolean not null default false;

comment on column public.shop_items.tier is
    'アイテムツリーの何段目か（1〜5）';
comment on column public.shop_items.position is
    'その段の何番目か。左から。小さいほど左';
comment on column public.shop_items.requires_item_id is
    'これを持っていないと買えない品物。空なら誰でも買える';
comment on column public.shop_items.is_secret is
    '買うまで中身を見せないか。名前も絵も伏せる';

/* 段と並びで引くので、そこで絞れるようにする */
create index if not exists shop_items_tree_idx
    on public.shop_items (tier, position);

-- ------------------------------------------------------------
-- 仮置きの品物
--
-- ★ 中身はこれから作る。
--
--   絵も名前も決まっていないので、
--   is_active を false にしておく。
--   画面には「？？？」と出て、押せない。
--
-- ★ 値段と置き場所だけ先に決める。
--
--   形が見えていないと、絵を作る側も困る。
--   何段目にどんな値段のものが要るかが分かる。
--
-- ★ 一度流したら、二度目は何もしない。
--   同じ品物が増えないように、名前で見て入れる。
-- ------------------------------------------------------------

insert into public.shop_items
    (kind, name, description, free_price, tier, position, is_active, is_secret)
select * from (values
    -- Lv.1 はじめの一歩
    ('stamp',      'スタンプ',       '', 50,   1::smallint, 0::smallint, false, false),
    ('stamp',      'スタンプ',       '', 50,   1::smallint, 1::smallint, false, false),
    ('stamp',      'スタンプ',       '', 50,   1::smallint, 2::smallint, false, false),
    ('stamp',      'シークレット',   '', 50,   1::smallint, 3::smallint, false, true),

    -- Lv.2 自分らしさを表現しよう
    ('stamp',      'スタンプ',       '', 100,  2::smallint, 0::smallint, false, false),
    ('stamp',      'スタンプ',       '', 100,  2::smallint, 1::smallint, false, false),
    ('frame',      '作者フレーム',   '', 200,  2::smallint, 2::smallint, false, false),
    ('background', '背景',           '', 300,  2::smallint, 3::smallint, false, false),
    ('stamp',      'シークレット',   '', 300,  2::smallint, 4::smallint, false, true),

    -- Lv.3 もっと楽しく、もっとつながる
    ('stamp',      'スタンプ',       '', 200,  3::smallint, 0::smallint, false, false),
    ('badge',      '称号',           '', 300,  3::smallint, 1::smallint, false, false),
    ('name_style', 'プロフィール装飾', '', 300, 3::smallint, 2::smallint, false, false),
    ('background', '背景',           '', 400,  3::smallint, 3::smallint, false, false),
    ('stamp',      'シークレット',   '', 400,  3::smallint, 4::smallint, false, true),

    -- Lv.4 特別なアイテムでさらに先へ
    ('stamp',      'スタンプ',       '', 500,  4::smallint, 0::smallint, false, false),
    ('frame',      'フレーム',       '', 600,  4::smallint, 1::smallint, false, false),
    ('frame',      '特別フレーム',   '', 800,  4::smallint, 2::smallint, false, false),
    ('badge',      '称号',           '', 1000, 4::smallint, 3::smallint, false, true),
    ('background', '背景',           '', 1000, 4::smallint, 4::smallint, false, true),

    -- Lv.5 まだ見ぬ景色へ
    ('frame',      'まだ見ぬアイテム', '', 2000, 5::smallint, 0::smallint, false, true)
) as seed(kind, name, description, free_price, tier, position, is_active, is_secret)
where not exists (
    select 1 from public.shop_items existing
    where existing.tier = seed.tier
      and existing.position = seed.position
);

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    tier      as 段,
    position  as 並び,
    kind      as 種類,
    name      as 名前,
    free_price as 値段,
    is_secret as 伏せる,
    is_active as 出す
from public.shop_items
order by tier, position;
