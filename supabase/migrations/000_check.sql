-- ============================================================
-- 原石航路 Studio
-- いまどうなっているかを調べる
--
-- 何も書き換えません。読むだけです。
-- SQL Editor に貼って実行し、出た表を見てください。
-- ============================================================

-- 1. テーブルは揃っているか
select
  t.name                                as テーブル,
  case when c.oid is null then '無い' else 'ある' end as 状態
from (values
  ('profiles'), ('novels'), ('episodes'),
  ('episode_versions'), ('resource_pages'), ('resource_entries'),
  ('resource_relations'), ('plot_stages'), ('plot_scenes'),
  ('entry_mentions'), ('work_display_settings'), ('work_ai_settings'),
  ('work_preferences'), ('writing_logs'), ('quick_memos'),
  ('writing_rooms'), ('contests'), ('contest_entries'),
  ('admin_notices'), ('admin_banners'), ('admin_ng_words'),
  ('admin_feature_flags')
) as t(name)
left join pg_class c
  on c.relname = t.name
 and c.relnamespace = 'public'::regnamespace
order by 状態, テーブル;

-- 2. novels に必要な列はあるか
select
  x.name as 列,
  case when c.column_name is null then '無い' else 'ある' end as 状態
from (values
  ('author_note'), ('keywords'), ('catchphrase'), ('age_rating'),
  ('cover_url'), ('visibility'), ('serial_status'), ('deleted_at')
) as x(name)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'novels'
 and c.column_name = x.name
order by 状態, 列;

-- 3. 権限はあるか
select
  table_name as テーブル,
  grantee    as 誰に,
  string_agg(privilege_type, ', ' order by privilege_type) as できること
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in ('novels', 'episodes', 'profiles', 'writing_rooms')
group by table_name, grantee
order by テーブル, 誰に;

-- 4. 中身は入っているか
select 'profiles' as テーブル, count(*) as 件数 from public.profiles
union all select 'novels',   count(*) from public.novels
union all select 'episodes', count(*) from public.episodes;

-- 5. いま誰としてログインしているか（SQL Editor では null になります）
select auth.uid() as 自分のid;
