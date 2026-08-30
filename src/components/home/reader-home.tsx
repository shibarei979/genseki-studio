import { createClient } from '@/lib/supabase/server'
import { ageFromBirthdate, allowedRatings } from '@/lib/age'
import { ROOT_ADMIN_EMAIL } from '@/types'
import Link from 'next/link'

import { getCachedRecommendScores, buildRecommendation } from '@/lib/recommend'
import WorkPopupFlag from '@/components/home/work-popup-flag'
import ShelfCardPopup from '@/components/home/shelf-card-popup'
import ReaderSidebar from '@/components/home/reader-sidebar'
import ReaderWorkList from '@/components/home/reader-work-list'
import HomeBannerCarousel from '@/components/home/home-banner-carousel'
import ReaderHero from '@/components/home/reader-hero'
import ShelfNav from '@/components/home/shelf-nav'
import BirthdateNotice from '@/components/birthdate-notice'
import BookshelfSection from '@/components/home/bookshelf-section'
import HomeEffects from '@/components/home/home-effects'
import Footer from '@/components/layout/footer'
import Header from '@/components/layout/header'
import type { HomeBook, HomeNotice } from '@/types/home'
import { loadBlockedIds } from '@/lib/social/blocks'

/*
 * revalidate はページ側で持つ。
 * 部品に書いても効かないので、page.tsx へ移した。
 */

// ============================================================
// 定数
// ============================================================
/* 本棚の冊数。home.js の B_SIDE_COUNT=10 に合わせる */
/* 本棚の冊数。home.js の B_SIDE_COUNT=10 に合わせる */
const SHELF_COUNT = 25
const WORKS_POOL_COUNT = 20   // Pick Up! / New Release! の候補プール数（初期表示は10冊）
const READING_LIST_COUNT = 8  // 4カラムリストの各件数
const NOTICE_COUNT = 8        // お知らせの最大表示件数（畳み込み時は4件）
/*
 * 本を開いたときの左ページに出す字数。
 *
 * 1 話の冒頭ではなく、あらすじを出す。
 * 冒頭は「読めば分かる」もので、
 * どんな話かを知りたい人には遠回り。
 *
 * ページが広いので、書けるだけ書く。
 */
const HEAD_LENGTH = 400
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
  /* 並べ替えと絞り込みに使う */
  updated_at?: string | null
  novel_type?: string | null
  serial_status?: string | null
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
    /*
     * 本に挿す付箋。
     *
     * ジャンルだけ。1 枚に絞る。
     * タグまで並べると、背表紙の上が付箋で埋まり、
     * どれが何の印か分からなくなる。
     */
    tags: [novel.genre].filter(Boolean),
    /* 左ページ。あらすじを出す。無ければ 1 話の冒頭で代える */
    head: truncate(novel.summary, HEAD_LENGTH) || extras.headMap[novel.id] || '',
    /*
     * 帯に出す文。
     *
     * 拡散のひとことだけを出す。
     * あらすじやキャッチコピーは、作者が書いたもの。
     * 帯は「読んだ人の声」を載せる場所なので、
     * 拡散されていない本の帯は空にする。
     */
    excerpt: '',
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

  /*
   * その人が見てよい区分。
   *
   * 生年月日が未設定なら all だけ。
   * 自分の作品と、運営は例外にする。
   */
  const { data: viewer } = user
    ? await supabase
        .from('profiles')
        .select('birthdate, role')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null }

  const ratings = allowedRatings(
    ageFromBirthdate((viewer as { birthdate?: string } | null)?.birthdate),
  )

  const isAdmin =
    user?.email === ROOT_ADMIN_EMAIL ||
    (viewer as { role?: string } | null)?.role === 'admin'

  // ----- 作品プール（新着60冊）とおすすめスコア -----
  const poolQuery = supabase
    .from('novels')
    .select('id, title, summary, catchcopy, genre, tags, author_id, created_at, age_rating, novel_type, serial_status, updated_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(60)

  const [{ data: newestRaw }, scoredAll] = await Promise.all([
    isAdmin
      ? poolQuery
      : /*
         * 自分の作品は年齢に関わらず出す。
         * 書いた本人から自作が消えると、
         * 消されたのかと思って問い合わせが来る。
         */
        poolQuery.or(
          `age_rating.in.(${ratings.join(',')})${user ? `,author_id.eq.${user.id}` : ''}`,
        ),
    getCachedRecommendScores(),
  ])
  /*
   * ブロックした作者の作品を、本棚から落とす。
   *
   * 読み終えてから落とす。問い合わせの側で外そうとすると、
   * 相手が多いときに URL が長くなりすぎて通らない。
   */
  const blockedAuthors = await loadBlockedIds(supabase, user?.id)
  const newest: NovelRow[] = (newestRaw || []).filter(
    (n: NovelRow) => !blockedAuthors.has((n as { author_id?: string }).author_id ?? ''),
  )
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
  /*
   * おすすめも同じ物差しで絞る。
   *
   * 集計そのものは全員で共有しているので、
   * 使う直前にここで落とす。
   */
  const scoredForViewer = isAdmin
    ? scoredAll
    : scoredAll.filter((n) =>
        ratings.includes((n.age_rating as 'all' | 'r15' | 'r18') ?? 'all'),
      )

  const pickedScored = buildRecommendation(scoredForViewer, WORKS_POOL_COUNT, favoriteGenres, user?.id)
  const pickupNovels: NovelRow[] = pickedScored.length > 0
    ? pickedScored.map((s) => ({
        id: s.id, title: s.title, summary: s.summary, catchcopy: s.catchcopy,
        genre: s.genre, tags: s.tags, author_id: s.author_id, created_at: s.created_at,
      }))
    : shuffle(newest).slice(0, WORKS_POOL_COUNT)
  pickupNovels.forEach((n) => { if (!novelById[n.id]) novelById[n.id] = n })

  const newReleaseNovels = newest.slice(0, WORKS_POOL_COUNT)
  /*
   * 本棚に並べる作品。
   *
   * 帯（拡散のひとことか、読者が描いたドット絵）が
   * ある作品を先に並べる。
   *
   * 本棚は「読んだ人の声が付いた本」を見せる場所にする。
   * 声の無い本ばかりでは、ただの新着一覧と変わらない。
   *
   * 帯のある作品だけでは冊数が足りないので、
   * 残りは新着から埋める。その本の帯は空になる。
   */
  const { data: obiRows } = await supabase
    .from('obi_dots')
    .select('novel_id')
    .eq('approved', true)

  const { data: obiCommentRows } = await supabase
    .from('discovers')
    .select('novel_id, comment')
    .not('comment', 'is', null)

  const withObi = new Set<string>()
  ;(obiRows || []).forEach((r: any) => withObi.add(r.novel_id as string))
  ;(obiCommentRows || []).forEach((r: any) => {
    if (String(r.comment ?? '').trim()) withObi.add(r.novel_id as string)
  })

  const shelfWithObi = shuffle(newest.filter((n) => withObi.has(n.id)))
  const shelfWithout = shuffle(newest.filter((n) => !withObi.has(n.id)))

  const shelfNovels = [...shelfWithObi, ...shelfWithout].slice(0, SHELF_COUNT)

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
    recommendedNovels = buildRecommendation(scoredForViewer, READING_LIST_COUNT, favoriteGenres, user.id)
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
    supabase.from('public_profiles').select('user_id, display_name').in('user_id', allAuthorIds),
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

  /*
   * 一覧に出す本。
   *
   * 10 件ずつ。2 列なので 5 行に収まる。
   * 空の枠では埋めない。作品が無ければ、その枠ごと出さない。
   */
  const LIST_SIZE = 10

  const followedBooks = [
    ...followedUpdateRows.map((r) => toBook(r.novel, extras, `/novel/${r.novel.id}/episode/${r.epId}`)),
    ...followedNewNovels.map((n) => toBook(n, extras)),
  ].slice(0, LIST_SIZE)

  /*
   * おすすめ。
   *
   * ログインしていない人には作れない。
   * その場合はこの枠を出さない。
   *
   * 新着で代えると「新しく届いた作品」と
   * 中身が同じ枠が 2 つ並ぶことになる。
   */
  const recommendBooks = recommendedNovels
    .map((n) => toBook(n, extras))
    .slice(0, LIST_SIZE)

  const popularBooks = pickupPool.slice(0, LIST_SIZE)

  /* 続きから読む。読みかけの作品を並べる */
  const continueBooks = continueRows
    .map((r) => toBook(r.novel, extras, `/novel/${r.novel.id}/episode/${r.epId}`))
    .slice(0, LIST_SIZE)

  /* 新しく届いた作品 */
  const newBooks = newReleasePool.slice(0, LIST_SIZE)

  /*
   * 最新話更新。
   *
   * 新しく作品が出たのではなく、
   * 続きが出たものを並べる。
   * 追っている人にとっては、こちらのほうが用がある。
   */
  const updatedBooks = [...newest]
    .filter((n) => n.updated_at && n.updated_at !== n.created_at)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, LIST_SIZE)
    .map((n) => toBook(n, extras))

  /*
   * 新作（おすすめ）。
   *
   * 出たばかりで、点数の高いもの。
   * ただ新しいだけでは、読む手がかりにならない。
   */
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const freshPickBooks = scoredForViewer
    .filter((n) => n.created_at >= monthAgo)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, LIST_SIZE)
    .map((n) => toBook(n as unknown as NovelRow, extras))

  /* 短編。ひと息で読み切れるもの */
  const shortBooks = newest
    .filter((n) => n.novel_type === '短編')
    .slice(0, LIST_SIZE)
    .map((n) => toBook(n, extras))

  /*
   * 完結作品。
   *
   * 終わりまで書かれている。
   * 途中で止まるのが嫌な人に向けて出す。
   */
  const completedBooks = newest
    .filter((n) => n.serial_status === 'completed')
    .slice(0, LIST_SIZE)
    .map((n) => toBook(n, extras))


  // ----- お知らせ / コンテスト -----
  const [{ data: annRows }, { data: contestRows }] = await Promise.all([
    supabase.from('announcements').select('id, title, body, link, image_url, created_at')
      .eq('is_published', true).order('created_at', { ascending: false }).limit(NOTICE_COUNT),
    /*
     * コンテスト。
     *
     * 絵の見せ方（banner_fit / zoom / x / y）まで読む。
     * これが無いと ContestBanner が既定値を使えず、
     * 絵が拡大されて角しか映らない。
     */
    supabase.from('contests').select('id, title, description, image_url, banner_url, banner_fit, banner_zoom, banner_x, banner_y, is_site_contest, apply_url, created_at')
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
  /*
   * 柱に出す読みかけ。
   *
   * 執筆側の「執筆中の作品」と同じ形にする。
   * 最後に読んだ日、いま何話目か、全体の何割かを出す。
   */
  const first = continueRows[0]
  let sidebarReading: {
    novelId: string
    episodeId: string
    title: string
    lastReadAt: string
    episodeLabel: string
    readCount: number
    totalCount: number
  } | null = null

  if (first && user) {
    /* その作品の話を並べ、いま何話目かを数える */
    const { data: eps } = await supabase
      .from('episodes')
      .select('id, ep_number')
      .eq('novel_id', first.novel.id)
      .eq('is_published', true)
      .order('ep_number', { ascending: true })
      .limit(5000)

    const list = eps || []
    const at = list.findIndex((e: any) => e.id === first.epId)

    /* 最後に読んだ日 */
    const { data: lastViewRows } = await supabase
      .from('page_views')
      .select('viewed_at')
      .eq('user_id', user.id)
      .eq('episode_id', first.epId)
      .order('viewed_at', { ascending: false })
      .limit(1)

    const lastView = (lastViewRows || [])[0] as { viewed_at?: string } | undefined

    sidebarReading = {
      novelId: first.novel.id,
      episodeId: first.epId,
      title: first.novel.title,
      lastReadAt: lastView?.viewed_at || '',
      episodeLabel:
        at >= 0 ? `${at + 1}話目まで` : '続きから',
      readCount: at >= 0 ? at + 1 : 0,
      totalCount: list.length,
    }
  }

  /*
   * 柱に出すお知らせ。
   *
   * お知らせの置き場は 2 つある。
   *   admin_notices  … Studio で作ったもの
   *   announcements  … 前の版から引き継いだもの
   * 片方だけ読むと、書いたのに出てこないことになる。
   */
  const { data: adminNoticeRows } = await supabase
    .from('admin_notices')
    .select('id, title, published_at, is_published')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(NOTICE_COUNT)

  const today = new Date().toISOString().slice(0, 10)

  const sidebarNotices = [
    ...(adminNoticeRows || [])
      /* 表に出す日が来たものだけ */
      .filter((a: any) => String(a.published_at).slice(0, 10) <= today)
      .map((a: any) => ({
        id: `adm-${a.id}`,
        href: '/announcements',
        date: formatMonthDay(a.published_at),
        title: a.title as string,
        at: String(a.published_at),
      })),
    ...datedNotices.map((n) => ({
      id: n.id,
      href: n.href,
      date: formatMonthDay(n.createdAt),
      title: n.title,
      at: n.createdAt,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3)
  const contestItems = datedContests.map(strip)

  /*
   * 柱に出すコンテスト。2 つまで。
   *
   * 絵の列は banner_url。
   * image_url を見ていて、絵が出ていなかった。
   */
  const sidebarContests = (contestRows || []).slice(0, 2).map((c: any) => ({
    ...c,
    /*
     * 絵の見せ方。
     * 値が入っていない古いものでも崩れないよう、既定を当てる。
     */
    banner_fit: c.banner_fit ?? 'cover',
    banner_zoom: c.banner_zoom ?? 100,
    banner_x: c.banner_x ?? 50,
    banner_y: c.banner_y ?? 50,
  })) as any[]
  /*
   * 中央に出すお知らせ。
   *
   * 柱には文字だけが出る。
   * 絵は柱の幅では小さすぎて、何の告知か伝わらない。
   * 絵のあるものだけを、中央へ回す。
   */
  const boardNotices = (annRows || [])
    /*
     * 絵で絞らない。
     *
     * 絞ると、絵を付けていない日は欄ごと消える。
     * 絵が無いものは、題名だけの札で出す。
     */
    .slice(0, 3)
    .map((a: any) => ({
      id: String(a.id),
      title: a.title as string,
      image: a.image_url as string,
      link: (a.link as string | null) || null,
    }))

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
    <div className="page-with-footer bg-canvas">
    {/* ヘッダーは端から端まで */}
    <Header />

    {/*
     * 左右の骨組みは執筆向けと同じ。
     *
     * 白い地と縦の線は外側の aside に持たせ、
     * 頁の下（フッターの手前）まで伸ばす。
     * 貼りつくのは中の箱だけ。
     */}
    {/*
     * 左右の骨組みは執筆向けと同じ。
     *
     * 白い地と縦の線は外側の aside に持たせ、
     * 頁の下（フッターの手前）まで伸ばす。
     * 貼りつくのは中の箱だけ。
     */}
    {/*
     * 見出しと本棚は、柱より上に出して全幅にする。
     *
     * 本棚は横に並べて見せるものなので、幅が要る。
     * 柱の右に置くと、300px ぶん狭い所へ押し込まれる。
     *
     * ★ 本棚は home.js が root.clientWidth を読んで
     *   並べる冊数を決める。幅が変われば計算し直される。
     *   window.resize でも追随する。
     *
     * ★ .reader-home で囲うのを忘れないこと。
     *   本棚の見た目はすべて .reader-home 配下の指定で決まっている。
     *   外に出すと、棚も板も消える。
     */}
    {/*
      * ★ 見出しは .reader-home の外に置くこと。
      *
      *   base.css に .reader-home * { margin:0; padding:0 } がある。
      *   中に入れると、見出しの内側の余白まで消えて
      *   文字が画面の端に張り付く。
      *
      *   囲みが要るのは本棚だけ。
      */}
    <div className="px-5 pt-4 sm:px-6">
      <BirthdateNotice />
      <ReaderHero />
    </div>

    <div
      className="reader-home"
      data-theme="light"
      data-view="reader"
      data-auth={user ? 'login' : 'guest'}
    >
      <div className="rh_main">
        {/*
         * 本棚と、その下の板。
         * 板が無いと本が宙に浮いて見える。
         */}
        <div className="rh_shelf">
          <BookshelfSection books={shelfBooks} />
          <div className="rh_shelf-board" aria-hidden="true" />

          {/* 手で前後に送る */}
          <ShelfNav />
        </div>
      </div>
    </div>

    <div className="flex">
      {/*
       * 柱。
       *
       * ★ 白い地と縦の線をやめた。
       *
       *   前は aside に bg-surface と border-r があり、
       *   さらに after で頁の下まで白い面を伸ばしていた。
       *   中身が短くても、白い柱だけが下まで続いていた。
       *
       *   札は自分で白を持っているので、地は要らない。
       *   高さも、中身のぶんだけで終わる。
       *
       * ★ 中身は右へ寄せる。
       *   左に余白を多めに取り、札の左端を内側へ入れる。
       *
       * ★ 上の位置は「作品を探す」にそろえる。
       *   右の main が py-4（16px）なので、こちらも同じにする。
       */}
      {/*
       * 枠を広げる。
       *
       * 300px のままだと、中身をいくら右へ寄せても
       * 枠の右端で止まり、「作品を探す」との間が開いたままだった。
       *
       * 枠を 380px にして、右端が本文のすぐ横まで届くようにする。
       * そのうえで、左の余白で寄せ具合を決める。
       */}
      <aside className="hidden w-[380px] shrink-0 xl:block">
        {/*
         * 左に大きく余白を取って、札を右へ寄せる。
         *
         * 左端に貼り付いていると、右の「作品を探す」との間が
         * 開きすぎて、二つが離れて見える。
         *
         * ★ 寄せ具合はこの pl-* と pr-* の数字だけで変わる。
         *   もっと右へ  pl-20 pr-0
         *   もっと左へ  pl-8  pr-3
         */}
        {/*
         * 札の幅は 300px のまま、左の余白で右へ寄せる。
         *
         * ★ 寄せ具合はこの pl-* だけで変わる。
         *   もっと右へ  pl-20（80px）
         *   もっと左へ  pl-8 （32px）
         */}
        <div className="sticky top-14 py-4 pl-20 pr-0">
          <ReaderSidebar
            reading={sidebarReading}
            notices={sidebarNotices}
            contests={sidebarContests}
          />
        </div>
      </aside>

      {/* 右 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1 space-y-3.5 px-5 py-4 sm:px-6">
          {/* 本棚から下は、参照元の見た目で囲う */}
          <div
            id="home-page"
            className="reader-home"
            data-theme="light"
            data-view="reader"
            data-auth={user ? 'login' : 'guest'}
          >
            {/* 見開きの器は layout に置いてある（BookInfoHost） */}
            {/* 見せ方の設定を body に伝える。home.js がそれを見る */}
            <WorkPopupFlag />
            {/* 札の設定のとき、本棚の本を押したら札を出す */}
            <ShelfCardPopup />
            <div className="rh_main">

            {/*
             * 作品を探す。
             *
             * 本棚のすぐ下に置く。
             * 棚を眺めて目当てが無かった人が、
             * そのまま探しに行ける。
             */}
            <Link href="/search" className="rh_search">
              <span className="rh_search-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7"/>
                  <path d="m20 20-3.5-3.5"/>
                </svg>
              </span>
              <span className="rh_search-text">
                <span className="rh_search-title">作品を探す</span>
                <span className="rh_search-note">ジャンル・タグ・キーワードで作品を検索できます</span>
              </span>
              <span className="rh_search-go">詳細検索 ›</span>
            </Link>

            {/*
             * 作品の一覧。
             *
             * 上から、追っている作者の新着・おすすめ・注目。
             * 自分に近いものから、広いものへ順に降りる。
             *
             * フォローしていない人には、追っている作者の枠を出さない。
             * 空の枠だけ並んでいても、することが無い。
             */}
            <ReaderWorkList
              title="続きから読む"
              books={continueBooks}
              /* 履歴のページはまだ無い。作品を探すへ送る */
              moreHref="/search"
            />

            <ReaderWorkList
              title="フォロー中の作家の新着"
              books={followedBooks}
              moreHref="/search?sort=new"
            />

            <ReaderWorkList
              title="おすすめの作品"
              books={recommendBooks}
              moreHref="/search"
            />

            {/*
             * 最新話更新。
             * 追っている人には、新作より続きのほうが用がある。
             */}
            <ReaderWorkList
              title="最新話が届いた作品"
              books={updatedBooks}
              moreHref="/search?sort=updated"
            />

            {/* 新作のうち、点数の高いもの */}
            <ReaderWorkList
              title="新作のおすすめ"
              books={freshPickBooks}
              moreHref="/search?sort=new"
            />

            {/* ひと息で読み切れる */}
            <ReaderWorkList
              title="短編"
              books={shortBooks}
              moreHref="/search?type=短編"
            />

            {/*
             * 流れる帯。
             *
             * コンテストと運営のお知らせの絵をここで流す。
             * 執筆向けのホームと同じ仕組みをそのまま使う。
             *
             * 作品を見終えた先に置く。
             * 上に置くと、本を探しに来た人の邪魔になる。
             */}
            <div className="rh_banner">
              <HomeBannerCarousel contests={sidebarContests} />
            </div>

            {/*
             * 完結した作品。
             *
             * 数が揃うまでは出さない。
             * 2 冊しか並ばない棚は、かえって寂しく見える。
             * 増えたら false を外す。
             */}
            {false && (
              <ReaderWorkList
                title="完結した作品"
                books={completedBooks}
                moreHref="/search?serial=completed"
              />
            )}
            </div>

            <HomeEffects pools={{ pickupPool, newReleasePool }} />
          </div>
        </main>
      </div>
    </div>

    <Footer />
    </div>
  )
}
