import AdminShell from '@/components/admin/admin-shell'
import { createClient } from '@/lib/supabase/server'
export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NovelManager from '@/components/admin/novels/novel-manager'

export default async function AdminNovelsPage({ searchParams }: { searchParams: { q?: string; page?: string; publishing?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  const q = searchParams.q || ''
  const page = Number(searchParams.page || 1)
  const publishingOnly = searchParams.publishing === '1'
  const PAGE_SIZE = 20
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase.from('novels').select('id, title, genre, author_id, published, is_r18, created_at, aims_publishing, official_tags', { count: 'exact' })
  if (q) query = (query as any).ilike('title', `%${q}%`)
  if (publishingOnly) query = (query as any).eq('aims_publishing', true)
  const { data: novels, count } = await (query as any).order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)

  const authorIds = (novels||[]).map((n: any) => n.author_id).filter((v:string,i:number,a:string[]) => a.indexOf(v)===i)
  const authorMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: authors } = await supabase.from('profiles').select('user_id, display_name').in('user_id', authorIds as string[])
    authors?.forEach((a: any) => { authorMap[a.user_id] = a.display_name })
  }
  const novelsWithAuthor = (novels||[]).map((n: any) => ({ ...n, display_name: authorMap[n.author_id]||'' }))

  return (
    <AdminShell title="作品の確認" description="公開されたもの">
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24,flexWrap:'wrap'}}>
          <span style={{fontSize:13,color:'#64748b'}}>（{count?.toLocaleString()}作品）</span>
          <a href={`/admin/novels?publishing=${publishingOnly?'0':'1'}`}
            style={{marginLeft:'auto',padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,textDecoration:'none',
              background:publishingOnly?'#eab308':'var(--base-color-1)',color:publishingOnly?'var(--base-color-1)':'#64748b',
              border:`1px solid ${publishingOnly?'#eab308':'#e2e8f0'}`}}>
            書籍化希望{publishingOnly?' ✓':''}
          </a>
        </div>
        <NovelManager initialNovels={novelsWithAuthor} total={count||0} currentPage={page} q={q} publishingOnly={publishingOnly}/>
    </AdminShell>
  )
}
