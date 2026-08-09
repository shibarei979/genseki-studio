/**
 * ============================================================
 * 原石航路 Studio
 * /api/novel/[id]/recommend — おすすめ作品
 *
 * 作品ページの一番下に出る。
 *
 * 好みを拾い、点を付け、足りなければ埋める。
 * 20 回近い問い合わせがかかるが、
 * 画面の下まで送らないと見えない。
 *
 * 表で待つと、あらすじも目次も出るのが遅れる。
 * ============================================================
 */

import { NextResponse } from 'next/server'

import { calcQualityScore } from '@/lib/quality-score'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  /* この作品と、同じシリーズのもの。おすすめから外す */
  const { searchParams } = new URL(request.url)
  const seriesNovelIds = new Set(
    (searchParams.get('exclude') ?? '').split(',').filter(Boolean),
  )

  /* いま見ている作品の種類。同じものばかり勧めないために使う */
  const currentGenre = searchParams.get('genre') ?? ''

  let readNovelIds = new Set<string>([params.id, ...Array.from(seriesNovelIds)])
  let historyGenres: string[] = []
  let historyTags: string[] = []
  let historyAuthorIds: string[] = []

  if (user) {
    // 閲覧履歴から好みを抽出
    const { data: historyData } = await supabase
      .from('page_views')
      .select('novel_id, novels(genre, tags, author_id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    for (const h of (historyData || [])) {
      const n = (h as any).novels
      if (!n) continue
      readNovelIds.add(h.novel_id)
      if (n.genre) historyGenres.push(n.genre)
      if (n.tags) historyTags.push(...n.tags)
      if (n.author_id) historyAuthorIds.push(n.author_id)
    }
  }

  // 未ログイン：前半・後半ともランダムジャンルで表示
  const allGenresList = ['異世界','ファンタジー','SF','恋愛','学園','ミステリー','ホラー','歴史・時代','日常','アクション','コメディ','その他']
  const isLoggedIn = !!user

  // 頻出ジャンル・タグ・作者を集計
  const genreFreq: Record<string,number> = {}
  historyGenres.forEach(g => { genreFreq[g] = (genreFreq[g]||0)+1 })
  const tagFreq: Record<string,number> = {}
  historyTags.forEach(t => { tagFreq[t] = (tagFreq[t]||0)+1 })
  const topGenres = Object.entries(genreFreq).sort((a,b)=>b[1]-a[1]).map(([g])=>g)
  const topTags   = Object.entries(tagFreq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t])=>t)
  const topAuthors = historyAuthorIds.filter((v, i, a) => a.indexOf(v) === i).slice(0,3)

  // フォールバック用：ジャンル不問で全作品取得（必ず6件確保するため）
  const { data: fallbackRaw } = await supabase
    .from('novels')
    .select('id, title, genre, novel_type, is_serial, author_id, summary, originality_score')
    .eq('published', true).neq('id', params.id)
    .order('created_at', { ascending: false })
    .limit(30)
  const fallbackPool = (fallbackRaw || []).filter((n: any) => !readNovelIds.has(n.id))

  // 前半：パーソナライズ or ランダム（3件）
  let scored: any[] = []
  if (isLoggedIn && topGenres.length > 0) {
    const preferGenre = topGenres[0]
    const { data: personalizedRaw } = await supabase
      .from('novels')
      .select('id, title, genre, novel_type, is_serial, author_id, summary, tags, originality_score')
      .eq('published', true).eq('genre', preferGenre)
      .order('created_at', { ascending: false })
      .limit(20)
    scored = (personalizedRaw || [])
      .filter((n: any) => !readNovelIds.has(n.id))
      .map((n: any) => {
        let score = 0
        if (topAuthors.includes(n.author_id)) score += 3
        const matchTags = (n.tags || []).filter((t: string) => topTags.includes(t)).length
        score += matchTags * 2
        score += (n.originality_score || 50) / 20  // 独創性スコアを加味（最大5点）
        return { ...n, score }
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3)
  } else {
    scored = fallbackPool.slice(0, 3)
  }

  // 後半：ディスカバリー or ランダム（3件）
  const scoredIds = new Set(scored.map((n: any) => n.id))
  let discovery: any[] = []
  if (isLoggedIn) {
    const unusedGenres = allGenresList.filter(g => !topGenres.slice(0,3).includes(g) && g !== currentGenre)
    const discoveryGenre = unusedGenres.length > 0
      ? unusedGenres[Math.floor(Math.random() * unusedGenres.length)]
      : allGenresList[Math.floor(Math.random() * allGenresList.length)]
    const { data: discoveryRaw } = await supabase
      .from('novels')
      .select('id, title, genre, novel_type, is_serial, author_id, summary, originality_score')
      .eq('published', true).eq('genre', discoveryGenre)
      .order('created_at', { ascending: false })
      .limit(10)
    discovery = (discoveryRaw || [])
      .filter((n: any) => !readNovelIds.has(n.id) && !scoredIds.has(n.id))
      .slice(0, 3)
  } else {
    discovery = fallbackPool.filter((n: any) => !scoredIds.has(n.id)).slice(0, 3)
  }

  // 不足分はfallbackで補填して必ず6件に
  let recommendedNovels = [...scored, ...discovery]
  if (recommendedNovels.length < 6) {
    const existingIds = new Set(recommendedNovels.map((n: any) => n.id))
    const extras = fallbackPool.filter((n: any) => !existingIds.has(n.id))
    recommendedNovels = [...recommendedNovels, ...extras].slice(0, 6)
  }
  // おすすめ作品のいいね数を取得
  const recNovelIds = recommendedNovels.map((n: any) => n.id)
  const recLikeMap: Record<string, number> = {}
  const recDiscoverMap: Record<string, number> = {}
  const recEpCountMap: Record<string, number> = {}
  const recLatestEpMap: Record<string, string> = {}
  const recBookmarkMap: Record<string, number> = {}
  const recViewMap: Record<string, number> = {}
  const recReadMap: Record<string, number> = {}
  if (recNovelIds.length > 0) {
    const [{ data: recLikes }, { data: recDiscovers }, { data: recEpisodes }, { data: recBookmarks }, { data: recViews }, { data: recReads }] = await Promise.all([
      supabase.from('likes').select('novel_id').in('novel_id', recNovelIds),
      supabase.from('discovers').select('novel_id').eq('is_pending', false).in('novel_id', recNovelIds),
      supabase.from('episodes').select('novel_id, created_at').in('novel_id', recNovelIds).eq('published', true),
      supabase.from('bookmarks').select('novel_id').in('novel_id', recNovelIds),
      supabase.from('novel_views').select('novel_id, view_count').in('novel_id', recNovelIds),
      supabase.from('read_episodes').select('novel_id').in('novel_id', recNovelIds),
    ])
    recLikes?.forEach((l: any) => { recLikeMap[l.novel_id] = (recLikeMap[l.novel_id] || 0) + 1 })
    recDiscovers?.forEach((d: any) => { recDiscoverMap[d.novel_id] = (recDiscoverMap[d.novel_id] || 0) + 1 })
    recEpisodes?.forEach((e: any) => {
      recEpCountMap[e.novel_id] = (recEpCountMap[e.novel_id] || 0) + 1
      if (!recLatestEpMap[e.novel_id] || e.created_at > recLatestEpMap[e.novel_id]) recLatestEpMap[e.novel_id] = e.created_at
    })
    recBookmarks?.forEach((b: any) => { recBookmarkMap[b.novel_id] = (recBookmarkMap[b.novel_id] || 0) + 1 })
    recViews?.forEach((v: any) => { recViewMap[v.novel_id] = v.view_count || 0 })
    recReads?.forEach((r: any) => { recReadMap[r.novel_id] = (recReadMap[r.novel_id] || 0) + 1 })
  }

  // 総合スコアで再ソート（独創性50% + いいね30% + 拡散20% + 新着ブースト + 更新ブースト + 質スコア0.4）
  const maxLikes = Math.max(1, ...Object.values(recLikeMap))
  const maxDiscovers = Math.max(1, ...Object.values(recDiscoverMap))
  const now48 = Date.now() - 48 * 60 * 60 * 1000
  recommendedNovels = recommendedNovels.map((n: any) => {
    const originality = (n.originality_score || 50) / 100
    const likeNorm = (recLikeMap[n.id] || 0) / maxLikes
    const discoverNorm = (recDiscoverMap[n.id] || 0) / maxDiscovers
    // 投稿から48時間以内はブースト（+0.3）
    const isNew = new Date(n.created_at).getTime() > now48
    const newBoost = isNew ? 0.3 : 0
    // 投稿ブースト（最新話の投稿から48時間）：3話まで×1.3、4話以降×1.05
    const epCount = recEpCountMap[n.id] || 0
    const isFresh = recLatestEpMap[n.id] && new Date(recLatestEpMap[n.id]).getTime() > now48
    const boostMultiplier = isFresh ? (epCount <= 3 ? 1.3 : 1.05) : 1.0
    // 質スコア（0-100を0-1に正規化して0.4係数）
    const q = calcQualityScore({
      views: recViewMap[n.id] || 0,
      readCount: recReadMap[n.id] || 0,
      bookmarkCount: recBookmarkMap[n.id] || 0,
      likeCount: recLikeMap[n.id] || 0,
      originalityScore: n.originality_score || 0,
    })
    const qualityBoost = (q.score / 100) * 0.4
    const finalScore = (originality * 0.5 + likeNorm * 0.3 + discoverNorm * 0.2 + newBoost + qualityBoost) * boostMultiplier
    return { ...n, finalScore, isNew }
  }).sort((a: any, b: any) => b.finalScore - a.finalScore)

  const recAuthorIds = Array.from(new Set(recommendedNovels.map((n: any) => n.author_id)))
  const recAuthorMap: Record<string,string> = {}
  if (recAuthorIds.length > 0) {
    const { data: recAuthors } = await supabase.from('profiles').select('user_id, display_name').in('user_id', recAuthorIds as string[])
    recAuthors?.forEach((a: any) => { recAuthorMap[a.user_id] = a.display_name })
  }


  return NextResponse.json({ recommendedNovels, recAuthorMap })
}
