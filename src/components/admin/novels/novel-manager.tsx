'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Novel { id: string; title: string; genre: string; display_name: string; published: boolean; is_r18: boolean; created_at: string; aims_publishing?: boolean; official_tags?: string[] }

const btn = (color: string, bg: string, border: string) => ({
  padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',color,background:bg,border:`1px solid ${border}`,
})

export default function NovelManager({ initialNovels, total, currentPage, q, publishingOnly }: { initialNovels: Novel[]; total: number; currentPage: number; q: string; publishingOnly?: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [novels, setNovels] = useState(initialNovels)
  const [tagModal, setTagModal] = useState(null as Novel | null)
  const [tagInput, setTagInput] = useState('')
  const [notifySending, setNotifySending] = useState(false)
  const [search, setSearch] = useState(q)

  async function togglePublish(n: Novel) {
    await supabase.from('novels').update({ published: !n.published }).eq('id', n.id)
    setNovels(novels.map(x => x.id === n.id ? {...x, published: !n.published} : x))
  }


  const PRESET_TAGS = ['受賞作', '月間賞', '編集部イチオシ', '特別賞', '読者賞', '新人賞']

  async function handleTagSave(novel: Novel, tags: string[]) {
    await supabase.from('novels').update({ official_tags: tags }).eq('id', novel.id)
    setNovels(novels.map(x => x.id === novel.id ? { ...x, official_tags: tags } : x))
    if (tagModal?.id === novel.id) setTagModal({ ...tagModal, official_tags: tags })
  }

  async function handleDelete(n: Novel) {
    if (!confirm(`「${n.title}」を削除しますか？この操作は取り消せません。`)) return
    await supabase.from('novels').delete().eq('id', n.id)
    setNovels(novels.filter(x => x.id !== n.id))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/admin/novels?q=${encodeURIComponent(search)}${publishingOnly?'&publishing=1':''}`)
  }

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>


      {/* タグ付けモーダル */}
      {tagModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:'24px',maxWidth:460,width:'100%',boxShadow:'0 8px 32px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:15,fontWeight:800,color:'#1e293b',marginBottom:4}}>運営タグの設定</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:16,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tagModal.title}</div>
            {/* プリセット */}
            <div style={{fontSize:11,fontWeight:700,color:'#64748b',marginBottom:8}}>プリセットタグ</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
              {PRESET_TAGS.map(tag => {
                const active = (tagModal.official_tags||[]).includes(tag)
                return (
                  <button key={tag} onClick={() => {
                    const cur = tagModal.official_tags || []
                    const next = active ? cur.filter(t=>t!==tag) : [...cur, tag]
                    setTagModal({...tagModal, official_tags: next})
                  }}
                  style={{padding:'4px 12px',borderRadius:16,fontSize:12,fontWeight:600,cursor:'pointer',border:'1.5px solid',borderColor:active?'var(--color-brand)':'#e2e8f0',background:active?'var(--color-brand-light)':'var(--base-color-1)',color:active?'var(--color-brand)':'#64748b'}}>
                    {active ? '✓ ' : ''}{tag}
                  </button>
                )
              })}
            </div>
            {/* カスタムタグ入力 */}
            <div style={{fontSize:11,fontWeight:700,color:'#64748b',marginBottom:8}}>カスタムタグ（コンテスト名など）</div>
            <div style={{display:'flex',gap:6,marginBottom:10}}>
              <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();const next=[...(tagModal.official_tags||[]),tagInput.trim()];setTagModal({...tagModal,official_tags:next});setTagInput('')}}}
                placeholder="コンテスト名など入力してEnter"
                style={{flex:1,padding:'7px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,outline:'none'}}/>
              <button onClick={()=>{if(tagInput.trim()){const next=[...(tagModal.official_tags||[]),tagInput.trim()];setTagModal({...tagModal,official_tags:next});setTagInput('')}}}
                style={{padding:'7px 14px',background:'var(--color-brand)',color:'var(--color-text-inverse)',border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>追加</button>
            </div>
            {/* 現在のタグ */}
            {(tagModal.official_tags||[]).length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:16}}>
                {(tagModal.official_tags||[]).map(tag=>(
                  <span key={tag} style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid #f5b080',padding:'2px 10px',borderRadius:12,fontSize:12}}>
                    {tag}
                    <button onClick={()=>setTagModal({...tagModal,official_tags:(tagModal.official_tags||[]).filter(t=>t!==tag)})}
                      style={{background:'none',border:'none',cursor:'pointer',color:'#f5a060',fontSize:14,padding:0,lineHeight:1}}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setTagModal(null)} style={btn('#64748b','var(--base-color-1)','#e2e8f0')}>キャンセル</button>
              <button onClick={()=>{handleTagSave(tagModal,tagModal.official_tags||[]);setTagModal(null)}}
                style={btn('var(--base-color-1)','var(--color-brand)','var(--color-brand)')}>保存</button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSearch} style={{display:'flex',gap:8,marginBottom:16}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="作品名で検索"
          style={{flex:1,padding:'8px 14px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13}}/>
        <button type="submit" style={{...btn('var(--base-color-1)','var(--color-brand)','var(--color-brand)'),padding:'8px 20px',fontSize:13}}>検索</button>
      </form>

      <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
        {novels.length === 0 ? (
          <div style={{padding:'48px',textAlign:'center',color:'#94a3b8',fontSize:13}}>作品が見つかりません</div>
        ) : novels.map((n, idx) => (
          <div key={n.id} style={{padding:'12px 16px',borderBottom:idx<novels.length-1?'1px solid #f1f5f9':'none',display:'flex',alignItems:'center',gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2,flexWrap:'wrap'}}>
                <span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid #f5b080',padding:'1px 5px',borderRadius:3}}>{n.genre}</span>
                {n.is_r18 && <span style={{fontSize:10,background:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',padding:'1px 5px',borderRadius:3}}>R18</span>}
                {!n.published && <span style={{fontSize:10,background:'#f1f5f9',color:'#94a3b8',padding:'1px 5px',borderRadius:3}}>非公開</span>}
                {n.aims_publishing && <span style={{fontSize:10,background:'#fefce8',color:'#854d0e',border:'1px solid #fde047',padding:'1px 5px',borderRadius:3,fontWeight:700}}>書籍化希望</span>}
                {(n.official_tags||[]).map(tag=><span key={tag} style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid #f5b080',padding:'1px 5px',borderRadius:3,fontWeight:700}}>{tag}</span>)}
              </div>
              <Link href={`/novel/${n.id}`} target="_blank" style={{fontSize:13,fontWeight:600,color:'#1e293b',textDecoration:'none'}}>{n.title}</Link>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>作者：{n.display_name} · {new Date(n.created_at).toLocaleDateString('ja-JP')}</div>
            </div>
            <div style={{display:'flex',gap:4,flexShrink:0}}>
              <button onClick={()=>setTagModal(n)} style={btn('var(--color-brand)','var(--color-brand-light)','#f5b080')}>タグ</button>
              <button onClick={()=>togglePublish(n)} style={btn(n.published?'#4a7fa5':'#10b981',n.published?'#fffbeb':'#f0fdf4',n.published?'#fde68a':'#86efac')}>
                {n.published?'非公開':'公開'}
              </button>
              <button onClick={()=>handleDelete(n)} style={btn('#dc2626','#fef2f2','#fca5a5')}>削除</button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:16}}>
          {currentPage > 1 && <a href={`/admin/novels?q=${q}&page=${currentPage-1}${publishingOnly?'&publishing=1':''}`} style={{padding:'6px 16px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,color:'var(--color-brand)',textDecoration:'none',background:'var(--color-bg-card)'}}>‹ 前へ</a>}
          <span style={{padding:'6px 12px',fontSize:13,color:'#64748b'}}>{currentPage} / {totalPages}</span>
          {currentPage < totalPages && <a href={`/admin/novels?q=${q}&page=${currentPage+1}${publishingOnly?'&publishing=1':''}`} style={{padding:'6px 16px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,color:'var(--color-brand)',textDecoration:'none',background:'var(--color-bg-card)'}}>次へ ›</a>}
        </div>
      )}
    </div>
  )
}
