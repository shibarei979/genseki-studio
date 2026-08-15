/**
 * ============================================================
 * 原石航路 Studio
 * /messages — 運営からのお知らせ
 *
 * 運営が個別に送ったものを読む場所。
 *
 * 「お知らせ（/notices）」とは分ける。
 * あちらは全員に向けたもの、こちらは自分あて。
 * 混ぜると、自分に関わる知らせが全体の告知に埋もれる。
 * ============================================================
 */

import { redirect } from 'next/navigation'

import Header from '@/components/layout/header'
import MessagesClient from '@/components/messages/messages-client'
import { createClient } from '@/lib/supabase/server'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { open?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/messages')

  const { data } = await supabase
    .from('admin_messages')
    .select('id, subject, body, is_read, created_at, from_user_id, parent_id')
    .eq('to_user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-page">
      <Header breadcrumbs={[{ label: 'お知らせ' }]} />
      {/* ベルから来たときは、その便りを開いた状態にする */}
      <MessagesClient
        messages={data || []}
        openId={searchParams.open ?? null}
        userId={user.id}
      />
    </div>
  )
}
