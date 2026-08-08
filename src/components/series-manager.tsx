'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Series {
  id: string; title: string; description: string; cover_url: string | null; order_num: number
  novels?: SeriesNovel[]
}
interface SeriesNovel {
  id: string; novel_id: string; order_num: number
  novel?: { id: string; title: string; genre: string; cover_url?: string }
}
interface Props { userId: string; myNovels: any[] }

export default function SeriesManager({ userId, myNovels }: Props) {
  const supabase = createClient()
  const [series, setSeries] = useState([] as Series[])
  const [selected, setSelected] = useState(null as Series | null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [addNovelId, setAddNovelId] = useState('')

  useEffect(() => {
    loadSeries()
  }, [userId])

  async function loadSeries() {
    const { data } = await supabase.from('series').select('*').eq('user_id', userId).order('order_num')
    setSeries(data || [])
  }

  async function loadSeriesNovels(seriesId: string) {
    const { data } = await supabase.from('series_novels')
      .select('id, novel_id, order_num, novels(id, title, genre)')
      .eq('series_id', seriesId).order('order_num')
    return data || []
  }

  async function handleNew() {
    const { data } = await supabase.from('series').insert({
      user_id: userId, title: '新しいシリーズ', description: '', order_num: series.length
    }).select().single()
    if (data) {
      setSeries(prev => [...prev, data])
      selectSeries(data)
    }
  }

  async function selectSeries(s: Series) {
    const novels = await loadSeriesNovels(s.id)
    const full = { ...s, novels }
    setSelected(full)
    setEditTitle(s.title)
    setEditDesc(s.description || '')
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('series').update({ title: editTitle, description: editDesc, updated_at: new Date().toISOString() }).eq('id', selected.id)
    if (error) { alert('保存失敗: ' + error.message); setSaving(false); return }
    setSeries(prev => prev.map(s => s.id === selected.id ? { ...s, title: editTitle, description: editDesc } : s))
    setSelected(prev => prev ? { ...prev, title: editTitle, description: editDesc } : null)
    setSaving(false)
    alert('保存しました')
  }

  async function handleDelete() {
    if (!selected || !confirm(`「${selected.title}」を削除しますか？`)) return
    await supabase.from('series').delete().eq('id', selected.id)
    setSeries(prev => prev.filter(s => s.id !== selected.id))
    setSelected(null)
  }

  async function handleAddNovel() {
    if (!selected || !addNovelId) return
    const already = (selected.novels || []).some(n => n.novel_id === addNovelId)
    if (already) { alert('すでに追加されています'); return }
    const { data } = await supabase.from('series_novels').insert({
      series_id: selected.id, novel_id: addNovelId, order_num: (selected.novels || []).length
    }).select('id, novel_id, order_num').single()
    if (data) {
      const novel = myNovels.find(n => n.id === addNovelId)
      const newEntry = { ...data, novels: novel }
      setSelected(prev => prev ? { ...prev, novels: [...(prev.novels || []), newEntry] } : null)
      setAddNovelId('')
    }
  }

  async function handleRemoveNovel(entryId: string) {
    await supabase.from('series_novels').delete().eq('id', entryId)
    setSelected(prev => prev ? { ...prev, novels: (prev.novels || []).filter(n => n.id !== entryId) } : null)
  }

  async function moveNovel(idx: number, dir: -1 | 1) {
    if (!selected) return
    const novels = [...(selected.novels || [])]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= novels.length) return
    const tmp = novels[idx]; novels[idx] = novels[swapIdx]; novels[swapIdx] = tmp
    const updated = novels.map((n, i) => ({ ...n, order_num: i }))
    setSelected(prev => prev ? { ...prev, novels: updated } : null)
    await Promise.all(updated.map(n => supabase.from('series_novels').update({ order_num: n.order_num }).eq('id', n.id)))
  }

  const inp = { width: '100%', padding: '8px 12px', border: '1.5px solid var(--color-brand-border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--color-bg-card)', color: 'var(--color-text)', boxSizing: 'border-box' as const }

  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* 左：シリーズ一覧 */}
      <div style={{ flex: '0 1 340px', minWidth: 280 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>シリーズ一覧</span>
          <button onClick={handleNew}
            style={{ height: 42, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--color-bg-card)', color: 'var(--color-brand)',
              border: '1px solid var(--color-brand)', borderRadius: 10, padding: '0 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            ＋ シリーズを作成
          </button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 14 }}>{series.length}件のシリーズ</div>

        {series.length === 0 ? (
          <div style={{ padding: '32px 20px', fontSize: 13, color: 'var(--color-text-faint)', textAlign: 'center',
            background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 16 }}>
            まだシリーズがありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {series.map(s => (
              <div key={s.id} onClick={() => selectSeries(s)}
                style={{ padding: '16px 18px', cursor: 'pointer', borderRadius: 16,
                  background: selected?.id === s.id ? '#eef5f9' : 'var(--color-bg-card)',
                  border: `1px solid ${selected?.id === s.id ? 'var(--color-brand)' : 'var(--color-brand-border)'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                {s.description && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 8,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{s.description}</div>
                )}
                <div style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                  {selected?.id === s.id ? `${(selected.novels || []).length}作品` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 詳細 */}
      {selected ? (
        <div style={{ flex: '1 1 480px', minWidth: 320, background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 20, padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>シリーズ編集</h3>
            <button onClick={handleSave} disabled={saving} style={{ marginLeft: 'auto', background: 'var(--color-brand)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 8, padding: '6px 16px', fontSize: 12, cursor: 'pointer' }}>
              {saving ? '保存中…' : '保存'}
            </button>
            <button onClick={handleDelete} style={{ background: 'none', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>削除</button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>シリーズ名</label>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inp}/>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>説明</label>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
              style={{ ...inp, resize: 'vertical' as const }} placeholder="シリーズの説明（省略可）"/>
          </div>

          {/* 作品追加 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>作品を追加</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={addNovelId} onChange={e => setAddNovelId(e.target.value)}
                style={{ ...inp, flex: 1, cursor: 'pointer' }}>
                <option value="">作品を選択</option>
                {myNovels.filter(n => !(selected.novels || []).some(sn => sn.novel_id === n.id)).map(n => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
              <button onClick={handleAddNovel} disabled={!addNovelId}
                style={{ background: 'var(--color-brand)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', opacity: addNovelId ? 1 : 0.5 }}>
                追加
              </button>
            </div>
          </div>

          {/* シリーズ内作品 */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 8 }}>シリーズの作品（{(selected.novels || []).length}件）</label>
            {(selected.novels || []).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-faint)', padding: '20px', textAlign: 'center', border: '2px dashed var(--color-brand-border)', borderRadius: 8 }}>
                作品を追加してください
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(selected.novels || []).map((sn, idx) => {
                  const novel = (sn as any).novels || myNovels.find(n => n.id === sn.novel_id)
                  return (
                    <div key={sn.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => moveNovel(idx, -1)} disabled={idx === 0}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--color-text-faint)', padding: 0, lineHeight: 1, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                        <button onClick={() => moveNovel(idx, 1)} disabled={idx === (selected.novels||[]).length - 1}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--color-text-faint)', padding: 0, lineHeight: 1, opacity: idx === (selected.novels||[]).length - 1 ? 0.3 : 1 }}>▼</button>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--color-text-faint)', minWidth: 20 }}>#{idx + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{novel?.title || '不明'}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{novel?.genre}</div>
                      </div>
                      <button onClick={() => handleRemoveNovel(sn.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: '1 1 480px', minWidth: 320, background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 20, padding: '48px 40px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          {/* 空状態：イラスト＋説明＋アクション */}
          <div style={{ textAlign: 'center', paddingBottom: 40, borderBottom: '1px solid #f4f5f3' }}>
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ marginBottom: 20 }}>
              <path d="M78 26c-14 4-28 16-34 30-4 9-5 18-4 26l-8 8a3 3 0 0 0 4 4l8-8c8 1 17 0 26-4 14-6 26-20 30-34 2-8 3-16 3-22 0-2-2-4-4-4-6 0-14 1-21 4z"
                fill="#eef2f5" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round"/>
              <path d="M74 40c-10 6-20 16-26 28" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="32" cy="34" r="2.5" fill="#4a7fa5"/>
              <circle cx="92" cy="66" r="2" fill="#4a7fa5"/>
              <circle cx="26" cy="60" r="1.8" fill="#4a7fa5"/>
            </svg>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>シリーズを選択してください</h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.9, marginBottom: 28 }}>
              選択したシリーズの詳細や、作品の並び替え・追加ができます。<br/>
              左の一覧からシリーズを選ぶか、新しくシリーズを作成しましょう。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleNew}
                style={{ height: 48, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--color-brand)', color: 'var(--color-text-inverse)',
                  border: 'none', borderRadius: 10, padding: '0 26px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                ＋ シリーズを作成
              </button>
            </div>
          </div>

          {/* シリーズとは？ */}
          <div style={{ paddingTop: 36 }}>
            <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>シリーズとは？</h4>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.9, marginBottom: 24 }}>
              関連する作品をまとめて読者にわかりやすく紹介できる機能です。<br/>
              長編の複数巻や、短編集・スピンオフなどの整理にご活用ください。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {[
                { t: '作品をまとめて管理', d: '関連作品をひとつにまとめて読者に見つけやすくします。', icon: <path d="M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5"/> },
                { t: '並び順を自由に設定', d: 'ドラッグ＆ドロップで作品の順番を並び替え可能。', icon: <><path d="M7 20V4M7 4L3 8M7 4l4 4"/><path d="M17 4v16m0 0l4-4m-4 4l-4-4"/></> },
                { t: '関連作品をつなぐ', d: '続編やスピンオフの関係を整理して管理できます。', icon: <><circle cx="9" cy="7" r="4"/><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></> },
              ].map(f => (
                <div key={f.t} style={{ background: 'var(--color-bg)', borderRadius: 14, padding: '18px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', marginBottom: 10, color: 'var(--color-brand)' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>{f.t}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
