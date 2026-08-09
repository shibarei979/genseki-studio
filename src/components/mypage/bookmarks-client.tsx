/**
 * ============================================================
 * 原石航路 Studio
 * BookmarksClient — 保存済み
 *
 * GENSEKIKORO のものを、そのまま移した。
 * 見た目は変えていない。
 *
 * 親が持っていたものを受け口にしただけ。
 * ============================================================
 */

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface Props {
  myBookmarks: any[]
  folders: any[]
  bmAuthorMap: Record<string, string>
}

export default function BookmarksClient({ myBookmarks, folders: initialFolders, bmAuthorMap }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [folders, setFolders] = useState(initialFolders)
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderInput, setFolderInput] = useState('')
  const [folderSaving, setFolderSaving] = useState(false)
  const [movingBookmark, setMovingBookmark] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState(myBookmarks)

  async function handleCreateFolder() {
    if (!folderInput.trim()) return
    setFolderSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('bookmark_folders')
      .insert({ user_id: user.id, name: folderInput.trim(), order_num: folders.length })
      .select().single()

    if (data) setFolders(prev => [...prev, data])
    setFolderInput('')
    setShowFolderModal(false)
    setFolderSaving(false)
  }

  async function handleDeleteFolder(folderId: string) {
    /* 中の作品は消さない。「未分類」へ移るだけ */
    if (!confirm('リストを削除しますか？（中の作品は「未分類」に移動します）')) return

    await supabase.from('bookmark_folders').delete().eq('id', folderId)
    setFolders(prev => prev.filter(f => f.id !== folderId))
    if (selectedFolder === folderId) setSelectedFolder('all')
  }

  async function handleMoveBookmark(novelId: string, folderId: string | null) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('bookmarks')
      .update({ folder_id: folderId })
      .eq('novel_id', novelId).eq('user_id', user.id)

    setBookmarks(prev => prev.map((bm: any) =>
      bm.novel_id === novelId ? { ...bm, folder_id: folderId } : bm))
    setMovingBookmark(null)
  }


    const listed = selectedFolder === 'all'
      ? bookmarks
      : selectedFolder === 'unclassified'
        ? bookmarks.filter((bm:any) => !bm.folder_id)
        : bookmarks.filter((bm:any) => bm.folder_id === selectedFolder)
    const currentName = selectedFolder === 'all' ? 'すべての保存済み'
      : selectedFolder === 'unclassified' ? '未分類'
      : (folders.find((f:any)=>f.id===selectedFolder)?.name || 'リスト')

    return (
    <div>
      {/* 見出し */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:32,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',letterSpacing:'-0.01em',lineHeight:1.3}}>
            保存済み作品 <span style={{fontSize:15,fontWeight:600,color:'var(--color-text-muted)'}}>（{bookmarks.length}）</span>
          </h1>
          <p style={{fontSize:14,color:'var(--color-text-muted)',marginTop:10,lineHeight:1.7}}>気になる作品をリストに保存して、あとでゆっくり読むことができます。</p>
        </div>
        <button onClick={()=>setShowFolderModal(true)}
          style={{height:44,display:'inline-flex',alignItems:'center',gap:6,padding:'0 20px',border:'1px solid var(--color-brand)',borderRadius:10,
            background:'var(--color-bg-card)',color:'var(--color-brand)',cursor:'pointer',fontWeight:600,fontSize:14}}>
          ＋ リスト作成
        </button>
      </div>

      <div style={{display:'flex',gap:24,alignItems:'flex-start',flexWrap:'wrap'}}>
        {/* 左：リストパネル */}
        <div style={{flex:'0 1 260px',minWidth:220,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'20px 8px',boxShadow:'0 1px 3px rgba(0,0,0,0.02)'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',padding:'0 14px',marginBottom:12}}>リスト</div>
          {[
            {id:'all', name:'すべての保存済み', count:bookmarks.length, deletable:false},
            ...folders.map((f:any)=>({id:f.id, name:f.name, count:bookmarks.filter((bm:any)=>bm.folder_id===f.id).length, deletable:true})),
            {id:'unclassified', name:'未分類', count:bookmarks.filter((bm:any)=>!bm.folder_id).length, deletable:false},
          ].map(item => (
            <div key={item.id}
              onClick={()=>setSelectedFolder(item.id)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'11px 14px',cursor:'pointer',borderRadius:8,
                background:selectedFolder===item.id?'#FFF0E5':'transparent',
                color:selectedFolder===item.id?'var(--color-brand)':'var(--color-text)',
                fontWeight:selectedFolder===item.id?700:500}}>
              <span style={{fontSize:13.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</span>
              <span style={{fontSize:12,color:selectedFolder===item.id?'var(--color-brand)':'var(--color-text-faint)',flexShrink:0}}>{item.count}</span>
            </div>
          ))}
          <div style={{borderTop:'1px solid #F7F2EC',marginTop:12,paddingTop:12}}>
            <button onClick={()=>setShowFolderModal(true)}
              style={{width:'100%',textAlign:'left' as const,padding:'8px 14px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--color-brand)',fontWeight:600}}>
              ＋ リストを作成
            </button>
            {selectedFolder!=='all' && selectedFolder!=='unclassified' && (
              <button onClick={()=>{ handleDeleteFolder(selectedFolder); setSelectedFolder('all') }}
                style={{width:'100%',textAlign:'left' as const,padding:'8px 14px',background:'none',border:'none',cursor:'pointer',fontSize:12.5,color:'var(--color-text-faint)'}}>
                このリストを削除
              </button>
            )}
          </div>
        </div>

        {/* 右：作品一覧 */}
        <div style={{flex:'1 1 520px',minWidth:300}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
            <span style={{fontSize:16,fontWeight:700,color:'var(--color-text)'}}>{currentName}</span>
            <span style={{fontSize:13,color:'var(--color-text-muted)'}}>（{listed.length}）</span>
          </div>

          {listed.length === 0 ? (
            <div style={{textAlign:'center',padding:'64px 24px',color:'var(--color-text-faint)',fontSize:14,
              background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:20}}>
              このリストに作品がありません
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {listed.map((bm:any) => {
                const n = bm.novels; if (!n) return null
                const authorName = bmAuthorMap[n.author_id] || ''
                return (
                  <div key={bm.novel_id}
                    style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:20,padding:'24px 28px',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.02)',display:'grid',gridTemplateColumns:'minmax(0,1fr) 180px',gap:28,alignItems:'center'}}>
                    <div style={{minWidth:0,cursor:'pointer'}} onClick={()=>router.push(`/novel/${n.id}`)}>
                      <div style={{fontSize:19,fontWeight:700,color:'var(--color-text)',lineHeight:1.4,marginBottom:6,overflowWrap:'anywhere' as any}}>{n.title}</div>
                      <div style={{fontSize:13,color:'var(--color-text-muted)',marginBottom:12}}>{authorName}</div>
                      {n.summary && (
                        <p style={{fontSize:13.5,color:'var(--color-text-muted)',lineHeight:1.8,marginBottom:14,maxWidth:600,
                          display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,overflow:'hidden',overflowWrap:'anywhere' as any}}>{n.summary}</p>
                      )}
                      <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
                        <span style={{fontSize:11.5,height:22,display:'inline-flex',alignItems:'center',background:'#FFF0E5',color:'var(--color-brand)',padding:'0 10px',borderRadius:6,fontWeight:600}}>{n.genre}</span>
                        {n.novel_type && <span style={{fontSize:11.5,height:22,display:'inline-flex',alignItems:'center',background:'#EEF4FF',color:'#2563eb',padding:'0 10px',borderRadius:6,fontWeight:600}}>{n.novel_type}</span>}
                        {n.is_serial
                          ? <span style={{fontSize:11.5,height:22,display:'inline-flex',alignItems:'center',background:'#EAF8EF',color:'#35a45d',padding:'0 10px',borderRadius:6,fontWeight:600}}>連載中</span>
                          : <span style={{fontSize:11.5,height:22,display:'inline-flex',alignItems:'center',background:'#F4F4F5',color:'#71717a',padding:'0 10px',borderRadius:6,fontWeight:600}}>完結</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'stretch'}}>
                      <Link href={`/novel/${n.id}`}
                        style={{height:44,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'var(--color-brand)',color:'var(--color-text-inverse)',
                          borderRadius:10,fontSize:14,fontWeight:600,textDecoration:'none'}}>
                        続きを読む
                      </Link>
                      <select
                        value={bm.folder_id||''}
                        onChange={e=>handleMoveBookmark(bm.novel_id,e.target.value||null)}
                        style={{height:40,padding:'0 12px',border:'1px solid #EADFD4',borderRadius:10,background:'var(--color-bg-card)',color:'var(--color-text-muted)',cursor:'pointer',fontSize:12.5}}>
                        <option value=''>未分類</option>
                        {folders.map((f:any)=>(<option key={f.id} value={f.id}>{f.name}</option>))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showFolderModal && (
        <FolderCreateModal
          onClose={()=>setShowFolderModal(false)}
          onCreate={async(name:string)=>{
            setFolderInput(name)
            await handleCreateFolder()
          }}
          saving={folderSaving}
        />
      )}
    </div>
    )
  }

  // ===== 閲覧履歴タブ =====
  const HistoryTab = () => {
}


/**
 * リストを作る窓。
 * GENSEKIKORO のものをそのまま移した。
 */
function FolderCreateModal({
  onClose, onCreate, saving,
}: { onClose:()=>void; onCreate:(name:string)=>void; saving:boolean }) {
  const [name, setName] = useState('')

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:24,maxWidth:360,width:'100%'}}>
        <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:12}}>リストを作成</div>
        <input
          type="text"
          value={name}
          onChange={e=>setName(e.target.value)}
          placeholder="リスト名"
          style={{width:'100%',padding:'9px 12px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13,outline:'none',marginBottom:12,boxSizing:'border-box' as const,fontFamily:'inherit',background:'var(--color-bg-card)',color:'var(--color-text)'}}
        />
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose}
            style={{flex:1,padding:'9px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>
            キャンセル
          </button>
          <button onClick={()=>onCreate(name.trim())} disabled={saving||!name.trim()}
            style={{flex:1,padding:'9px',border:'none',borderRadius:8,background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,cursor:'pointer',opacity:saving||!name.trim()?0.5:1}}>
            {saving?'作成中...':'作成'}
          </button>
        </div>
      </div>
    </div>
  )
}
