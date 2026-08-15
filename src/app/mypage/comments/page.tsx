import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import FeedbackList from '@/components/mypage/comments/feedback-list'

export const dynamic = 'force-dynamic'

// 感想・コメントページ：自作品へのコメント＋拡散（推薦文）を時系列で一覧
// 既読管理：前回このページを開いた時刻（last_seen_comments_at）より新しいもの＝未読
export default async function MyCommentsPage({ searchParams }: { searchParams: { tab?: string; kind?: string; seen?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
  const tab = searchParams.tab === 'read' ? 'read' : 'unread'
  const kind = ['comment', 'discover'].includes(searchParams.kind || '') ? searchParams.kind : 'all'

  // 既読は read_feedbacks に item_key があるかで1件ずつ判定する
  const { data: readRows } = await supabase.from('read_feedbacks').select('item_key').eq('user_id', user.id).limit(2000)
  const readSet = new Set((readRows || []).map((r: any) => r.item_key))

  // 自分の作品
  const { data: myNovels } = await supabase.from('novels').select('id, title').eq('author_id', user.id)
  const novelIds = (myNovels || []).map((n: any) => n.id)
  const titleMap: Record<string, string> = {}
  ;(myNovels || []).forEach((n: any) => { titleMap[n.id] = n.title })

  // コメントと拡散を取得（直近200件ずつ）
  let items: any[] = []
  if (novelIds.length > 0) {
    const [cmRes, dcRes] = await Promise.all([
      supabase.from('comments')
        .select('id, novel_id, episode_id, user_id, body, rating, quoted_text, created_at')
        .in('novel_id', novelIds).neq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('discovers')
        .select('novel_id, user_id, comment, display_name, created_at')
        .in('novel_id', novelIds).eq('is_pending', false).neq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(200),
    ])
    // コメント投稿者名を取得
    const cmUserIds = Array.from(new Set((cmRes.data || []).map((c: any) => c.user_id).filter(Boolean)))
    const nameMap: Record<string, string> = {}
    if (cmUserIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('user_id, display_name').in('user_id', cmUserIds)
      profs?.forEach((p: any) => { nameMap[p.user_id] = p.display_name })
    }
    const comments = (cmRes.data || []).map((c: any) => ({
      type: 'comment' as const,
      key: `c-${c.id}`,
      novelId: c.novel_id,
      episodeId: c.episode_id,
      fromUserId: c.user_id,
      name: nameMap[c.user_id] || '読者',
      body: c.body,
      rating: c.rating,
      quoted: c.quoted_text,
      created_at: c.created_at,
    }))
    const discovers = (dcRes.data || []).map((d: any, i: number) => ({
      type: 'discover' as const,
      key: `d-${d.novel_id}-${d.user_id}-${d.created_at}`,
      novelId: d.novel_id,
      episodeId: null,
      fromUserId: d.user_id,
      name: d.display_name || '読者',
      body: d.comment || '',
      rating: null,
      quoted: null,
      created_at: d.created_at,
    }))
    items = [...comments, ...discovers].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }

  // 未読/既読・種類で絞り込み
  const kindFiltered = items.filter(it => {
    if (kind === 'comment' && it.type !== 'comment') return false
    if (kind === 'discover' && it.type !== 'discover') return false
    return true
  })
  const unreadCount = items.filter(it => !readSet.has(it.key)).length

  const seenQ = ''

  const pill = (active: boolean) => ({
    fontSize: 12, fontWeight: active ? 700 : 500, padding: '6px 16px', borderRadius: 16, textDecoration: 'none',
    background: active ? 'var(--color-brand)' : 'var(--color-bg-card)',
    color: active ? 'var(--base-color-1)' : 'var(--color-text-muted)',
    border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-brand-border)'}`,
  })

  return (
    <div style={{ minHeight:'100vh'}}>
      <Header />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>感想・コメント</h1>
          <Link href="/mypage" style={{ fontSize: 13, color: 'var(--color-brand)', textDecoration: 'none' }}>← マイページ</Link>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 16 }}>あなたの作品に届いたコメントと拡散（推薦）の一覧です。</p>

        {/* 未読/既読タブ */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <Link href={`/mypage/comments?tab=unread&kind=${kind}${seenQ}`} style={pill(tab === 'unread')}>未読{unreadCount > 0 ? `（${unreadCount}）` : ''}</Link>
          <Link href={`/mypage/comments?tab=read&kind=${kind}${seenQ}`} style={pill(tab === 'read')}>既読</Link>
        </div>
        {/* 種類絞り込み */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          <Link href={`/mypage/comments?tab=${tab}&kind=all${seenQ}`} style={pill(kind === 'all')}>すべて</Link>
          <Link href={`/mypage/comments?tab=${tab}&kind=comment${seenQ}`} style={pill(kind === 'comment')}>コメント</Link>
          <Link href={`/mypage/comments?tab=${tab}&kind=discover${seenQ}`} style={pill(kind === 'discover')}>拡散</Link>
        </div>

        <FeedbackList
          items={kindFiltered as any}
          titleMap={titleMap}
          initialReadKeys={Array.from(readSet)}
          tab={tab as any}
          myUserId={user.id}
          myName={profile?.display_name || ''}
        />
      </div>
      <Footer />
    </div>
  )
}
