'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Chapter { id: string; title: string; order_num: number }
interface Episode { id: string; title: string; ep_number: number; chapter_id: string | null }

interface Props {
  novelId: string
  novelTitle: string
  onClose: () => void
}

export default function ChapterEditModal({ novelId, novelTitle, onClose }: Props) {
  const supabase = createClient()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    loadData()
  }, [novelId])

  async function loadData() {
    setLoading(true)
    const [{ data: chData }, { data: epData }] = await Promise.all([
      /*
       * 章は chapters（箱A）から読む。
       *
       * 前は novel_chapters（箱B）を読んでいた。
       * 執筆画面は箱Aを使うので、そちらで作った章が
       * この画面に出ず、「章がありません」と出ていた。
       *
       * 並びの列名も違う。箱Bは order_num、箱Aは sort_order。
       */
      supabase.from('chapters').select('id, novel_id, title, sort_order, parent_id, is_part')
        .eq('novel_id', novelId).order('sort_order', { ascending: true }),
      supabase.from('episodes').select('id,title,ep_number,chapter_id').eq('novel_id', novelId).order('ep_number', { ascending: true }),
    ])
    /*
     * この画面は order_num という名前で並びを持っている。
     * 箱Aは sort_order なので、読んだところで詰め替える。
     * 画面の側を全部書き換えるより、入口でそろえるほうが安全。
     */
    setChapters((chData || []).map((c: any) => ({ ...c, order_num: c.sort_order })))
    setEpisodes(epData || [])
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function handleAddChapter() {
    if (!newChapterTitle.trim()) return
    setAdding(true)
    const maxOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order_num)) : 0
    const { data, error } = await supabase.from('chapters').insert({
      novel_id: novelId,
      title: newChapterTitle.trim(),
      sort_order: maxOrder + 1,
    }).select().single()
    setAdding(false)
    if (!error && data) {
      setChapters(prev => [...prev, { ...data, order_num: data.sort_order }])
      setNewChapterTitle('')
      showToast('章を追加しました')
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    if (!confirm('この章を削除しますか？所属する話は「未分類」に戻ります。')) return
    await supabase.from('episodes').update({ chapter_id: null }).eq('chapter_id', chapterId)
    await supabase.from('chapters').delete().eq('id', chapterId)
    setChapters(prev => prev.filter(c => c.id !== chapterId))
    setEpisodes(prev => prev.map(e => e.chapter_id === chapterId ? { ...e, chapter_id: null } : e))
    showToast('章を削除しました')
  }

  async function handleRenameChapter(chapterId: string) {
    if (!editingTitle.trim()) { setEditingChapterId(null); return }
    await supabase.from('chapters').update({ title: editingTitle.trim() }).eq('id', chapterId)
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, title: editingTitle.trim() } : c))
    setEditingChapterId(null)
    showToast('章名を変更しました')
  }

  async function handleAssignEpisode(epId: string, chapterId: string | null) {
    await supabase.from('episodes').update({ chapter_id: chapterId }).eq('id', epId)
    setEpisodes(prev => prev.map(e => e.id === epId ? { ...e, chapter_id: chapterId } : e))
  }

  async function moveChapter(chapterId: string, direction: 'up' | 'down') {
    const idx = chapters.findIndex(c => c.id === chapterId)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= chapters.length) return
    const a = chapters[idx], b = chapters[targetIdx]
    await Promise.all([
      supabase.from('chapters').update({ sort_order: b.order_num }).eq('id', a.id),
      supabase.from('chapters').update({ sort_order: a.order_num }).eq('id', b.id),
    ])
    const next = [...chapters]
    next[idx] = { ...a, order_num: b.order_num }
    next[targetIdx] = { ...b, order_num: a.order_num }
    next.sort((x, y) => x.order_num - y.order_num)
    setChapters(next)
  }

  const unassigned = episodes.filter(e => !e.chapter_id)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:'var(--color-bg-card)',borderRadius:16,maxWidth:560,width:'100%',maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>

        {/* ヘッダー */}
        <div style={{padding:'18px 24px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)',borderRadius:'16px 16px 0 0'}}>
          <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',marginBottom:2}}>章・編管理</div>
          <div style={{fontSize:12,color:'var(--color-text-muted)'}}>{novelTitle}</div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
          {loading ? (
            <div style={{textAlign:'center',padding:40,color:'var(--color-text-faint)',fontSize:13}}>読み込み中...</div>
          ) : (
            <>
              {/* 章追加 */}
              <div style={{display:'flex',gap:8,marginBottom:20}}>
                <input value={newChapterTitle} onChange={e=>setNewChapterTitle(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')handleAddChapter()}}
                  placeholder="例：第一章 序章"
                  style={{flex:1,padding:'9px 12px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13,outline:'none'}}/>
                <button onClick={handleAddChapter} disabled={adding||!newChapterTitle.trim()}
                  style={{padding:'9px 18px',background:newChapterTitle.trim()?'var(--color-brand)':'var(--color-brand-border)',color:'var(--color-bg-card)',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:newChapterTitle.trim()?'pointer':'not-allowed',whiteSpace:'nowrap'}}>
                  ＋ 章を追加
                </button>
              </div>

              {/* 章一覧 */}
              {chapters.length === 0 ? (
                <div style={{textAlign:'center',padding:'24px',color:'var(--color-text-faint)',fontSize:12,background:'var(--color-bg)',borderRadius:10,marginBottom:16}}>
                  まだ章がありません。上のフォームから追加してください。
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
                  {chapters.map((chapter, i) => {
                    const chEpisodes = episodes.filter(e => e.chapter_id === chapter.id)
                    return (
                      <div key={chapter.id} style={{border:'1.5px solid var(--color-brand-border)',borderRadius:10,overflow:'hidden'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'var(--color-brand-light)',borderBottom: chEpisodes.length>0 ? '1px solid var(--color-brand-border)' : 'none'}}>
                          <div style={{display:'flex',flexDirection:'column',gap:2}}>
                            <button onClick={()=>moveChapter(chapter.id,'up')} disabled={i===0}
                              style={{width:18,height:14,border:'none',background:'none',cursor:i===0?'default':'pointer',color:i===0?'var(--color-brand-border)':'var(--color-text-muted)',fontSize:10,padding:0}}>▲</button>
                            <button onClick={()=>moveChapter(chapter.id,'down')} disabled={i===chapters.length-1}
                              style={{width:18,height:14,border:'none',background:'none',cursor:i===chapters.length-1?'default':'pointer',color:i===chapters.length-1?'var(--color-brand-border)':'var(--color-text-muted)',fontSize:10,padding:0}}>▼</button>
                          </div>
                          {editingChapterId === chapter.id ? (
                            <input value={editingTitle} onChange={e=>setEditingTitle(e.target.value)}
                              onKeyDown={e=>{if(e.key==='Enter')handleRenameChapter(chapter.id);if(e.key==='Escape')setEditingChapterId(null)}}
                              onBlur={()=>handleRenameChapter(chapter.id)}
                              autoFocus
                              style={{flex:1,padding:'4px 8px',border:'1.5px solid var(--color-brand)',borderRadius:6,fontSize:13,outline:'none'}}/>
                          ) : (
                            <div onClick={()=>{setEditingChapterId(chapter.id);setEditingTitle(chapter.title)}}
                              style={{flex:1,fontSize:13,fontWeight:700,color:'var(--color-text)',cursor:'pointer'}}>
                              {chapter.title}
                            </div>
                          )}
                          <span style={{fontSize:11,color:'var(--color-text-faint)',whiteSpace:'nowrap'}}>{chEpisodes.length}話</span>
                          <button onClick={()=>handleDeleteChapter(chapter.id)}
                            style={{fontSize:11,padding:'3px 8px',border:'1px solid #fca5a5',borderRadius:6,background:'var(--color-bg-card)',color:'var(--color-danger)',cursor:'pointer'}}>削除</button>
                        </div>
                        {chEpisodes.length > 0 && (
                          <div style={{padding:'8px 14px'}}>
                            {chEpisodes.map(ep => (
                              <div key={ep.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0'}}>
                                <span style={{fontSize:12,color:'var(--color-text)',flex:1}}>{ep.title}</span>
                                <select value={ep.chapter_id || ''} onChange={e=>handleAssignEpisode(ep.id, e.target.value || null)}
                                  style={{fontSize:11,padding:'3px 6px',border:'1px solid var(--color-brand-border)',borderRadius:6,color:'var(--color-text-muted)',background:'var(--color-bg-card)'}}>
                                  <option value="">未分類にする</option>
                                  {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 未分類の話 */}
              {unassigned.length > 0 && (
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--color-text-muted)',marginBottom:8}}>未分類の話（{unassigned.length}）</div>
                  <div style={{border:'1.5px dashed var(--color-brand-border)',borderRadius:10,padding:'8px 14px'}}>
                    {unassigned.map(ep => (
                      <div key={ep.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0'}}>
                        <span style={{fontSize:12,color:'var(--color-text)',flex:1}}>{ep.title}</span>
                        {chapters.length > 0 ? (
                          <select value="" onChange={e=>handleAssignEpisode(ep.id, e.target.value || null)}
                            style={{fontSize:11,padding:'3px 6px',border:'1px solid var(--color-brand-border)',borderRadius:6,color:'var(--color-text-muted)',background:'var(--color-bg-card)'}}>
                            <option value="">章を選択...</option>
                            {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                          </select>
                        ) : (
                          <span style={{fontSize:11,color:'var(--color-text-faint)'}}>章を作成してください</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{padding:'16px 24px',borderTop:'1px solid var(--color-brand-border)'}}>
          <button onClick={onClose} style={{width:'100%',padding:'11px',border:'none',borderRadius:10,background:'var(--color-brand)',color:'var(--color-bg-card)',fontSize:14,fontWeight:700,cursor:'pointer'}}>
            完了
          </button>
        </div>

        {toast && (
          <div style={{position:'absolute',bottom:70,left:'50%',transform:'translateX(-50%)',background:'var(--color-text)',color:'var(--color-bg-card)',padding:'8px 18px',borderRadius:20,fontSize:12,fontWeight:600}}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
