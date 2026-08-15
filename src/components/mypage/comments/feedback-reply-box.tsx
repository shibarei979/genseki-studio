'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  parentCommentId: string
  novelId: string
  episodeId: string | null
  targetUserId: string   // 返信先（コメント主）
  targetName: string
  myUserId: string
  myName: string
}

// 感想・コメントページ用の返信ボックス
export default function FeedbackReplyBox({ parentCommentId, novelId, episodeId, targetUserId, targetName, myUserId, myName }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || posting) return
    setPosting(true)
    const { error } = await supabase.from('comments').insert({
      novel_id: novelId,
      episode_id: episodeId,
      user_id: myUserId,
      body: trimmed,
      parent_id: parentCommentId,
    })
    if (!error) {
      // コメント主に返信通知
      if (targetUserId && targetUserId !== myUserId) {
        fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: targetUserId,
            type: 'reply',
            message: `${myName || '作者'}さんがあなたのコメントに返信しました`,
            link: episodeId ? `/novel/${novelId}/episode/${episodeId}` : `/novel/${novelId}`,
          }),
        }).catch(() => {})
      }
      setDone(true)
      setBody('')
      setTimeout(() => { setOpen(false); setDone(false) }, 1500)
    }
    setPosting(false)
  }

  if (done) {
    return <div style={{ fontSize: 12, color: 'var(--color-success, #15803d)', fontWeight: 600, marginTop: 8 }}>返信しました</div>
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ fontSize: 12, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
          返信する
        </button>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{targetName}さんへ返信</div>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={2} maxLength={500}
            placeholder="返信を入力..."
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-brand-border)', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button onClick={() => { setOpen(false); setBody('') }}
              style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>キャンセル</button>
            <button onClick={handleSubmit} disabled={posting || !body.trim()}
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-inverse)', background: 'var(--color-brand)', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: posting || !body.trim() ? 'not-allowed' : 'pointer', opacity: posting || !body.trim() ? 0.5 : 1 }}>
              {posting ? '送信中...' : '返信する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
