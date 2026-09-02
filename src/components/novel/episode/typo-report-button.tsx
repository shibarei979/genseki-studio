'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  novelId: string
  episodeId: string
  authorId: string
  userId: string | null
  userName: string | null
  novelTitle?: string
  episodeTitle?: string
}

export default function TypoReportButton({ novelId, episodeId, authorId, userId, userName, novelTitle, episodeTitle }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [original, setOriginal] = useState('')
  const [suggested, setSuggested] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  // 作者自身・未ログインには出さない
  if (!userId || userId === authorId) return null

  async function handleSubmit() {
    if (!original.trim()) return
    setSending(true)
    const { error } = await supabase.from('typo_reports').insert({
      novel_id: novelId,
      episode_id: episodeId,
      reporter_id: userId,
      original_text: original.trim(),
      suggested_text: suggested.trim() || null,
      note: note.trim() || null,
    })
    if (!error) {
      /*
       * 作者に知らせる。
       *
       * ★ 報告の中身は通知に載せない。
       *   そのまま載せると、相手の通知欄へ好きな文を送れてしまう。
       *   話へ行けば、報告の一覧で読める。
       */
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typo_episode_id: episodeId }),
      }).catch(() => {})
      setDone(true)
      setTimeout(() => {
        setOpen(false)
        setDone(false)
        setOriginal(''); setSuggested(''); setNote('')
      }, 1600)
    }
    setSending(false)
  }

  const inp = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--color-brand-border)',
    borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit',
    background: 'var(--color-bg-card)', color: 'var(--color-text)', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ marginTop: 14 }}>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          誤字・脱字を報告する
        </button>
      ) : (
        <div style={{ background: 'var(--color-bg-card)', border: '1.5px solid var(--color-brand-border)', borderRadius: 12, padding: '14px 16px' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '14px', fontSize: 13, color: 'var(--color-success, #15803d)', fontWeight: 600 }}>
              報告しました。ご協力ありがとうございます！
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>誤字・脱字を報告</div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>誤りのある箇所 <span style={{color:'var(--color-danger)'}}>*</span></div>
                <input value={original} onChange={e => setOriginal(e.target.value)} placeholder="例：吾輩は猫てある" style={inp} maxLength={100}/>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>修正案（任意）</div>
                <input value={suggested} onChange={e => setSuggested(e.target.value)} placeholder="例：吾輩は猫である" style={inp} maxLength={100}/>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>補足（任意）</div>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="例：第3段落あたり" style={inp} maxLength={100}/>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setOpen(false)} style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
                  キャンセル
                </button>
                <button onClick={handleSubmit} disabled={sending || !original.trim()}
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-inverse)', background: 'var(--color-brand)', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: sending || !original.trim() ? 'not-allowed' : 'pointer', opacity: sending || !original.trim() ? 0.5 : 1 }}>
                  {sending ? '送信中...' : '報告する'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
