'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ドット絵帯：発掘者がドット絵で「推し帯」を作り、作者の承認後、ホームの読者の声に表示される
export const OBI_SIZES = [
  { label: 'あらい', w: 24, h: 6 },
  { label: 'ふつう', w: 48, h: 12 },
  { label: 'こまかい', w: 96, h: 24 },
]
export const OBI_PALETTE = [
  'var(--base-color-1)', '#000000', 'var(--color-brand)', '#a9cade', '#ef476f', '#06d6a0', '#118ab2', '#073b4c',
  '#9b5de5', '#f4a261', '#8d5524', '#c9ada7', '#a8dadc', '#808080', '#ffc0cb', '#2a9d8f',
]

export interface ObiRow {
  id: string
  creator_id: string
  creator_name: string | null
  dots: { w: number; h: number; d: number[] } | number[]
  show_in_comments: boolean
  approved: boolean
}

// ドットデータ→SVG表示（旧形式:配列 / 新形式:{w,h,d} 両対応）
export function normalizeObi(dots: any): { w: number; h: number; d: number[] } {
  if (Array.isArray(dots)) return { w: 48, h: 12, d: dots }
  return { w: dots?.w || 48, h: dots?.h || 12, d: dots?.d || [] }
}
export function ObiDotsView({ dots, height = 60 }: { dots: any; height?: number }) {
  const { w, h, d } = normalizeObi(dots)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: height * 4, height, display: 'block', imageRendering: 'pixelated', borderRadius: 4 }} shapeRendering="crispEdges">
      <rect x="0" y="0" width={w} height={h} fill="var(--base-color-1)" />
      {d.map((c: number, i: number) => c > 0 ? (
        <rect key={i} x={i % w} y={Math.floor(i / w)} width="1" height="1" fill={OBI_PALETTE[c] || '#000'} />
      ) : null)}
    </svg>
  )
}

interface Props {
  novelId: string
  novelTitle: string
  userId: string | null
  userName: string
  isAuthor: boolean
  hasDiscovered: boolean          // 発掘済みの読者のみ帯を作れる
  approvedObis: ObiRow[]
  myObi: ObiRow | null
  pendingObis: ObiRow[]           // 作者向け：承認待ち
}

export default function ObiBelt({ novelId, novelTitle, userId, userName, isAuthor, hasDiscovered, approvedObis, myObi, pendingObis }: Props) {
  const supabase = createClient()
  const [showEditor, setShowEditor] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const initial = myObi ? normalizeObi(myObi.dots) : null
  const [sizeIdx, setSizeIdx] = useState(() => {
    if (!initial) return 1
    const found = OBI_SIZES.findIndex(s => s.w === initial.w && s.h === initial.h)
    return found >= 0 ? found : 1
  })
  const W = OBI_SIZES[sizeIdx].w, H = OBI_SIZES[sizeIdx].h

  /*
   * 絵の大きさは、選ばれている細かさに必ず合わせる。
   *
   * 前は、保存した絵が壊れているときだけ
   * 別の大きさ（真ん中の細かさ）で作り直していた。
   * 細かさのほうは保存した絵から決めていたので、
   * 枡の数と絵の数がずれて崩れることがあった。
   */
  const [dots, setDots] = useState<number[]>(() => {
    const size = OBI_SIZES[
      initial
        ? Math.max(0, OBI_SIZES.findIndex(s => s.w === initial.w && s.h === initial.h))
        : 1
    ]
    return initial && initial.d.length === size.w * size.h
      ? [...initial.d]
      : Array(size.w * size.h).fill(0)
  })
  const [color, setColor] = useState(2)
  const [showInComments, setShowInComments] = useState(myObi?.show_in_comments !== false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [pending, setPending] = useState(pendingObis)
  const paintingRef = useRef(false)


  /**
   * 編集を閉じる。
   *
   * 描いている最中に閉じられると、押しっぱなしの印が残る。
   * 次に開いたとき、押していないのに触れた所が塗られる。
   * 閉じる道は必ずここを通す。
   */
  function closeEditor() {
    paintingRef.current = false
    setShowEditor(false)
    setSavedMsg('')
  }

  function paint(i: number) {
    setDots(prev => { const next = [...prev]; next[i] = color; return next })
  }

  async function handleSave() {
    if (!userId || saving) return
    setSaving(true)
    const { error } = await supabase.from('obi_dots').upsert({
      novel_id: novelId,
      creator_id: userId,
      creator_name: userName || null,
      dots: { w: W, h: H, d: dots },
      show_in_comments: showInComments,
      approved: false,  // 保存すると再承認待ちに
    }, { onConflict: 'novel_id,creator_id' })
    setSaving(false)
    if (!error) {
      setSavedMsg('保存しました！作者の承認後に表示されます')
      setTimeout(() => { setSavedMsg(''); closeEditor() }, 2000)
    } else {
      setSavedMsg('保存に失敗しました')
      setTimeout(() => setSavedMsg(''), 2000)
    }
  }

  async function handleApprove(id: string, approve: boolean) {
    if (approve) {
      await supabase.from('obi_dots').update({ approved: true }).eq('id', id)
    } else {
      await supabase.from('obi_dots').delete().eq('id', id)
    }
    setPending(prev => prev.filter(o => o.id !== id))
  }

  /*
   * 窓の外で指を離したときも、描くのをやめる。
   *
   * キャンバスの中でしか見ていなかったので、
   * 外へ出て離すと押しっぱなしのままだった。
   */
  useEffect(() => {
    function stop() { paintingRef.current = false }
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchend', stop)
    return () => {
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchend', stop)
    }
  }, [])

  // 拡散モーダルの「ドット絵の帯で推薦する」から開かれる
  useEffect(() => {
    function onOpen() { if (userId && !isAuthor) setShowEditor(true) }
    window.addEventListener('open-obi-editor', onOpen)
    return () => window.removeEventListener('open-obi-editor', onOpen)
  }, [userId, isAuthor])

  const hasButtons = (isAuthor && pending.length > 0) || (hasDiscovered && userId && !isAuthor)
  if (!hasButtons && !userId) return null

  return (
    <div style={{ marginBottom: hasButtons ? 14 : 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* 発掘者：帯を作る */}
        {hasDiscovered && userId && !isAuthor && (
          <button onClick={() => setShowEditor(true)}
            style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-brand)', background: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 12, padding: '5px 12px', cursor: 'pointer' }}>
            {myObi ? '推し帯を編集する' : 'ドット絵で推し帯を作る'}
          </button>
        )}
        {/* 作者：承認待ち */}
        {isAuthor && pending.length > 0 && (
          <button onClick={() => setShowReview(true)}
            style={{ fontSize: 11.5, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '5px 12px', cursor: 'pointer' }}>
            承認待ちの推し帯があります（{pending.length}）
          </button>
        )}
      </div>

      {/* エディタモーダル */}
      {showEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }} onClick={closeEditor}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg-card)', borderRadius: 14, padding: '18px 16px', maxWidth: 640, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
            {/*
              * 閉じる押し具。
              *
              * 前は、外側の暗い所を押すしか閉じる道が無かった。
              * 絵を描く画面なので、外を押すのは「描き損ねた」ようにも
              * 見えて、閉じてよいのか分からない。
              */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>推し帯をつくる</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  /* 描きかけを黙って捨てない */
                  if (dots.some(d => d > 0) && !savedMsg
                      && !confirm('描いた絵は保存されません。閉じますか？')) return
                  closeEditor()
                }}
                aria-label="閉じる"
                style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-brand-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-muted)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 10, lineHeight: 1.6 }}>「{novelTitle}」への推しをドット絵で。保存すると作者の承認後、読者の声に表示されます。</div>

            {/* 細かさ（3段階） */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>細かさ</span>
              {OBI_SIZES.map((s, i) => (
                <button key={i} onClick={() => {
                    if (i === sizeIdx) return
                    if (dots.some(d => d > 0) && !confirm('細かさを変えると描いた絵が消えます。よろしいですか？')) return
                    setSizeIdx(i); setDots(Array(s.w * s.h).fill(0))
                  }}
                  style={{ fontSize: 11.5, fontWeight: sizeIdx === i ? 700 : 500, padding: '4px 12px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${sizeIdx === i ? 'var(--color-brand)' : 'var(--color-brand-border)'}`, background: sizeIdx === i ? 'var(--color-brand-light)' : 'var(--color-bg-card)', color: sizeIdx === i ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* パレット */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {OBI_PALETTE.map((c, i) => (
                <button key={i} onClick={() => setColor(i)}
                  style={{ width: 24, height: 24, borderRadius: 5, background: c, cursor: 'pointer', border: color === i ? '2.5px solid var(--color-text)' : '1px solid #ccc', boxSizing: 'border-box', position: 'relative' }}>
                  {i === 0 && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>／</span>}
                </button>
              ))}
              <button onClick={() => setDots(Array(W * H).fill(0))}
                style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 6, padding: '0 10px', cursor: 'pointer' }}>全消し</button>
            </div>

            {/* キャンバス */}
            <div
              onMouseDown={() => { paintingRef.current = true }}
              onMouseUp={() => { paintingRef.current = false }}
              onMouseLeave={() => { paintingRef.current = false }}
              onTouchStart={e => {
                paintingRef.current = true
                const t = e.touches[0]
                const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null
                const idx = el?.dataset?.idx
                if (idx !== undefined) paint(Number(idx))
              }}
              onTouchMove={e => {
                if (!paintingRef.current) return
                const t = e.touches[0]
                const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null
                const idx = el?.dataset?.idx
                if (idx !== undefined) paint(Number(idx))
              }}
              onTouchEnd={() => { paintingRef.current = false }}
              style={{ display: 'grid', gridTemplateColumns: `repeat(${W}, 1fr)`, border: '1px solid var(--color-brand-border)', borderRadius: 6, overflow: 'hidden', touchAction: 'none', userSelect: 'none', background: 'var(--color-bg-card)', aspectRatio: `${W} / ${H}` }}>
              {dots.map((c, i) => (
                <div key={i} data-idx={i}
                  onMouseDown={() => paint(i)}
                  onMouseEnter={() => { if (paintingRef.current) paint(i) }}
                  style={{ background: c > 0 ? OBI_PALETTE[c] : ((Math.floor(i / W) + (i % W)) % 2 === 0 ? 'var(--base-color-1)' : '#f7f4f0'), aspectRatio: '1', cursor: 'crosshair' }} />
              ))}
            </div>

            {/* プレビュー */}
            <div style={{ margin: '10px 0' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>プレビュー</div>
              <div style={{ border: '1px solid var(--color-brand-border)', borderRadius: 6, overflow: 'hidden' }}>
                <ObiDotsView dots={dots} height={48} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-text)', marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={showInComments} onChange={e => setShowInComments(e.target.checked)} />
              コメント欄（読者の声）にもこの帯を表示する
            </label>

            {savedMsg && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)', marginBottom: 8 }}>{savedMsg}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEditor(false)} style={{ fontSize: 13, color: 'var(--color-text-muted)', background: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>閉じる</button>
              <button onClick={handleSave} disabled={saving}
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-inverse)', background: 'var(--color-brand)', border: 'none', borderRadius: 8, padding: '9px 22px', cursor: 'pointer' }}>
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 作者の承認モーダル */}
      {showReview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }} onClick={() => setShowReview(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg-card)', borderRadius: 14, padding: '18px 16px', maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>推し帯の承認</div>
            {pending.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '20px 0', textAlign: 'center' }}>承認待ちはありません</div>
            ) : (
              pending.map(o => (
                <div key={o.id} style={{ border: '1px solid var(--color-brand-border)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                  <ObiDotsView dots={o.dots} height={52} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>承認するとホームの読者の声に表示されます</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleApprove(o.id, false)}
                        style={{ fontSize: 12, color: '#dc2626', background: 'none', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>却下</button>
                      <button onClick={() => handleApprove(o.id, true)}
                        style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-inverse)', background: 'var(--color-brand)', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer' }}>承認して表示</button>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setShowReview(false)} style={{ fontSize: 13, color: 'var(--color-text-muted)', background: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
