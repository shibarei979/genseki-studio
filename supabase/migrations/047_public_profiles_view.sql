-- ============================================================
-- 原石航路 Studio
-- 【1つめ】公開してよい列だけの見え方を作る
--
-- これは足すだけです。いまの動きは何も変わりません。
-- 先にこれを流し、コードを送ってから、2つめを流します。
--
-- ------------------------------------------------------------
-- なぜ要るか
--
-- profiles の読み取りが「誰でも可」になっている。
--
--   profiles_select   読む   誰に {}   読む条件 true
--
-- 「誰に {}」は全員の意味。ログインしていない人でも、
-- 全員分の email・生年月日・管理者かどうかが読める。
--
-- ただし、決まりを厳しくするだけでは動かなくなる。
-- 作品ページの作者名、コメントの名前とアイコン、
-- 作品検索の作者名は、どれも他人の profiles を読んでいる。
--
-- そこで、公開してよい列だけを通す道を別に作る。
-- 本体は本人と運営だけに閉じ、外へはこの道だけを開ける。
-- ============================================================

/*
 * 公開してよい列。
 *
 * ここに書いた列だけが外から見える。
 * email・生年月日・login_provider・is_admin は入れない。
 *
 * 実際にある列だけを拾って組み立てる。
 * 決め打ちで書くと、無い列が 1 つあるだけで作れない。
 */
do $$
declare
    allowed text[] := array[
        'user_id',
        'display_name',
        'icon_url',
        'bio',
        'x_account',
        'user_number',
        'allow_comments',
        'created_at'
    ];
    cols text;
begin
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = any(allowed);

    if cols is null then
        raise exception '公開してよい列が 1 つも見つかりません';
    end if;

    execute format(
        'create or replace view public.public_profiles as select %s from public.profiles',
        cols
    );
end $$;

/*
 * 見え方の持ち主を postgres にする。
 *
 * 持ち主の権限で中身を読むので、
 * profiles 本体を閉じたあとも、この道だけは通る。
 */
alter view public.public_profiles owner to postgres;

/* 読むことだけ許す。書き換えは許さない */
revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.views
            where table_schema = 'public' and table_name = 'public_profiles'
        ) then '用意できました'
        else '失敗 ← 確認してください'
    end as 状態;

/* 出ている列を目で見る。email や birthdate が混ざっていないこと */
select string_agg(column_name, ', ' order by ordinal_position) as 外から見える列
from information_schema.columns
where table_schema = 'public' and table_name = 'public_profiles';
