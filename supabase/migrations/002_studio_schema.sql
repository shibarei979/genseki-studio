-- ============================================================
-- 原石航路 Studio — 制作ツールのスキーマ
--
-- Supabase ダッシュボード → SQL Editor に、
-- このファイルの中身を丸ごと貼って実行してください。
--
-- 何度実行しても壊れません。
-- 途中で止まらないよう、こうしてあります。
--
--   ・外部キーを付けない … 参照先の形が違うと落ちる
--   ・制約を付けない     … 既存データと合わないと落ちる
--   ・土台を作り直さない … すでにあるものを壊さない
--   ・列は 1 文ずつ足す  … 1 つ失敗しても他が入る
--   ・索引とポリシーも包む … 途中で止まらない
--
-- 「飛ばしました」が出ても構いません。
-- 大事なのは、最後の「すべて揃いました」だけです。
--
-- 最後に「すべて揃いました」と出れば成功です。
-- ============================================================

-- ============================================================
-- 0. 共通
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 0.9 章
--
-- 話をまとめる入れ物。
-- 章を作らずに書き始められるので、無い作品もある。
-- ============================================================
create table if not exists public.chapters (
  id         uuid primary key default gen_random_uuid(),
  novel_id   uuid not null,
  title      text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 1. バージョン履歴
-- ============================================================
create table if not exists public.episode_versions (
  id         uuid primary key default gen_random_uuid(),
  episode_id uuid not null,
  novel_id   uuid not null,
  body       text not null default '',
  char_count integer not null default 0,
  trigger    text not null default 'auto',
  label      text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. 資料
-- ============================================================
create table if not exists public.resource_pages (
  id            uuid primary key default gen_random_uuid(),
  novel_id      uuid not null,
  builtin_key   text,
  label         text not null default '',
  description   text not null default '',
  kind          text not null default 'entries',
  fields        jsonb not null default '[]',
  is_pinned     boolean not null default false,
  sort_order    integer not null default 0,
  layout        text not null default 'list',
  image_style   text,
  timeline_mode text not null default 'order',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.resource_entries (
  id               uuid primary key default gen_random_uuid(),
  novel_id         uuid not null,
  page_id          uuid not null,
  name             text not null default '',
  aliases          text[] not null default '{}',
  summary          text not null default '',
  values           jsonb not null default '{}',
  is_major         boolean not null default false,
  candidate_status text not null default 'none',
  candidate_source text,
  image_url        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- 3. 関係
-- ============================================================
create table if not exists public.resource_relations (
  id            uuid primary key default gen_random_uuid(),
  novel_id      uuid not null,
  from_entry_id uuid not null,
  to_entry_id   uuid not null,
  label         text not null default '',
  note          text not null default '',
  changes       jsonb not null default '[]',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 4. プロット
-- ============================================================
create table if not exists public.plot_stages (
  id            uuid primary key default gen_random_uuid(),
  novel_id      uuid not null,
  title         text not null default '',
  description   text not null default '',
  episode_range text not null default '',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.plot_scenes (
  id            uuid primary key default gen_random_uuid(),
  novel_id      uuid not null,
  stage_id      uuid not null,
  title         text not null default '',
  description   text not null default '',
  episode_range text not null default '',
  entry_ids     uuid[] not null default '{}',
  is_done       boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 5. 本文から資料へのリンク
-- ============================================================
create table if not exists public.entry_mentions (
  id         uuid primary key default gen_random_uuid(),
  novel_id   uuid not null,
  episode_id uuid not null,
  entry_id   uuid not null,
  surface    text not null default '',
  created_at timestamptz not null default now(),
  unique (episode_id, entry_id, surface)
);

-- ============================================================
-- 6. 作品ごとの設定
-- ============================================================
create table if not exists public.work_display_settings (
  novel_id         uuid primary key,
  writing_mode     text not null default 'horizontal',
  font_size        integer not null default 16,
  line_height      text not null default 'relaxed',
  theme            text not null default 'white',
  page_mode_pc     text not null default 'scroll',
  page_mode_mobile text not null default 'paged',
  updated_at       timestamptz not null default now()
);

create table if not exists public.work_ai_settings (
  novel_id              uuid primary key,
  is_enabled            boolean not null default true,
  auto_extract          boolean not null default true,
  approval_mode         text not null default 'manual',
  extract_characters    boolean not null default true,
  extract_places        boolean not null default true,
  extract_organizations boolean not null default true,
  extract_terms         boolean not null default true,
  extract_events        boolean not null default true,
  suggest_links         boolean not null default true,
  generate_images       boolean not null default true,
  updated_at            timestamptz not null default now()
);

create table if not exists public.work_preferences (
  novel_id        uuid primary key,
  record_progress boolean not null default true,
  daily_goal      integer not null default 0,
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 7. 執筆の記録
-- ============================================================
create table if not exists public.writing_logs (
  novel_id    uuid not null,
  log_date    date not null,
  total_chars integer not null default 0,
  delta       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (novel_id, log_date)
);

-- ============================================================
-- 8. 作品に属さないメモ
-- ============================================================
create table if not exists public.quick_memos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  title      text not null default '',
  body       text not null default '',
  novel_id   uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 9. 執筆室
-- ============================================================
create table if not exists public.writing_rooms (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null default '',
  description        text not null default '',
  visibility         text not null default 'open',
  theme              text not null default 'library',
  host_id            uuid,
  capacity           integer not null default 20,
  allow_chat         boolean not null default true,
  allow_stamps       boolean not null default true,
  allow_host_voice   boolean not null default false,
  chat_limit_count   integer not null default 10,
  chat_limit_minutes integer not null default 10,
  /*
   * 話してよい人・締め出した人。
   *
   * uuid ではなく text で持つ。
   * ログインしていない人は端末ごとの目印を使うので、
   * uuid の形をしていない。
   */
  speakers           text[] not null default '{}',
  banned             text[] not null default '{}',
  layout             jsonb not null default '{}',
  is_official        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- 9.5 部屋の模様の控え
--
-- 一度作った家具の並びを、名前を付けて残す。
-- 次に部屋を立てるとき、そこから始められる。
-- ============================================================
create table if not exists public.room_presets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  name          text not null default '',
  layout        jsonb not null default '{}',
  thumbnail_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 9.8 お問い合わせ
--
-- フッターの「お問い合わせ」から届く。
-- 送るのは誰でもできるが、読めるのは運営だけ。
-- ============================================================
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  name       text not null default '',
  email      text not null default '',
  category   text not null default '',
  body       text not null default '',
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9.9 通報
--
-- 執筆室で見かけた発言や人を、運営へ知らせる。
--
-- 発言の本文をそのまま控える。
-- 「誰々が言った」だけでは、運営が見に行ったときには
-- 消えていて確かめようがない。
-- ============================================================
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  target        text not null default 'message',
  reason        text not null default 'other',
  note          text not null default '',

  room_id       uuid,
  room_name     text not null default '',

  accused_id    uuid,
  accused_name  text not null default '',
  quoted_body   text not null default '',

  reporter_id   uuid,
  reporter_name text not null default '',

  status        text not null default 'open',
  memo          text not null default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 10. コンテスト
/*
 * 日どりを、時刻まで持てるようにする。
 *
 * date のままだと「8月20日 20:00」と入れても
 * 時刻が落ちて「8月20日」になる。
 * 締め切りは、その日のいつまでかで意味が変わる。
 */
do $$
declare c text;
begin
  foreach c in array array['starts_at', 'ends_at', 'result_at']
  loop
    execute format(
      'alter table public.contests alter column %I type timestamptz '
      'using %I::timestamptz', c, c);
  end loop;
exception when others then
  raise notice '日どりの型を飛ばしました（%）', sqlerrm;
end $$;

-- ============================================================
create table if not exists public.contests (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null default '',
  catchphrase        text not null default '',
  description        text not null default '',
  status             text not null default 'draft',
  organizer          text not null default '',
  prizes             jsonb not null default '[]',
  theme              text not null default '',
  audience           text not null default '',
  checkpoints        jsonb not null default '[]',
  starts_at          date not null default current_date,
  ends_at            date not null default current_date,
  result_at          date not null default current_date,
  min_chars          integer not null default 0,
  max_chars          integer not null default 0,
  genres             text[] not null default '{}',
  entry_limit        integer not null default 1,
  allow_published    boolean not null default true,
  eligibility        text not null default '',
  required_materials text not null default '',
  allow_unfinished   boolean not null default true,
  ai_policy          text not null default '',
  steps              jsonb not null default '[]',
  notices            jsonb not null default '[]',
  terms              text not null default '',
  banner_url         text,
  banner_fit         text not null default 'cover',
  banner_x           integer not null default 50,
  banner_y           integer not null default 50,
  banner_zoom        integer not null default 100,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.contest_entries (
  id             uuid primary key default gen_random_uuid(),
  contest_id     uuid not null,
  novel_id       uuid not null,
  author_id      uuid not null,
  author_name    text not null default '',
  work_title     text not null default '',
  char_count     integer not null default 0,
  entered_at     timestamptz not null default now(),
  is_shortlisted boolean not null default false,
  is_awarded     boolean not null default false,
  award_label    text not null default '',
  note           text not null default '',
  unique (contest_id, novel_id)
);

/*
 * 応募の列。
 *
 * 表そのものは前からあるので、create table は飛ばされる。
 * あとで増やした列は、個別に足さないと入らない。
 */
do $$
begin
  execute $q$alter table public.contest_entries
    add column if not exists author_id      uuid,
    add column if not exists author_name    text not null default '',
    add column if not exists work_title     text not null default '',
    add column if not exists char_count     integer not null default 0,
    add column if not exists is_shortlisted boolean not null default false,
    add column if not exists is_awarded     boolean not null default false,
    add column if not exists award_label    text not null default '',
    add column if not exists note           text not null default ''$q$;
exception when others then
  raise notice '応募の列を飛ばしました（%）', sqlerrm;
end $$;

-- ============================================================
-- 11. 運営が扱うもの
-- ============================================================
create table if not exists public.admin_notices (
  id           uuid primary key default gen_random_uuid(),
  type         text not null default 'info',
  title        text not null default '',
  body         text not null default '',
  link         text not null default '',
  image_url    text,
  is_published boolean not null default false,
  published_at date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.admin_banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default '',
  image_url  text,
  link_url   text not null default '',
  place      text not null default 'home-side',
  is_active  boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_ng_words (
  id         uuid primary key default gen_random_uuid(),
  word       text not null unique,
  reason     text not null default '',
  suggestion text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_feature_flags (
  key        text primary key,
  status     text not null default 'on',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 11.5 Studio のテーブルに足りない列を補う
--
-- 前に途中まで作られていると、列が欠けたテーブルが残る。
-- create table if not exists は、すでにあれば何もしないので、
-- 欠けたままになる。ここで 1 つずつ足す。
-- ============================================================
do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    -- コンテスト
    $q$alter table public.contests add column if not exists status text not null default 'draft'$q$,
    $q$alter table public.contests add column if not exists title text not null default ''$q$,
    $q$alter table public.contests add column if not exists catchphrase text not null default ''$q$,
    $q$alter table public.contests add column if not exists description text not null default ''$q$,
    $q$alter table public.contests add column if not exists organizer text not null default ''$q$,
    $q$alter table public.contests add column if not exists prizes jsonb not null default '[]'$q$,
    $q$alter table public.contests add column if not exists theme text not null default ''$q$,
    $q$alter table public.contests add column if not exists audience text not null default ''$q$,
    $q$alter table public.contests add column if not exists checkpoints jsonb not null default '[]'$q$,
    $q$alter table public.contests add column if not exists starts_at date not null default current_date$q$,
    $q$alter table public.contests add column if not exists ends_at date not null default current_date$q$,
    $q$alter table public.contests add column if not exists result_at date not null default current_date$q$,
    $q$alter table public.contests add column if not exists min_chars integer not null default 0$q$,
    $q$alter table public.contests add column if not exists max_chars integer not null default 0$q$,
    $q$alter table public.contests add column if not exists genres text[] not null default '{}'$q$,
    $q$alter table public.contests add column if not exists entry_limit integer not null default 1$q$,
    $q$alter table public.contests add column if not exists allow_published boolean not null default true$q$,
    $q$alter table public.contests add column if not exists eligibility text not null default ''$q$,
    $q$alter table public.contests add column if not exists required_materials text not null default ''$q$,
    $q$alter table public.contests add column if not exists allow_unfinished boolean not null default true$q$,
    $q$alter table public.contests add column if not exists ai_policy text not null default ''$q$,
    $q$alter table public.contests add column if not exists steps jsonb not null default '[]'$q$,
    $q$alter table public.contests add column if not exists notices jsonb not null default '[]'$q$,
    $q$alter table public.contests add column if not exists terms text not null default ''$q$,
    $q$alter table public.contests add column if not exists banner_url text$q$,
    $q$alter table public.contests add column if not exists banner_fit text not null default 'cover'$q$,
    $q$alter table public.contests add column if not exists banner_x integer not null default 50$q$,
    $q$alter table public.contests add column if not exists banner_y integer not null default 50$q$,
    $q$alter table public.contests add column if not exists banner_zoom integer not null default 100$q$,
    $q$alter table public.contests add column if not exists created_at timestamptz not null default now()$q$,
    $q$alter table public.contests add column if not exists updated_at timestamptz not null default now()$q$,

    -- 執筆室
    $q$alter table public.writing_rooms add column if not exists speakers text[] not null default '{}'$q$,
    $q$alter table public.writing_rooms add column if not exists banned text[] not null default '{}'$q$,
    $q$alter table public.writing_rooms add column if not exists layout jsonb not null default '{}'$q$,
    $q$alter table public.writing_rooms add column if not exists is_official boolean not null default false$q$,
    $q$alter table public.writing_rooms add column if not exists visibility text not null default 'open'$q$,
    $q$alter table public.writing_rooms add column if not exists state text not null default 'draft'$q$,
    $q$alter table public.writing_rooms add column if not exists opens_at timestamptz$q$,
    $q$alter table public.writing_rooms add column if not exists opened_at timestamptz$q$,
    $q$alter table public.writing_rooms add column if not exists closed_at timestamptz$q$,
    $q$alter table public.writing_rooms add column if not exists host_seen_at timestamptz$q$,

    -- 資料
    $q$alter table public.resource_pages add column if not exists timeline_mode text not null default 'order'$q$,
    $q$alter table public.resource_pages add column if not exists image_style text$q$,
    $q$alter table public.resource_pages add column if not exists layout text not null default 'list'$q$,
    $q$alter table public.resource_entries add column if not exists image_url text$q$,
    $q$alter table public.resource_entries add column if not exists candidate_source text$q$,

    -- お知らせ
    $q$alter table public.admin_notices add column if not exists image_url text$q$,
    $q$alter table public.admin_notices add column if not exists link text not null default ''$q$,

    -- 履歴
    $q$alter table public.episode_versions add column if not exists label text not null default ''$q$,
    $q$alter table public.episode_versions add column if not exists trigger text not null default 'auto'$q$
  ] loop
    begin
      execute stmt;
    exception when others then
      raise notice '飛ばしました: % （%）', stmt, sqlerrm;
    end;
  end loop;
end $$;

-- ============================================================
-- 11.8 索引
--
-- 列が揃ってから作る。
-- 列の無い状態で作ろうとすると、そこで止まる。
-- ============================================================
do $$
begin
  execute $i$create index if not exists episode_versions_episode_idx
  on public.episode_versions (episode_id, created_at desc)$i$;
exception when others then
  raise notice '索引を飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$create index if not exists resource_pages_novel_idx
  on public.resource_pages (novel_id, sort_order)$i$;
exception when others then
  raise notice '索引を飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$create index if not exists resource_entries_page_idx
  on public.resource_entries (page_id, candidate_status)$i$;
exception when others then
  raise notice '索引を飛ばしました（%）', sqlerrm;
end $$;
do $$
begin
  execute $i$create index if not exists resource_entries_novel_idx
  on public.resource_entries (novel_id)$i$;
exception when others then
  raise notice '索引を飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$create index if not exists resource_relations_novel_idx
  on public.resource_relations (novel_id)$i$;
exception when others then
  raise notice '索引を飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$create index if not exists plot_scenes_stage_idx
  on public.plot_scenes (stage_id, sort_order)$i$;
exception when others then
  raise notice '索引を飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$create index if not exists entry_mentions_entry_idx
  on public.entry_mentions (entry_id)$i$;
exception when others then
  raise notice '索引を飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$create index if not exists quick_memos_user_idx
  on public.quick_memos (user_id, updated_at desc)$i$;
exception when others then
  raise notice '索引を飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$create index if not exists contests_status_idx
  on public.contests (status, ends_at)$i$;
exception when others then
  raise notice '索引を飛ばしました（%）', sqlerrm;
end $$;


-- ============================================================
-- 12. 列を足す
--
-- 1 文ずつ包む。まとめて足すと、
-- 1 つ失敗しただけで全部が入らない。
-- ============================================================
do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    $q$alter table public.profiles add column if not exists user_role text not null default 'user'$q$,
    $q$alter table public.profiles add column if not exists suspended_at timestamptz$q$,
    $q$alter table public.profiles add column if not exists suspend_reason text not null default ''$q$,
    $q$alter table public.profiles add column if not exists birthdate date$q$,
    $q$alter table public.profiles add column if not exists age_verified boolean not null default false$q$,
    $q$alter table public.profiles add column if not exists agreed_at timestamptz$q$,
    $q$alter table public.novels add column if not exists author_note text default ''$q$,
    $q$alter table public.novels add column if not exists keywords text[] default '{}'$q$,
    $q$alter table public.novels add column if not exists catchphrase text default ''$q$,
    $q$alter table public.novels add column if not exists age_rating text default 'all'$q$,
    $q$alter table public.novels add column if not exists cover_url text$q$,
    $q$alter table public.novels add column if not exists cover_tile text$q$,
    $q$alter table public.novels add column if not exists format text$q$,
    $q$alter table public.novels add column if not exists ai_usage text not null default 'none'$q$,
    $q$alter table public.novels add column if not exists notify_on_publish boolean not null default true$q$,
    $q$alter table public.work_display_settings add column if not exists font_family text not null default 'mincho'$q$,
    $q$alter table public.work_display_settings add column if not exists letter_spacing text not null default 'normal'$q$,
    $q$alter table public.novels add column if not exists visibility text default 'draft'$q$,
    $q$alter table public.novels add column if not exists serial_status text default 'ongoing'$q$,
    $q$alter table public.novels add column if not exists deleted_at timestamptz$q$,
    $q$alter table public.episodes add column if not exists draft_status text default 'todo'$q$,
    $q$alter table public.episodes add column if not exists char_count integer default 0$q$,
    $q$alter table public.episodes add column if not exists scanned_length integer default 0$q$,
    $q$alter table public.episodes add column if not exists deleted_at timestamptz$q$,
    $q$alter table public.episodes add column if not exists chapter_id uuid$q$,
    $q$alter table public.episodes add column if not exists is_published boolean not null default false$q$,
    $q$alter table public.episodes add column if not exists publish_at timestamptz$q$,
    $q$alter table public.episodes add column if not exists preface text$q$,
    $q$alter table public.episodes add column if not exists afterword text$q$,
    $q$alter table public.episodes add column if not exists episode_summary text$q$,
    $q$alter table public.novels add column if not exists allow_likes boolean not null default true$q$,
    $q$alter table public.novels add column if not exists allow_bookmarks boolean not null default true$q$,
    $q$alter table public.novels add column if not exists allow_shares boolean not null default true$q$,
    $q$alter table public.work_display_settings add column if not exists reader_mode text not null default 'none'$q$,
    $q$alter table public.resource_entries add column if not exists source_ref text$q$,
    $q$alter table public.work_display_settings add column if not exists letter_spacing text not null default 'normal'$q$
  ] loop
    begin
      execute stmt;
    exception when others then
      raise notice '飛ばしました: % （%）', stmt, sqlerrm;
    end;
  end loop;
end $$;

-- ============================================================
-- 13. 見える範囲
-- ============================================================
create or replace function public.owns_novel(target uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.novels n
    where n.id = target and n.author_id = auth.uid()
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.user_role = 'admin'
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'episode_versions', 'resource_pages', 'resource_entries',
    'resource_relations', 'plot_stages', 'plot_scenes', 'entry_mentions',
    'work_display_settings', 'work_ai_settings', 'work_preferences',
    'writing_logs', 'chapters'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all using (public.owns_novel(novel_id)) with check (public.owns_novel(novel_id))',
      t || '_owner', t
    );
  end loop;
end $$;

do $$
begin
  execute $i$alter table public.reports enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists reports_insert on public.reports$i$;
  -- ログインしていれば誰でも出せる
  execute $i$create policy reports_insert on public.reports
  for insert with check (auth.uid() is not null)$i$;

  execute $i$drop policy if exists reports_admin on public.reports$i$;
  -- 読み書きできるのは運営だけ
  execute $i$create policy reports_admin on public.reports
  for all using (public.is_admin()) with check (public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: reports （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$alter table public.contact_messages enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists contact_messages_insert on public.contact_messages$i$;
  -- 誰でも送れる。ログインしていなくても
  execute $i$create policy contact_messages_insert on public.contact_messages
  for insert with check (true)$i$;

  execute $i$drop policy if exists contact_messages_admin on public.contact_messages$i$;
  -- 読めるのは運営だけ
  execute $i$create policy contact_messages_admin on public.contact_messages
  for select using (public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: contact_messages （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$alter table public.room_presets enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists room_presets_owner on public.room_presets$i$;
  execute $i$create policy room_presets_owner on public.room_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id)$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: room_presets_owner （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$alter table public.quick_memos enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;
do $$
begin
  execute $i$alter table public.writing_rooms enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;
do $$
begin
  execute $i$alter table public.contests enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;
do $$
begin
  execute $i$alter table public.contest_entries enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;
do $$
begin
  execute $i$alter table public.admin_notices enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;
do $$
begin
  execute $i$alter table public.admin_banners enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;
do $$
begin
  execute $i$alter table public.admin_ng_words enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;
do $$
begin
  execute $i$alter table public.admin_feature_flags enable row level security$i$;
exception when others then
  raise notice '飛ばしました（%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists quick_memos_owner on public.quick_memos$i$;
  execute $i$create policy quick_memos_owner on public.quick_memos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id)$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: quick_memos_owner （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists writing_rooms_read on public.writing_rooms$i$;
  execute $i$create policy writing_rooms_read on public.writing_rooms
  for select using (state <> 'draft' or auth.uid() = host_id)$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: writing_rooms_read （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists writing_rooms_write on public.writing_rooms$i$;
  execute $i$create policy writing_rooms_write on public.writing_rooms
  for all
  using ((auth.uid() = host_id and not is_official) or public.is_admin())
  with check ((auth.uid() = host_id and not is_official) or public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: writing_rooms_write （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists contests_read on public.contests$i$;
  execute $i$create policy contests_read on public.contests
  for select using (status <> 'draft' or public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: contests_read （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists contests_write on public.contests$i$;
  execute $i$create policy contests_write on public.contests
  for all using (public.is_admin()) with check (public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: contests_write （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists contest_entries_read on public.contest_entries$i$;
  execute $i$create policy contest_entries_read on public.contest_entries
  for select using (auth.uid() = author_id or public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: contest_entries_read （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists contest_entries_insert on public.contest_entries$i$;
  execute $i$create policy contest_entries_insert on public.contest_entries
  for insert with check (auth.uid() = author_id)$i$;

  execute $i$drop policy if exists contest_entries_delete on public.contest_entries$i$;
  -- 出した本人が取り消せる。運営はどれでも
  execute $i$create policy contest_entries_delete on public.contest_entries
  for delete using (
    auth.uid() = author_id or auth.uid() = user_id or public.is_admin()
  )$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: contest_entries_insert （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists contest_entries_admin on public.contest_entries$i$;
  execute $i$create policy contest_entries_admin on public.contest_entries
  for update using (public.is_admin()) with check (public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: contest_entries_admin （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists admin_notices_read on public.admin_notices$i$;
  execute $i$create policy admin_notices_read on public.admin_notices
  for select using (
    (is_published and published_at <= current_date) or public.is_admin()
  )$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: admin_notices_read （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists admin_notices_write on public.admin_notices$i$;
  execute $i$create policy admin_notices_write on public.admin_notices
  for all using (public.is_admin()) with check (public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: admin_notices_write （%）', sqlerrm;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['admin_banners', 'admin_ng_words', 'admin_feature_flags'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      t || '_write', t
    );
  end loop;
end $$;

do $$
begin
  execute $i$drop policy if exists profiles_admin_read on public.profiles$i$;
  execute $i$create policy profiles_admin_read on public.profiles
  for select using (public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: profiles_admin_read （%）', sqlerrm;
end $$;

do $$
begin
  execute $i$drop policy if exists profiles_admin_write on public.profiles$i$;
  execute $i$create policy profiles_admin_write on public.profiles
  for update using (public.is_admin()) with check (public.is_admin())$i$;
exception when others then
  raise notice 'ポリシーを飛ばしました: profiles_admin_write （%）', sqlerrm;
end $$;

-- ============================================================
-- 14. 登録したら profiles を作る
-- ============================================================
create or replace function public.root_admin_email()
returns text language sql immutable as $$
  select 'gensekikoro@gmail.com';
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (
    user_id, display_name, email, login_provider, user_role,
    birthdate, age_verified, agreed_at
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1),
      '名無しの書き手'
    ),
    coalesce(new.email, ''),
    case
      when new.raw_app_meta_data->>'provider' = 'google' then 'google'
      else 'email'
    end,
    case
      when lower(coalesce(new.email, '')) = public.root_admin_email() then 'admin'
      else 'user'
    end,
    (new.raw_user_meta_data->>'birthdate')::date,
    coalesce((new.raw_user_meta_data->>'age_verified')::boolean, false),
    case when new.raw_user_meta_data ? 'agreed' then now() else null end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 15. 最上位の運営
-- ============================================================
update public.profiles p
set user_role = 'admin'
from auth.users u
where u.id = p.user_id
  and lower(u.email) = public.root_admin_email();

create or replace function public.protect_root_admin()
returns trigger language plpgsql security definer as $$
declare
  target_email text;
begin
  select lower(email) into target_email from auth.users where id = new.user_id;

  if target_email = public.root_admin_email() then
    new.user_role    := 'admin';
    new.suspended_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_root_admin on public.profiles;
create trigger protect_root_admin
  before update on public.profiles
  for each row execute function public.protect_root_admin();

-- ============================================================
-- 16. 権限
--
-- GRANT … そのテーブルに触れてよいか
-- RLS   … どの行に触れてよいか
-- 別の仕組みなので両方が要る。
-- ============================================================
grant usage on schema public to anon, authenticated;
grant all on all tables    in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;

alter default privileges in schema public
  grant all on tables to anon, authenticated;
alter default privileges in schema public
  grant all on sequences to anon, authenticated;

-- ============================================================
-- 17. 控えを取り直す
-- ============================================================
notify pgrst, 'reload schema';

-- ============================================================
-- 18. 確かめ
-- ============================================================
do $$
declare
  missing text[] := '{}';
  t text;
begin
  foreach t in array array[
    'episode_versions', 'resource_pages', 'resource_entries',
    'resource_relations', 'plot_stages', 'plot_scenes', 'entry_mentions',
    'work_display_settings', 'work_ai_settings', 'work_preferences',
    'writing_logs', 'quick_memos', 'writing_rooms', 'room_presets', 'chapters', 'contact_messages', 'reports',
        'contests', 'contest_entries',
    'admin_notices', 'admin_banners', 'admin_ng_words', 'admin_feature_flags'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      missing := missing || t;
    end if;
  end loop;

  if array_length(missing, 1) > 0 then
    raise exception '足りないテーブル: %', array_to_string(missing, ', ');
  end if;

  raise notice 'すべて揃いました';
end $$;

-- 知らせの表
--
-- 運営からのお知らせや、いいね・コメントの知らせを入れる。
-- ヘッダーのベルに出る。

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  -- announcement / like / comment / follow など
  type       text not null default 'announcement',
  message    text not null default '',
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- 自分あてのものを、新しい順に取り出す
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- 自分あてのものだけ読める
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select using (auth.uid() = user_id);

-- 読んだ印を付けられる
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (auth.uid() = user_id);

-- 入れられるのは運営だけ
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (public.is_admin());

notify pgrst, 'reload schema';
