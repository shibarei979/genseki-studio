'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Item {
  user_id: string
  novel_id: string
  novel_title: string
  comment: string
  display_name: string
  pending_reason: string
  created_at: string
}

const btn = (color: string, bg: string, border: string) => ({
  padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',
  color,background:bg,border:`1px solid ${border}`,
})

export default function DiscoverManager({ initialItems }: { initialItems: Item[] }) {
  const supabase = createClient()
  const [items, setItems] = useState(initialItems)

  async function handleApprove(item: Item) {
    // is_pending を false にして公開
    await supabase.from('discovers')
      .update({ is_pending: false, pending_reason: null })
      .eq('user_id', item.user_id)
      .eq('novel_id', item.novel_id)
    setItems(prev => prev.filter(i => !(i.user_id === item.user_id && i.novel_id === item.novel_id)))
  }

  async function handleReject(item: Item) {
    // コメントを削除
    await supabase.from('discovers')
      .delete()
      .eq('user_id', item.user_id)
      .eq('novel_id', item.novel_id)
    setItems(prev => prev.filter(i => !(i.user_id === item.user_id && i.novel_id === item.novel_id)))
  }

  if (items.length === 0) {
    return (
      <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,padding:'48px',textAlign:'center',color:'#94a3b8',fontSize:13}}>
        審査待ちのコメントはありません
      </div>
    )
  }

  return (
    <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
      {items.map((item, idx) => (
        <div key={`${item.user_id}-${item.novel_id}`}
          style={{padding:'16px 20px',borderBottom:idx<items.length-1?'1px solid #f1f5f9':'none'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              {/* 作品名・投稿者 */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>{item.display_name}</span>
                <span style={{fontSize:11,color:'#94a3b8'}}>→</span>
                <span style={{fontSize:11,color:'var(--color-brand)',fontWeight:600}}>「{item.novel_title}」</span>
                <span style={{fontSize:10,color:'#94a3b8',marginLeft:'auto'}}>{new Date(item.created_at).toLocaleString('ja-JP')}</span>
              </div>
              {/* コメント本文 */}
              <div style={{fontSize:13,color:'#374151',lineHeight:1.7,padding:'10px 14px',background:'#f8fafc',borderRadius:8,marginBottom:6,borderLeft:'3px solid #e2e8f0'}}>
                「{item.comment}」
              </div>
              {/* 審査理由 */}
              {item.pending_reason && (
                <div style={{fontSize:11,color:'#ef4444',display:'flex',alignItems:'center',gap:4}}>
                  <span>⚠️</span>
                  <span>AIによる判定理由：{item.pending_reason}</span>
                </div>
              )}
            </div>
            {/* ボタン */}
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button onClick={()=>handleApprove(item)} style={btn('#10b981','#f0fdf4','#86efac')}>
                ✓ 承認
              </button>
              <button onClick={()=>handleReject(item)} style={btn('#dc2626','#fef2f2','#fca5a5')}>
                × 却下
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
