import AdminShell from '@/components/admin/admin-shell'
import UserJoinPetals from '@/components/admin/user-join-petals'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminChart from '@/components/admin/admin-chart'
import { UserDonut, GenreRanking } from '@/components/admin/admin-side-cards'

export const dynamic = 'force-dynamic'


/** 札に出す1つの数字 */
interface Stat {
  label: string
  value: number
  /** 前の期間ぶん。あれば増減を出す */
  prev?: number
  /** 比べた相手の名前。「前期間比」「昨日比」など */
  prevLabel?: string
  /** 数字の後ろに付ける単位 */
  unit?: string
  /** 下に添える補助の文 */
  note?: string
  /** 右上に薄く置く絵 */
  icon?: 'user' | 'active' | 'login' | 'book' | 'page' | 'comment' | 'eye' | 'mobile'
}

/**
 * 札の右上に置く絵。
 *
 * 何の数字かを、読む前に見分けるための目印。
 * 薄い色で置く。数字より目立つと本末転倒になる。
 */
function StatIcon({ name }: { name: NonNullable<Stat['icon']> }) {
  const paths: Record<NonNullable<Stat['icon']>, React.ReactNode> = {
    user:    <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    active:  <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
    login:   <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></>,
    book:    <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    page:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    comment: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    eye:     <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    mobile:  <><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>,
  }

  return (
    <span style={{
      width:32,height:32,borderRadius:9,flexShrink:0,
      display:'flex',alignItems:'center',justifyContent:'center',
      background:'var(--admin-bg)',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="var(--admin-stat-blue)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" opacity=".75">
        {paths[name]}
      </svg>
    </span>
  )
}

/**
 * 数字の札。
 *
 * ★ 4 段で必ず同じ形にする。
 *
 *   1 ラベル
 *   2 数字
 *   3 増減
 *   4 補足
 *
 *   段の数が札ごとに違うと、高さが揃わず、
 *   並べたときに落ち着かない。
 *   中身が無い段は、場所だけ空けて高さを保つ。
 *
 * 増減は、元の数が小さいときは割合を出さない。
 * 1 から 118 になったときの「+11,700%」は、
 * 大きく見えるだけで何も伝えない。
 */
function StatCard({ label, value, prev, prevLabel, unit, note, icon }: Stat) {
  const diff = prev === undefined ? null : value - prev
  const canRate = prev !== undefined && prev >= 10
  const rate = canRate && prev ? Math.round((diff! / prev) * 1000) / 10 : null

  return (
    <div style={{
      background:'var(--admin-bg-card)',
      border:'1px solid var(--admin-border)',
      borderRadius:12,
      padding:'16px 18px',
      display:'flex',
      flexDirection:'column',
      /* 高さを揃える。中身の量で段差ができない */
      height:'100%',
    }}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
        <span style={{fontSize:13,color:'var(--admin-text-muted)',lineHeight:1.4}}>{label}</span>
        {icon && <StatIcon name={icon} />}
      </div>

      <div style={{fontSize:32,fontWeight:800,color:'var(--admin-text)',lineHeight:1.05,letterSpacing:'-.01em'}}>
        {value.toLocaleString()}<span style={{fontSize:18}}>{unit ?? ''}</span>
      </div>

      {/* 増減の段。無い札でも高さを空ける */}
      <div style={{minHeight:18,marginTop:6}}>
        {diff !== null && diff !== 0 && (
          <span style={{fontSize:12,fontWeight:700,
            color: diff > 0 ? 'var(--admin-stat-green)' : 'var(--admin-stat-rose)'}}>
            {diff > 0 ? '+' : ''}{diff.toLocaleString()}
            {rate !== null && `（${rate > 0 ? '+' : ''}${rate}%）`}
            <span style={{fontWeight:500,color:'var(--admin-text-faint)',marginLeft:5}}>
              {prevLabel ?? '前期間比'}
            </span>
          </span>
        )}
      </div>

      {/* 補足の段。同じく高さを空ける */}
      <div style={{minHeight:16,marginTop:'auto',paddingTop:8}}>
        {note && (
          <span style={{fontSize:11.5,color:'var(--admin-text-faint)',lineHeight:1.6}}>{note}</span>
        )}
      </div>
    </div>
  )
}

export default async function AdminPage() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  /*
   * ★ ここから先の数え上げは、運営用の鍵で行う。
   *
   *   ログインしている人として数えると、表の決まりに阻まれる。
   *   話は公開済みだけ、閲覧記録は自分のぶんだけになり、
   *   運営 1 人の数が「サイト全体の数」として出てしまう。
   *
   *   運営かどうかは、この 1 行上で確かめている。
   */
  const supabase = adminSupabase

  const [
    { count: userCount },
    { count: novelCount },
    { count: episodeCount },
    { count: publishedEpisodeCount },
    { count: commentCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('novels').select('*', { count: 'exact', head: true }).eq('published', true),
    supabase.from('episodes').select('*', { count: 'exact', head: true }),
    /*
     * 公開されている話。
     *
     * 「話数」ひとつでは、書かれた量なのか
     * 読める量なのかが分からない。
     * 下書きと予約を含む数と、読める数を分けて出す。
     *
     * 公開の印は is_published。published は既定が true なので
     * 印にならない（引き継ぎの地雷リストのとおり）。
     */
    supabase.from('episodes').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('comments').select('*', { count: 'exact', head: true }),
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
  const since30 = new Date(); since30.setDate(since30.getDate() - 30)
  const since60 = new Date(); since60.setDate(since60.getDate() - 60)

  const [
    { data: allUsers }, { data: allNovels },
    loginRes, mobileRes, desktopRes,
    prevUserRes, prevNovelRes, prevCommentRes, pv30Res, pvPrev30Res,
    homeModeRes, genreRes, openReportRes,
  ] = await Promise.all([
    supabase.from('profiles').select('created_at').gte('created_at', startDate.toISOString()),
    supabase.from('novels').select('created_at').gte('created_at', startDate.toISOString()),

    /* 失敗しても止めない。数字が 0 になるだけ */
    Promise.resolve(adminSupabase.rpc('get_login_stats')).catch(() => ({ data: null } as any)),
    Promise.resolve(adminSupabase.from('page_views').select('*', { count: 'exact', head: true }).eq('device', 'mobile').gte('viewed_at', weekAgo)).catch(() => ({ count: 0 } as any)),
    Promise.resolve(adminSupabase.from('page_views').select('*', { count: 'exact', head: true }).eq('device', 'desktop').gte('viewed_at', weekAgo)).catch(() => ({ count: 0 } as any)),

    /*
     * 前の30日ぶん。「前月比」を出すのに要る。
     *
     * 「先月」ではなく「30日前から60日前まで」で数える。
     * 月の長さが違うと比べられないので、日数でそろえる。
     */
    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .lt('created_at', since30.toISOString()),
    supabase.from('novels').select('*', { count: 'exact', head: true })
      .eq('published', true).lt('created_at', since30.toISOString()),
    supabase.from('comments').select('*', { count: 'exact', head: true })
      .lt('created_at', since30.toISOString()),
    supabase.from('page_views').select('*', { count: 'exact', head: true })
      .gte('viewed_at', since30.toISOString()),
    supabase.from('page_views').select('*', { count: 'exact', head: true })
      .gte('viewed_at', since60.toISOString()).lt('viewed_at', since30.toISOString()),

    /*
     * 読者と作者を分ける。
     *
     * マイページの設定にある home_mode で分かれている。
     *   write   執筆向け（既定）
     *   focus   執筆集中
     *   read    読者向け
     *
     * 前は「作品を1つ以上出しているか」で分けていた。
     * それだと、登録したがまだ 1 作も出していない作家が
     * 全員「読者」に入る。プレリリースは作家向けだったので、
     * 実際には居ないはずの読者が 37 人いることになっていた。
     */
    supabase.from('profiles').select('home_mode').limit(20000),

    /* ジャンル別の作品数。公開しているものだけ数える */
    supabase.from('novels').select('genre').eq('published', true).limit(20000),

    /* まだ見ていない通報。運営がいちばん先に気づくべき数字 */
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
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
  const loginMonth = loginStats?.month || 0
  const loginPrevMonth = loginStats?.prev_month || 0

  /*
   * 読者と作者を分ける。
   *
   * 設定していない人は「執筆向け」の扱い。
   * 既定がそちらなので、数え方もそろえる。
   */
  const modes = (homeModeRes.data || []) as { home_mode: string | null }[]
  const readerCount = modes.filter((m) => m.home_mode === 'read').length
  const authorCount = modes.length - readerCount

  /* 作品数の多い順に5つ。ジャンルの無いものは数えない */
  const genreCount: Record<string, number> = {}
  for (const row of (genreRes.data || []) as { genre: string | null }[]) {
    if (!row.genre) continue
    genreCount[row.genre] = (genreCount[row.genre] ?? 0) + 1
  }
  const topGenres = Object.entries(genreCount)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  /*
   * 最終更新。
   *
   * この画面はサーバーで組み立てるので、
   * いつの数字かが分からないと判断を誤る。
   * 日本時間で出す。
   */
  const updatedAt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit',
  }).format(new Date())

  const pv30 = pv30Res.count || 0
  const pvPrev30 = pvPrev30Res.count || 0
  const deviceMobile = mobileRes.count || 0
  const deviceDesktop = desktopRes.count || 0
  const deviceTotal = deviceMobile + deviceDesktop
  const mobilePct = deviceTotal > 0 ? Math.round((deviceMobile / deviceTotal) * 100) : 0

  /*
   * 数字をひとまとめに。
   *
   * 前は「登録ユーザー」「本日ログイン」「モバイル比率」が
   * 同じ列に並んでいた。種類の違う数字が混ざると、
   * どれとどれを見比べればよいかが分からない。
   *
   * ユーザー / 作品 / 交流 / アクセス で分ける。
   */
  const groups: { title: string; items: Stat[]; columns: number }[] = [
    {
      title: 'ユーザー',
      columns: 4,
      items: [
        {
          label: '登録ユーザー', icon: 'user',
          value: userCount ?? 0, prev: prevUserRes.count ?? 0,
          note: `執筆向け ${authorCount.toLocaleString()}人 ・ 読者向け ${readerCount.toLocaleString()}人`,
        },
        { label: '月間ユーザー', icon: 'active', value: loginMonth, prev: loginPrevMonth, note: '30日以内に来た人' },
        { label: '本日ログイン', icon: 'login', value: loginToday, note: '今日ログインした人' },
        { label: '7日ログイン',  icon: 'login', value: loginWeek,  note: '直近7日に来た人' },
      ],
    },
    {
      title: '作品',
      columns: 3,
      items: [
        { label: '公開作品', icon: 'book', value: novelCount ?? 0, prev: prevNovelRes.count ?? 0, note: '読者が読める作品' },
        { label: '公開話数', icon: 'page', value: publishedEpisodeCount ?? 0, note: '読者が読める話' },
        { label: '制作話数', icon: 'page', value: episodeCount ?? 0, note: '下書き・予約を含む' },
      ],
    },
    {
      /*
       * 交流とアクセスをひとまとめに。
       *
       * 前は「交流」がコメント 1 枚だけで、
       * 画面いっぱいに横長の札が伸びていた。
       * 1 枚だけの列は、並べると不自然になる。
       */
      title: '交流とアクセス',
      columns: 4,
      items: [
        { label: 'コメント', icon: 'comment', value: commentCount ?? 0, prev: prevCommentRes.count ?? 0, note: '作品に届いた感想' },
        { label: 'PV（30日）', icon: 'eye', value: pv30, prev: pvPrev30, note: '直近30日の閲覧' },
        {
          label: 'モバイル比率', icon: 'mobile',
          value: mobilePct, unit: '%',
          note: deviceTotal > 0 ? '直近7日のPVでの割合' : 'データなし',
        },
        { label: '未対応の通報', icon: 'comment', value: openReportRes.count ?? 0, note: 'まだ見ていない通報' },
      ],
    },
  ]

  return (
    <AdminShell title="ダッシュボード" description="原石航路の運営状況をひと目で確認できます">
      {/* 人が増えていたら花が舞う。1 人につき 50 枚 */}
      <UserJoinPetals count={userCount ?? 0} />

        {/*
          * 上の帯。
          *
          * 前は見出しの下に空の枠が残り、
          * 数字にたどり着くまでが遠かった。
          * 縦を詰めて、右端に控えめな道具だけ並べる。
          */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',
          flexWrap:'wrap',gap:10,marginBottom:20}}>
          <span style={{fontSize:11.5,color:'var(--admin-text-faint)'}}>
            最終更新 {updatedAt}
          </span>
          {/*
            * サイトへ戻る。
            *
            * よく押すものではないので、小さく置く。
            * 大きいと、数字より先に目に入る。
            */}
          <Link href="/" style={{display:'inline-flex',alignItems:'center',gap:5,
            fontSize:12,color:'var(--admin-text-muted)',textDecoration:'none',
            border:'1px solid var(--admin-border)',borderRadius:8,padding:'5px 11px',
            background:'var(--admin-bg-card)'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            サイトへ戻る
          </Link>
        </div>

        {/* 統計カード */}
        {/*
          * 数字の札。
          *
          * 種類ごとに固めて並べる。
          * 幅に合わせて列の数が変わる。
          */}
        {groups.map(group => (
          <div key={group.title} style={{marginBottom:24}}>
            <div style={{fontSize:14,fontWeight:600,color:'var(--admin-text-muted)',marginBottom:12}}>
              {group.title}
            </div>
            {/*
              * 列の数はまとまりごとに決める。
              * auto-fit に任せると、枚数によって幅が変わり、
              * まとまりごとに札の大きさが違って見える。
              */}
            <div style={{
              display:'grid',
              gridTemplateColumns:`repeat(${group.columns}, minmax(0, 1fr))`,
              gap:16,
            }} className="admin-cards">
              {group.items.map(item => <StatCard key={item.label} {...item} />)}
            </div>
          </div>
        ))}

        {/*
          * 図と、その横に2枚。
          *
          * 数字だけでは、全体の中でどれくらいの割合なのかが
          * 分からない。図の隣に置いて、一度に見られるようにする。
          *
          * 狭い画面では縦に落ちる。
          */}
        {/*
          * 12 の枡で分ける。
          *   図 6 / ユーザー属性 3 / ジャンル 3
          * 「なんとなく並ぶ」のではなく、比率を決めて置く。
          */}
        <div className="admin-lower" style={{display:'grid',gridTemplateColumns:'repeat(12, minmax(0, 1fr))',gap:16,marginBottom:24,alignItems:'stretch'}}>
          <div style={{gridColumn:'span 6',minWidth:0}}>
            <AdminChart data30={chartData30} data180={chartData180} data365={chartData365} data1825={chartData1825} />
          </div>
          <div style={{gridColumn:'span 3',minWidth:0}}>
            <UserDonut authorCount={authorCount} readerCount={readerCount} />
          </div>
          <div style={{gridColumn:'span 3',minWidth:0}}>
            <GenreRanking items={topGenres} />
          </div>
        </div>

        {/*
          * 「管理メニュー」「最近のお知らせ」「コンテスト」を外した。
          *
          * どれも左の柱と同じ行き先で、二重になっていた。
          * 柱には未対応の赤い丸が付くぶん、そちらのほうが情報が多い。
          * 同じものが 2 つあって片方だけ古い状態だった。
          *
          * ここは「いまどうなっているか」を数字と図で見る場所に絞る。
          * 行き先は柱にある。
          */}
    </AdminShell>
  )
}
