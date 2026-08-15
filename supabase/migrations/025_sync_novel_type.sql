-- ============================================================
-- 原石航路 Studio
-- 食い違っている作品の形をそろえる
--
-- 分かったこと:
--   format は保存されていた（short が 5 件ある）。
--   保存されていなかったのは novel_type のほうで、
--   表示と検索が見ているのはそちらだった。
--   だから「短編で出したのに長編になる」が起きた。
--
-- ここでは、既にある作品の novel_type を format に合わせる。
-- 書き手が選び直さなくても直る。
--
-- 何度実行しても壊れない。
-- ============================================================

update public.novels
   set novel_type = case format
                        when 'short' then '短編'
                        when 'long'  then '長編'
                        else novel_type
                    end
 where format in ('short', 'long')
   and novel_type is distinct from (case format
                                        when 'short' then '短編'
                                        when 'long'  then '長編'
                                    end);

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
--
-- format と novel_type が揃っていれば、
-- 「食い違い」の行は 0 件になる。
-- ============================================================
select
    format,
    novel_type,
    count(*) as 件数,
    case
        when (format = 'short' and novel_type = '短編')
          or (format = 'long'  and novel_type = '長編')
          or format is null
        then '一致'
        else '食い違い ← 見せてください'
    end as 状態
from public.novels
group by format, novel_type
order by 1, 2;
