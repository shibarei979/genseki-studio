-- ============================================================
-- 原石航路 Studio
-- テーブルを確実に作る
--
-- 002 が途中で止まるときに使う。
--
-- 外した仕掛け:
--   ・check 制約   … 既存データと合わないと落ちる
--   ・外部キー     … 参照先の形が違うと落ちる
--   ・土台への変更 … すでにあるものを壊さない
--
-- 動くことを優先した形。
-- 整えるのは、動いたあとでよい。
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
-- 2. バージョン履歴
--
-- 差分ではなく全文を控える。復元が単純になり、
-- ひとつ壊れても他の版に影響しない。
-- ============================================================
create table if not exists public.episode_versions (
  id          uuid primary key default gen_random_uuid(),
  episode_id  uuid not null,
  novel_id    uuid not null,
  body        text not null,
  char_count  integer not null default 0,
  trigger     text not null default 'auto'),
  label       text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists episode_versions_episode_idx
  on public.episode_versions (episode_id, created_at desc);

-- ============================================================
-- 3. 資料
--
-- ページ自体を作者が作れるようにするため、
-- 入力欄の構成（fields）と値（values）をデータとして持つ。
-- 型を増やして対応すると、作者が新しい種類を作れなくなる。
-- ============================================================
create table if not exists public.resource_pages (
  id            uuid primary key default gen_random_uuid(),
  novel_id      uuid not null,
  builtin_key   text,
  label         text not null,
  description   text not null default '',
  kind          text not null default 'entries'),
  fields        jsonb not null default '[]',
  is_pinned     boolean not null default false,
  sort_order    integer not null default 0,
  layout        text not null default 'list'),
  image_style   text),
  timeline_mode text not null default 'order'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists resource_pages_novel_idx
  on public.resource_pages (novel_id, sort_order);

create trigger resource_pages_updated_at
  before update on public.resource_pages
  for each row execute function public.handle_updated_at();

create table if not exists public.resource_entries (
  id               uuid primary key default gen_random_uuid(),
  novel_id         uuid not null,
  page_id          uuid not null,
  name             text not null default '',
  -- 別名。統合したときに消えたほうの名前をここへ移す
  aliases          text[] not null default '{}',
  summary          text not null default '',
  values           jsonb not null default '{}',
  is_major         boolean not null default false,
  -- 承認されるまで一覧に混ぜない。rejected は覚えておかないと
  -- 読み直すたびに同じものが候補へ戻ってくる
  candidate_status text not null default 'none'),
  candidate_source text,
  image_url        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists resource_entries_page_idx
  on public.resource_entries (page_id, candidate_status);
create index if not exists resource_entries_novel_idx
  on public.resource_entries (novel_id);

create trigger resource_entries_updated_at
  before update on public.resource_entries
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 4. 関係
--
-- 人物同士に限らない。人物と組織、人物と場所も結べる。
-- 1 つのラベルで固定せず、話数に沿った変化を changes に持つ。
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
  updated_at    timestamptz not null default now(),
);

create index if not exists resource_relations_novel_idx
  on public.resource_relations (novel_id);

-- ============================================================
-- 5. プロット
--
-- 段（柱）と場面（横木）の 2 段構え。
-- 段だけだと大枠しか置けず、書くときに手が動かない。
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

create index if not exists plot_scenes_stage_idx
  on public.plot_scenes (stage_id, sort_order);

-- ============================================================
-- 6. 本文から資料へのリンク
--
-- 本文には記法を埋め込まない。別テーブルに逃がす。
-- 素のテキストのまま保てば、縦書き表示・書き出し・
-- 投稿サイトへの転送が記法に縛られない。
-- ============================================================
create table if not exists public.entry_mentions (
  id         uuid primary key default gen_random_uuid(),
  novel_id   uuid not null,
  episode_id uuid not null,
  entry_id   uuid not null,
  surface    text not null,
  created_at timestamptz not null default now(),
  unique (episode_id, entry_id, surface)
);

create index if not exists entry_mentions_entry_idx
  on public.entry_mentions (entry_id);

-- ============================================================
-- 7. 作品ごとの設定
--
-- novels に列を足していくより 1:1 の別テーブルへ分ける。
-- 作品を一覧するだけの場面で、使わない設定値まで読まずに済む。
-- ============================================================
create table if not exists public.work_display_settings (
  novel_id         uuid primary key,
  writing_mode     text not null default 'horizontal'),
  font_size        integer not null default 16,
  line_height      text not null default 'relaxed'),
  theme            text not null default 'white'),
  page_mode_pc     text not null default 'scroll'),
  page_mode_mobile text not null default 'paged'),
  updated_at       timestamptz not null default now()
);

create table if not exists public.work_ai_settings (
  novel_id              uuid primary key,
  is_enabled            boolean not null default true,
  auto_extract          boolean not null default true,
  approval_mode         text not null default 'manual'),
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
-- 8. 執筆の記録
--
-- 過去に遡って集計はできない。始めた日からしか作れないので、
-- 既定でオンにしてある。
-- ============================================================
create table if not exists public.writing_logs (
  novel_id    uuid not null,
  -- 現地時刻の日付。書き手の「今日」で数える
  log_date    date not null,
  total_chars integer not null default 0,
  delta       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (novel_id, log_date)
);

-- ============================================================
-- 9. 作品に属さないメモ
-- ============================================================
create table if not exists public.quick_memos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  title      text not null default '',
  body       text not null default '',
  novel_id   uuid on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quick_memos_user_idx
  on public.quick_memos (user_id, updated_at desc);

-- ============================================================
-- 10. 執筆室
-- ============================================================
create table if not exists public.writing_rooms (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text not null default '',
  visibility        text not null default 'open'),
  theme             text not null default 'library'),
  host_id           uuid,
  capacity          integer not null default 20,
  allow_chat        boolean not null default true,
  allow_stamps      boolean not null default true,
  allow_host_voice  boolean not null default false,
  chat_limit_count  integer not null default 10,
  chat_limit_minutes integer not null default 10,
  -- 発言を許した人。部屋を立てた人は常に話せる
  speakers          uuid[] not null default '{}',
  -- 入れない人
  banned            uuid[] not null default '{}',
  -- 家具の配置と床・壁
  layout            jsonb not null default '{}',
  -- 運営が用意した部屋か
  is_official       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- すでに作ってあった場合に備えて、足りない列を足す
alter table public.writing_rooms
  add column if not exists speakers uuid[] not null default '{}',
  add column if not exists banned uuid[] not null default '{}',
  add column if not exists layout jsonb not null default '{}',
  -- 運営が用意した部屋か。誰でも名乗れると目印の意味が無くなる
  add column if not exists is_official boolean not null default false;

-- 古い決まりを外して、新しいものを入れ直す
alter table public.writing_rooms drop constraint if exists writing_rooms_visibility_check;
update public.writing_rooms set visibility = 'open' where visibility not in ('link','open');
alter table public.writing_rooms
  add constraint writing_rooms_visibility_check);

-- ============================================================
-- 11. Row Level Security
--
-- 制作中のデータは作者本人だけが読み書きできる。
-- 資料や原稿は公開前の内容なので、他人に見えてはいけない。
-- ============================================================

alter table public.episode_versions      enable row level security;
alter table public.resource_pages        enable row level security;
alter table public.resource_entries      enable row level security;
alter table public.resource_relations    enable row level security;
alter table public.plot_stages           enable row level security;
alter table public.plot_scenes           enable row level security;
alter table public.entry_mentions        enable row level security;
alter table public.work_display_settings enable row level security;
alter table public.work_ai_settings      enable row level security;
alter table public.work_preferences      enable row level security;
alter table public.writing_logs          enable row level security;
alter table public.quick_memos           enable row level security;
alter table public.writing_rooms         enable row level security;

-- 作品の持ち主かどうかを見る。各テーブルで使い回す
create or replace function public.owns_novel(target uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.novels n
    where n.id = target and n.author_id = auth.uid()
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'episode_versions', 'resource_pages', 'resource_entries', 'resource_relations',
    'plot_stages', 'plot_scenes', 'entry_mentions',
    'work_display_settings', 'work_ai_settings', 'work_preferences', 'writing_logs'
  ] loop
    execute format($f$
      drop policy if exists %1$s_owner on public.%1$s;
      create policy %1$s_owner on public.%1$s
        for all
        using (public.owns_novel(novel_id))
        with);
    $f$, t);
  end loop;
end $$;

-- メモは本人のもの
drop policy if exists quick_memos_owner on public.quick_memos;
create policy quick_memos_owner on public.quick_memos
  for all using (auth.uid() = user_id) with = user_id);

-- 部屋は、公式か URL 限定なら誰でも読める。書き換えは立てた人だけ
drop policy if exists writing_rooms_read on public.writing_rooms;
create policy writing_rooms_read on public.writing_rooms
  for select using (visibility <> 'solo' or auth.uid() = host_id);

drop policy if exists writing_rooms_write on public.writing_rooms;
create policy writing_rooms_write on public.writing_rooms
  for all using (auth.uid() = host_id) with = host_id);


-- ============================================================
-- 12. コンテスト
--
-- 運営が立てて、書き手が作品を出す。
-- ============================================================
create table if not exists public.contests (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null default '',
  catchphrase        text not null default '',
  description        text not null default '',
  status             text not null default 'draft'),
  organizer          text not null default '',
  -- 賞は「名前と中身」の組で持つ。1 つの文章にすると並べて見せられない
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
  banner_fit         text not null default 'cover'),
  banner_x           integer not null default 50,
  banner_y           integer not null default 50,
  banner_zoom        integer not null default 100,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists contests_status_idx on public.contests (status, ends_at);

create trigger contests_updated_at
  before update on public.contests
  for each row execute function public.handle_updated_at();

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
  -- 同じ作品を二度出せない
  unique (contest_id, novel_id)
);

-- ============================================================
-- 13. 運営が扱うもの
-- ============================================================
create table if not exists public.admin_notices (
  id           uuid primary key default gen_random_uuid(),
  type         text not null default 'info'),
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
  place      text not null default 'home-side'),
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
  status     text not null default 'on'),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 14. コンテストと運営の見える範囲
--
-- 誰でも読めるが、書けるのは運営だけ。
-- 運営かどうかは profiles.user_role で見る。
-- ============================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.user_role = 'admin'
  );
$$;

alter table public.contests            enable row level security;
alter table public.contest_entries     enable row level security;
alter table public.admin_notices       enable row level security;
alter table public.admin_banners       enable row level security;
alter table public.admin_ng_words      enable row level security;
alter table public.admin_feature_flags enable row level security;

-- 準備中のコンテストは運営だけが見える
drop policy if exists contests_read on public.contests;
create policy contests_read on public.contests
  for select using (status <> 'draft' or public.is_admin());

drop policy if exists contests_write on public.contests;
create policy contests_write on public.contests
  for all using (public.is_admin()) with);

-- 応募は、出した本人と運営が見える
drop policy if exists contest_entries_read on public.contest_entries;
create policy contest_entries_read on public.contest_entries
  for select using (auth.uid() = author_id or public.is_admin());

drop policy if exists contest_entries_insert on public.contest_entries;
create policy contest_entries_insert on public.contest_entries
  for insert with = author_id);

drop policy if exists contest_entries_admin on public.contest_entries;
create policy contest_entries_admin on public.contest_entries
  for update using (public.is_admin()) with);

-- お知らせは、公開されたものを誰でも読める
drop policy if exists admin_notices_read on public.admin_notices;
create policy admin_notices_read on public.admin_notices
  for select using (
    (is_published and published_at <= current_date) or public.is_admin()
  );

drop policy if exists admin_notices_write on public.admin_notices;
create policy admin_notices_write on public.admin_notices
  for all using (public.is_admin()) with);

do $$
declare t text;
begin
  foreach t in array array['admin_banners', 'admin_ng_words', 'admin_feature_flags'] loop
    execute format($f$
      drop policy if exists %1$s_read on public.%1$s;
      create policy %1$s_read on public.%1$s for select using (true);

      drop policy if exists %1$s_write on public.%1$s;
      create policy %1$s_write on public.%1$s
        for all using (public.is_admin()) with);
    $f$, t);
  end loop;
end $$;


-- ============================================================
-- 15. 利用者の一覧を運営が見る
--
-- profiles は本人しか読めない作りなので、
-- 運営だけが全員を見られる道を足す。
-- ============================================================
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles
  for select using (public.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for update using (public.is_admin()) with);

-- 停止された人は書けない。読むのは許す
create or replace function public.is_active()
returns boolean language sql stable security definer as $$
  select not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.suspended_at is not null
  );
$$;

drop policy if exists novels_write_active on public.novels;
create policy novels_write_active on public.novels
  for all using (auth.uid() = author_id and public.is_active())
  with = author_id and public.is_active());


-- ============================================================
-- 16. 登録したら profiles を作る
--
-- auth.users に行ができた瞬間に、対応する profiles を作る。
-- 画面側で作ると、作られる前に読みに行って空になることがある。
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, display_name, email, login_provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', '名無しの書き手'),
    coalesce(new.email, ''),
    case
      when new.raw_app_meta_data->>'provider' = 'google' then 'google'
      else 'email'
    end
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
-- 17. 公式の部屋は運営だけが立てられる
-- ============================================================
drop policy if exists writing_rooms_write on public.writing_rooms;
create policy writing_rooms_write on public.writing_rooms
  for all using (
    (auth.uid() = host_id and not is_official) or public.is_admin()
  )
  with = host_id and not is_official) or public.is_admin()
  );




-- ============================================================
-- 控えを取り直す

-- ============================================================
-- 列を 1 つずつ足す
--
-- まとめて足すと、1 つ失敗しただけで全部が入らない。
-- 1 文ずつ包み、失敗したものだけ飛ばす。
-- ============================================================
do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    -- 利用者の権限と停止
    $q$alter table public.profiles add column if not exists user_role text not null default 'user'$q$,
    $q$alter table public.profiles add column if not exists suspended_at timestamptz$q$,
    $q$alter table public.profiles add column if not exists suspend_reason text not null default ''$q$,
    $q$alter table public.profiles add column if not exists created_at timestamptz not null default now()$q$,
    $q$alter table public.profiles add column if not exists updated_at timestamptz not null default now()$q$,
    $q$alter table public.profiles alter column display_name set default '名無しの書き手'$q$,

    -- 制作ツールで使う列
    $q$alter table public.novels add column if not exists author_note text default ''$q$,
    $q$alter table public.novels add column if not exists keywords text[] default '{}'$q$,
    $q$alter table public.novels add column if not exists catchphrase text default ''$q$,
    $q$alter table public.novels add column if not exists age_rating text default 'all'$q$,
    $q$alter table public.novels add column if not exists cover_url text$q$,
    $q$alter table public.novels add column if not exists visibility text default 'draft'$q$,
    $q$alter table public.novels add column if not exists serial_status text default 'ongoing'$q$,
    $q$alter table public.novels add column if not exists deleted_at timestamptz$q$,

    -- 話の進み具合と文字数
    $q$alter table public.episodes add column if not exists draft_status text default 'todo'$q$,
    $q$alter table public.episodes add column if not exists char_count integer default 0$q$,
    $q$alter table public.episodes add column if not exists scanned_length integer default 0$q$,
    $q$alter table public.episodes add column if not exists deleted_at timestamptz$q$
  ] loop
    begin
      execute stmt;
    exception when others then
      -- 失敗しても続ける。何が通らなかったかだけ知らせる
      raise notice '飛ばしました: % （%）', stmt, sqlerrm;
    end;
  end loop;
end $$;

-- 決まりを入れ直す。列が揃ってからでないと付けられない
do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    $q$alter table public.profiles drop constraint if exists profiles_user_role_check$q$,
    $q$alter table public.profiles add constraint profiles_user_role_check check (user_role in ('user','admin'))$q$,
    $q$alter table public.novels drop constraint if exists novels_age_rating_check$q$,
    $q$alter table public.novels add constraint novels_age_rating_check check (age_rating in ('all','r15','r18'))$q$,
    $q$alter table public.novels drop constraint if exists novels_visibility_check$q$,
    $q$alter table public.novels add constraint novels_visibility_check check (visibility in ('draft','limited','public'))$q$,
    $q$alter table public.novels drop constraint if exists novels_serial_status_check$q$,
    $q$alter table public.novels add constraint novels_serial_status_check check (serial_status in ('ongoing','completed','paused'))$q$,
    $q$alter table public.episodes drop constraint if exists episodes_draft_status_check$q$,
    $q$alter table public.episodes add constraint episodes_draft_status_check check (draft_status in ('todo','writing','done'))$q$
  ] loop
    begin
      execute stmt;
    exception when others then
      raise notice '飛ばしました: % （%）', stmt, sqlerrm;
    end;
  end loop;
end $$;

-- ============================================================
-- 17.9 最上位の運営
--
-- gensekikoro@gmail.com は、誰にも解除できない運営とする。
--
-- 権限の付け外しは運営どうしでできてしまう。
-- 誤って外したり、乗っ取られたりしたときに、
-- 戻す道が 1 本も無くなるのを避ける。
--
-- 登録より先にこの SQL を流しても効くよう、
-- 登録の引き金からも同じ判定をする。
-- ============================================================

/** 誰にも解除できない運営のメール */
create or replace function public.root_admin_email()
returns text language sql immutable as $$
  select 'gensekikoro@gmail.com';
$$;

-- すでに登録していれば、いま運営にする
update public.profiles p
set user_role = 'admin'
from auth.users u
where u.id = p.user_id
  and lower(u.email) = public.root_admin_email();

-- 権限を落とせないようにする
create or replace function public.protect_root_admin()
returns trigger language plpgsql security definer as $$
declare
  target_email text;
begin
  select lower(email) into target_email from auth.users where id = new.user_id;

  if target_email = public.root_admin_email() then
    -- 何を送られても運営のまま。停止もできない
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

-- 行ごと消されるのも防ぐ
create or replace function public.block_root_admin_delete()
returns trigger language plpgsql security definer as $$
begin
  if exists (
    select 1 from auth.users u
    where u.id = old.user_id and lower(u.email) = public.root_admin_email()
  ) then
    raise exception 'この利用者は削除できません';
  end if;
  return old;
end;
$$;

drop trigger if exists block_root_admin_delete on public.profiles;
create trigger block_root_admin_delete
  before delete on public.profiles
  for each row execute function public.block_root_admin_delete();

-- 登録した瞬間から運営にする
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, display_name, email, login_provider, user_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', '名無しの書き手'),
    coalesce(new.email, ''),
    case
      when new.raw_app_meta_data->>'provider' = 'google' then 'google'
      else 'email'
    end,
    case
      when lower(coalesce(new.email, '')) = public.root_admin_email() then 'admin'
      else 'user'
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;


-- ============================================================
-- 権限
--
-- RLS を入れただけでは足りない。
--
--   GRANT … そのテーブルに触れてよいか
--   RLS   … どの行に触れてよいか
--
-- 別の仕組みなので、両方が要る。
-- GRANT が無いと「permission denied」になる。
-- ============================================================
grant usage on schema public to anon, authenticated;
grant all on all tables    in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;

-- これから作るテーブルにも同じように
alter default privileges in schema public
  grant all on tables to anon, authenticated;
alter default privileges in schema public
  grant all on sequences to anon, authenticated;

-- ============================================================
notify pgrst, 'reload schema';

do $$
declare
  missing text[] := '{}';
  t text;
begin
  foreach t in array array[
    'episode_versions', 'resource_pages', 'resource_entries',
    'resource_relations', 'plot_stages', 'plot_scenes', 'entry_mentions',
    'work_display_settings', 'work_ai_settings', 'work_preferences',
    'writing_logs', 'quick_memos', 'writing_rooms',
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

  raise notice 'テーブルが揃いました';
end $$;
