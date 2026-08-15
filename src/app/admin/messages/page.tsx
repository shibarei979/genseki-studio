import AdminShell from '@/components/admin/admin-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MessageSender from '@/components/admin/messages/message-sender'

export default async function AdminMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  const adminSupabase = createAdminClient()
  const { data: users } = await adminSupabase
    .from('profiles')
    .select('user_id, display_name, email, icon_url')
    .order('created_at', { ascending: false })

  const { data: sentMessages } = await adminSupabase
    .from('admin_messages')
    .select('id, to_user_id, subject, body, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  // 受信者名をマップ
  const userMap = Object.fromEntries((users||[]).map((u:any) => [u.user_id, u]))
  const messages = (sentMessages||[]).map((m:any) => ({
    ...m,
    to_name: userMap[m.to_user_id]?.display_name || '不明',
    to_email: userMap[m.to_user_id]?.email || '',
  }))

  return (
    <AdminShell title="個別のお知らせ" description="特定の人へ送る">
        <MessageSender users={users||[]} sentMessages={messages} />
    </AdminShell>
  )
}
