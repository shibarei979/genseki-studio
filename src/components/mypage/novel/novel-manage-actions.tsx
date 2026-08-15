'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ChapterEditModal from '@/components/mypage/chapter-edit-modal'

interface Props {
  novelId: string
  novelTitle: string
  initialPublished: boolean
  initialIsSerial: boolean
  initialAllowComments: boolean
}

export default function NovelManageActions({ novelId, novelTitle, initialPublished, initialIsSerial, initialAllowComments }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [published, setPublished] = useState(initialPublished)
  const [isSerial, setIsSerial] = useState(initialIsSerial)
  const [allowComments, setAllowComments] = useState(initialAllowComments)
  const [saving, setSaving] = useState('')
  const [toast, setToast] = useState('')
  const [showChapters, setShowChapters] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 1800)
  }

  async function togglePublished() {
    setSaving('published')
    const next = !published
    const { error } = await supabase.from('novels').update({ published: next }).eq('id', novelId)
    if (!error) { setPublished(next); showToast(next ? '公開しました' : '非公開にしました') }
    setSaving('')
  }

  async function toggleSerial() {
    setSaving('serial')
    const next = !isSerial
    const { error } = await supabase.from('novels').update({ is_serial: next, completed_at: next ? null : new Date().toISOString() }).eq('id', novelId)
    if (!error) { setIsSerial(next); showToast(next ? '連載中に戻しました' : '完結にしました') }
    setSaving('')
  }

  async function toggleComments() {
    setSaving('comments')
    const next = !allowComments
    const { error } = await supabase.from('novels').update({ allow_comments: next }).eq('id', novelId)
    if (!error) { setAllowComments(next); showToast(next ? 'コメントを許可しました' : 'コメントを不可にしました') }
    setSaving('')
  }

  async function handleDelete() {
    if (deleteInput !== novelTitle) return
    setDeleting(true)
    const { error } = await supabase.from('novels').delete().eq('id', novelId)
    if (!error) {
      router.push('/mypage')
    } else {
      showToast('削除に失敗しました')
      setDeleting(false)
    }
  }

  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--color-brand-light)', gap: 10, flexWrap: 'wrap' as const }
  const btnStyle = (active: boolean) => ({
    fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 14, cursor: 'pointer',
    border: '1px solid var(--color-brand-border)', background: 'var(--color-bg-card)',
    color: active ? 'var(--color-info)' : 'var(--color-text-muted)', flexShrink: 0,
  })

  return (
    <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-text)', color: 'var(--color-bg-card)', padding: '10px 20px', borderRadius: 8, fontSize: 13, zIndex: 100 }}>{toast}</div>
      )}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--color-brand-light)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>公開・受付設定</div>

      <div style={rowStyle}>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>公開状態</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{published ? '読者に公開されています' : '非公開（自分だけが見られます）'}</div>
        </div>
        <button onClick={togglePublished} disabled={saving === 'published'}
          style={{ ...btnStyle(false), background: published ? 'var(--color-bg-card)' : 'var(--color-brand)', color: published ? 'var(--color-text-muted)' : 'var(--base-color-1)' }}>
          {saving === 'published' ? '...' : published ? '非公開にする' : '公開する'}
        </button>
      </div>

      <div style={rowStyle}>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>完結設定</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{isSerial ? '連載中として表示されます' : '完結として表示されます'}</div>
        </div>
        <button onClick={toggleSerial} disabled={saving === 'serial'} style={btnStyle(isSerial)}>
          {saving === 'serial' ? '...' : isSerial ? '完結にする' : '連載に戻す'}
        </button>
      </div>

      <div style={rowStyle}>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>コメント受付</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{allowComments ? 'コメントを受け付けています' : 'コメント不可に設定中'}</div>
        </div>
        <button onClick={toggleComments} disabled={saving === 'comments'} style={btnStyle(allowComments)}>
          {saving === 'comments' ? '...' : allowComments ? 'コメント不可にする' : 'コメントを許可する'}
        </button>
      </div>

      <div style={rowStyle}>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>章（チャプター）の編集</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>章の作成・並び替え・話の割り当て</div>
        </div>
        <button onClick={() => setShowChapters(true)} style={btnStyle(false)}>章の編集を開く</button>
      </div>

      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)', marginBottom: 2 }}>作品の削除</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>すべての話・データが削除されます（元に戻せません）</div>
        </div>
        <button onClick={() => { setShowDelete(true); setDeleteInput('') }}
          style={{ ...btnStyle(false), color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>削除する</button>
      </div>

      {showChapters && <ChapterEditModal novelId={novelId} novelTitle={novelTitle} onClose={() => setShowChapters(false)} />}

      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => !deleting && setShowDelete(false)}>
          <div style={{ background: 'var(--color-bg-card)', borderRadius: 14, padding: '24px 22px', maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-danger)', marginBottom: 10 }}>作品を削除しますか？</div>
            <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.7, marginBottom: 14 }}>
              「{novelTitle}」とすべての話・コメント等のデータが完全に削除されます。この操作は元に戻せません。
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>確認のため、作品タイトルを入力してください</div>
            <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder={novelTitle}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--color-brand-border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-brand-border)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>キャンセル</button>
              <button onClick={handleDelete} disabled={deleting || deleteInput !== novelTitle}
                style={{ fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-danger)', color: 'var(--color-text-inverse)', cursor: deleteInput === novelTitle ? 'pointer' : 'not-allowed', opacity: deleteInput === novelTitle ? 1 : 0.5 }}>
                {deleting ? '削除中...' : '完全に削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
