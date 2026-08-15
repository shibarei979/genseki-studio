import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import RankingHistoryList from '@/components/mypage/ranking-history/ranking-history-list'

export const dynamic = 'force-dynamic'

// ランキング履歴：自作品のランクイン記録「○時から○時 ○位（総合・日間）」
export default async function RankingHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
  const { data: readRows } = await supabase.from('read_feedbacks').select('item_key').eq('user_id', user.id).limit(2000)
  const readSet = new Set((readRows || []).map((r: any) => r.item_key))

  const { data: history } = await supabase
    .from('ranking_history')
    .select('id, novel_id, period, rank, from_time, to_time, created_at')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  // 作品タイトル
  const novelIds = Array.from(new Set((history || []).map((h: any) => h.novel_id)))
  const titleMap: Record<string, string> = {}
  if (novelIds.length > 0) {
    const { data: novels } = await supabase.from('novels').select('id, title').in('id', novelIds)
    novels?.forEach((n: any) => { titleMap[n.id] = n.title })
  }



  return (
    <div style={{ minHeight:'100vh'}}>
      <Header />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>ランキング履歴</h1>
          <Link href="/mypage" style={{ fontSize: 13, color: 'var(--color-brand)', textDecoration: 'none' }}>← マイページ</Link>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 18 }}>あなたの作品がランキングに入った記録です（上位20位まで・3時間ごとの集計単位）。</p>

        <RankingHistoryList
          history={(history || []) as any}
          titleMap={titleMap}
          initialReadKeys={Array.from(readSet)}
        />
      </div>
      <Footer />
    </div>
  )
}
