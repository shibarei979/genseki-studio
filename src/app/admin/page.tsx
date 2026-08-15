import AdminShell from '@/components/admin/admin-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminChart from '@/components/admin/admin-chart'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  const [
    { count: userCount },
    { count: novelCount },
    { count: episodeCount },
    { count: commentCount },
    { data: announcements },
    { data: contests },
    { count: aiReviewCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('novels').select('*', { count: 'exact', head: true }).eq('published', true),
    supabase.from('episodes').select('*', { count: 'exact', head: true }),
    supabase.from('comments').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('id, title, type, is_published, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('contests').select('id, title, deadline, is_published').order('created_at', { ascending: false }).limit(3),
    supabase.from('ai_reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  // グラフ用データ
  function makeDays(n: number) {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d
    })
  }
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 365 * 5)
  /*
   * ここから下を一度に頼む。
   *
   * どれも互いに関わらないのに、3 回に分けて待っていた。
   * 失敗しても止めないものは、後で拾う。
   */
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: allUsers }, { data: allNovels },
    loginRes, mobileRes, desktopRes,
  ] = await Promise.all([
    supabase.from('profiles').select('created_at').gte('created_at', startDate.toISOString()),
    supabase.from('novels').select('created_at').gte('created_at', startDate.toISOString()),

    /* 失敗しても止めない。数字が 0 になるだけ */
    Promise.resolve(adminSupabase.rpc('get_login_stats')).catch(() => ({ data: null } as any)),
    Promise.resolve(adminSupabase.from('page_views').select('*', { count: 'exact', head: true }).eq('device', 'mobile').gte('viewed_at', weekAgo)).catch(() => ({ count: 0 } as any)),
    Promise.resolve(adminSupabase.from('page_views').select('*', { count: 'exact', head: true }).eq('device', 'desktop').gte('viewed_at', weekAgo)).catch(() => ({ count: 0 } as any)),
  ])
  function buildChartData(days: Date[]) {
    return days.map(d => {
      const s = new Date(d); s.setHours(0,0,0,0)
      const e = new Date(d); e.setHours(23,59,59,999)
      const fmt = (dt: Date) => `${dt.getMonth()+1}/${dt.getDate()}`
      return {
        date: fmt(d),
        users:  (allUsers  || []).filter((u: any) => { const t = new Date(u.created_at); return t >= s && t <= e }).length,
        novels: (allNovels || []).filter((n: any) => { const t = new Date(n.created_at); return t >= s && t <= e }).length,
      }
    })
  }
  const chartData30   = buildChartData(makeDays(30))
  const chartData180  = buildChartData(makeDays(180))
  const chartData365  = buildChartData(makeDays(365))
  const chartData1825 = buildChartData(makeDays(365 * 5))

  // ログインユーザー数（今日・直近7日）とデバイス別PV（直近7日）
  const loginStats = loginRes.data
  const loginToday = loginStats?.today || 0
  const loginWeek = loginStats?.week || 0
  const deviceMobile = mobileRes.count || 0
  const deviceDesktop = desktopRes.count || 0
  const deviceTotal = deviceMobile + deviceDesktop
  const mobilePct = deviceTotal > 0 ? Math.round((deviceMobile / deviceTotal) * 100) : 0

  const stats = [
    { label: '登録ユーザー', value: userCount?.toLocaleString() ?? '0', color: 'var(--admin-stat-blue)' },
    { label: '公開作品',     value: novelCount?.toLocaleString() ?? '0', color: 'var(--admin-stat-green)' },
    { label: '話数',         value: episodeCount?.toLocaleString() ?? '0', color: 'var(--admin-stat-amber)' },
    { label: 'コメント',     value: commentCount?.toLocaleString() ?? '0', color: 'var(--admin-stat-purple)' },
    { label: '本日ログイン', value: loginToday.toLocaleString(), color: 'var(--admin-stat-blue)' },
    { label: '7日ログイン',  value: loginWeek.toLocaleString(), color: 'var(--admin-stat-blue)' },
    { label: 'モバイル比率(7日PV)', value: deviceTotal > 0 ? `${mobilePct}%` : 'データなし', color: 'var(--admin-stat-green)' },
  ]

  const menus = [
    { href: '/admin/announcements', label: 'お知らせ（サイト）', desc: 'ホームに並ぶもの' },
    { href: '/admin/notices',       label: 'お知らせ（ベル）', desc: '利用者に届く通知' },
    { href: '/admin/contest',       label: 'コンテスト',      desc: '立てて、選ぶ' },
    { href: '/admin/users',         label: '利用者',          desc: '権限・停止' },
    { href: '/admin/novels',        label: '作品の確認',      desc: '公開されたもの' },
    { href: '/admin/banners',       label: 'バナー',          desc: 'ホームに出す帯' },
    { href: '/admin/contacts',      label: '問い合わせ',      desc: '受け取りと返信' },
    { href: '/admin/ng-words',      label: '使わない言葉',    desc: '推敲で知らせる' },
    { href: '/admin/messages',      label: '個別のお知らせ',  desc: '特定の人へ送る' },
    { href: '/admin/discovers',     label: '発掘',            desc: '読者が見つけたもの' },
    { href: '/admin/reports',       label: '通報',            desc: '見かけた振る舞い' },
    { href: '/admin/rooms',         label: '公式の部屋',      desc: '誰でも入れる執筆室' },
    { href: '/admin/analytics',     label: '分析',            desc: '読まれ方の推移' },
    { href: '/admin/features',      label: '機能の入切',      desc: '出す・隠す' },
  ]

  return (
    <AdminShell title="ダッシュボード" description="今どうなっているか">
        <div style={{marginBottom:28}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginBottom:4}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:22,fontWeight:800,color:'var(--admin-text)'}}>運営管理画面</span>
              <span style={{fontSize:11,background:'var(--color-brand)',color:'var(--color-bg-card)',padding:'2px 8px',borderRadius:10,fontWeight:700}}>ADMIN</span>
            </div>
            <Link href="/" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,color:'var(--color-brand)',textDecoration:'none',border:'1px solid var(--admin-border)',borderRadius:10,padding:'7px 16px',background:'var(--admin-bg-card)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              サイトへ戻る
            </Link>
          </div>
          <div style={{fontSize:13,color:'var(--admin-text-muted)'}}>原石航路 管理者専用ページ</div>
        </div>

        {/* 統計カード */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
          {stats.map(s => (
            <div key={s.label} style={{background:'var(--admin-bg-card)',border:'1px solid var(--admin-border)',borderRadius:12,padding:'18px 20px'}}>
              <div style={{fontSize:26,fontWeight:800,color:s.color,marginBottom:2}}>{s.value}</div>
              <div style={{fontSize:12,color:'var(--admin-text-muted)'}}>{s.label}</div>
            </div>
          ))}
        </div>

        <AdminChart data30={chartData30} data180={chartData180} data365={chartData365} data1825={chartData1825} />

        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'var(--admin-text)',marginBottom:12}}>管理メニュー</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {menus.map(m => (
                <Link key={m.href} href={m.href} style={{textDecoration:'none'}}>
                  <div style={{background:'var(--admin-bg-card)',border:'1px solid var(--admin-border)',borderRadius:12,padding:'18px 20px',cursor:'pointer',position:'relative'}}>
                    {'badge' in m && (m as any).badge > 0 && (
                      <span style={{position:'absolute',top:12,right:12,fontSize:10,background:'var(--admin-stat-red)',color:'var(--color-text-inverse)',padding:'1px 7px',borderRadius:10,fontWeight:700}}>
                        {(m as any).badge}件
                      </span>
                    )}
                    <div style={{fontSize:14,fontWeight:700,color:'var(--admin-text)',marginBottom:3}}>{m.label}</div>
                    <div style={{fontSize:12,color:'var(--admin-text-muted)'}}>{m.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:700,color:'var(--admin-text)'}}>最近のお知らせ</div>
              <Link href="/admin/announcements" style={{fontSize:12,color:'var(--color-brand)',textDecoration:'none'}}>管理 ›</Link>
            </div>
            <div style={{background:'var(--admin-bg-card)',border:'1px solid var(--admin-border)',borderRadius:12,overflow:'hidden'}}>
              {(announcements||[]).length === 0
                ? <div style={{padding:'24px',textAlign:'center',color:'var(--admin-text-faint)',fontSize:13}}>お知らせなし</div>
                : (announcements||[]).map((a: any) => (
                  <div key={a.id} style={{padding:'12px 16px',borderBottom:'1px solid var(--admin-row-border)',display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:10,
                      background:a.type==='contest'?'var(--color-brand-light)':a.type==='important'?'#fef2f2':'var(--color-info-bg)',
                      color:a.type==='contest'?'var(--color-brand)':a.type==='important'?'var(--admin-stat-red)':'var(--admin-stat-blue)',
                      border:`1px solid ${a.type==='contest'?'var(--color-tag-border)':a.type==='important'?'#fca5a5':'var(--color-info-border)'}`,
                      padding:'1px 6px',borderRadius:3,flexShrink:0}}>
                      {a.type==='contest'?'コンテスト':a.type==='important'?'重要':'お知らせ'}
                    </span>
                    <span style={{fontSize:12,color:'var(--admin-text)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.title}</span>
                    {!a.is_published && <span style={{fontSize:10,color:'var(--admin-text-faint)',flexShrink:0}}>非公開</span>}
                  </div>
                ))}
            </div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16,marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:700,color:'var(--admin-text)'}}>コンテスト</div>
              <Link href="/admin/contests" style={{fontSize:12,color:'var(--color-brand)',textDecoration:'none'}}>管理 ›</Link>
            </div>
            <div style={{background:'var(--admin-bg-card)',border:'1px solid var(--admin-border)',borderRadius:12,overflow:'hidden'}}>
              {(contests||[]).length === 0
                ? <div style={{padding:'24px',textAlign:'center',color:'var(--admin-text-faint)',fontSize:13}}>コンテストなし</div>
                : (contests||[]).map((c: any) => (
                  <div key={c.id} style={{padding:'12px 16px',borderBottom:'1px solid var(--admin-row-border)',display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:12,color:'var(--admin-text)',flex:1}}>{c.title}</span>
                    {c.deadline && <span style={{fontSize:11,color:'var(--admin-text-faint)',flexShrink:0}}>{new Date(c.deadline).toLocaleDateString('ja-JP')}</span>}
                    {!c.is_published && <span style={{fontSize:10,color:'var(--admin-text-faint)',flexShrink:0}}>非公開</span>}
                  </div>
                ))}
            </div>
          </div>
        </div>
    </AdminShell>
  )
}
