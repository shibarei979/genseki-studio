import AdminShell from '@/components/admin/admin-shell'
import UserJoinPetals from '@/components/admin/user-join-petals'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminRangePicker from '@/components/admin/admin-range-picker'
import AdminChart from '@/components/admin/admin-chart'
import { UserDonut, GenreRanking } from '@/components/admin/admin-side-cards'

export const dynamic = 'force-dynamic'


/** 札の右下に置く内訳。区切り線の下に2列で並べる */
interface Breakdown {
  label: string
  value: string
}

/** 札に出す1つの数字 */
interface Stat {
  label: string
  value: number
  /** 前の期間ぶん。あれば増減を出す */
  prev?: number
  /** 数字の後ろに付ける単位 */
  unit?: string
  /** 区切り線の下に出す内訳。2つまで */
  breakdown?: Breakdown[]
  /** 内訳の代わりに置く一行 */
  note?: string
  icon?: 'user' | 'book' | 'eye' | 'comment' | 'heart'
}

/*
 * 札ごとの色。
 *
 * 数字そのものは濃紺で統一する。
 * 色を持たせるのは右上の絵だけにして、
 * 「何の数字か」を見分ける目印として使う。
 */
const ICON_COLOR: Record<NonNullable<Stat['icon']>, { fg: string; bg: string }> = {
  user:    { fg: '#2563eb', bg: '#eff6ff' },
  book:    { fg: '#2563eb', bg: '#eff6ff' },
  eye:     { fg: '#2563eb', bg: '#eff6ff' },
  comment: { fg: '#16a34a', bg: '#f0fdf4' },
  heart:   { fg: '#e11d48', bg: '#fff1f2' },
}

function StatIcon({ name }: { name: NonNullable<Stat['icon']> }) {
  const paths: Record<NonNullable<Stat['icon']>, React.ReactNode> = {
    user:    <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    book:    <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    eye:     <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    comment: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    heart:   <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></>,
  }
  const color = ICON_COLOR[name]

  return (
    <span style={{
      width:34,height:34,borderRadius:10,flexShrink:0,
      display:'flex',alignItems:'center',justifyContent:'center',
      background:color.bg,
    }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
        stroke={color.fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paths[name]}
      </svg>
    </span>
  )
}

/**
 * 数字の札。
 *
 * ★ どの札も同じ形にする。
 *
 *   1 ラベル ＋ 右上の絵
 *   2 数字
 *   3 増減
 *   ── 区切り線 ──
 *   4 内訳（2列）
 *
 *   段の数が札ごとに違うと高さが揃わない。
 *   中身が無い段も場所だけ空ける。
 *
 * 増減は、比べる相手が小さすぎるときは割合を出さない。
 * サイトが始まって日が浅いうちは、
 * 「+11,700%」のような数字にしかならない。
 */
function StatCard({ label, value, prev, unit, breakdown, note, icon }: Stat) {
  const diff = prev === undefined ? null : value - prev
  const canRate = prev !== undefined && prev >= 10
  const rate = canRate && prev ? Math.round((diff! / prev) * 1000) / 10 : null

  return (
    <div style={{
      background:'var(--admin-bg-card)',
      border:'1px solid var(--admin-border)',
      borderRadius:14,
      padding:'16px 18px',
      display:'flex',
      flexDirection:'column',
      height:'100%',
    }}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
        <span style={{fontSize:12.5,color:'var(--admin-text-muted)',lineHeight:1.4,paddingTop:4}}>
          {label}
        </span>
        {icon && <StatIcon name={icon} />}
      </div>

      <div style={{fontSize:30,fontWeight:800,color:'var(--admin-text)',lineHeight:1.1,marginTop:6,letterSpacing:'-.01em'}}>
        {value.toLocaleString()}<span style={{fontSize:18}}>{unit ?? ''}</span>
      </div>

      <div style={{minHeight:17,marginTop:5}}>
        {diff !== null && diff !== 0 && (
          <span style={{fontSize:12,fontWeight:700,
            color: diff > 0 ? 'var(--admin-stat-green)' : 'var(--admin-stat-rose)'}}>
            {diff > 0 ? '+' : ''}{diff.toLocaleString()}
            <span style={{fontWeight:500,color:'var(--admin-text-faint)',marginLeft:5}}>
              {rate !== null ? `前期間比 ${rate > 0 ? '+' : ''}${rate}%` : '前期間比'}
            </span>
          </span>
        )}
      </div>

      {/*
        * 内訳。
        *
        * 区切り線を引いて 2 列に分ける。
        * 1 行に並べて書くと、どこまでが 1 つの数字か
        * 目で追わないと分からない。
        */}
      {breakdown && breakdown.length > 0 && (
        <div style={{
          marginTop:'auto',paddingTop:12,
          borderTop:'1px solid var(--admin-border)',
          display:'grid',gridTemplateColumns:`repeat(${breakdown.length}, minmax(0, 1fr))`,gap:10,
        }}>
          {breakdown.map(item => (
            <div key={item.label}>
              <div style={{fontSize:11,color:'var(--admin-text-faint)',marginBottom:2}}>{item.label}</div>
              <div style={{fontSize:13.5,fontWeight:700,color:'var(--admin-text)'}}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {!breakdown && (
        <div style={{marginTop:'auto',paddingTop:12,minHeight:16}}>
          {note && <span style={{fontSize:11.5,color:'var(--admin-text-faint)'}}>{note}</span>}
        </div>
      )}
    </div>
  )
}

/*
 * 選べる期間。
 *
 * 日付を自分で入れる形ではなく、決まった範囲から選ぶ。
 * 運営が毎日見る画面なので、押すだけのほうが速い。
 * 細かい範囲が要るようになったら、あとから広げられる。
 */
const RANGES = [
  { key: '7',   label: '7日',  days: 7 },
  { key: '30',  label: '30日', days: 30 },
  { key: '90',  label: '90日', days: 90 },
  { key: '365', label: '1年',  days: 365 },
] as const

/**
 * 入れられた日付を、日数に直す。
 *
 * ★ おかしな値は受け取らない。
 *   日付として読めない、順序が逆、1年より長い。
 *   そのときは null を返して、決まった範囲のほうを使う。
 *
 * 住所に手で書き込まれることがあるので、ここで止める。
 */
function parseRange(from?: string, to?: string) {
  if (!from || !to) return null

  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (start > end) return null

  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
  if (days < 1 || days > 365) return null

  return {
    days,
    label: `${from} 〜 ${to}`,
    from,
    to,
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string }
}) {
  /*
   * 期間の決め方。
   *
   *   1  日付を自分で入れた（from と to）  → それを使う
   *   2  決まった範囲を選んだ（range）     → その日数
   *   3  どちらも無い                    → 30日
   *
   * 日付を入れた場合も、中では「何日ぶんか」に直して使う。
   * 数え上げの側は日数しか受け取れないので、そこへ寄せる。
   */
  const custom = parseRange(searchParams.from, searchParams.to)

  const range = RANGES.find(r => r.key === searchParams.range) ?? RANGES[1]
  const rangeDays = custom ? custom.days : range.days
  const rangeLabel = custom ? custom.label : range.label

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
  const weekAgo = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString()
  /*
   * 選ばれた期間と、その1つ前。
   *
   *   since30  → 選んだ期間の始まり
   *   since60  → その1つ前の期間の始まり
   *
   * 名前は since30 のままにしてある。
   * 呼んでいる所が多く、まとめて変えると読み違えやすい。
   * 中身は「選ばれた期間」に変わっている。
   */
  const since30 = new Date(); since30.setDate(since30.getDate() - rangeDays)
  const since60 = new Date(); since60.setDate(since60.getDate() - rangeDays * 2)
  const since365 = new Date(); since365.setDate(since365.getDate() - 365)

  const [
    { data: allUsers }, { data: allNovels },
    loginRes, mobileRes, desktopRes,
    prevUserRes, prevNovelRes, prevCommentRes, pv30Res, pvPrev30Res,
    homeModeRes, genreRes, openReportRes, likeRes, prevLikeRes,
    mob30Res, desk30Res, mob365Res, desk365Res, mobAllRes, deskAllRes,
  ] = await Promise.all([
    supabase.from('profiles').select('created_at, home_mode').gte('created_at', startDate.toISOString()),
    supabase.from('novels').select('created_at').gte('created_at', startDate.toISOString()),

    /* 失敗しても止めない。数字が 0 になるだけ */
    /*
     * 選ばれた期間を渡す。
     *
     * 前は日数を渡していなかったので、
     * 期間を変えても「月間ユーザー」が動かなかった。
     */
    Promise.resolve(adminSupabase.rpc('get_login_stats', { days: rangeDays })).catch(() => ({ data: null } as any)),
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

    /* いいね。見本の5枚目にあたる */
    supabase.from('likes').select('*', { count: 'exact', head: true }),
    supabase.from('likes').select('*', { count: 'exact', head: true })
      .lt('created_at', since30.toISOString()),

    /*
     * 端末の割合を、30日・1年・累計でも数える。
     *
     * 7日ぶんだけでは、たまたま一人が
     * パソコンで大量に読んだ日に大きく振れる。
     * 長い期間も並べて、傾向を見られるようにする。
     */
    supabase.from('page_views').select('*', { count: 'exact', head: true })
      .eq('device', 'mobile').gte('viewed_at', since30.toISOString()),
    supabase.from('page_views').select('*', { count: 'exact', head: true })
      .eq('device', 'desktop').gte('viewed_at', since30.toISOString()),

    supabase.from('page_views').select('*', { count: 'exact', head: true })
      .eq('device', 'mobile').gte('viewed_at', since365.toISOString()),
    supabase.from('page_views').select('*', { count: 'exact', head: true })
      .eq('device', 'desktop').gte('viewed_at', since365.toISOString()),

    supabase.from('page_views').select('*', { count: 'exact', head: true }).eq('device', 'mobile'),
    supabase.from('page_views').select('*', { count: 'exact', head: true }).eq('device', 'desktop'),
  ])
  function buildChartData(days: Date[]) {
    return days.map(d => {
      const s = new Date(d); s.setHours(0,0,0,0)
      const e = new Date(d); e.setHours(23,59,59,999)
      const fmt = (dt: Date) => `${dt.getMonth()+1}/${dt.getDate()}`
      return {
        date: fmt(d),
        /*
         * 登録した人を、向きで分ける。
         *
         * 見本と同じく、読者登録と作者登録を積み上げる。
         * ひとつの棒にすると、どちらが増えたか分からない。
         */
        readers: (allUsers || []).filter((u: any) => {
          const t = new Date(u.created_at)
          return t >= s && t <= e && u.home_mode === 'read'
        }).length,
        authors: (allUsers || []).filter((u: any) => {
          const t = new Date(u.created_at)
          return t >= s && t <= e && u.home_mode !== 'read'
        }).length,
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
   * 期間ごとの端末の割合。
   *
   * 元になる閲覧が少ないと、割合が大きく振れる。
   * 何件を元に出した割合かも一緒に出す。
   */
  function ratio(mobile: number, desktop: number) {
    const total = mobile + desktop
    return {
      pct: total > 0 ? Math.round((mobile / total) * 100) : 0,
      total,
    }
  }

  const mobile30  = ratio(mob30Res.count || 0,  desk30Res.count || 0)
  const mobile365 = ratio(mob365Res.count || 0, desk365Res.count || 0)
  const mobileAll = ratio(mobAllRes.count || 0, deskAllRes.count || 0)

  /*
   * 数字をひとまとめに。
   *
   * 前は「登録ユーザー」「本日ログイン」「モバイル比率」が
   * 同じ列に並んでいた。種類の違う数字が混ざると、
   * どれとどれを見比べればよいかが分からない。
   *
   * ユーザー / 作品 / 交流 / アクセス で分ける。
   */
  /*
   * 上に並べる 5 枚。
   *
   * 前はまとまりごとに 3 段に分けて積んでいた。
   * 種類は分かれるが、縦に長くなって
   * ひと目では見渡せなくなっていた。
   *
   * いちばん見たい 5 つを 1 列にして、
   * それぞれの内訳を札の下に畳む。
   */
  const kpis: Stat[] = [
    {
      label: '総登録ユーザー数', icon: 'user',
      value: userCount ?? 0, prev: prevUserRes.count ?? 0,
      breakdown: [
        { label: '作家向け', value: `${authorCount.toLocaleString()} 人` },
        { label: '読者向け', value: `${readerCount.toLocaleString()} 人` },
      ],
    },
    {
      label: '総作品数', icon: 'book',
      value: novelCount ?? 0, prev: prevNovelRes.count ?? 0,
      breakdown: [
        { label: '公開話数', value: `${(publishedEpisodeCount ?? 0).toLocaleString()} 話` },
        { label: '制作話数', value: `${(episodeCount ?? 0).toLocaleString()} 話` },
      ],
    },
    {
      label: `総閲覧数（${rangeLabel}）`, icon: 'eye',
      value: pv30, prev: pvPrev30,
      breakdown: [
        { label: `直近${rangeLabel}`, value: pv30.toLocaleString() },
        /* 携帯の割合は、下の「サイト利用状況」で期間ごとに出す */
        { label: `直近${rangeLabel}の携帯`, value: deviceTotal > 0 ? `${mobilePct} %` : '—' },
      ],
    },
    {
      label: '総コメント数', icon: 'comment',
      value: commentCount ?? 0, prev: prevCommentRes.count ?? 0,
      breakdown: [
        { label: '作品への感想', value: `${(commentCount ?? 0).toLocaleString()} 件` },
        { label: '未対応の通報', value: `${(openReportRes.count ?? 0).toLocaleString()} 件` },
      ],
    },
    {
      label: 'いいね数', icon: 'heart',
      value: likeRes.count ?? 0, prev: prevLikeRes.count ?? 0,
      breakdown: [
        { label: '作品への いいね', value: `${(likeRes.count ?? 0).toLocaleString()} 件` },
        { label: '1作品あたり', value: novelCount ? `${Math.round(((likeRes.count ?? 0) / novelCount) * 10) / 10}` : '—' },
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
          {/*
            * 期間を選ぶ。
            *
            * 押すと住所に ?range=90 が付いて、画面が作り直される。
            * 画面の中で切り替えないのは、数え上げが
            * サーバー側で行われているため。
            * 住所に残るので、その期間のまま人に渡せる。
            */}
          <div style={{display:'flex',gap:2,background:'var(--admin-bg)',borderRadius:9,padding:3}}>
            {RANGES.map(r => (
              <Link
                key={r.key}
                href={`/admin?range=${r.key}`}
                style={{
                  fontSize:12,padding:'5px 12px',borderRadius:7,textDecoration:'none',
                  fontWeight: (!custom && r.key === range.key) ? 700 : 500,
                  background: (!custom && r.key === range.key) ? 'var(--admin-bg-card)' : 'transparent',
                  color: (!custom && r.key === range.key) ? 'var(--admin-stat-blue)' : 'var(--admin-text-muted)',
                  boxShadow: (!custom && r.key === range.key) ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
                }}
              >
                {r.label}
              </Link>
            ))}
          </div>

          {/*
            * 日付で選ぶ。
            * 決まった範囲で足りないときに使う。
            */}
          <AdminRangePicker
            from={custom?.from}
            to={custom?.to}
            label={custom ? custom.label : '日付で選ぶ'}
          />

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

        {/*
          * 上の 5 枚。1 列で並べる。
          * 狭い画面では列を減らす（globals.css の .admin-cards）。
          */}
        <div className="admin-cards" style={{
          display:'grid',
          gridTemplateColumns:'repeat(5, minmax(0, 1fr))',
          gap:16,
          marginBottom:24,
        }}>
          {kpis.map(item => <StatCard key={item.label} {...item} />)}
        </div>

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
            {/*
              * 図も、選ばれた期間で開く。
              * 上の札が 90日なのに、図だけ 1ヶ月では見比べられない。
              */}
            <AdminChart
              initialPeriod={rangeDays <= 30 ? '30' : rangeDays <= 90 ? '180' : '365'}
              data30={chartData30} data180={chartData180} data365={chartData365} data1825={chartData1825} />
          </div>
          <div style={{gridColumn:'span 3',minWidth:0}}>
            <UserDonut authorCount={authorCount} readerCount={readerCount} />
          </div>
          <div style={{gridColumn:'span 3',minWidth:0}}>
            <GenreRanking items={topGenres} />
          </div>
        </div>

        {/*
          * サイト利用状況。
          *
          * 見本ではここが「収益サマリー」だった。
          * 課金の仕組みがまだ無いので、
          * 数字を入れれば必ず作り物になる。
          *
          * 代わりに、上の 5 枚に入りきらなかった
          * 使われ方の数字をここへ置く。
          * 画面の下半分が空白のままにならない。
          */}
        <div style={{
          background:'var(--admin-bg-card)',
          border:'1px solid var(--admin-border)',
          borderRadius:14,
          padding:'20px 22px',
          marginBottom:24,
        }}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginBottom:14}}>
            <span style={{fontSize:15,fontWeight:700,color:'var(--admin-text)'}}>サイト利用状況</span>
            <span style={{fontSize:11.5,color:'var(--admin-text-faint)'}}>
              課金の仕組みを入れると、ここに収益の数字が並びます
            </span>
          </div>

          <div className="admin-cards" style={{
            display:'grid',
            gridTemplateColumns:'repeat(4, minmax(0, 1fr))',
            gap:14,
          }}>
            {[
              { label: `${rangeLabel}ユーザー`, value: loginMonth.toLocaleString(), note: `${rangeLabel}以内に来た人` },
              { label: '本日ログイン', value: loginToday.toLocaleString(), note: '今日来た人' },
              { label: '7日ログイン',  value: loginWeek.toLocaleString(),  note: '直近7日に来た人' },
              { label: '未対応の通報', value: (openReportRes.count ?? 0).toLocaleString(), note: 'まだ見ていない通報' },

              /*
               * 携帯からの割合。
               *
               * 7日ぶんだけでは、たまたま一人が
               * パソコンで大量に読んだ日に大きく振れる。
               * 長い期間も並べて、傾向を見られるようにする。
               */
              { label: `携帯の割合（${rangeLabel}）`, value: mobile30.total > 0 ? `${mobile30.pct} %` : '—',
                note: `${mobile30.total.toLocaleString()}件のPVから` },
              { label: '携帯の割合（1年）', value: mobile365.total > 0 ? `${mobile365.pct} %` : '—',
                note: `${mobile365.total.toLocaleString()}件のPVから` },
              { label: '携帯の割合（累計）', value: mobileAll.total > 0 ? `${mobileAll.pct} %` : '—',
                note: `${mobileAll.total.toLocaleString()}件のPVから` },
            ].map(item => (
              <div key={item.label} style={{
                border:'1px solid var(--admin-border)',
                borderRadius:12,
                padding:'14px 16px',
                background:'var(--admin-bg)',
              }}>
                <div style={{fontSize:12,color:'var(--admin-text-muted)',marginBottom:6}}>{item.label}</div>
                <div style={{fontSize:24,fontWeight:800,color:'var(--admin-text)',lineHeight:1.1}}>{item.value}</div>
                <div style={{fontSize:11,color:'var(--admin-text-faint)',marginTop:6}}>{item.note}</div>
              </div>
            ))}
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
