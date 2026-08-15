import AdminShell from '@/components/admin/admin-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DiscoverManager from '@/components/admin/discovers/discover-manager'

export default async function AdminDiscoversPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  // 審査待ちコメント取得（通常クライアントで取得）
  const { data: pending } = await supabase
    .from('discovers')
    .select('user_id, novel_id, comment, display_name, pending_reason, created_at')
    .eq('is_pending', true)
    .order('created_at', { ascending: false })

  // novel_idからタイトル取得
  const novelIds = Array.from(new Set((pending||[]).map((d:any) => d.novel_id)))
  let novelMap: Record<string,string> = {}
  if (novelIds.length > 0) {
    const { data: novels } = await supabase
      .from('novels').select('id, title').in('id', novelIds)
    novels?.forEach((n:any) => { novelMap[n.id] = n.title })
  }

  const items = (pending||[]).map((d:any) => ({
    ...d,
    novel_title: novelMap[d.novel_id] || '不明',
  }))

  return (
    <AdminShell title="発掘" description="読者が見つけたもの">
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
          {items.length > 0 && (
            <span style={{fontSize:11,background:'#ef4444',color:'var(--color-text-inverse)',padding:'2px 8px',borderRadius:10,fontWeight:700}}>
              {items.length}件待ち
            </span>
          )}
        </div>
        <DiscoverManager initialItems={items} />
    </AdminShell>
  )
}
