-- ============================================================
-- 原石航路 Studio
-- 画像を置く許し
--
-- お知らせの画像が public-images に入らない件。
-- いまある insert の決まりは条件が合っておらず、
-- notices/ への置き込みが弾かれている。
--
-- 「ログインした人は public-images に置ける」という
-- 引き継ぎどおりの許しを 1 枚足す。既存の決まりは触らない。
-- 何度実行しても壊れない。
-- ============================================================

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename  = 'objects'
          and policyname = 'genseki public-images insert'
    ) then
        create policy "genseki public-images insert"
        on storage.objects
        for insert
        to authenticated
        with check (bucket_id = 'public-images');
    end if;

    -- 差し替えたとき、前の絵を片づける許しも同じ形で
    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename  = 'objects'
          and policyname = 'genseki public-images delete'
    ) then
        create policy "genseki public-images delete"
        on storage.objects
        for delete
        to authenticated
        using (bucket_id = 'public-images');
    end if;
end $$;

-- ============================================================
-- 確認
-- ============================================================
select policyname as 決まりの名前, cmd as 何に効くか
from pg_policies
where schemaname = 'storage'
  and tablename  = 'objects'
  and policyname like 'genseki%';
