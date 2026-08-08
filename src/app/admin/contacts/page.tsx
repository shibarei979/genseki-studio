import AdminShell from '@/components/admin/admin-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ContactManager from '@/components/admin/contacts/contact-manager'

export default async function AdminContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  const adminSupabase = createAdminClient()
  const { data: contacts } = await adminSupabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <AdminShell title="問い合わせ" description="受け取りと返信">
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
          {(contacts||[]).filter((c:any)=>!c.is_read).length > 0 && (
            <span style={{fontSize:11,background:'#ef4444',color:'var(--color-text-inverse)',padding:'2px 8px',borderRadius:10,fontWeight:700}}>
              未読 {(contacts||[]).filter((c:any)=>!c.is_read).length}件
            </span>
          )}
        </div>
        <ContactManager initialContacts={contacts||[]} />
    </AdminShell>
  )
}
