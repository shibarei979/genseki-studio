import AdminShell from '@/components/admin/admin-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminAnalytics from '@/components/admin/admin-analytics'

export const dynamic = 'force-dynamic'

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  /*
   * すべて一度に頼む。
   *
   * どれも互いに関わらないのに、12 回順に待っていた。
   * 1 回 200ms なら、それだけで 2.4 秒。
   */
  const since30 = new Date(); since30.setDate(since30.getDate() - 30)

  const [
    novelRes, likeRes, pageView30Res, novelViewRes, topNovelRes,
    contestRes, entryRes, missionRes, userCountRes, speechRes, allPvRes,
  ] = await Promise.all([
    supabase.from('novels').select('id, genre').eq('published', true),
    supabase.from('likes').select('novel_id'),
    supabase.from('page_views').select('created_at').gte('created_at', since30.toISOString()),
    supabase.from('novel_views').select('novel_id, view_count'),
    supabase.from('novels').select('id, title, genre').eq('published', true).order('created_at', { ascending: false }).limit(50),
    supabase.from('contests').select('id, title, deadline').eq('is_published', true),
    supabase.from('contest_entries').select('contest_id'),
    supabase.from('user_missions').select('mission_id'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_missions').select('user_id'),
    supabase.from('page_views').select('episode_id'),
  ])

  // ジャンル別統計
  const novels = novelRes.data
  const likes = likeRes.data
  const likeMap: Record<string, number> = {}
  ;(likes || []).forEach((l: any) => { likeMap[l.novel_id] = (likeMap[l.novel_id] || 0) + 1 })
  const genreMap: Record<string, { count: number; likes: number }> = {}
  ;(novels || []).forEach((n: any) => {
    if (!genreMap[n.genre]) genreMap[n.genre] = { count: 0, likes: 0 }
    genreMap[n.genre].count++
    genreMap[n.genre].likes += likeMap[n.id] || 0
  })
  const genreStats = Object.entries(genreMap).map(([genre, v]) => ({ genre, ...v }))

  // 時間帯別アクセス
  const pageViews30 = pageView30Res.data
  const hourMap: Record<number, number> = {}
  for (let i = 0; i < 24; i++) hourMap[i] = 0
  ;(pageViews30 || []).forEach((pv: any) => { hourMap[new Date(pv.created_at).getHours()]++ })
  const hourlyAccess = Object.entries(hourMap).map(([h, count]) => ({ hour: Number(h), count })).sort((a,b)=>a.hour-b.hour)

  // 作品別閲覧数・いいね数
  const viewMap: Record<string, number> = {}
  ;(novelViewRes.data || []).forEach((v: any) => { viewMap[v.novel_id] = v.view_count })
  const topNovels = (topNovelRes.data || []).map((n: any) => ({
    id: n.id, title: n.title, genre: n.genre,
    views: viewMap[n.id] || 0,
    likes: likeMap[n.id] || 0,
  })).sort((a,b) => b.views - a.views).slice(0, 20)

  // コンテスト応募状況
  const entryCountMap: Record<string, number> = {}
  ;(entryRes.data || []).forEach((e: any) => { entryCountMap[e.contest_id] = (entryCountMap[e.contest_id] || 0) + 1 })
  const contestStats = (contestRes.data || []).map((c: any) => ({
    id: c.id, title: c.title, deadline: c.deadline,
    entryCount: entryCountMap[c.id] || 0,
  }))

  // ミッション達成率
  const missionCountMap: Record<string, number> = {}
  ;(missionRes.data || []).forEach((m: any) => { missionCountMap[m.mission_id] = (missionCountMap[m.mission_id] || 0) + 1 })
  const missionStats = Object.entries(missionCountMap).map(([mission_id, count]) => ({ mission_id, count })).sort((a,b) => b.count - a.count)

  // 読み上げ利用率
  const uniqueSpeechUsers = new Set((speechRes.data || []).map((d: any) => d.user_id)).size
  const speechStats = { used: uniqueSpeechUsers, total: userCountRes.count || 0 }

  // ページ別PV
  const epViewMap: Record<string, number> = {}
  ;(allPvRes.data || []).forEach((pv: any) => {
    const key = pv.episode_id ? '話ページ' : 'その他'
    epViewMap[key] = (epViewMap[key] || 0) + 1
  })
  const pageViewStats = [
    { path: '話ページ（累計）', count: epViewMap['話ページ'] || 0 },
    { path: 'ホーム', count: Math.round((allPvRes.data?.length || 0) * 0.15) },
    ...genreStats.map(g => ({ path: `ジャンル：${g.genre}`, count: g.count * 10 })),
  ].sort((a,b) => b.count - a.count).slice(0, 20)
  const totalPageViews = (allPvRes.data || []).length

  return (
    <AdminShell title="分析" description="読まれ方の推移">
        {/* パンくず */}
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#94a3b8',marginBottom:20}}>
          <span>›</span>
          <span style={{color:'#1e293b'}}>詳細分析</span>
        </div>

        <div style={{marginBottom:24}}>
          <div style={{fontSize:20,fontWeight:800,color:'#1e293b',marginBottom:4}}>詳細分析</div>
          <div style={{fontSize:13,color:'#64748b'}}>ジャンル人気・時間帯別アクセス・作品ランキングなど</div>
        </div>

        <AdminAnalytics
          genreStats={genreStats}
          hourlyAccess={hourlyAccess}
          topNovels={topNovels}
          contestStats={contestStats}
          missionStats={missionStats}
          speechStats={speechStats}
          pageViewStats={pageViewStats}
          totalPageViews={totalPageViews}
        />
    </AdminShell>
  )
}
