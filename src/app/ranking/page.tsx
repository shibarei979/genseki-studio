import { createClient } from '@/lib/supabase/server'
import { ageFromBirthdate, allowedRatings } from '@/lib/age'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { GENRES_SELECTABLE, GENRES_R18_ONLY, GENRE_LEGACY_MATCH } from '@/types'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import AdBanner from '@/components/layout/ad-banner'
import Link from 'next/link'
import NovelPopup from '@/components/novel-popup'
import SideScroller from '@/components/common/side-scroller'
import { loadBlockedIds } from '@/lib/social/blocks'
import { serverEnv } from '@/config/env.server'
import { clientEnv } from '@/config/env.client'

const PAGE_SIZE = 50

/*
 * ratings は、その人が見てよい区分。
 * 呼ぶ側で決めて渡す。ここでは人を知らない。
 */
/*
 * 大人向けの棚を、一般の並びに混ぜない。
 *
 * ★ これまでは、R18 の作品を丸ごと外していた。
 *
 *   BL R18・GL R18・官能 R18 は、どの並びにも出ない。
 *   BL の棚には全年齢と R15 だけが並び、
 *   R18 のものはどこにも無い、という形だった。
 *   分かれていないのではなく、片方が消えていた。
 *
 * ★ 直し方
 *
 *   その棚を選んだときだけ、そこを開く。
 *   「全て」や「恋愛」を見ている人の目には入らない。
 *
 *   開くのは、年齢の区分で R18 を見てよい人だけ。
 *   生年月日を入れていない人には、そもそも
 *   age_rating の絞りで届かない。
 */
function keepR18Out(query: unknown, genre: string, ratings: string[]) {
    /* 大人向けの棚を、その人が見てよいか */
    const wantsR18 =
        GENRES_R18_ONLY.includes(genre) && ratings.includes('r18')

    if (wantsR18) return query

    return (query as any)
        .eq('is_r18', false)
        /*
         * ★ 手で並べない。GENRES_R18_ONLY から作る。
         *   棚を増やしたとき、ここへ足し忘れると
         *   その棚だけ一般の並びに混ざる。
         *
         *   「官能」は昔の名前。いまは選べないが、
         *   その名前で出している作品が残っている。
         */
        .not(
            'genre',
            'in',
            `("官能",${GENRES_R18_ONLY.map(g => `"${g}"`).join(',')})`,
        )
}

async function computeRanking(period: string, novelType: string, serial: string, genre: string, aiMode: string, offset: number, displaySize: number, showMore: boolean, ratings: string[] = ['all']): Promise<{ items: any[]; total: number }> {
  // キャッシュ内ではcookies非依存の素のクライアントを使用（ランキングは公開データのみ）
  const supabase: any = createSbClient(serverEnv.supabaseUrl, clientEnv.supabaseAnonKey)
  /**
   * 1000 行ずつ、無くなるまで取る。
   *
   * ★ limit は効かない。
   *
   *   PostgREST は既定で 1000 行までしか返さない。
   *   limit(50000) と書いても、そこで頭打ちになる。
   *   多い表では、途中から数え落とす。
   *
   *   range で区切って、返らなくなるまで繰り返す。
   */
  async function readAll(build: (from: number, to: number) => any) {
    const rows: any[] = []

    for (let from = 0; from < 200000; from += 1000) {
      const { data: page } = await build(from, from + 999)
      if (!page || page.length === 0) break

      rows.push(...page)
      if (page.length < 1000) break
    }

    return rows
  }

  let likeIds: string[] = []

  const GROWTH_PERIODS = ['discover_rate', 'read_rate', 'bookmark_rate', 'newbie_focus']
  const MIN_VIEWS = 30 // 母数が少なすぎる作品を除外

  if (GROWTH_PERIODS.includes(period)) {
    /* 候補プール取得（公開済み・直近300件）。大人向けは選んだときだけ */
    let poolQuery = supabase
      .from('novels')
      .select('id, title, cover_url, genre, novel_type, is_serial, author_id, summary, catchcopy, tags, created_at')
      .eq('published', true).in('age_rating', ratings)
    poolQuery = keepR18Out(poolQuery, genre, ratings) as typeof poolQuery
    if (aiMode === 'ai') poolQuery = (poolQuery as any).eq('ai_usage', 'full')
    else poolQuery = (poolQuery as any).neq('ai_usage', 'full')
    const { data: poolNovels } = await poolQuery
      .order('created_at', { ascending: false }).limit(300)

    if (!poolNovels || poolNovels.length === 0) return { items: [], total: 0 }
    const poolIds = poolNovels.map((n:any) => n.id)

    /*
     * 読めない作品を外す。
     *
     * ★ 話が 1 つも無い作品が並んでいた。
     *   押すと「このページはありません」になる。
     *   作品ページは、話が 0 件なら読者に見せない作りだから。
     *
     * 題名の無いものも外す。並べても何の話か分からない。
     *
     * 読者ホーム・おすすめ・作品を探す でも同じことをしている。
     * 作品を並べる所では、毎回これが要る。
     */
    const { data: liveEps } = await supabase
      .from('episodes').select('novel_id')
      .in('novel_id', poolIds).eq('is_published', true).limit(1000)

    const hasLive = new Set((liveEps || []).map((e:any) => e.novel_id))

    const [{ data: viewsData }, { data: discoversData }, { data: likesData }, { data: bookmarksData }, { data: readData }] = await Promise.all([
      /* 閲覧は novel_stats から。作者と見回りの機械を除いた数 */
      supabase.from('novel_stats').select('novel_id, view_count').in('novel_id', poolIds),
      supabase.from('discovers').select('novel_id').in('novel_id', poolIds).eq('is_pending', false),
      supabase.from('likes').select('novel_id').in('novel_id', poolIds),
      supabase.from('bookmarks').select('novel_id').in('novel_id', poolIds),
      supabase.from('read_episodes').select('novel_id').in('novel_id', poolIds),
    ])

    const viewMap: Record<string,number> = {}
    viewsData?.forEach((v:any) => { viewMap[v.novel_id] = v.view_count || 0 })
    const discoverCountMap: Record<string,number> = {}
    discoversData?.forEach((d:any) => { discoverCountMap[d.novel_id] = (discoverCountMap[d.novel_id]||0)+1 })
    const likeCountMap: Record<string,number> = {}
    likesData?.forEach((l:any) => { likeCountMap[l.novel_id] = (likeCountMap[l.novel_id]||0)+1 })
    const bookmarkCountMap: Record<string,number> = {}
    bookmarksData?.forEach((b:any) => { bookmarkCountMap[b.novel_id] = (bookmarkCountMap[b.novel_id]||0)+1 })
    const readCountMap: Record<string,number> = {}
    readData?.forEach((r:any) => { readCountMap[r.novel_id] = (readCountMap[r.novel_id]||0)+1 })

    // 新人注目：作者ごとの公開作品数をカウント
    let newbieAuthorSet = new Set<string>()
    if (period === 'newbie_focus') {
      const { data: authorWorks } = await supabase.from('novels').select('author_id').eq('published', true)
      const authorCount: Record<string,number> = {}
      authorWorks?.forEach((n:any) => { authorCount[n.author_id] = (authorCount[n.author_id]||0)+1 })
      newbieAuthorSet = new Set(Object.entries(authorCount).filter(([,c])=>c<=4).map(([id])=>id))
    }

    let candidates = poolNovels
      .filter((n:any) => hasLive.has(n.id) && (n.title ?? '').trim() !== '')
      .filter((n:any) => (viewMap[n.id]||0) >= MIN_VIEWS)
    if (period === 'newbie_focus') {
      candidates = candidates.filter((n:any) => newbieAuthorSet.has(n.author_id))
    }
    if (genre !== '全て') {
      /*
       * ★ 昔のジャンルで出している作品も拾う。
       *
       *   ファンタジーを 3 つに分けた日から、
       *   古いジャンルのままの作品はどのジャンルでも
       *   出てこなくなっていた。検索は拾っているので、
       *   ランキングも同じ扱いにそろえる。
       */
      const legacy = GENRE_LEGACY_MATCH[genre] ?? []
      const wanted = new Set([genre, ...legacy])
      candidates = candidates.filter((n:any) => wanted.has(n.genre))
    }

    const rateScored = candidates.map((n:any) => {
      const views = viewMap[n.id] || 1
      let rate = 0
      let rateLabel = ''
      if (period === 'discover_rate') { rate = (discoverCountMap[n.id]||0) / views; rateLabel = '発掘率' }
      else if (period === 'read_rate') { rate = (readCountMap[n.id]||0) / views; rateLabel = '読了率' }
      else if (period === 'bookmark_rate') { rate = (bookmarkCountMap[n.id]||0) / views; rateLabel = '保存率' }
      else if (period === 'newbie_focus') {
        rate = ((discoverCountMap[n.id]||0)*2 + (likeCountMap[n.id]||0) + (bookmarkCountMap[n.id]||0)*1.5) / views
        rateLabel = '注目度'
      }
      return { ...n, rate, rateLabel, score: likeCountMap[n.id]||0, char_count: 0, last_updated: n.created_at }
    }).sort((a:any,b:any) => b.rate - a.rate)

    const total = rateScored.length
    const paged = rateScored.slice(offset, offset + PAGE_SIZE)
    const authorIds = Array.from(new Set(paged.map((n:any) => n.author_id)))
    const authorMap: Record<string,string> = {}
    if (authorIds.length > 0) {
      const { data: authors } = await supabase.from('public_profiles').select('user_id, display_name').in('user_id', authorIds as string[])
      authors?.forEach((a:any) => { authorMap[a.user_id] = a.display_name })
    }
    return {
      total,
      items: paged.map((n:any) => ({
        ...n,
        display_name: authorMap[n.author_id]||'',
        ratePercent: (n.rate * 100).toFixed(1),
      }))
    }
  }

  if (period === 'rising') {
    const { data: risingData } = await supabase.from('rising_novels').select('id, rising_score').limit(100)
    const risingIds = (risingData || []).map((r:any) => r.id)
    const scoreMap = Object.fromEntries((risingData||[]).map((r:any) => [r.id, r.rising_score]))
    if (risingIds.length === 0) return { items: [], total: 0 }
    const { data: risingNovelData } = await supabase
      /*
       * ★ created_at も取る。
       *   取っていなかったので、この並びだけ更新日が空になり、
       *   NaN/NaN/NaN と出ていた。
       */
      .from('novels').select('id, title, cover_url, genre, novel_type, is_serial, author_id, summary, catchcopy, tags, created_at')
      .in('id', risingIds).eq('published', true)
    const risingItems = (risingNovelData || [])
      .sort((a:any, b:any) => (scoreMap[b.id]||0) - (scoreMap[a.id]||0))
      /* 更新日。話がまだ無い作品は、作った日を出す */
      .map((n:any) => ({...n, like_count: scoreMap[n.id]||0, last_updated: n.created_at}))
    const authorIds2 = Array.from(new Set(risingItems.map((n:any) => n.author_id)))
    const authorMap2: Record<string,string> = {}
    if (authorIds2.length > 0) {
      const { data: authors2 } = await supabase.from('public_profiles').select('user_id, display_name').in('user_id', authorIds2 as string[])
      authors2?.forEach((a:any) => { authorMap2[a.user_id] = a.display_name })
    }
    return { items: risingItems.map((n:any) => ({...n, display_name: authorMap2[n.author_id]||''})), total: risingItems.length }
  } else {
    /*
     * ★ ここでは何も数えない。
     *
     *   いいねも保存も星も、ranking_points に
     *   溜めてあるものを下で読む。
     *   ここで数え直すと、二重に数えることになる。
     *
     *   候補があることだけ、先へ伝える。
     */
    likeIds = ['all']
  }

  if (likeIds.length === 0) return { items: [], total: 0 }

  /*
   * ★ id を並べて渡すのをやめる。
   *
   *   候補を全作品にしたので、in(...) に 195 個の id が並ぶ。
   *   問い合わせの住所が長くなりすぎて、途中で切られる。
   *   195 作品あるのに 112 件しか返らなかったのは、これ。
   *
   *   候補が全作品なら、そもそも id で絞る必要がない。
   *   公開されているものを、そのまま読む。
   *
   * ★ 上限は付けない。下で分けて取る。
   */
  /*
   * ★ 問い合わせは、毎回組み直す。
   *
   *   前は 1 つ作って、range だけ変えて使い回していた。
   *   Supabase の問い合わせは一度きりのもので、
   *   二度目からは正しく走らない。
   *
   *   175 件あるはずが 106 件しか返らなかったのは、これ。
   *
   *   組み立てを関数にして、1 ページごとに作り直す。
   */
  async function buildNovels(from: number, to: number) {
  let q = supabase.from('novels')
      .select('id, title, cover_url, genre, novel_type, is_serial, author_id, summary, tags, created_at')
      .eq('published', true).is('deleted_at', null).in('age_rating', ratings)
    // AI作品ランキングと人間作品ランキングを分離
    if (aiMode === 'ai') q = (q as any).eq('ai_usage', 'full')
    else q = (q as any).neq('ai_usage', 'full')
    q = keepR18Out(q, genre, ratings) as typeof q
    if (novelType !== '全て') q = (q as any).eq('novel_type', novelType)
    if (genre !== '全て') {
      /* こちらも、昔のジャンルを一緒に拾う */
      const legacy = GENRE_LEGACY_MATCH[genre] ?? []
      q = legacy.length > 0
        ? (q as any).in('genre', [genre, ...legacy])
        : (q as any).eq('genre', genre)
    }
    if (serial === 'serial')   q = (q as any).eq('is_serial', true)
    if (serial === 'complete') q = (q as any).eq('is_serial', false)
    if (serial === 'new')      q = (q as any).gte('created_at', new Date(Date.now()-30*24*60*60*1000).toISOString())
    if (serial === 'newbie') {
      const { data: newbieAuthors } = await supabase.from('novels').select('author_id').eq('published', true)
      const authorCount: Record<string,number> = {}
      newbieAuthors?.forEach((n:any) => { authorCount[n.author_id] = (authorCount[n.author_id]||0)+1 })
      const newbieIds = Object.entries(authorCount).filter(([,c])=>c<=3).map(([id])=>id)
      q = (q as any).in('author_id', newbieIds)
    }
    /*
     * ★ 作品も、分けて取る。
     *
     *   limit では 1000 件で頭打ちになる。
     *   増えたときに、下のほうの作品が
     *   まるごと消える。
     */

    return (q as any).range(from, to)
  }

  const novels = await readAll((from, to) => buildNovels(from, to))

  /*
   * ★ 1 話も出していない作品は、並べない。
   *
   *   押しても空の目次しか無く、読むものがない。
   *   作者の公開ページでは既に外してある。
   *   ランキングだけ出していると、辻褄が合わない。
   *
   * ★ 話の有無は、まとめて 1 回で調べる。
   *   作品ごとに問い合わせると、その数だけ待つことになる。
   */
  const liveNovelIds = new Set<string>()
  {
    /*
     * ★ limit は効かない。range で分けて取る。
     *
     *   PostgREST は既定で 1000 行までしか返さない。
     *   limit(50000) と書いても、そこで頭打ちになる。
     *
     *   300 作品ぶんの話を一度に取ろうとすると、
     *   1000 行で切られ、70 作品ぶんしか拾えない。
     *   195 作品が 73 件になっていたのは、これ。
     *
     *   range で 1000 行ずつ、無くなるまで取る。
     */
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from('episodes')
        .select('novel_id')
        .eq('is_published', true)
        .range(from, from + 999)

      if (!page || page.length === 0) break
      page.forEach((e: any) => liveNovelIds.add(e.novel_id))
      if (page.length < 1000) break
    }
  }

  const candidateNovels = (novels || []).filter((n: any) =>
    liveNovelIds.has(n.id),
  )
  const candidateIds = candidateNovels.map((n: any) => n.id)

  /*
   * ============================================================
   * 点は、溜めてある表から読む
   *
   * ★ その場で数え直さない。
   *
   *   前はここで、いいね・保存・星・読まれた数・
   *   続けて読んだ人を、全作品ぶん集めていた。
   *
   *   作品が増えるほど重くなり、
   *   1000 行の頭打ちにも当たりやすい。
   *   195 作品が 73 件しか出ない不具合は、それで起きた。
   *
   *   数え直しは /api/cron/ranking が定時にやる。
   *   ここは、その結果を読むだけ。
   *
   * ★ 最新の数ではない。
   *
   *     15 分ごと  日間・週間
   *     30 分ごと  月間・四半期
   *     1 日 1 回  年間・累計
   *
   *   ランキングが 15 分遅れても困らない。
   *   押した瞬間に順位が動くほうが、かえって落ち着かない。
   *
   * ★ 点の重みは SQL 側（refresh_ranking_points）にある。
   *   変えるときは、両方を見ること。
   * ============================================================
   */
  const pointMap: Record<string, number> = {}
  /* 同点のときに見る */
  const continuedForSort: Record<string, number> = {}
  const likeCntMap: Record<string, number> = {}
  const bookmarkCntMap: Record<string, number> = {}
  const starSumMap: Record<string, number> = {}
  const pvCntMap: Record<string, number> = {}

  if (candidateIds.length > 0) {
    const rows = await readAll((from, to) =>
      supabase
        .from('ranking_points')
        .select('novel_id, points, like_count, bookmark_count, star_sum, view_count, continued_count')
        .eq('period', period)
        .range(from, to),
    )

    rows.forEach((r: any) => {
      pointMap[r.novel_id] = Number(r.points) || 0
      likeCntMap[r.novel_id] = Number(r.like_count) || 0
      bookmarkCntMap[r.novel_id] = Number(r.bookmark_count) || 0
      starSumMap[r.novel_id] = Number(r.star_sum) || 0
      pvCntMap[r.novel_id] = Number(r.view_count) || 0
      continuedForSort[r.novel_id] = Number(r.continued_count) || 0
    })
  }

  /*
   * 並べ替え。
   *
   * ★ 同点の決まりを持たせる。
   *
   *   前は点だけで並べていたので、同点のときは
   *   表から返ってきた順のまま残っていた。
   *   どちらが上に来るかは運で決まっていた。
   *
   *   同点なら「続けて読んだ人」が多いほう。
   *   それも同じなら、更新の新しいほう。
   *
   *   続けて読んだ人を次に見るのは、それが
   *   面白かったことをいちばん強く表す数だから。
   */
  /*
   * ★ 短い期間は、点の付いた作品だけを出す。
   *
   *   日間・週間・月間・四半期は
   *   「いまどれが読まれているか」を見る場所。
   *   その期間に何も起きていない作品まで並べると、
   *   下のほうが 0 点で埋まって読めない。
   *
   * ★ 年間・累計は、全作品を出す。
   *   こちらは「これまでの積み重ね」を見る場所なので、
   *   0 点でも順位の内に入る。
   *
   * ★ 外すのは、点を出したあと。
   *
   *   点はいいねだけで決まらない。
   *   読まれた数も、星も、保存も入る。
   *   いいねが 0 でも読まれた作品はあるので、
   *   いいねの数で先に外してはいけない。
   */
  const shortPeriod =
    period === 'daily' ||
    period === 'weekly' ||
    period === 'monthly' ||
    period === 'quarterly'

  const listed = shortPeriod
    ? candidateNovels.filter((n: any) => (pointMap[n.id] || 0) > 0)
    : candidateNovels

  /*
   * ★ どこで何件になったかを、記録に残す。
   *
   *   数が合わないとき、どの段で落ちたのかが
   *   分からないと直せない。
   *   Vercel の記録から追える。
   */
  console.log('[ランキング]', {
    期間: period,
    作品を読んだ: (novels || []).length,
    話がある: candidateNovels.length,
    点を読んだ: Object.keys(pointMap).length,
    点が0でない: candidateNovels.filter((n: any) => (pointMap[n.id] || 0) > 0).length,
    出す: listed.length,
  })

  const sorted = listed.sort((a: any, b: any) => {
    const byPoint = (pointMap[b.id]||0) - (pointMap[a.id]||0)
    if (byPoint !== 0) return byPoint

    const byContinued = (continuedForSort[b.id]||0) - (continuedForSort[a.id]||0)
    if (byContinued !== 0) return byContinued

    return String(b.updated_at||'').localeCompare(String(a.updated_at||''))
  })
  const total  = sorted.length
  const paged  = sorted.slice(offset, offset + PAGE_SIZE)
  const authorIds = Array.from(new Set(paged.map((n: any) => n.author_id)))
  const authorMap: Record<string,string> = {}
  if (authorIds.length > 0) {
    const { data: authors } = await supabase.from('public_profiles').select('user_id, display_name').in('user_id', authorIds as string[])
    authors?.forEach((a: any) => { authorMap[a.user_id] = a.display_name })
  }
  const novelIds = paged.map((n: any) => n.id)
  const charCountMap: Record<string,number> = {}
  const lastUpdateMap: Record<string,string> = {}
  if (novelIds.length > 0) {
    const { data: eps } = await supabase.from('episodes').select('novel_id, body, created_at').in('novel_id', novelIds)
    eps?.forEach((ep: any) => {
      charCountMap[ep.novel_id] = (charCountMap[ep.novel_id]||0) + (ep.body?.length||0)
      if (!lastUpdateMap[ep.novel_id] || ep.created_at > lastUpdateMap[ep.novel_id]) lastUpdateMap[ep.novel_id] = ep.created_at
    })
  }
  // ランキング履歴の記録：総合（全フィルタ既定・1ページ目）のみ、上位20位を保存
  // 3時間キャッシュのため、この計算は3時間に1回だけ走る
  if (offset === 0 && genre === '全て' && novelType === '全て' && serial === 'all' && aiMode === 'human' && serverEnv.supabaseServiceRoleKey) {
    try {
      const admin: any = createSbClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey)
      const now = new Date()
      const until = new Date(now.getTime() + 3 * 60 * 60 * 1000)
      const rows = sorted.slice(0, 100).map((n: any, i: number) => ({
        novel_id: n.id,
        author_id: n.author_id,
        period,
        rank: i + 1,
        from_time: now.toISOString(),
        to_time: until.toISOString(),
      }))
      if (rows.length > 0) await admin.from('ranking_history').insert(rows)
    } catch (_) { /* 記録失敗はランキング表示に影響させない */ }
  }

  const sevenDaysAgo = Date.now() - 7*24*60*60*1000
  return {
    total,
    items: paged.map((n: any) => ({
      ...n,
      display_name:  authorMap[n.author_id]||'',
      score:         pointMap[n.id]||0,
      char_count:    charCountMap[n.id]||0,
      last_updated:  lastUpdateMap[n.id]||n.created_at,
      hideStats: period !== 'rising' && (new Date(n.created_at).getTime() > sevenDaysAgo || (likeCntMap[n.id]||0) < 50),
    }))
  }
}

// ランキングは3時間ごとに更新（キャッシュ）
/*
 * 作り置き。
 *
 * ★ 合言葉を変えると、古い作り置きが捨てられる。
 *
 *   中身を直しても、合言葉が同じままだと
 *   前の結果がそのまま返る。3 時間そのまま。
 *   直したのに数字が変わらないのは、これ。
 *
 *   数え方を変えたときは、必ず番号を上げること。
 *
 * ★ 3 時間 → 10 分にする。
 *
 *   点は /api/cron/ranking が定時に数え直すので、
 *   ここは「その結果を並べたもの」を短く持てば足りる。
 *   長く持つと、数え直しても画面が追いつかない。
 */
const getCachedRanking = unstable_cache(computeRanking, ['ranking-v2'], { revalidate: 600 })


interface Props {
  searchParams: { period?: string; type?: string; serial?: string; page?: string; genre?: string; ai?: string }
}

export default async function RankingPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    profile = data
  }

  /*
   * その人が見てよい区分。
   *
   * 生年月日が未設定なら all だけ。
   * ランキングは R18 をもともと出さないが、
   * R15 は絞られていなかった。
   */
  const ratings = allowedRatings(
    ageFromBirthdate((profile as { birthdate?: string } | null)?.birthdate),
  )

  const period    = searchParams.period || 'weekly'
  const genre     = searchParams.genre  || '全て'
  const aiMode    = (profile as any)?.show_ai_works === false ? 'human' : (searchParams.ai === 'ai' ? 'ai' : 'human')  // AI非表示設定の読み手は常にhuman
  const showMore  = searchParams.page === 'all'
  const novelType = searchParams.type   || '長編'
  const serial    = searchParams.serial || 'all'
  const page      = showMore ? 1 : Math.max(1, parseInt(searchParams.page || '1'))
  const displaySize = showMore ? 100 : PAGE_SIZE
  const offset    = (page - 1) * PAGE_SIZE


  const { items: rankingAll, total } = await getCachedRanking(period, novelType, serial, genre, aiMode, offset, displaySize, showMore, ratings)

  /*
   * ブロックした作者の作品を落とす。
   *
   * 順位そのものは動かさない。3位が消えても 4位は 4位のまま。
   * 詰めると、消えた場所に誰かが居たことが分かってしまう。
   */
  const blockedAuthors = await loadBlockedIds(supabase, user?.id)
  const ranking = blockedAuthors.size > 0
    ? rankingAll.filter((n: any) => !blockedAuthors.has(n.author_id))
    : rankingAll
  const totalPages = Math.ceil(total / PAGE_SIZE)

  /*
   * 日付を出す。
   *
   * ★ 読めない値のときは、何も出さない。
   *
   *   前はそのまま組み立てていたので、
   *   値が無いと NaN/NaN/NaN と出ていた。
   *   出せないものは、出さないほうがよい。
   *
   * ★ 日本時間で出す。
   *   getFullYear などは、その機械の時計で答える。
   *   置き場は協定世界時なので、0 時から 9 時に
   *   出した話が前の日に見える。
   */
  function fmtDate(s: string) {
    if (!s) return ''
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
  }
  function fmtChar(n: number) {
    if (n >= 10000) return `${Math.floor(n/1000)/10}万文字`
    return `${n.toLocaleString()}文字`
  }
  function fmtNum(n: number | undefined | null): string {
    if (!n) return '0'
    if (n >= 10000) return (Math.floor(n / 1000) / 10) + '万'
    if (n >= 1000)  return (Math.floor(n / 100)  / 10) + 'K'
    return n.toString()
  }
  function rankColor(abs: number) {
    if (abs === 0) return 'var(--color-rank-gold)'
    if (abs === 1) return 'var(--color-rank-silver)'
    if (abs === 2) return 'var(--color-rank-bronze)'
    return 'var(--color-text)'
  }
  function rankSize(abs: number) {
    if (abs === 0) return 22
    if (abs === 1) return 20
    if (abs === 2) return 18
    return 14
  }

  const periodOptions = [
    { value:'daily',     label:'日間' },
    { value:'weekly',    label:'週間' },
    { value:'monthly',   label:'月間' },
    { value:'quarterly', label:'四半期' },
    { value:'yearly',    label:'年間' },
    { value:'all',       label:'累計' },
    { value:'rising',    label:'急上昇' },
    { value:'discover_rate',  label:'発掘率' },
    { value:'read_rate',      label:'読了率' },
    { value:'bookmark_rate',  label:'保存率' },
    { value:'newbie_focus',   label:'新人' },
  ]
  /*
   * 並べるジャンル。
   *
   * ★ 作品に付けられるものと、そろえる。
   *
   *   前はここに手で書いた古い一覧が入っていた。
   *   「オールジャンル」「異世界」「ファンタジー」は
   *   もう誰も選べないジャンルで、押しても 0 件。
   *   逆に、いま選べる ハイファンタジー・異世界ファンタジー・
   *   ローファンタジー・BL・GL は、ここに無いので絞れなかった。
   *
   *   GENRES_SELECTABLE から作れば、
   *   ジャンルを足したときにここも一緒に増える。
   *
   * ★ R18 のジャンルは出さない。
   *   ランキングは R18 の作品を初めから外している。
   *   押しても必ず 0 件になる。
   */
  /*
   * ★ 大人向けの棚は、見てよい人にだけ出す。
   *
   *   生年月日を入れていない人、18 歳未満の人には出さない。
   *   出しても中身が届かないので、押せる意味がない。
   */
  const genres = [
    '全て',
    ...GENRES_SELECTABLE.filter(g => !GENRES_R18_ONLY.includes(g)),
    ...(ratings.includes('r18') ? GENRES_R18_ONLY : []),
  ]
  const typeOptions   = [{ value:'全て',label:'全て' },{ value:'長編',label:'長編' },{ value:'短編',label:'短編' }]
  const serialOptions = [{ value:'all',label:'すべて' },{ value:'serial',label:'連載中' },{ value:'complete',label:'完結' },{ value:'new',label:'新作' }]

  function buildUrl(p: string, t: string, s: string, pg = 1, ai = aiMode, g = genre) {
    return `/ranking?period=${p}&type=${encodeURIComponent(t)}&serial=${s}&genre=${encodeURIComponent(g)}&ai=${ai}&page=${pg}`
  }

  const GROWTH_PERIODS = ['discover_rate', 'read_rate', 'bookmark_rate', 'newbie_focus']
  const isGrowthRanking = GROWTH_PERIODS.includes(period)
  const periodLabel = periodOptions.find(o=>o.value===period)?.label||'週間'
  const scoreLabel  = period === 'rising' ? '↑' : 'pt'

  const pill = (active: boolean, small = false) => ({
    padding: small ? '4px 10px' : '4px 11px',
    borderRadius: 20,
    fontSize: small ? 11 : 12,
    fontWeight: 600 as const,
    textDecoration: 'none' as const,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0 as const,
    background: active ? 'var(--color-brand)' : 'var(--color-brand-light)',
    color: active ? 'var(--color-bg-card)' : 'var(--color-brand)',
    border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-tag-border)'}`,
  })
  const pillClass = (active: boolean) => active ? 'ranking-pill ranking-pill-active' : 'ranking-pill ranking-pill-inactive'

  return (
    <div style={{minHeight:'100vh',fontFamily:"'Noto Sans JP',sans-serif"}}>
      <Header />

      <div className="main-layout rk-page" style={{maxWidth:1200,margin:'0 auto',padding:'20px 32px',display:'flex',gap:20,alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:0}}>
                    {/*
            * 見出し。
            *
            * 絵と説明文を添える。
            * 題名だけだと、何が並んでいるのか
            * 一目では伝わらない。
            */}
          <div className="rk-head">
            <span className="rk-head-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
                <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7 11" />
                <path d="M17 6h3v1.5A3.5 3.5 0 0 1 17 11" />
                <path d="M12 14v3" />
                <path d="M8.5 20h7" />
                <path d="M10 17h4v3h-4z" />
              </svg>
            </span>
            <span className="rk-head-text">
              <h1 className="rk-head-title">ランキング</h1>
              <span className="rk-head-note">今、読者に支持されている作品をチェック！</span>
            </span>
          </div>

          {/*
              * 携帯で絞り込みを畳む。
              *
              * ★ 印（checkbox）と札（label）だけで作る。
              *   このページはサーバー側で組み立てるので、
              *   状態を持つ部品にすると作りが増える。
              *   HTML の仕組みだけで足りる。
              *
              * パソコンでは CSS 側で隠してあるので、出ない。
              */}
            <input type="checkbox" id="rk-more" className="rk-more-check" />

            <div className="ranking-filter" style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'12px 16px',marginBottom:16}}>
            {/* 期間 */}
            <div className="rk-filter" style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:14}}>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,minWidth:60,flexShrink:0,paddingTop:5,lineHeight:1.3}}>期間</div>
              {/* 期間もはみ出すことがある。同じ送り方に揃える */}
              <SideScroller label="期間を送る">
                {periodOptions.filter(o=>['daily','weekly','monthly','quarterly','yearly','all'].includes(o.value)).map(o => (
                  <Link key={o.value} href={buildUrl(o.value,novelType,serial)} className={pillClass(period===o.value)} style={pill(period===o.value)}>
                    {o.label}
                  </Link>
                ))}
              </SideScroller>
            </div>
            {/* 特集 ＋ 長さ・区分 */}
            <div className="rk-filter" style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:14,flexWrap:'wrap'}}>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,minWidth:60,flexShrink:0,paddingTop:5,lineHeight:1.3}}>特集</div>
              <div className="rk-chips" style={{display:'flex',gap:6,rowGap:10,flexWrap:'wrap',alignItems:'center',flex:1,minWidth:0}}>
                <Link href={buildUrl(['rising','newbie_focus'].includes(period)?'weekly':period,novelType,serial)} className={pillClass(!['rising','newbie_focus'].includes(period))} style={pill(!['rising','newbie_focus'].includes(period))}>総合</Link>
                <Link href={buildUrl('rising',novelType,serial)} className={pillClass(period==='rising')} style={pill(period==='rising')}>急上昇</Link>
                <Link href={buildUrl('newbie_focus',novelType,serial)} className={pillClass(period==='newbie_focus')} style={pill(period==='newbie_focus')}>新人</Link>
                <span style={{width:1,height:18,background:'var(--color-brand-border)',margin:'0 4px',flexShrink:0}}/>
                {typeOptions.map(o => (
                  <Link key={o.value} href={buildUrl(period,o.value,serial)} className={pillClass(novelType===o.value)} style={pill(novelType===o.value,true)}>
                    {o.label}
                  </Link>
                ))}
                {profile?.show_ai_works !== false && (
                  <span className="rk-ai">
                    <span style={{width:1,height:18,background:'var(--color-brand-border)',margin:'0 4px',flexShrink:0}}/>
                    <Link href={buildUrl(period,novelType,serial,1,'human')} className={pillClass(aiMode==='human')} style={pill(aiMode==='human',true)}>通常</Link>
                    <Link href={buildUrl(period,novelType,serial,1,'ai')} className={pillClass(aiMode==='ai')} style={pill(aiMode==='ai',true)}>AI</Link>
                  </span>
                )}
              </div>
            </div>
            {/* ジャンル：気分で探す風のボタン */}
            {/*
              * ★ rk-genre の印を付ける。
              *
              *   パソコンでは、この帯だけを 2 段に折り返す。
              *   棚が 17 個あり、1 段では端が隠れる。
              *   送れることに気づかない人には、
              *   隠れた棚は無いのと同じになる。
              *
              *   携帯はこれまでどおり。狭いので、
              *   全部を折り返すと段が増えすぎる。
              */}
            <div className="rk-filter rk-genre" style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:14}}>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,minWidth:60,flexShrink:0,paddingTop:8,lineHeight:1.3}}>ジャンル</div>
              <SideScroller label="ジャンルを送る">
                {genres.map(g => (
                  <Link key={g} href={buildUrl(period,novelType,serial,1,aiMode,g)} className={pillClass(genre===g)} style={pill(genre===g)}>
                    {g}
                  </Link>
                ))}
              </SideScroller>
            </div>
            {/* 絞り込み */}
            <div className="rk-filter" style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,minWidth:60,flexShrink:0,paddingTop:5,lineHeight:1.3}}>絞り込み</div>
              <div className="rk-chips" style={{display:'flex',gap:6,rowGap:10,flexWrap:'wrap',flex:1,minWidth:0}}>
                {serialOptions.map(o => (
                  <Link key={o.value} href={buildUrl(period,novelType,o.value)} className={pillClass(serial===o.value)} style={pill(serial===o.value,true)}>
                    {o.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* 開く・閉じるの札。閉じているときだけ「開く」と出す */}
            <label htmlFor="rk-more" className="rk-more-label">
              <span className="rk-more-open">すべての絞り込みを開く</span>
              <span className="rk-more-close">絞り込みを閉じる</span>
              <span className="rk-more-arrow">⌄</span>
            </label>
          </div>

          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:15,fontWeight:700,color:'var(--color-text)'}}>{periodLabel}ランキング</span>
                <span style={{fontSize:11,color:'var(--color-text-muted)'}}>{novelType!=='全て'&&novelType}{serial==='serial'?' 連載中':serial==='complete'?' 完結':serial==='new'?' 新作':''}</span>
              </div>
              <span style={{fontSize:12,color:'var(--color-text-muted)'}}>{total}件</span>
            </div>

            {ranking.length === 0 ? (
              <div style={{padding:'48px',textAlign:'center',color:'var(--color-text-faint)',fontSize:13}}>
                該当する作品がありません
              </div>
            ) : ranking.map((n, i) => {
              const abs = offset + i
              return (
                <div key={n.id} style={{borderBottom:'1px solid var(--color-brand-light)'}}>
                  <NovelPopup novel={{...n, like_count: n.hideStats ? 0 : (n.score||n.like_count||0)}}>
                  <div className="rk-row" style={{display:'flex',gap:12,padding:'12px 14px',alignItems:'flex-start',cursor:'pointer'}}>
                    <div className="rk-no" style={{width:28,textAlign:'center',flexShrink:0,paddingTop:2}}>
                      <span style={{fontSize:rankSize(abs),fontWeight:800,color:rankColor(abs),fontFamily:"'Noto Serif JP',serif"}}>{abs+1}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:4,marginBottom:3,flexWrap:'wrap',alignItems:'center'}}>
                        <span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',padding:'1px 5px',borderRadius:3}}>{n.genre}</span>
                        <span style={{fontSize:10,background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'1px 5px',borderRadius:3}}>{n.novel_type}</span>
                        {n.is_serial && <span style={{fontSize:10,background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',padding:'1px 5px',borderRadius:3}}>連載中</span>}
                      </div>
                      <div style={{fontSize:14,fontWeight:700,color:'var(--color-text)',marginBottom:2,lineHeight:1.4}}>{n.title}</div>
                      <div style={{fontSize:11,color:'var(--color-text-muted)',marginBottom:4}}>作者：{n.display_name}</div>
                      {n.summary && (
                        <div className="rk-summary" style={{fontSize:12,color:'#5a3a20',lineHeight:1.7,marginBottom:5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical' as any}}>
                          {n.summary}
                        </div>
                      )}
                      {(n.tags||[]).length > 0 && (
                        <div className="rk-tags" style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:5}}>
                          {(n.tags as string[]).slice(0,4).map((tag: string) => (
                            <span key={tag} style={{fontSize:10,background:'var(--color-bg)',color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',padding:'1px 5px',borderRadius:3}}>#{tag}</span>
                          ))}
                        </div>
                      )}
                      <div style={{display:'flex',gap:10,fontSize:11,color:'var(--color-text-faint)',flexWrap:'wrap',alignItems:'center'}}>
                        {n.char_count > 0 && <span>{fmtChar(n.char_count)}</span>}
                        {fmtDate(n.last_updated) && (
                          <span>更新：{fmtDate(n.last_updated)}</span>
                        )}
                        {isGrowthRanking ? (
                          /*
                            * ★ 0.0% のときは出さない。
                            *
                            *   まだ誰も押していない作品に
                            *   「注目度 0.0%」と貼ると、
                            *   数が無いことをわざわざ知らせるだけになる。
                            *   何も貼らないほうがよい。
                            */
                          Number(n.ratePercent) > 0 ? (
                            <span style={{background:'var(--color-brand-light)',color:'var(--color-brand)',fontWeight:700,padding:'1px 8px',borderRadius:10,fontSize:11}}>{n.rateLabel} {n.ratePercent}%</span>
                          ) : null
                        ) : (
                          !n.hideStats && <span style={{color:'var(--color-text-muted)',fontWeight:600}}>{period==='rising' ? `${scoreLabel} ${fmtNum(n.score)}` : `${fmtNum(n.score)} ${scoreLabel}`}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  </NovelPopup>
                </div>
              )
            })}
          </div>

          {!showMore && total > PAGE_SIZE && (
            <div style={{textAlign:'center',padding:'16px'}}>
              <Link href={`/ranking?period=${period}&type=${encodeURIComponent(novelType)}&serial=${serial}&page=all`}
                style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 24px',background:'var(--color-bg)',border:'1.5px solid var(--color-brand)',borderRadius:20,fontSize:13,color:'var(--color-brand)',textDecoration:'none',fontWeight:600}}>
                もっと見る
              </Link>
            </div>
          )}

          {totalPages > 1 && (
            <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:20,flexWrap:'wrap'}}>
              {page > 1 && (
                <Link href={buildUrl(period,novelType,serial,page-1)}
                  style={{padding:'6px 16px',border:'1px solid var(--color-brand-border)',borderRadius:20,fontSize:13,color:'var(--color-brand)',textDecoration:'none',background:'var(--color-bg)'}}>
                  ‹ 前へ
                </Link>
              )}
              {Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=2).map((p,i,arr)=>(
                <span key={p} style={{display:'flex',alignItems:'center',gap:8}}>
                  {i>0&&arr[i-1]!==p-1&&<span style={{color:'var(--color-text-faint)'}}>…</span>}
                  <Link href={buildUrl(period,novelType,serial,p)}
                    style={{padding:'6px 14px',border:'1px solid',borderRadius:20,fontSize:13,textDecoration:'none',
                      borderColor:p===page?'var(--color-brand)':'var(--color-brand-border)',
                      background:p===page?'var(--color-brand)':'var(--color-bg-card)',
                      color:p===page?'var(--color-bg-card)':'var(--color-text-muted)',
                      fontWeight:p===page?700:400}}>
                    {p}
                  </Link>
                </span>
              ))}
              {page < totalPages && (
                <Link href={buildUrl(period,novelType,serial,page+1)}
                  style={{padding:'6px 16px',border:'1px solid var(--color-brand-border)',borderRadius:20,fontSize:13,color:'var(--color-brand)',textDecoration:'none',background:'var(--color-bg)'}}>
                  次へ ›
                </Link>
              )}
            </div>
          )}

          <div className="mobile-only" style={{height:80}}/>
        </div>
      </div>

      <AdBanner />
      <Footer />

      <style>{`
        @media (max-width: 768px) {
          .ranking-filter > div > div { flex-wrap: nowrap !important; }
        }
      `}</style>
    </div>
  )
}
