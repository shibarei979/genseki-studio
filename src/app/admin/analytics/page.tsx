import AdminShell from '@/components/admin/admin-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminAnalytics from '@/components/admin/admin-analytics'

export const dynamic = 'force-dynamic'

/** 大きな数字の札。数は3桁ごとに区切って読みやすくする */
function Card({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div style={{flex:'1 1 180px',border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',background:'#fff'}}>
      <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>{label}</div>
      <div style={{fontSize:24,fontWeight:800,color:'#1e293b'}}>{value.toLocaleString()}</div>
      {note && <div style={{fontSize:10,color:'#94a3b8',marginTop:4}}>{note}</div>}
    </div>
  )
}

export default async function AdminAnalyticsPage() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  /*
   * ★ ここから先の数え上げは、運営用の鍵で行う。
   *
   *   前はログインしている人として数えていた。
   *   page_views の決まりは「自分の記録か、自分の作品への記録」しか
   *   読めないので、運営自身のぶんしか数えられていなかった。
   *
   *   PV が 95、読んだ人が 1 人と出ていたのは、そのため。
   *   実際の数ではなく、運営 1 人の数だった。
   *
   *   運営かどうかは、この 1 行上で確かめている。
   */
  const supabase = adminSupabase

  /*
   * すべて一度に頼む。
   *
   * どれも互いに関わらないのに、12 回順に待っていた。
   * 1 回 200ms なら、それだけで 2.4 秒。
   */
  const since30 = new Date(); since30.setDate(since30.getDate() - 30)
  const since7  = new Date(); since7.setDate(since7.getDate() - 7)
  const since1  = new Date(); since1.setDate(since1.getDate() - 1)

  const [
    novelRes, likeRes, pageView30Res, novelViewRes, topNovelRes,
    contestRes, entryRes, missionRes, userCountRes, speechRes,
    totalPvRes, pv30Res, episodePvRes, otherPvRes,
    pv1Res, pv7Res, activeReadersRes, activeWorksRes,
  ] = await Promise.all([
    supabase.from('novels').select('id, genre').eq('published', true),
    supabase.from('likes').select('novel_id'),
    supabase.from('page_views').select('viewed_at').gte('viewed_at', since30.toISOString()).limit(50000),
    supabase.from('novel_views').select('novel_id, view_count'),
    /*
     * 作品ごとの PV を出すので、新しい 50 件では足りない。
     *
     * 前は「新しい順に 50 件」から並べ替えていたので、
     * よく読まれている古い作品が一度も出てこなかった。
     */
    supabase.from('novels').select('id, title, genre').eq('published', true).limit(3000),
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

    /*
     * 単位ごとの PV。
     *
     * 日・週・月を別々に数える。
     * 1 つの数字だけでは、伸びているのか止まっているのかが
     * 分からない。
     */
    supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('viewed_at', since1.toISOString()),
    supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('viewed_at', since7.toISOString()),

    /*
     * 月に一度でも読んだ人。
     *
     * 登録した人の数だけでは、いま使われているかが分からない。
     * 読んだ記録のある人を数える。
     * 名前が要らないので、user_id だけ引く。
     */
    supabase.from('page_views').select('user_id')
      .gte('viewed_at', since30.toISOString()).not('user_id', 'is', null).limit(50000),

    /* 月に一度でも書いた人 */
    supabase.from('episodes').select('novel_id')
      .gte('created_at', since30.toISOString()).limit(50000),
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

  /*
   * 月に一度でも読んだ人・書いた人。
   *
   * 同じ人が何度も読むので、重なりを外して数える。
   */
  const activeReaders = new Set(
    (activeReadersRes.data || []).map((r: any) => r.user_id).filter(Boolean),
  ).size
  const activeWorks = new Set(
    (activeWorksRes.data || []).map((r: any) => r.novel_id).filter(Boolean),
  ).size
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

        {/* PV。単位ごとに並べる。1つの数字では伸びが分からない */}
        <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:16}}>
          <Card label="PV（今日）"      value={pv1Res.count || 0} />
          <Card label="PV（7日）"       value={pv7Res.count || 0} />
          <Card label="PV（30日）"      value={pageViews30Count} />
          <Card label="PV（累計）"      value={totalPageViews} />
        </div>

        {/* 使われ方。登録数だけでは、いま動いているか分からない */}
        <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:16}}>
          <Card label="読んだ人（30日）"  value={activeReaders}
                note="一度でも読んだ、ログイン済みの人" />
          <Card label="書かれた作品（30日）" value={activeWorks}
                note="一度でも話が投稿された作品" />
          <Card label="話ページの PV（累計）" value={episodePvRes.count || 0} />
        </div>

        {/*
          * 収益。
          *
          * ★ まだ課金の仕組みがありません。
          *   数字を入れる所だけ先に置いておきます。
          *   作り物の数字は出しません。見て判断できないためです。
          */}
        <div style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'16px',background:'#fff',marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1e293b',marginBottom:10}}>収益</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
            {['今月の売上','今月の決済件数','平均単価','未払い金額'].map((label) => (
              <div key={label} style={{flex:'1 1 180px',border:'1px dashed #cbd5e1',borderRadius:10,padding:'14px 16px',background:'#f8fafc'}}>
                <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>{label}</div>
                <div style={{fontSize:14,color:'#94a3b8'}}>まだありません</div>
              </div>
            ))}
          </div>
          <p style={{fontSize:11,color:'#94a3b8',marginTop:10,lineHeight:1.7}}>
            課金の仕組みを入れると、ここに数字が入ります。
            決済に何を使うかが決まってから、表の形を決めます。
          </p>
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
