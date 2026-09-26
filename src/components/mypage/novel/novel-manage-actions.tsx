'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import HelpTip from '@/components/common/help-tip'
import { createClient } from '@/lib/supabase/client'
import ChapterEditModal from '@/components/mypage/chapter-edit-modal'

interface Props {
  novelId: string
  novelTitle: string
  initialPublished: boolean
  /** 作品の見せる相手。public / limited / draft */
  initialVisibility?: string | null
  /** 読者に出ている話の数 */
  postedCount?: number
  initialIsSerial: boolean
  initialAllowComments: boolean
}

export default function NovelManageActions({ novelId, novelTitle, initialPublished, initialVisibility, postedCount = 0, initialIsSerial, initialAllowComments }: Props) {
  const supabase = createClient()
  const router = useRouter()
  /*
   * ★ 見え方は visibility で決める。
   *
   *   前は published だけを書き換えていた。読者の頁は visibility を見ているので、
   *   ここで「公開する」を押しても読者には出なかった。
   *   マイページは「公開中」、執筆側は「下書き」、読者は見られない、とずれていた。
   *
   *   いまは「作品ごと隠す／見えるようにする」だけを置き、両方の列を揃えて書く。
   *   作品を公開する操作は無い。話を投稿すると作品も出る。
   */
  const [visibility, setVisibility] = useState<string>(
    initialVisibility ?? (initialPublished ? 'public' : 'draft'),
  )
  const [askHide, setAskHide] = useState(false)
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

  async function setAudience(next: 'public' | 'draft') {
    setSaving('published')
    const { error } = await supabase
      .from('novels')
      .update({ visibility: next, published: next === 'public' })
      .eq('id', novelId)
    if (!error) {
      setVisibility(next)
      showToast(next === 'public' ? '作品を公開に戻しました' : '作品を非公開にしました')
      router.refresh()
    } else {
      showToast('変えられませんでした')
    }
    setSaving('')
    setAskHide(false)
  }

  const neverPosted = postedCount === 0
  const isHidden = visibility === 'draft' && !neverPosted

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
        <div style={{ minWidth: 180, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            作品の見え方
            <HelpTip topic="mypage-visibility" size={15} />
          </div>
          <div style={{ fontSize: 11.5, color: isHidden ? 'var(--color-danger)' : 'var(--color-text-muted)', lineHeight: 1.7 }}>
            {neverPosted
              ? 'まだ1話も投稿していません。話を投稿すると、作品も読者に出ます。'
              : isHidden
                ? '作品を非公開にしています。読者には見えません（予約した話も出ません）。'
                : visibility === 'limited'
                  ? 'URLを知っている人に見えています。'
                  : 'みんなに見えています。'}
          </div>
          {askHide && (
            <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.7, color: 'var(--color-text)', background: 'var(--color-bg)', border: '1px solid var(--color-brand-border)', borderRadius: 8, padding: '8px 10px' }}>
              作品と、投稿した話がすべて読者から見えなくなります。話やコメントは消えません。
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button autoFocus onClick={() => setAskHide(false)} style={{ ...btnStyle(false), padding: '5px 12px' }}>やめる</button>
                <button onClick={() => setAudience('draft')} disabled={saving === 'published'}
                  style={{ ...btnStyle(false), padding: '5px 14px', background: 'var(--color-danger)', color: 'var(--color-text-inverse)', border: 'none' }}>
                  {saving === 'published' ? '...' : '非公開にする'}
                </button>
              </div>
            </div>
          )}
        </div>
        {neverPosted ? (
          <Link href={`/workspace/${novelId}/post`} style={{ ...btnStyle(false), background: 'var(--color-brand)', color: 'var(--base-color-1)', textDecoration: 'none' }}>
            投稿の画面へ
          </Link>
        ) : isHidden ? (
          <button onClick={() => setAudience('public')} disabled={saving === 'published'}
            style={{ ...btnStyle(false), background: 'var(--color-brand)', color: 'var(--base-color-1)' }}>
            {saving === 'published' ? '...' : '公開に戻す'}
          </button>
        ) : !askHide ? (
          <button onClick={() => setAskHide(true)} style={btnStyle(false)}>作品を非公開にする</button>
        ) : null}
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
