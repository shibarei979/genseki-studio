import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import NovelManageActions from '@/components/mypage/novel/novel-manage-actions'

export const dynamic = 'force-dynamic'

const AI_LABEL: Record<string, string> = { none: 'AI未使用', assist: '補助的利用', full: '全面的利用' }

export default async function NovelManagePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()

  const { data: novel } = await supabase
    .from('novels')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()
  if (!novel) notFound()
  if (novel.author_id !== user.id) redirect('/mypage')  // 自分の作品のみ

  // 話一覧を先に取得（PV集計に話IDが必要）
  const { data: epsData } = await supabase.from('episodes').select('id, ep_number, title, body, published, scheduled_at, created_at, updated_at').eq('novel_id', params.id).order('ep_number', { ascending: true })
  const episodes = epsData || []
  const epIds = episodes.map((e: any) => e.id)

  // ランキング記録：最高順位と現在の順位
  const [bestRankRes, currentRankRes] = await Promise.all([
    supabase.from('ranking_history').select('period, rank').eq('novel_id', params.id).order('rank', { ascending: true }).limit(1),
    supabase.from('ranking_history').select('period, rank').eq('novel_id', params.id).gt('to_time', new Date().toISOString()).order('rank', { ascending: true }).limit(1),
  ])
  const PERIOD_LABEL: Record<string, string> = { daily: '日間', weekly: '週間', monthly: '月間', quarterly: '四半期', yearly: '年間', all: '累計' }
  const bestRank = bestRankRes.data?.[0] || null
  const currentRank = currentRankRes.data?.[0] || null

  // 統計を並列取得（PVはpage_viewsから集計）
  const [likeRes, bookmarkRes, discoverRes, commentRes, pvRes] = await Promise.all([
    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('novel_id', params.id),
    supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('novel_id', params.id),
    supabase.from('discovers').select('*', { count: 'exact', head: true }).eq('novel_id', params.id).eq('is_pending', false),
    supabase.from('comments').select('*', { count: 'exact', head: true }).eq('novel_id', params.id).neq('user_id', user.id),
    epIds.length > 0
      ? supabase.from('page_views').select('*', { count: 'exact', head: true }).in('episode_id', epIds)
      : Promise.resolve({ count: 0 } as any),
  ])
  const totalChars = episodes.reduce((s: number, e: any) => s + (e.body?.length || 0), 0)
  const publishedEps = episodes.filter((e: any) => e.published !== false)
  const firstDate = publishedEps[0]?.created_at
  const lastDate = publishedEps.length > 0 ? publishedEps.reduce((max: string, e: any) => (e.created_at > max ? e.created_at : max), publishedEps[0].created_at) : null

  const fmt = (s?: string | null) => {
    if (!s) return '—'
    const d = new Date(s)
    return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${String(d.getHours()).padStart(2, '0')}時${String(d.getMinutes()).padStart(2, '0')}分`
  }

  const secStyle = { background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' as const }
  const secHead = { padding: '12px 18px', borderBottom: '1px solid var(--color-brand-light)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' as const }
  const row = { display: 'flex', padding: '10px 18px', borderBottom: '1px solid var(--color-brand-light)', fontSize: 13 }
  const rowLabel = { width: 130, flexShrink: 0, color: 'var(--color-text-muted)', fontSize: 12 }
  const rowValue = { flex: 1, color: 'var(--color-text)', lineHeight: 1.6 }

  return (
    <div style={{ minHeight:'100vh'}}>
      <Header />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>

        {/* パンくず＋タイトル */}
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          <Link href="/mypage" style={{ color: 'var(--color-brand)', textDecoration: 'none' }}>マイページ</Link>
          <span style={{ margin: '0 6px' }}>›</span>作品管理
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-inverse)', background: novel.is_serial ? 'var(--color-info)' : 'var(--color-text-faint)', padding: '3px 10px', borderRadius: 4 }}>{novel.is_serial ? '連載中' : '完結'}</span>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{novel.title}</h1>
          </div>
          <Link href={`/novel/${novel.id}`} style={{ fontSize: 12, color: 'var(--color-brand)', textDecoration: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 14, padding: '6px 14px' }}>作品ページを見る →</Link>
        </div>

        {/* 操作ボタン */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <Link href={`/post?novel=${novel.id}`} style={{ background: 'var(--color-brand)', color: 'var(--color-text-inverse)', fontSize: 12.5, fontWeight: 700, padding: '9px 18px', borderRadius: 16, textDecoration: 'none' }}>＋ 新しい話を追加</Link>
          <Link href={`/post?edit=${novel.id}`} style={{ border: '1px solid var(--color-brand-border)', color: 'var(--color-brand)', fontSize: 12.5, fontWeight: 600, padding: '9px 18px', borderRadius: 16, textDecoration: 'none' }}>作品・話を編集</Link>
          <Link href="/mypage/analytics" style={{ border: '1px solid var(--color-brand-border)', color: 'var(--color-brand)', fontSize: 12.5, fontWeight: 600, padding: '9px 18px', borderRadius: 16, textDecoration: 'none' }}>アクセス解析</Link>
        </div>

        {/* 作品情報：データ＋読者の反応 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div style={{ ...secStyle, marginBottom: 0 }}>
            <div style={secHead}>データ</div>
            <div style={row}><span style={rowLabel}>投稿状態</span><span style={rowValue}>{novel.published ? '公開中' : '下書き'}〈{novel.is_serial ? '連載中' : '完結'}〉</span></div>
            <div style={row}><span style={rowLabel}>話数</span><span style={rowValue}>{publishedEps.length}話{episodes.length !== publishedEps.length ? `（下書き${episodes.length - publishedEps.length}話）` : ''}</span></div>
            <div style={row}><span style={rowLabel}>投稿文字数</span><span style={rowValue}>{totalChars.toLocaleString()}文字</span></div>
            <div style={row}><span style={rowLabel}>初回掲載日</span><span style={rowValue}>{fmt(firstDate)}</span></div>
            <div style={row}><span style={rowLabel}>最新掲載日</span><span style={rowValue}>{fmt(lastDate)}</span></div>
            <div style={row}><span style={rowLabel}>現在の順位</span><span style={{ ...rowValue, fontWeight: currentRank ? 700 : 400, color: currentRank ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>{currentRank ? `${currentRank.rank}位（総合・${PERIOD_LABEL[currentRank.period] || currentRank.period}）` : '圏外'}</span></div>
            <div style={{ ...row, borderBottom: 'none' }}><span style={rowLabel}>最高順位</span><span style={rowValue}>{bestRank ? `${bestRank.rank}位（総合・${PERIOD_LABEL[bestRank.period] || bestRank.period}）` : '—'}</span></div>
          </div>
          <div style={{ ...secStyle, marginBottom: 0 }}>
            <div style={secHead}>読者の反応</div>
            <div style={row}><span style={rowLabel}>PV</span><span style={{ ...rowValue, fontWeight: 700 }}>{(pvRes.count || 0).toLocaleString()}</span></div>
            <div style={row}><span style={rowLabel}>いいね</span><span style={rowValue}>{(likeRes.count || 0).toLocaleString()}</span></div>
            <div style={row}><span style={rowLabel}>保存</span><span style={rowValue}>{(bookmarkRes.count || 0).toLocaleString()}</span></div>
            <div style={row}><span style={rowLabel}>発掘・拡散</span><span style={rowValue}>{(discoverRes.count || 0).toLocaleString()}</span></div>
            <div style={{ ...row, borderBottom: 'none' }}><span style={rowLabel}>コメント</span><span style={rowValue}>{(commentRes.count || 0).toLocaleString()}</span></div>
          </div>
        </div>

        {/* 作品設定 */}
        <div style={secStyle}>
          <div style={secHead}>
            作品設定
            <Link href={`/post?edit=${novel.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)', textDecoration: 'none' }}>✎ 編集</Link>
          </div>
          <div style={row}><span style={rowLabel}>作品タイトル</span><span style={rowValue}>{novel.title}</span></div>
          <div style={row}><span style={rowLabel}>作品種別</span><span style={rowValue}>{novel.novel_type || '長編'}</span></div>
          <div style={row}><span style={rowLabel}>ジャンル</span><span style={rowValue}>{novel.genre}</span></div>
          <div style={row}><span style={rowLabel}>AI利用状況</span><span style={rowValue}>{AI_LABEL[novel.ai_usage || 'none'] || 'AI未使用'}</span></div>
          <div style={row}><span style={rowLabel}>あらすじ</span><span style={{ ...rowValue, whiteSpace: 'pre-wrap' as const }}>{novel.summary || '（未設定）'}</span></div>
          <div style={{ ...row, borderBottom: 'none' }}><span style={rowLabel}>タグ</span><span style={rowValue}>{(novel.tags || []).length > 0 ? (novel.tags || []).join(' ／ ') : '（未設定）'}</span></div>
        </div>

        {/* 公開・状態設定（その場で切替） */}
        <NovelManageActions novelId={novel.id} novelTitle={novel.title} initialPublished={!!novel.published} initialIsSerial={!!novel.is_serial} initialAllowComments={novel.allow_comments !== false} />

        {/* エピソード一覧 */}
        <div style={secStyle}>
          <div style={secHead}>
            エピソード一覧（{episodes.length}話）
            <Link href={`/post?novel=${novel.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)', textDecoration: 'none' }}>＋ 話を追加</Link>
          </div>
          {episodes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-faint)' }}>まだ話がありません</div>
          ) : (
            episodes.map((ep: any, i: number) => (
              <div key={ep.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: i === episodes.length - 1 ? 'none' : '1px solid var(--color-brand-light)', gap: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-inverse)', background: ep.published === false ? 'var(--color-text-faint)' : 'var(--color-info)', padding: '2px 7px', borderRadius: 3, flexShrink: 0 }}>{ep.published === false ? '下書き' : '公開'}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>ep.{ep.ep_number}</span>
                <Link href={`/novel/${novel.id}/episode/${ep.id}`} style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</Link>
                <span style={{ fontSize: 11, color: 'var(--color-text-faint)', flexShrink: 0 }}>{(ep.body?.length || 0).toLocaleString()}字</span>
                <span className="desktop-only" style={{ fontSize: 11, color: 'var(--color-text-faint)', flexShrink: 0 }}>{fmt(ep.created_at).split(' ')[0]}</span>
              </div>
            ))
          )}
        </div>

      </div>
      <Footer />
    </div>
  )
}
