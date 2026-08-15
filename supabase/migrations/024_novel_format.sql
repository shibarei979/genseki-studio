-- ============================================================
-- 原石航路 Studio
-- 作品の形（短編・長編）を持てるようにする
--
-- 症状:
--   基本情報で「短編」を選んでも「長編」になる。
--
-- 原因:
--   こちらは format（"long"/"short"）で持ち、
--   投稿サイト側は novel_type（「長編」/「短編」）で持っていた。
--   繋いでいなかったので、選んでも表には既定の
--   「長編」が入ったままだった。
--
-- ここでは列を用意するだけ。
-- 繋ぐのはコード側で行う。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.novels
    add column if not exists format text;

-- 既にある作品は、投稿サイト側の値から写しておく。
-- （全部「長編」になっているので、書き手が選び直せば直る）
update public.novels
   set format = case novel_type
                    when '短編' then 'short'
                    when '長編' then 'long'
                    else format
                end
 where format is null;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select format, novel_type, count(*) as 件数
from public.novels
group by format, novel_type
order by 1, 2;
