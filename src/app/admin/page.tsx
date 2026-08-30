import AdminShell from '@/components/admin/admin-shell'
import UserJoinPetals from '@/components/admin/user-join-petals'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminChart from '@/components/admin/admin-chart'

export const dynamic = 'force-dynamic'


/** 札に出す1つの数字 */
interface Stat {
  label: string
  value: number
  /** 前の30日ぶん。あれば増減を出す */
  prev?: number
  /** 数字の後ろに付ける単位 */
  unit?: string
  /** 下に添える補助の文 */
  note?: string
}

/**
 * 数字の札。
 *
 * 増減は、元の数が小さいときは割合を出さない。
 * 1 から 118 になったときの「+11,700%」は、
 * 大きく見えるだけで何も伝えない。
 */
function StatCard({ label, value, prev, unit, note }: Stat) {
  const diff = prev === undefined ? null : value - prev
  const canRate = prev !== undefined && prev >= 10
  const rate = canRate && prev ? Math.round((diff! / prev) * 1000) / 10 : null

  return (
    <div style={{
      background:'var(--admin-bg-card)',
      border:'1px solid var(--admin-border)',
      borderRadius:12,
      padding:'18px 20px',
      boxShadow:'0 1px 2px rgba(15,23,42,.04)',
    }}>
      <div style={{fontSize:12.5,color:'var(--admin-text-muted)',marginBottom:8}}>{label}</div>

      <div style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
        {/*
          * 数字は濃紺で統一する。
          * 色を数字ごとに変えると、色に意味があるように見えて
          * かえって読み違える。
          */}
        <span style={{fontSize:28,fontWeight:800,color:'var(--admin-text)',lineHeight:1.1}}>
          {value.toLocaleString()}{unit ?? ''}
        </span>

        {diff !== null && diff !== 0 && (
          <span style={{
            fontSize:12,
            fontWeight:700,
            /* 増えたら緑、減ったら赤。ここは意味を持つ色 */
            color: diff > 0 ? 'var(--admin-stat-green)' : 'var(--admin-stat-rose)',
          }}>
            {diff > 0 ? '+' : ''}{diff.toLocaleString()}
            {rate !== null && `（${rate > 0 ? '+' : ''}${rate}%）`}
          </span>
        )}
      </div>

      {note && (
        <div style={{fontSize:11.5,color:'var(--admin-text-faint)',marginTop:8,lineHeight:1.6}}>
          {note}
        </div>
      )}
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
    homeModeRes,
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
  const groups: { title: string; items: Stat[] }[] = [
    {
      title: 'ユーザー',
      items: [
        {
          label: '登録ユーザー',
          value: userCount ?? 0,
          prev: prevUserRes.count ?? 0,
          note: `執筆向け ${authorCount.toLocaleString()}人 ・ 読者向け ${readerCount.toLocaleString()}人`,
        },
        { label: '月間ユーザー', value: loginMonth, prev: loginPrevMonth, note: '30日以内に来た人' },
        { label: '本日ログイン', value: loginToday },
        { label: '7日ログイン',  value: loginWeek },
      ],
    },
    {
      title: '作品',
      items: [
        { label: '公開作品', value: novelCount ?? 0, prev: prevNovelRes.count ?? 0 },
        { label: '公開話数', value: publishedEpisodeCount ?? 0, note: '読者が読める話' },
        { label: '制作話数', value: episodeCount ?? 0, note: '下書き・予約を含む' },
      ],
    },
    {
      title: '交流',
      items: [
        { label: 'コメント', value: commentCount ?? 0, prev: prevCommentRes.count ?? 0 },
      ],
    },
    {
      title: 'アクセス',
      items: [
        { label: 'PV（30日）', value: pv30, prev: pvPrev30 },
        {
          label: 'モバイル比率',
          value: mobilePct,
          unit: '%',
          note: deviceTotal > 0 ? '直近7日のPV' : 'データなし',
        },
      ],
    },
  ]

  return (
    <AdminShell title="ダッシュボード" description="原石航路の運営状況をひと目で確認できます">
      {/* 人が増えていたら花が舞う。1 人につき 50 枚 */}
      <UserJoinPetals count={userCount ?? 0} />

        <div style={{marginBottom:28}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginBottom:4}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              {/*
                * 見出しは AdminShell が出している。
                * ここでも「運営管理画面 ADMIN」と出していたので、
                * 同じ画面に見出しが 2 つ並んでいた。
                */}
            </div>
            <Link href="/" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,color:'var(--color-brand)',textDecoration:'none',border:'1px solid var(--admin-border)',borderRadius:10,padding:'7px 16px',background:'var(--admin-bg-card)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              サイトへ戻る
            </Link>
          </div>
          {/* 副題も AdminShell 側にある。ここでは出さない */}
        </div>

        {/* 統計カード */}
        {/*
          * 数字の札。
          *
          * 種類ごとに固めて並べる。
          * 幅に合わせて列の数が変わる。
          */}
        {groups.map(group => (
          <div key={group.title} style={{marginBottom:26}}>
            <div style={{fontSize:12,fontWeight:700,color:'var(--admin-text-faint)',marginBottom:10,letterSpacing:'.04em'}}>
              {group.title}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',gap:16}}>
              {group.items.map(item => <StatCard key={item.label} {...item} />)}
            </div>
          </div>
        ))}

        <AdminChart data30={chartData30} data180={chartData180} data365={chartData365} data1825={chartData1825} />

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
