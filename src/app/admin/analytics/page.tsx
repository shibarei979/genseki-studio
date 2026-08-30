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
  if (!user) redirect('/login')

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
    contestRes, entryRes, missionRes, userCountRes, speechRes,
    totalPvRes, pv30Res, episodePvRes, otherPvRes,
  ] = await Promise.all([
    supabase.from('novels').select('id, genre').eq('published', true),
    supabase.from('likes').select('novel_id'),
    supabase.from('page_views').select('viewed_at').gte('viewed_at', since30.toISOString()).limit(50000),
    supabase.from('novel_views').select('novel_id, view_count'),
    supabase.from('novels').select('id, title, genre').eq('published', true).order('created_at', { ascending: false }).limit(50),
    supabase.from('contests').select('id, title, deadline').eq('is_published', true),
    supabase.from('contest_entries').select('contest_id'),
    supabase.from('user_missions').select('mission_id'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_missions').select('user_id'),

    /*
     * PV の数は、行を取ってきて数えないこと。
     *
     * 前は page_views の行を全部引いて length で数えていた。
     * 一度に返る行には上限があるので、実際が何万あっても
     * その上限で頭打ちになる。
     * count で頼めば、行を運ばずに本当の数が返る。
     */
    supabase.from('page_views').select('*', { count: 'exact', head: true }),
    supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('viewed_at', since30.toISOString()),
    supabase.from('page_views').select('*', { count: 'exact', head: true }).not('episode_id', 'is', null),
    supabase.from('page_views').select('*', { count: 'exact', head: true }).is('episode_id', null),
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

  /*
   * 時間帯別アクセス。
   *
   * 前は new Date(...).getHours() で数えていた。
   * これは動かしている機械の時刻で数えるので、
   * Vercel（UTC）では日本時間より 9 時間ずれる。
   * 「夜に読まれている」が「昼」と出ていた。
   */
  const jstHour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', hour12: false,
  })
  const pageViews30 = pageView30Res.data
  const hourMap: Record<number, number> = {}
  for (let i = 0; i < 24; i++) hourMap[i] = 0
  ;(pageViews30 || []).forEach((pv: any) => {
    const hour = Number(jstHour.format(new Date(pv.viewed_at))) % 24
    hourMap[hour]++
  })
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

  /*
   * ページ別 PV。
   *
   * 前はここに作り物の数字が混ざっていた。
   *   ホーム       … 全体の 15% と決め打ち
   *   ジャンル別    … 作品数 × 10
   * どちらも数えたものではないので、見て判断できない。
   * 数えられるものだけを出す。
   */
  const pageViewStats = [
    { path: '話ページ', count: episodePvRes.count || 0 },
    { path: 'そのほかのページ', count: otherPvRes.count || 0 },
  ].sort((a,b) => b.count - a.count)

  const totalPageViews = totalPvRes.count || 0
  const pageViews30Count = pv30Res.count || 0

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

        {/* PV の数。いちばん見るものなので上に出す */}
        <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:24}}>
          <div style={{flex:'1 1 200px',border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',background:'#fff'}}>
            <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>PV（累計）</div>
            <div style={{fontSize:24,fontWeight:800,color:'#1e293b'}}>{totalPageViews.toLocaleString()}</div>
          </div>
          <div style={{flex:'1 1 200px',border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',background:'#fff'}}>
            <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>PV（直近30日）</div>
            <div style={{fontSize:24,fontWeight:800,color:'#1e293b'}}>{pageViews30Count.toLocaleString()}</div>
          </div>
          <div style={{flex:'1 1 200px',border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',background:'#fff'}}>
            <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>話ページの PV（累計）</div>
            <div style={{fontSize:24,fontWeight:800,color:'#1e293b'}}>{(episodePvRes.count || 0).toLocaleString()}</div>
          </div>
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
