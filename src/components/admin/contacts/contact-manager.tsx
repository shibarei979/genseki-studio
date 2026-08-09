'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Contact {
  id: string; name: string; email: string; category: string; body: string
  user_id: string | null; is_read: boolean; admin_note: string | null; created_at: string
}

const btn = (color: string, bg: string, border: string) => ({
  padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',
  color,background:bg,border:`1px solid ${border}`,
})

export default function ContactManager({ initialContacts }: { initialContacts: Contact[] }) {
  const supabase = createClient()
  const [items, setItems] = useState(initialContacts)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all'|'unread'|'read'>('all')

  const filtered = items.filter(c =>
    filter === 'all' ? true : filter === 'unread' ? !c.is_read : c.is_read
  )

  async function handleSelect(c: Contact) {
    setSelected(c)
    setNote(c.admin_note || '')
    // 未読なら既読にする
    if (!c.is_read) {
      await supabase.from('contact_messages').update({ is_read: true }).eq('id', c.id)
      setItems(prev => prev.map(i => i.id === c.id ? {...i, is_read: true} : i))
      setSelected({...c, is_read: true})
    }
  }

  async function handleSaveNote() {
    if (!selected) return
    setSaving(true)
    await supabase.from('contact_messages').update({ admin_note: note }).eq('id', selected.id)
    setItems(prev => prev.map(i => i.id === selected.id ? {...i, admin_note: note} : i))
    setSelected(prev => prev ? {...prev, admin_note: note} : null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('contact_messages').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function toggleRead(c: Contact) {
    await supabase.from('contact_messages').update({ is_read: !c.is_read }).eq('id', c.id)
    setItems(prev => prev.map(i => i.id === c.id ? {...i, is_read: !c.is_read} : i))
    if (selected?.id === c.id) setSelected({...c, is_read: !c.is_read})
  }

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}>
      {/* 左：一覧 */}
      <div>
        {/* フィルター */}
        <div style={{display:'flex',gap:6,marginBottom:12}}>
          {(['all','unread','read'] as const).map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              style={{...btn(filter===f?'var(--base-color-1)':'#64748b', filter===f?'var(--color-brand)':'var(--base-color-1)', filter===f?'var(--color-brand)':'#e2e8f0'),fontSize:11}}>
              {f==='all'?`すべて(${items.length})`:f==='unread'?`未読(${items.filter(c=>!c.is_read).length})`:`既読(${items.filter(c=>c.is_read).length})`}
            </button>
          ))}
        </div>

        <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'48px',textAlign:'center',color:'#94a3b8',fontSize:13}}>問い合わせがありません</div>
          ) : filtered.map((c, idx) => (
            <div key={c.id}
              onClick={() => handleSelect(c)}
              style={{
                padding:'12px 16px',
                borderBottom: idx < filtered.length-1 ? '1px solid #f1f5f9' : 'none',
                cursor:'pointer',
                background: selected?.id === c.id ? 'var(--color-brand-light)' : c.is_read ? 'var(--base-color-1)' : '#fefce8',
                borderLeft: selected?.id === c.id ? '3px solid var(--color-brand)' : '3px solid transparent',
              }}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                {!c.is_read && <span style={{width:7,height:7,borderRadius:'50%',background:'#ef4444',flexShrink:0,display:'inline-block'}}/>}
                <span style={{fontSize:12,fontWeight:700,color:'#1e293b',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                <span style={{fontSize:10,color:'#94a3b8',flexShrink:0}}>{new Date(c.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
              <div style={{fontSize:11,color:'#64748b',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.category}</div>
              <div style={{fontSize:11,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.body.replace(/\n/g,' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 右：詳細 */}
      <div>
        {selected ? (
          <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid #f1f5f9',background:'#f8fafc',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#1e293b'}}>問い合わせ詳細</div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>toggleRead(selected)}
                  style={btn(selected.is_read?'#4a7fa5':'#10b981',selected.is_read?'#fffbeb':'#f0fdf4',selected.is_read?'#fde68a':'#86efac')}>
                  {selected.is_read?'未読に戻す':'既読にする'}
                </button>
                <button onClick={()=>handleDelete(selected.id)} style={btn('#dc2626','#fef2f2','#fca5a5')}>削除</button>
              </div>
            </div>
            <div style={{padding:'16px'}}>
              {[
                ['お名前', selected.name],
                ['メール', selected.email],
                ['カテゴリ', selected.category],
                ['送信日時', new Date(selected.created_at).toLocaleString('ja-JP')],
              ].map(([label, val]) => (
                <div key={label} style={{display:'flex',gap:12,marginBottom:10,alignItems:'flex-start'}}>
                  <div style={{fontSize:11,color:'#64748b',fontWeight:600,width:80,flexShrink:0}}>{label}</div>
                  <div style={{fontSize:12,color:'#1e293b',flex:1,wordBreak:'break-all'}}>{val}</div>
                </div>
              ))}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:'#64748b',fontWeight:600,marginBottom:6}}>本文</div>
                <div style={{fontSize:12,color:'#1e293b',lineHeight:1.8,whiteSpace:'pre-wrap',background:'#f8fafc',padding:'12px',borderRadius:8,border:'1px solid #f1f5f9'}}>
                  {selected.body}
                </div>
              </div>
              {/* 管理メモ */}
              <div>
                <div style={{fontSize:11,color:'#64748b',fontWeight:600,marginBottom:6}}>管理メモ（内部用）</div>
                <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
                  placeholder="対応状況などをメモできます"
                  style={{width:'100%',padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,resize:'vertical',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:6}}>
                  <button onClick={handleSaveNote} disabled={saving}
                    style={{...btn('var(--base-color-1)','var(--color-brand)','var(--color-brand)'),opacity:saving?0.6:1}}>
                    {saving?'保存中...':'メモを保存'}
                  </button>
                </div>
              </div>
              {/* 返信リンク */}
              <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #f1f5f9'}}>
                <a href={`mailto:${selected.email}?subject=【原石航路】お問い合わせへの回答&body=この度はお問い合わせいただきありがとうございます。%0A%0A`}
                  style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:'#3b82f6',textDecoration:'none',border:'1px solid #bfdbfe',padding:'6px 14px',borderRadius:8,background:'#eff6ff'}}>
                  ✉️ メールで返信する
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,padding:'48px',textAlign:'center',color:'#94a3b8',fontSize:13}}>
            左の一覧から問い合わせを選択してください
          </div>
        )}
      </div>
    </div>
  )
}
