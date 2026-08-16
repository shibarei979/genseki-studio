import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import AnalyticsCharts from '@/components/mypage/analytics/analytics-charts'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()

  const { data: novels } = await supabase
    .from('novels')
    .select('id, title, genre, published, created_at')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  const novelIds = (novels || []).map((n: any) => n.id)

  let allEpisodes: any[] = []
  const statsMap: Record<string, any> = {}

  let deviceStats = { mobilePv: 0, desktopPv: 0, mobileUsers: 0, desktopUsers: 0 }
  if (novelIds.length > 0) {
    const { data: episodes } = await supabase
      .from('episodes')
      .select('id, novel_id, title, ep_number, published, is_published, created_at')
      .in('novel_id', novelIds)
      .order('ep_number', { ascending: true })
    allEpisodes = episodes || []

    const epIds = allEpisodes.map((e: any) => e.id)
    const epToNovel: Record<string, string> = {}
    allEpisodes.forEach((e: any) => { epToNovel[e.id] = e.novel_id })

    const [{ data: pageViews }, { data: likes }, { data: bookmarks }, { data: comments }, { data: epLikes }, { data: epComments }] = await Promise.all([
      epIds.length > 0 ? supabase.from('page_views').select('episode_id, user_id, viewed_at, device').in('episode_id', epIds) : Promise.resolve({ data: [] }),
      supabase.from('likes').select('novel_id').in('novel_id', novelIds),
      supabase.from('bookmarks').select('novel_id').in('novel_id', novelIds),
      supabase.from('comments').select('novel_id, episode_id, body, user_id, created_at, rating').in('novel_id', novelIds).neq('user_id', user.id).order('created_at', { ascending: false }),
      epIds.length > 0 ? supabase.from('episode_likes').select('episode_id').in('episode_id', epIds) : Promise.resolve({ data: [] }),
      Promise.resolve({ data: [] }),
    ])

    // デバイス別の読者集計（device記録開始以降のデータ）
    const mobileUsers = new Set<string>(); const desktopUsers = new Set<string>()
    let mobilePv = 0, desktopPv = 0
    ;(pageViews || []).forEach((pv: any) => {
      if (pv.device === 'mobile') { mobilePv++; if (pv.user_id) mobileUsers.add(pv.user_id) }
      else if (pv.device === 'desktop') { desktopPv++; if (pv.user_id) desktopUsers.add(pv.user_id) }
    })
    deviceStats = { mobilePv, desktopPv, mobileUsers: mobileUsers.size, desktopUsers: desktopUsers.size }

    // コメント投稿者名を取得
    const commentUserIds = Array.from(new Set((comments || []).map((c: any) => c.user_id).filter(Boolean)))
    const commentUserMap: Record<string, string> = {}
    if (commentUserIds.length > 0) {
      const { data: cu } = await supabase.from('profiles').select('user_id, display_name').in('user_id', commentUserIds as string[])
      cu?.forEach((p: any) => { commentUserMap[p.user_id] = p.display_name || '名無し' })
    }
    // 話タイトルマップ
    const epTitleMap: Record<string, string> = {}
    allEpisodes.forEach((e: any) => { epTitleMap[e.id] = e.title })

    novelIds.forEach((id: string) => {
      statsMap[id] = {
        views: 0, likes: 0, bookmarks: 0, comments: 0,
        viewsToday: 0, viewsYesterday: 0, viewsWeek: 0, viewsMonth: 0,
        uniqueUsers: new Set<string>(),
        hourlyToday: new Array(24).fill(0),
        hourlyYesterday: new Array(24).fill(0),
        daily7: {},   // 直近7日
        daily30: {},  // 直近30日（日別上位用）
        monthly: {},  // 月別
        episodeViews: {},
        episodeLikes: {},
        episodeComments: {},
        commentList: [],
      }
    })

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000
    const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000

    ;(pageViews || []).forEach((pv: any) => {
      const nId = epToNovel[pv.episode_id]
      if (!nId || !statsMap[nId]) return
      const st = statsMap[nId]
      st.views++
      st.episodeViews[pv.episode_id] = (st.episodeViews[pv.episode_id] || 0) + 1
      if (pv.user_id) st.uniqueUsers.add(pv.user_id)
      const dt = new Date(pv.viewed_at)
      const t = dt.getTime()
      const hour = dt.getHours()
      if (t >= todayStart) { st.viewsToday++; st.hourlyToday[hour]++ }
      else if (t >= yesterdayStart) { st.viewsYesterday++; st.hourlyYesterday[hour]++ }
      if (t >= weekStart) st.viewsWeek++
      if (t >= monthStart) st.viewsMonth++
      const day = (pv.viewed_at || '').slice(0, 10)
      // 分類：未ログイン(a) / スマホ(m) / PC(d)
      const seg = !pv.user_id ? 'a' : (pv.device === 'mobile' ? 'm' : 'd')
      if (t >= weekStart) { if (!st.daily7[day]) st.daily7[day] = { v: 0, m: 0, d: 0, a: 0 }; st.daily7[day].v++; st.daily7[day][seg]++ }
      if (t >= monthStart) { if (!st.daily30[day]) st.daily30[day] = { v: 0, m: 0, d: 0, a: 0 }; st.daily30[day].v++; st.daily30[day][seg]++ }
      const month = (pv.viewed_at || '').slice(0, 7)
      if (month) { if (!st.monthly[month]) st.monthly[month] = { v: 0, m: 0, d: 0, a: 0 }; st.monthly[month].v++; st.monthly[month][seg]++ }
    })

    ;(likes || []).forEach((l: any) => { if (statsMap[l.novel_id]) statsMap[l.novel_id].likes++ })
    ;(bookmarks || []).forEach((b: any) => { if (statsMap[b.novel_id]) statsMap[b.novel_id].bookmarks++ })
    ;(comments || []).forEach((c: any) => {
      if (statsMap[c.novel_id]) {
        statsMap[c.novel_id].comments++
        if (c.episode_id) {
          statsMap[c.novel_id].episodeComments[c.episode_id] = (statsMap[c.novel_id].episodeComments[c.episode_id] || 0) + 1
        }
        // コメント本文リスト（最新30件まで）
        if (statsMap[c.novel_id].commentList.length < 30) {
          statsMap[c.novel_id].commentList.push({
            body: c.body,
            author: commentUserMap[c.user_id] || '名無し',
            created_at: c.created_at,
            episode_title: c.episode_id ? (epTitleMap[c.episode_id] || '') : '作品ページ',
            rating: c.rating || null,
          })
        }
      }
    })
    ;(epLikes || []).forEach((el: any) => {
      const nId = epToNovel[el.episode_id]
      if (nId && statsMap[nId]) {
        statsMap[nId].episodeLikes[el.episode_id] = (statsMap[nId].episodeLikes[el.episode_id] || 0) + 1
      }
    })
  }

  const novelStats = (novels || []).map((n: any) => {
    const s = statsMap[n.id]
    const eps = allEpisodes.filter((e: any) => e.novel_id === n.id && e.is_published === true)

    const empty = {
      views:0,likes:0,bookmarks:0,comments:0,viewsToday:0,viewsYesterday:0,viewsWeek:0,viewsMonth:0,
      uniqueUsers:new Set(),hourlyToday:new Array(24).fill(0),hourlyYesterday:new Array(24).fill(0),
      daily7:{},daily30:{},monthly:{},episodeViews:{},episodeLikes:{},episodeComments:{},commentList:[],
    }
    const st = s || empty

    const episodeRows = eps.map((ep: any) => ({
      ep_number: ep.ep_number,
      title: ep.title,
      views: st.episodeViews[ep.id] || 0,
      likes: st.episodeLikes[ep.id] || 0,
      comments: st.episodeComments[ep.id] || 0,
      created_at: ep.created_at,
    }))

    // 直近7日の日別配列
    const daily7: { date: string; views: number; m: number; d: number; a: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      const o7 = st.daily7[key] || { v: 0, m: 0, d: 0, a: 0 }
      daily7.push({ date: key.slice(5), views: o7.v, m: o7.m, d: o7.d, a: o7.a })
    }
    // 日別上位（直近30日）
    const dailyTop = Object.entries(st.daily30)
      .map(([date, o]: any) => ({ date, views: o.v, m: o.m, d: o.d, a: o.a }))
      .sort((a, b) => b.views - a.views).slice(0, 5)
    // 月別上位
    const monthlyTop = Object.entries(st.monthly)
      .map(([month, o]: any) => ({ month, views: o.v, m: o.m, d: o.d, a: o.a }))
      .sort((a, b) => b.views - a.views).slice(0, 5)

    return {
      id: n.id,
      title: n.title,
      genre: n.genre,
      published: n.published,
      views: st.views,
      viewsToday: st.viewsToday,
      viewsYesterday: st.viewsYesterday,
      viewsWeek: st.viewsWeek,
      viewsMonth: st.viewsMonth,
      likes: st.likes,
      bookmarks: st.bookmarks,
      comments: st.comments,
      uniqueCount: st.uniqueUsers.size,
      hourlyToday: st.hourlyToday,
      hourlyYesterday: st.hourlyYesterday,
      daily7,
      dailyTop,
      monthlyTop,
      episodeRows,
      commentList: st.commentList,
    }
  })

  return (
    <div style={{minHeight:'100vh'}}>
      <Header />
      <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:8}}>
          <h1 style={{fontSize:20,fontWeight:700,color:'var(--color-text)'}}>ダッシュボード</h1>
          <Link href="/mypage?tab=works" style={{fontSize:13,color:'var(--color-brand)',textDecoration:'none'}}>← 作品管理に戻る</Link>
        </div>
        {novelStats.length === 0 ? (
          <div style={{textAlign:'center',padding:'60px 20px',color:'var(--color-text-muted)'}}>まだ作品がありません</div>
        ) : (
          <>
          <AnalyticsCharts novels={novelStats} />

          {/*
           * デバイス別。
           *
           * 札で大きく出していたが、毎日見る数字ではない。
           * 図の下に 1 行で添える。
           */}
          {(deviceStats.mobilePv + deviceStats.desktopPv) > 0 && (
            <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:'4px 14px',padding:'10px 16px',marginTop:12,border:'1px solid var(--color-brand-border)',borderRadius:10,fontSize:12,color:'var(--color-text-muted)'}}>
              <span style={{fontWeight:700,color:'var(--color-text)'}}>デバイス別</span>
              <span>PC {deviceStats.desktopPv.toLocaleString()}（{deviceStats.desktopUsers.toLocaleString()}人）</span>
              <span>スマホ {deviceStats.mobilePv.toLocaleString()}（{deviceStats.mobileUsers.toLocaleString()}人）</span>
              <span style={{color:'var(--color-brand)',fontWeight:700}}>
                合計 {(deviceStats.desktopPv+deviceStats.mobilePv).toLocaleString()}（{(deviceStats.desktopUsers+deviceStats.mobileUsers).toLocaleString()}人）
              </span>
            </div>
          )}
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}
