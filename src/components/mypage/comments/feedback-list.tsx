'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import FeedbackReplyBox from '@/components/mypage/comments/feedback-reply-box'

interface Item {
  type: 'comment' | 'discover'
  key: string
  novelId: string
  episodeId: string | null
  fromUserId?: string
  name: string
  body: string
  rating: number | null
  quoted: string | null
  created_at: string
}

interface Props {
  items: Item[]
  titleMap: Record<string, string>
  initialReadKeys: string[]
  tab: 'unread' | 'read'
  myUserId: string
  myName: string
}

const fmt = (s: string) => {
  const d = new Date(s)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function FeedbackList({ items, titleMap, initialReadKeys, tab, myUserId, myName }: Props) {
  const supabase = createClient()
  const [readSet, setReadSet] = useState(new Set(initialReadKeys))

  async function markRead(key: string) {
    setReadSet(prev => new Set(prev).add(key))  // 即座に移動
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('read_feedbacks').insert({ user_id: user.id, item_key: key })
  }

  const visible = items.filter(it => tab === 'unread' ? !readSet.has(it.key) : readSet.has(it.key))

  if (visible.length === 0) {
    return (
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, padding: '48px 20px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-faint)' }}>
        {tab === 'unread' ? '未読の感想はありません' : 'まだ既読の感想がありません'}
      </div>
    )
  }

  return (
    <>
      {visible.map(it => (
        <div key={it.key} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, padding: '13px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: it.type === 'discover' ? 'var(--color-brand-light)' : 'var(--color-info-bg, #eff6ff)', color: it.type === 'discover' ? 'var(--color-brand)' : 'var(--color-info, #2563eb)' }}>
              {it.type === 'discover' ? '拡散' : 'コメント'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{it.name}さん</span>
            {it.rating && it.rating >= 1 ? (
              <span>{[1,2,3,4,5].map(s => (
                <span key={s} style={{ fontSize: 12, color: s <= (it.rating||0) ? '#f5a623' : 'var(--color-brand-border)' }}>★</span>
              ))}</span>
            ) : null}
            <span style={{ fontSize: 11, color: 'var(--color-text-faint)', marginLeft: 'auto' }}>{fmt(it.created_at)}</span>
          </div>
          <Link href={it.episodeId ? `/novel/${it.novelId}/episode/${it.episodeId}` : `/novel/${it.novelId}`}
            style={{ fontSize: 11.5, color: 'var(--color-brand)', textDecoration: 'none', display: 'inline-block', marginBottom: 6 }}>
            「{titleMap[it.novelId] || '作品'}」→
          </Link>
          {it.quoted && (
            <div style={{ fontSize: 12, color: '#8a5a3a', background: '#FFF6EC', border: '1px solid #f0d9c0', borderLeft: '3px solid var(--color-brand)', borderRadius: '2px 6px 6px 2px', padding: '6px 10px', lineHeight: 1.6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--color-brand)', fontWeight: 700, marginRight: 4 }}>引用</span>
              {it.quoted.length > 60 ? it.quoted.slice(0, 60) + '…' : it.quoted}
            </div>
          )}
          {it.body && (
            <div style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{it.body}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
            {it.type === 'comment' ? (
              <FeedbackReplyBox
                parentCommentId={it.key.slice(2)}
                novelId={it.novelId}
                episodeId={it.episodeId}
                targetUserId={it.fromUserId || ''}
                targetName={it.name}
                myUserId={myUserId}
                myName={myName}
              />
            ) : <span/>}
            {!readSet.has(it.key) ? (
              <button onClick={() => markRead(it.key)}
                style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-brand)', background: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 12, padding: '4px 12px', cursor: 'pointer', flexShrink: 0 }}>
                既読にする
              </button>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--color-text-faint)', flexShrink: 0 }}>既読</span>
            )}
          </div>
        </div>
      ))}
    </>
  )
}
