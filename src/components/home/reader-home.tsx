import { createClient } from '@/lib/supabase/server'

import { getCachedRecommendScores, buildRecommendation } from '@/lib/recommend'
import BookInfoPopup from '@/components/home/book-info-popup'
import ReaderSidebar from '@/components/home/reader-sidebar'
import BookshelfSection from '@/components/home/bookshelf-section'
import HomeEffects from '@/components/home/home-effects'
import ReadingListSection from '@/components/home/reading-list-section'
import WorksSection from '@/components/home/works-section'
import Footer from '@/components/layout/footer'
import Header from '@/components/layout/header'
import type { HomeBook, HomeNotice } from '@/types/home'

/*
 * revalidate はページ側で持つ。
 * 部品に書いても効かないので、page.tsx へ移した。
 */

// ============================================================
// 定数
// ============================================================
const SHELF_COUNT = 25        // 本棚ループの冊数（左右10冊 + 中央1冊 + 裏側 / layout_calc.js の B_SIDE_COUNT=10 に対応）
const WORKS_POOL_COUNT = 20   // Pick Up! / New Release! の候補プール数（初期表示は10冊）
const READING_LIST_COUNT = 8  // 4カラムリストの各件数
const NOTICE_COUNT = 8        // お知らせの最大表示件数（畳み込み時は4件）
const HEAD_LENGTH = 120       // 本文冒頭の文字数
const EXCERPT_LENGTH = 80     // 抜粋の文字数
const NOTICE_FALLBACK_IMAGE = '/home/img/notice/tmp.png'

// ============================================================
// ユーティリティ
// ============================================================
function truncate(text: string | null | undefined, length: number): string {
  if (!text) return ''
  const t = text.replace(/\r?\n/g, ' ').trim()
  return t.length > length ? t.slice(0, length) + '…' : t
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 件数固定のセクションを「準備中」で末尾まで埋める（レイアウトは変えない） */
function padWithPlaceholders(books: HomeBook[], count: number, kind: string): HomeBook[] {
  const padded = books.slice(0, count)
  while (padded.length < count) {
    padded.push({
      id: `${kind}-placeholder-${padded.length}`,
      href: '#',
      title: '作品タイトル（準備中）',
      author: '作者（準備中）',
      tags: ['ジャンル'],
      head: '',
      excerpt: '',
      comment: '',
      likes: 0,
      placeholder: true,
    })
  }
  return padded
}

function formatMonthDay(dateText: string): string {
  const d = new Date(dateText)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

interface NovelRow {
  id: string
  title: string
  summary: string | null
  catchcopy: string | null
  genre: string
  tags: string[] | null
  author_id: string
  created_at: string
}

/** novels 行 + 付随情報 → 本の統一フォーマット（デザインの book_template.js と同一キー） */
function toBook(
  novel: NovelRow,
  extras: {
    authorMap: Record<string, string>
    likeMap: Record<string, number>
    headMap: Record<string, string>
    commentMap: Record<string, string>
  },
  href?: string,
): HomeBook {
  return {
    id: novel.id,
    href: href ?? `/novel/${novel.id}`,
    title: novel.title,
    author: extras.authorMap[novel.author_id] || '不明な作者',
    tags: [novel.genre, ...(novel.tags || [])].filter(Boolean).slice(0, 7),
    head: extras.headMap[novel.id] || truncate(novel.summary, HEAD_LENGTH),
    excerpt: truncate(novel.catchcopy || novel.summary, EXCERPT_LENGTH),
    comment: extras.commentMap[novel.id] || '',
    likes: extras.likeMap[novel.id] || 0,
  }
}

// ============================================================
// ページ本体
// ============================================================
export default async function ReaderHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ----- 作品プール（新着60冊）とおすすめスコア -----
  const [{ data: newestRaw }, scoredAll] = await Promise.all([
    supabase
      .from('novels')
      .select('id, title, summary, catchcopy, genre, tags, author_id, created_at')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(60),
    getCachedRecommendScores(),
  ])
  const newest: NovelRow[] = newestRaw || []
  const novelById: Record<string, NovelRow> = {}
  newest.forEach((n) => { novelById[n.id] = n })

  // ----- ユーザーがよく読むジャンル（旧トップページと同じロジック） -----
  let favoriteGenres: string[] = []
  if (user) {
    const { data: myReads } = await supabase
      .from('read_episodes').select('novel_id').eq('user_id', user.id).limit(100)
    const readNovelIds = Array.from(new Set((myReads || []).map((r: any) => r.novel_id)))
    if (readNovelIds.length > 0) {
      const { data: readNovels } = await supabase.from('novels').select('genre').in('id', readNovelIds)
      const genreCount: Record<string, number> = {}
      readNovels?.forEach((n: any) => { genreCount[n.genre] = (genreCount[n.genre] || 0) + 1 })
      favoriteGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g)
    }
  }

  // ----- Pick Up!（おすすめアルゴリズム）/ New Release! -----
  const pickedScored = buildRecommendation(scoredAll, WORKS_POOL_COUNT, favoriteGenres, user?.id)
  const pickupNovels: NovelRow[] = pickedScored.length > 0
    ? pickedScored.map((s) => ({
        id: s.id, title: s.title, summary: s.summary, catchcopy: s.catchcopy,
        genre: s.genre, tags: s.tags, author_id: s.author_id, created_at: s.created_at,
      }))
    : shuffle(newest).slice(0, WORKS_POOL_COUNT)
  pickupNovels.forEach((n) => { if (!novelById[n.id]) novelById[n.id] = n })

  const newReleaseNovels = newest.slice(0, WORKS_POOL_COUNT)
  const shelfNovels = shuffle(newest).slice(0, SHELF_COUNT)

  // ----- ログインユーザー向け 4カラムリストの素材 -----
  const continueRows: { novel: NovelRow; epId: string }[] = []
  let recommendedNovels: NovelRow[] = []
  const followedUpdateRows: { novel: NovelRow; epId: string }[] = []
  let followedNewNovels: NovelRow[] = []

  if (user) {
    // 続きから読む（閲覧履歴 /history と同じ page_views ベース）
    const { data: views } = await supabase
      .from('page_views')
      .select('episode_id, viewed_at')
      .eq('user_id', user.id)
      .order('viewed_at', { ascending: false })
      .limit(100)
    const epIds = Array.from(new Set((views || []).map((v: any) => v.episode_id).filter(Boolean))).slice(0, 40)
    if (epIds.length > 0) {
      const { data: viewedEps } = await supabase
        .from('episodes')
        .select('id, novel_id, novels(id, title, summary, catchcopy, genre, tags, author_id, created_at, published)')
        .in('id', epIds as string[])
      const orderedEps = (epIds as string[])
        .map((id) => (viewedEps || []).find((e: any) => e.id === id))
        .filter(Boolean) as any[]
      const seen = new Set<string>()
      for (const ep of orderedEps) {
        const novel = ep.novels as NovelRow & { published?: boolean } | null
        if (!novel?.id || !novel.published || seen.has(novel.id)) continue
        seen.add(novel.id)
        continueRows.push({ novel, epId: ep.id })
        novelById[novel.id] = novel
        if (continueRows.length >= READING_LIST_COUNT) break
      }
    }

    // あなたへのおすすめ
    recommendedNovels = buildRecommendation(scoredAll, READING_LIST_COUNT, favoriteGenres, user.id)
      .map((s) => ({
        id: s.id, title: s.title, summary: s.summary, catchcopy: s.catchcopy,
        genre: s.genre, tags: s.tags, author_id: s.author_id, created_at: s.created_at,
      }))
    recommendedNovels.forEach((n) => { if (!novelById[n.id]) novelById[n.id] = n })

    // フォローした作者の作品（更新 = 既存作品の新しい話 / 新着 = 新しい作品）
    const { data: follows } = await supabase
      .from('follows').select('following_id').eq('follower_id', user.id)
    const followingIds = (follows || []).map((f: any) => f.following_id)
    if (followingIds.length > 0) {
      const { data: followedNovelsRaw } = await supabase
        .from('novels')
        .select('id, title, summary, catchcopy, genre, tags, author_id, created_at')
        .eq('published', true)
        .in('author_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(30)
      const followedNovels: NovelRow[] = followedNovelsRaw || []
      followedNovels.forEach((n) => { novelById[n.id] = n })
      followedNewNovels = followedNovels.slice(0, READING_LIST_COUNT)

      if (followedNovels.length > 0) {
        const { data: recentEps } = await supabase
          .from('episodes')
          .select('id, novel_id, ep_number, created_at')
          .in('novel_id', followedNovels.map((n) => n.id))
          .gt('ep_number', 1)
          .order('created_at', { ascending: false })
          .limit(40)
        const seen = new Set<string>()
        for (const ep of recentEps || []) {
          if (seen.has(ep.novel_id)) continue
          seen.add(ep.novel_id)
          const novel = novelById[ep.novel_id]
          if (novel) followedUpdateRows.push({ novel, epId: ep.id })
          if (followedUpdateRows.length >= READING_LIST_COUNT) break
        }
      }
    }
  }

  // ----- 付随情報（作者名 / いいね数 / 本文冒頭 / 発掘コメント）を一括取得 -----
  const allIds = Object.keys(novelById)
  const allAuthorIds = Array.from(new Set(Object.values(novelById).map((n) => n.author_id)))

  const [{ data: authors }, { data: likeRows }, { data: firstEps }, { data: discoverRows }] = await Promise.all([
    supabase.from('profiles').select('user_id, display_name').in('user_id', allAuthorIds),
    supabase.from('likes').select('novel_id').in('novel_id', allIds),
    supabase.from('episodes').select('novel_id, body').eq('ep_number', 1).in('novel_id', allIds),
    supabase.from('discovers').select('novel_id, comment')
      .in('novel_id', allIds).not('comment', 'is', null).eq('is_pending', false)
      .order('created_at', { ascending: false }).limit(200),
  ])

  const authorMap: Record<string, string> = {}
  authors?.forEach((a: any) => { authorMap[a.user_id] = a.display_name })
  const likeMap: Record<string, number> = {}
  likeRows?.forEach((l: any) => { likeMap[l.novel_id] = (likeMap[l.novel_id] || 0) + 1 })
  const headMap: Record<string, string> = {}
  firstEps?.forEach((e: any) => { if (!headMap[e.novel_id]) headMap[e.novel_id] = truncate(e.body, HEAD_LENGTH) })
  const commentMap: Record<string, string> = {}
  discoverRows?.forEach((d: any) => { if (!commentMap[d.novel_id]) commentMap[d.novel_id] = truncate(d.comment, EXCERPT_LENGTH) })

  const extras = { authorMap, likeMap, headMap, commentMap }

  // ----- 本の統一フォーマットへ変換 -----
  // 各セクションの冊数はデザインで固定（本棚20 / works各10 / 4カラム各8）。
  // 実データが足りない分は「準備中」で末尾を埋め、レイアウトは変えない。
  const shelfBooks = padWithPlaceholders(shelfNovels.map((n) => toBook(n, extras)), SHELF_COUNT, 'shelf')
  const pickupPool = pickupNovels.map((n) => toBook(n, extras))       // 「更新」用プール（実データのみ）
  const newReleasePool = newReleaseNovels.map((n) => toBook(n, extras))

  const readingListColumns = user
    ? [
        { title: '続きから読む', items: continueRows.map((r) => toBook(r.novel, extras, `/novel/${r.novel.id}/episode/${r.epId}`)) },
        { title: 'あなたへのおすすめ', items: recommendedNovels.map((n) => toBook(n, extras)) },
        { title: 'フォローした作者の更新', items: followedUpdateRows.map((r) => toBook(r.novel, extras, `/novel/${r.novel.id}/episode/${r.epId}`)) },
        { title: 'フォローした作者の新着', items: followedNewNovels.map((n) => toBook(n, extras)) },
      ].map((col, i) => ({ ...col, items: padWithPlaceholders(col.items, READING_LIST_COUNT, `rl${i}`) }))
    : []

  // ----- お知らせ / コンテスト -----
  const [{ data: annRows }, { data: contestRows }] = await Promise.all([
    supabase.from('announcements').select('id, title, body, link, image_url, created_at')
      .eq('is_published', true).order('created_at', { ascending: false }).limit(NOTICE_COUNT),
    supabase.from('contests').select('id, title, description, image_url, is_site_contest, apply_url, created_at')
      .eq('is_published', true).order('created_at', { ascending: false }).limit(NOTICE_COUNT),
  ])

  type DatedNotice = HomeNotice & { createdAt: string }
  const strip = ({ createdAt: _createdAt, ...n }: DatedNotice): HomeNotice => n

  const datedNotices: DatedNotice[] = (annRows || []).map((a: any) => ({
    id: `ann-${a.id}`,
    href: a.link || `/announcements/${a.id}`,
    image: a.image_url || NOTICE_FALLBACK_IMAGE,
    time: formatMonthDay(a.created_at),
    title: a.title,
    detail: truncate(a.body, EXCERPT_LENGTH),
    createdAt: a.created_at,
  }))
  const datedContests: DatedNotice[] = (contestRows || []).map((c: any) => ({
    id: `con-${c.id}`,
    href: c.is_site_contest ? `/contests/${c.id}` : (c.apply_url || '/contests'),
    image: c.image_url || NOTICE_FALLBACK_IMAGE,
    time: formatMonthDay(c.created_at),
    title: c.title,
    detail: truncate(c.description, EXCERPT_LENGTH),
    createdAt: c.created_at,
  }))
  const noticeItems = datedNotices.map(strip)

  /*
   * 左の柱に渡すもの。
   *
   * 読みかけは、続きから読むの先頭。
   * 一番最近ひらいた作品が来る。
   */
  const first = continueRows[0]
  const sidebarReading = first
    ? {
        novelId: first.novel.id,
        episodeId: first.epId,
        title: first.novel.title,
        updatedAt: first.novel.created_at,
        episodeLabel: '続きから',
      }
    : null

  /* お知らせは 3 件まで。柱に並べすぎない */
  const sidebarNotices = datedNotices.slice(0, 3).map((n) => ({
    id: n.id,
    href: n.href,
    date: formatMonthDay(n.createdAt),
    title: n.title,
  }))
  const contestItems = datedContests.map(strip)
  const allNotices = [...datedNotices, ...datedContests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, NOTICE_COUNT)
    .map(strip)

  // ============================================================
  // レンダリング
  // テーマ・ビュー・ログイン状態は <body> の data 属性が持つ
  // （src/app/layout.tsx がサイト全体で一元管理）
  // ============================================================
  return (
    <>
    {/*
     * ヘッダーと足は囲いの外に置く。
     *
     * 参照元の CSS は * に字と余白をあてているので、
     * 中に入れるとヘッダーの並びまで崩れる。
     */}
    <Header />

    <div className="flex min-h-screen">
      {/*
       * 左の柱は囲いの外に置く。
       *
       * 参照元の CSS は * に字・余白・色をあてているので、
       * 中に入れると柱の組（Tailwind）が全部打ち消される。
       */}
      <aside className="relative hidden w-[300px] shrink-0 border-r border-line bg-surface xl:block">
        <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto px-5 py-5">
          <ReaderSidebar reading={sidebarReading} notices={sidebarNotices} />
        </div>
      </aside>

      {/* 右側だけを、参照元の見た目で囲う */}
      <div
        id="home-page"
        className="reader-home min-w-0 flex-1"
        data-theme="light"
        data-view="reader"
        data-auth={user ? 'login' : 'guest'}
      >
      <main>
        <BookInfoPopup />

        <div className="rh_main">
            <BookshelfSection books={shelfBooks} />
        <WorksSection
          kind="pickup"
          title="おすすめの作品"
          moreHref="/ranking"
          moreLabel="もっと見る"
          items={padWithPlaceholders(pickupPool, 10, 'pickup')}
        />
        <WorksSection
          kind="new_release"
          title="新しく届いた作品"
          moreHref="/search"
          moreLabel="もっと見る"
          items={padWithPlaceholders(newReleasePool, 10, 'new')}
        />
        {readingListColumns.length > 0 && <ReadingListSection columns={readingListColumns} />}
        </div>
      </main>

      <HomeEffects pools={{ pickupPool, newReleasePool }} />
      </div>
    </div>

    <Footer />
    </>
  )
}
