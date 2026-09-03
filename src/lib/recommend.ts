// 原石航路 おすすめアルゴリズム（仕様書 Ver.1.0 / Phase 1）
// 最終スコア = 作品スコア × Freshness × 信用度 × 独創性ブースト × 受賞ブースト
import { createClient as createSbClient } from '@supabase/supabase-js'
import { clientEnv } from '@/config/env.client'
import { unstable_cache } from 'next/cache'
import { serverEnv } from '@/config/env.server'

export interface ScoredNovel {
  id: string
  title: string
  genre: string
  novel_type: string | null
  author_id: string
  summary: string | null
  catchcopy: string | null
  tags: string[] | null
  created_at: string
  ai_usage: string | null
  /*
   * 年齢の区分。
   *
   * ここでは絞らない。集計は全員で共有するので、
   * 人ごとに変えると使い回せない。
   * 見せる直前に、呼ぶ側で絞る。
   */
  age_rating: string | null
  finalScore: number
  inGuarantee: boolean
  validReaders: number
}

async function computeRecommendScores(): Promise<ScoredNovel[]> {
  const supabase: any = createSbClient(serverEnv.supabaseUrl, clientEnv.supabaseAnonKey)
  const now = Date.now()

  // 候補作品（公開・全年齢・直近300件）
  const { data: novels } = await supabase
    .from('novels')
    .select('id, title, genre, novel_type, author_id, summary, catchcopy, tags, created_at, originality_score, ai_usage, is_serial, completed_at, age_rating')
    .eq('published', true).eq('is_r18', false).not('genre', 'in', '("官能","官能 R18","BL R18","GL R18")')
    .order('created_at', { ascending: false }).limit(300)
  if (!novels || novels.length === 0) return []
  const novelIds = novels.map((n: any) => n.id)

  // 関連データを並列取得
  const [epsRes, likesRes, bookmarksRes, discoversRes, commentsRes, readsRes, boostsRes] = await Promise.all([
    supabase.from('episodes').select('id, novel_id, created_at').in('novel_id', novelIds).eq('published', true),
    supabase.from('likes').select('novel_id, user_id').in('novel_id', novelIds),
    supabase.from('bookmarks').select('novel_id, user_id').in('novel_id', novelIds),
    supabase.from('discovers').select('novel_id, user_id').in('novel_id', novelIds).eq('is_pending', false),
    supabase.from('comments').select('novel_id, user_id').in('novel_id', novelIds),
    supabase.from('read_episodes').select('novel_id, user_id').in('novel_id', novelIds),
    supabase.from('award_boosts').select('novel_id, multiplier').gt('expires_at', new Date().toISOString()),
  ])

  // 話マップ（作品→話ID群・最新話）
  const epMap: Record<string, { ids: string[]; latest: string; latestAt: string }> = {}
  ;(epsRes.data || []).forEach((e: any) => {
    if (!epMap[e.novel_id]) epMap[e.novel_id] = { ids: [], latest: e.id, latestAt: e.created_at }
    epMap[e.novel_id].ids.push(e.id)
    if (e.created_at > epMap[e.novel_id].latestAt) { epMap[e.novel_id].latest = e.id; epMap[e.novel_id].latestAt = e.created_at }
  })

  // 有効読者（is_valid_read=true）を話ID経由で取得
  const allEpIds = Object.values(epMap).flatMap(m => m.ids)
  const epToNovel: Record<string, string> = {}
  Object.entries(epMap).forEach(([nid, m]) => m.ids.forEach(eid => { epToNovel[eid] = nid }))
  let validRows: any[] = []
  if (allEpIds.length > 0) {
    // 分割して取得（inの上限対策）
    for (let i = 0; i < allEpIds.length; i += 500) {
      const chunk = allEpIds.slice(i, i + 500)
      const { data } = await supabase.from('page_views').select('episode_id, user_id').in('episode_id', chunk).eq('is_valid_read', true)
      if (data) validRows = validRows.concat(data)
    }
  }
  // 直近72時間のPV（勢い＝途中でPVが伸びた作品を押し上げる）
  const recentPvMap: Record<string, number> = {}
  const pvSince = new Date(now - 72 * 3600 * 1000).toISOString()
  if (allEpIds.length > 0) {
    for (let i = 0; i < allEpIds.length; i += 500) {
      const chunk = allEpIds.slice(i, i + 500)
      const { data } = await supabase.from('page_views').select('episode_id').in('episode_id', chunk).gt('created_at', pvSince)
      data?.forEach((r: any) => { const nid = epToNovel[r.episode_id]; if (nid) recentPvMap[nid] = (recentPvMap[nid] || 0) + 1 })
    }
  }

  // 作品ごとの有効読者（distinct user）・最新話の有効読者・2話以上読んだ人
  const validUsers: Record<string, Set<string>> = {}
  const latestEpValid: Record<string, Set<string>> = {}
  const userEpCount: Record<string, Record<string, Set<string>>> = {}  // novel -> user -> ep set
  validRows.forEach((r: any) => {
    const nid = epToNovel[r.episode_id]
    if (!nid || !r.user_id) return
    if (!validUsers[nid]) validUsers[nid] = new Set()
    validUsers[nid].add(r.user_id)
    if (epMap[nid]?.latest === r.episode_id) {
      if (!latestEpValid[nid]) latestEpValid[nid] = new Set()
      latestEpValid[nid].add(r.user_id)
    }
    if (!userEpCount[nid]) userEpCount[nid] = {}
    if (!userEpCount[nid][r.user_id]) userEpCount[nid][r.user_id] = new Set()
    userEpCount[nid][r.user_id].add(r.episode_id)
  })

  // 反応マップ（件数＋distinctユーザー）
  function buildMap(rows: any[]) {
    const count: Record<string, number> = {}
    const users: Record<string, Set<string>> = {}
    rows.forEach((r: any) => {
      count[r.novel_id] = (count[r.novel_id] || 0) + 1
      if (r.user_id) {
        if (!users[r.novel_id]) users[r.novel_id] = new Set()
        users[r.novel_id].add(r.user_id)
      }
    })
    return { count, users }
  }
  const likeM = buildMap(likesRes.data || [])
  const bmM = buildMap(bookmarksRes.data || [])
  const dcM = buildMap(discoversRes.data || [])
  const cmM = buildMap(commentsRes.data || [])
  const rdM = buildMap(readsRes.data || [])
  const boostMap: Record<string, number> = {}
  ;(boostsRes.data || []).forEach((b: any) => { boostMap[b.novel_id] = Math.max(boostMap[b.novel_id] || 1, Number(b.multiplier) || 1) })

  const clip = (x: number) => Math.min(1, Math.max(0, x))

  // 第1パス：通常スコア（率ベース）を計算
  const raw: Record<string, { workScore: number; V: number; reactions: number }> = {}
  novels.forEach((n: any) => {
    const V = validUsers[n.id]?.size || 0
    const epCount = epMap[n.id]?.ids.length || 0
    const isShort = n.novel_type === '短編' || epCount === 1
    const orig = clip((n.originality_score || 0) / 100)
    const reactions = (likeM.count[n.id] || 0) + (bmM.count[n.id] || 0) + (dcM.count[n.id] || 0)

    let workScore = 0
    if (V > 0) {
      const readRate = clip((rdM.users[n.id]?.size || 0) / V)                 // 完読率
      const saveRate = clip((bmM.count[n.id] || 0) / V)                        // 保存率
      const likeRate = clip((likeM.count[n.id] || 0) / V)                      // いいね率
      const cmRate = clip((cmM.users[n.id]?.size || 0) / V)                    // コメント率
      const dcRate = clip((dcM.count[n.id] || 0) / V)                          // 発掘率
      if (isShort) {
        workScore = readRate * 0.35 + saveRate * 0.15 + likeRate * 0.10 + cmRate * 0.08 + dcRate * 0.20 + orig * 0.12
      } else {
        // 続きを読む率 ≈ 2話以上有効読了した読者の割合
        const multi = Object.values(userEpCount[n.id] || {}).filter(s => s.size >= 2).length
        const contRate = clip(multi / V)
        // 継続率(8%)はPhase2のため除外し、92%で正規化
        workScore = (readRate * 0.25 + contRate * 0.15 + saveRate * 0.10 + likeRate * 0.10 + cmRate * 0.07 + dcRate * 0.15 + orig * 0.10) / 0.92
      }
    }
    raw[n.id] = { workScore, V, reactions }
  })

  // サイト平均（十分なデータがある作品の平均。無ければ0.3）
  const matured = novels.filter((n: any) => raw[n.id].V >= 100)
  const siteAvg = matured.length > 0
    ? matured.reduce((s: number, n: any) => s + raw[n.id].workScore, 0) / matured.length
    : 0.3

  // 第2パス：補正・倍率を適用して最終スコア
  const result: ScoredNovel[] = novels.map((n: any) => {
    const { workScore, V, reactions } = raw[n.id]
    const epCount = epMap[n.id]?.ids.length || 0
    const orig = clip((n.originality_score || 0) / 100)

    // データ不足補正（有効読者100人・反応10件に達するまでブレンド）
    const initReact = clip(reactions / 10)
    const provisional = siteAvg * 0.5 + initReact * 0.3 + orig * 0.2
    const t = Math.min(1, V / 100) * Math.min(1, reactions / 10)
    let score = provisional * (1 - t) + workScore * t

    // Freshness：更新が古いほど減衰（最低0.5、更新で1.0に戻る）
    const lastUpdate = epMap[n.id]?.latestAt || n.created_at
    const days = Math.floor((now - new Date(lastUpdate).getTime()) / 86400000)
    const freshness = Math.max(0.5, 1.0 - 0.03 * Math.floor(days / 3))

    // 信用度：評価人数が多いほど信頼（min 0.8 → max 1.3）
    const raters = (likeM.users[n.id]?.size || 0) + (bmM.users[n.id]?.size || 0) + (dcM.users[n.id]?.size || 0) + (cmM.users[n.id]?.size || 0)
    const trust = Math.min(1.3, 0.8 + Math.log10(raters + 1) * 0.1)

    // 独創性ブースト
    const origBoost = (n.originality_score || 0) >= 85 ? 1.20 : (n.originality_score || 0) >= 70 ? 1.10 : (n.originality_score || 0) >= 40 ? 1.00 : 0.95

    // 受賞ブースト
    const awardBoost = boostMap[n.id] || 1.0

    // PV勢いブースト：直近72時間のPVが多いほど上昇（PV10≈×1.10 / PV100≈×1.20 / PV1000≈×1.30、上限1.35）
    const momentum = Math.min(1.35, 1 + Math.log10((recentPvMap[n.id] || 0) + 1) * 0.1)

    // 完結ブースト：完結後1ヶ月だけ×1.15（完結の節目を押し上げる）
    const completedAt = n.completed_at || (n.is_serial === false ? n.created_at : null)
    const completeBoost = (n.is_serial === false && completedAt && (now - new Date(completedAt).getTime()) < 30 * 86400000) ? 1.15 : 1.0

    const finalScore = score * freshness * trust * origBoost * awardBoost * momentum * completeBoost

    // 最低読者保証：1〜3話=有効200人まで（最大7日）／4話〜=最新話が有効100人まで（最大5日）
    let inGuarantee = false
    if (epCount > 0) {
      if (epCount <= 3) {
        const age = now - new Date(n.created_at).getTime()
        inGuarantee = V < 200 && age < 7 * 86400000
      } else {
        const latestAge = now - new Date(epMap[n.id].latestAt).getTime()
        const latestV = latestEpValid[n.id]?.size || 0
        inGuarantee = latestV < 100 && latestAge < 5 * 86400000
      }
    }

    return {
      id: n.id, title: n.title, genre: n.genre, novel_type: n.novel_type,
      author_id: n.author_id, summary: n.summary, catchcopy: n.catchcopy,
      tags: n.tags, created_at: n.created_at,
      ai_usage: n.ai_usage || 'none',
      finalScore: Math.max(0.001, finalScore),
      inGuarantee,
      validReaders: V,
    }
  })

  return result
}

// 3時間ごとに再計算（ランキングと同じキャッシュ方式）
export const getCachedRecommendScores = unstable_cache(computeRecommendScores, ['recommend-scores-v1'], { revalidate: 10800 })

// 重み付きランダム抽選：スコアが高いほど出やすいが低い作品にも確率がある
export function pickWeightedRandom<T extends { finalScore: number }>(items: T[], count: number): T[] {
  const pool = [...items]
  const picked: T[] = []
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((s, it) => s + it.finalScore, 0)
    let r = Math.random() * total
    let idx = 0
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].finalScore
      if (r <= 0) { idx = i; break }
    }
    picked.push(pool[idx])
    pool.splice(idx, 1)
  }
  return picked
}

// おすすめの組み立て：保証枠 ＋ ジャンル50:50 の重み付きランダム
// favoriteGenres: ユーザーがよく読むジャンル（未ログイン・履歴なしは空配列）
export function buildRecommendation(scored: ScoredNovel[], count: number, favoriteGenres: string[], excludeAuthorId?: string, hideAi?: boolean): ScoredNovel[] {
  let pool = scored
  if (excludeAuthorId) pool = pool.filter(n => n.author_id !== excludeAuthorId)
  if (hideAi) pool = pool.filter(n => n.ai_usage !== 'full')
  if (pool.length === 0) return []

  const picked: ScoredNovel[] = []
  const used = new Set<string>()

  // 1) 保証枠：最低読者保証中の作品を優先露出（枠の約4割）
  const guaranteeSlots = Math.max(1, Math.round(count * 0.4))
  const guaranteed = pool.filter(n => n.inGuarantee)
  pickWeightedRandom(guaranteed, guaranteeSlots).forEach(n => { picked.push(n); used.add(n.id) })

  // 2) 残り枠：ジャンル50:50（好きなジャンル半分＋新しい出会い半分）
  const remain = count - picked.length
  const rest = pool.filter(n => !used.has(n.id))
  if (favoriteGenres.length > 0) {
    const fav = rest.filter(n => favoriteGenres.includes(n.genre))
    const other = rest.filter(n => !favoriteGenres.includes(n.genre))
    const favCount = Math.round(remain / 2)
    pickWeightedRandom(fav, favCount).forEach(n => { picked.push(n); used.add(n.id) })
    pickWeightedRandom(other, remain + picked.length - count + (count - picked.length)).forEach(n => { if (picked.length < count) { picked.push(n); used.add(n.id) } })
    // 足りなければ全体から補充
    if (picked.length < count) {
      pickWeightedRandom(rest.filter(n => !used.has(n.id)), count - picked.length).forEach(n => picked.push(n))
    }
  } else {
    pickWeightedRandom(rest, remain).forEach(n => picked.push(n))
  }
  return picked
}
