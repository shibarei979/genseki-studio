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
  const likeMap: Record<string,number> = {}
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
      .in('novel_id', poolIds).eq('is_published', true).limit(20000)

    const hasLive = new Set((liveEps || []).map((e:any) => e.novel_id))

    const [{ data: viewsData }, { data: discoversData }, { data: likesData }, { data: bookmarksData }, { data: readData }] = await Promise.all([
      supabase.from('novel_views').select('novel_id, view_count').in('novel_id', poolIds),
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
      .from('novels').select('id, title, cover_url, genre, novel_type, is_serial, author_id, summary, catchcopy, tags')
      .in('id', risingIds).eq('published', true)
    const risingItems = (risingNovelData || [])
      .sort((a:any, b:any) => (scoreMap[b.id]||0) - (scoreMap[a.id]||0))
      .map((n:any) => ({...n, like_count: scoreMap[n.id]||0}))
    const authorIds2 = Array.from(new Set(risingItems.map((n:any) => n.author_id)))
    const authorMap2: Record<string,string> = {}
    if (authorIds2.length > 0) {
      const { data: authors2 } = await supabase.from('public_profiles').select('user_id, display_name').in('user_id', authorIds2 as string[])
      authors2?.forEach((a:any) => { authorMap2[a.user_id] = a.display_name })
    }
    return { items: risingItems.map((n:any) => ({...n, display_name: authorMap2[n.author_id]||''})), total: risingItems.length }
  } else if (period === 'all') {
    // 累計：全期間のいいねを集計
    const { data: allLikes } = await supabase.from('likes').select('novel_id')
    allLikes?.forEach((l: any) => { likeMap[l.novel_id] = (likeMap[l.novel_id]||0)+1 })
    likeIds = Object.entries(likeMap).sort((a,b)=>b[1]-a[1]).map(([id])=>id)
    const { data: recentNovels } = await supabase.from('novels').select('id').eq('published',true).order('created_at',{ascending:false}).limit(100)
    const recentIds = (recentNovels||[]).map((n:any)=>n.id)
    likeIds = Array.from(new Set([...likeIds, ...recentIds]))
  } else if (period === 'daily') {
    const today = new Date(); today.setHours(0,0,0,0)
    const { data: dl } = await supabase.from('likes').select('novel_id').gte('created_at', today.toISOString())
    dl?.forEach((l: any) => { likeMap[l.novel_id] = (likeMap[l.novel_id]||0)+1 })
    // 日間の保存・コメント（星）も集計対象にするため、いいねが付いた作品を候補に
    likeIds = Object.entries(likeMap).sort((a,b)=>b[1]-a[1]).map(([id])=>id)
    // 候補が少ない場合は最近更新された作品も追加
    const { data: recentNovels } = await supabase.from('novels').select('id').eq('published',true).order('created_at',{ascending:false}).limit(100)
    const recentIds = (recentNovels||[]).map((n:any)=>n.id)
    likeIds = Array.from(new Set([...likeIds, ...recentIds]))
  } else {
    const tableMap: Record<string,string> = { weekly:'weekly_likes', monthly:'monthly_likes', quarterly:'quarterly_likes', yearly:'yearly_likes' }
    const { data: likes } = await supabase.from(tableMap[period]).select('novel_id, like_count').order('like_count',{ascending:false}).limit(500)
    likes?.forEach((l: any) => { likeMap[l.novel_id] = l.like_count })
    likeIds = (likes||[]).map((l: any) => l.novel_id)
    // 候補が少ない場合を考慮し最近の作品も追加
    const { data: recentNovels } = await supabase.from('novels').select('id').eq('published',true).order('created_at',{ascending:false}).limit(100)
    const recentIds = (recentNovels||[]).map((n:any)=>n.id)
    likeIds = Array.from(new Set([...likeIds, ...recentIds]))
  }

  if (likeIds.length === 0) return { items: [], total: 0 }

  let q = supabase.from('novels')
    .select('id, title, cover_url, genre, novel_type, is_serial, author_id, summary, tags, created_at')
    .in('id', likeIds).eq('published', true).in('age_rating', ratings)
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
  const { data: novels } = await q
  const candidateNovels = novels || []
  const candidateIds = candidateNovels.map((n: any) => n.id)

  // ポイント計算：☆×1 + いいね×2 + 保存×3
  // ☆は1人1話5まで（同一ユーザー・同一話のratingは最大5に丸める）
  const pointMap: Record<string, number> = {}
  /* 同点のときに見る。上の囲いの外でも使う */
  const continuedForSort: Record<string, number> = {}
  const likeCntMap: Record<string, number> = {}
  const bookmarkCntMap: Record<string, number> = {}
  const starSumMap: Record<string, number> = {}

  if (candidateIds.length > 0) {
    /*
     * いいねと保存は novel_stats から読む。
     *
     * ★ 表を直に数えてはいけない。
     *
     *   likes と bookmarks の決まりは auth.uid() = user_id。
     *   「自分が押したもの」しか読めないので、
     *   ここで数えても 0 しか返らなかった。
     *   ランキングは長いあいだ、実質「星の数」だけで
     *   並んでいた。
     *
     *   novel_stats は数だけを返す入れ物で、
     *   中の行の決まりを素通りする。
     *   誰が押したかは漏れない。
     *
     * ★ いいねには話への♡も入っている。
     *   読者が押すのは、たいてい本文の下の♡。
     */
    const [{ data: allStats }, { data: allRatings }] = await Promise.all([
      supabase.from('novel_stats').select('novel_id, like_count, bookmark_count').in('novel_id', candidateIds),
      supabase.from('comments').select('novel_id, episode_id, user_id, rating').in('novel_id', candidateIds).not('rating', 'is', null),
    ])
    allStats?.forEach((row: any) => {
      likeCntMap[row.novel_id] = Number(row.like_count) || 0
      bookmarkCntMap[row.novel_id] = Number(row.bookmark_count) || 0
    })

    // ☆は「1人1話につき最大5」：user_id+episode_idごとに最大ratingを取る
    const bestRating: Record<string, number> = {} // key: novel_id|user_id|episode_id
    allRatings?.forEach((r: any) => {
      const key = `${r.novel_id}|${r.user_id}|${r.episode_id}`
      const val = Math.min(5, r.rating || 0)
      if (!bestRating[key] || val > bestRating[key]) bestRating[key] = val
    })
    Object.entries(bestRating).forEach(([key, val]) => {
      const nId = key.split('|')[0]
      starSumMap[nId] = (starSumMap[nId] || 0) + (val as number)
    })

    // 期間内PVの集計（PVもランキングに貢献させる）
    const periodHours: Record<string, number> = { daily: 24, weekly: 168, monthly: 720, quarterly: 2160, yearly: 8760 }
    const pvCntMap: Record<string, number> = {}
    {
      const { data: candEps } = await supabase.from('episodes').select('id, novel_id').in('novel_id', candidateIds)
      const epToNovelPv: Record<string, string> = {}
      const candEpIds = (candEps || []).map((e: any) => { epToNovelPv[e.id] = e.novel_id; return e.id })
      const hours = periodHours[period]
      const pvSince = hours ? new Date(Date.now() - hours * 3600 * 1000).toISOString() : null
      for (let i = 0; i < candEpIds.length; i += 500) {
        const chunk = candEpIds.slice(i, i + 500)
        /*
         * ★ 時刻の列は viewed_at。created_at ではない。
         *   その列は無いので、期間つきの並びでは
         *   この問い合わせが失敗し、読まれた数が
         *   まるごと 0 として数えられていた。
         *
         * ★ 見回りの機械は外す。
         *   印の無い古い記録（null）は人として残す。
         */
        let q: any = supabase.from('page_views').select('episode_id')
          .eq('is_author', false)
          .or('is_bot.is.null,is_bot.eq.false')
          .in('episode_id', chunk)
        if (pvSince) q = q.gt('viewed_at', pvSince)
        const { data: pvRows } = await q
        pvRows?.forEach((r: any) => { const nid = epToNovelPv[r.episode_id]; if (nid) pvCntMap[nid] = (pvCntMap[nid] || 0) + 1 })
      }
    }

    /*
     * 続けて読んだ人を数える。
     *
     * ★ 同じ人が、その作品の 2 話以上を読んだ数。
     *
     *   1 話だけ読んで離れた人と、
     *   続きを読みに戻ってきた人は、意味が違う。
     *   後者のほうが「面白かった」を強く表す。
     *
     * ★ 順番までは見ない。
     *   1 話 → 2 話 → 3 話 と順に追うには、
     *   人数 × 話数ぶん調べることになり、
     *   開くたびの計算としては重すぎる。
     */
    const continuedMap = continuedForSort
    {
      const readByUser: Record<string, Set<string>> = {}

      for (let i = 0; i < candidateIds.length; i += 200) {
        const chunk = candidateIds.slice(i, i + 200)
        const { data: reads } = await supabase
          .from('read_episodes')
          .select('novel_id, user_id, episode_id')
          .in('novel_id', chunk)
          .limit(20000)

        reads?.forEach((r: any) => {
          if (!r.user_id) return
          const key = `${r.novel_id}|${r.user_id}`
          if (!readByUser[key]) readByUser[key] = new Set()
          readByUser[key].add(r.episode_id)
        })
      }

      /* 2 話以上読んだ人だけ数える */
      Object.entries(readByUser).forEach(([key, eps]) => {
        if (eps.size < 2) return
        const nId = key.split('|')[0]
        continuedMap[nId] = (continuedMap[nId] || 0) + 1
      })
    }

    candidateIds.forEach((id: string) => {
      /*
       * 点の出し方。
       *
       *   評価（星）    × 1
       *   いいね        × 2
       *   保存          × 2     ← 3 から下げた
       *   続けて読んだ   × 1.3   ← 足した
       *   読まれた数     × 0.2
       *
       * 保存は「あとで読む」の印で、読んだ証しではない。
       * 続けて読んだほうが、面白かったことを強く表す。
       */
      pointMap[id] =
        (starSumMap[id] || 0) * 1
        + (likeCntMap[id] || 0) * 2
        + (bookmarkCntMap[id] || 0) * 2
        + Math.round((continuedMap[id] || 0) * 1.3)
        + Math.round((pvCntMap[id] || 0) * 0.2)
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
  const sorted = candidateNovels.sort((a: any, b: any) => {
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
const getCachedRanking = unstable_cache(computeRanking, ['ranking-v1'], { revalidate: 10800 })


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

  function fmtDate(s: string) {
    const d = new Date(s)
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`
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
    { value:'rising',    label:'注目度' },
    { value:'discover_rate',  label:'発掘率' },
    { value:'read_rate',      label:'読了率' },
    { value:'bookmark_rate',  label:'保存率' },
    { value:'newbie_focus',   label:'新人注目' },
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
                <Link href={buildUrl('rising',novelType,serial)} className={pillClass(period==='rising')} style={pill(period==='rising')}>注目度</Link>
                <Link href={buildUrl('newbie_focus',novelType,serial)} className={pillClass(period==='newbie_focus')} style={pill(period==='newbie_focus')}>新人注目</Link>
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
                        <span>更新：{fmtDate(n.last_updated)}</span>
                        {isGrowthRanking ? (
                          <span style={{background:'var(--color-brand-light)',color:'var(--color-brand)',fontWeight:700,padding:'1px 8px',borderRadius:10,fontSize:11}}>{n.rateLabel} {n.ratePercent}%</span>
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
