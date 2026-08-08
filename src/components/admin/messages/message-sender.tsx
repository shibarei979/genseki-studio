'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface User { user_id: string; display_name: string; email: string; icon_url: string | null }
interface Message { id: string; to_user_id: string; to_name: string; to_email: string; subject: string; body: string; is_read: boolean; created_at: string }

const btn = (color: string, bg: string, border: string) => ({
  padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',
  color,background:bg,border:`1px solid ${border}`,
})

export default function MessageSender({ users, sentMessages: initialMessages }: { users: User[]; sentMessages: Message[] }) {
  const supabase = createClient()
  const [messages, setMessages]   = useState(initialMessages)
  const [toUserId, setToUserId]   = useState('')
  const [subject,  setSubject]    = useState('')
  const [body,     setBody]       = useState('')
  const [search,   setSearch]     = useState('')
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState('')
  const [sent,     setSent]       = useState(false)
  const [selected, setSelected]   = useState<Message | null>(null)

  const filteredUsers = users.filter(u =>
    u.display_name?.includes(search) || u.email?.includes(search)
  )

  async function handleSend() {
    setError('')
    if (!toUserId) { setError('送信先を選択してください'); return }
    if (!subject.trim()) { setError('件名を入力してください'); return }
    if (body.trim().length < 5) { setError('本文を5文字以上入力してください'); return }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('admin_messages')
      .insert({ to_user_id: toUserId, subject: subject.trim(), body: body.trim() })
      .select().single()
    setLoading(false)

    if (err) { setError('送信に失敗しました'); return }

    // 通知も送る
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: toUserId,
        type: 'admin',
        message: `【運営からのお知らせ】${subject.trim()}`,
        link: '/mypage/messages',
      })
    })

    const toUser = users.find(u => u.user_id === toUserId)
    const newMsg: Message = {
      ...data,
      to_name: toUser?.display_name || '不明',
      to_email: toUser?.email || '',
    }
    setMessages(prev => [newMsg, ...prev])
    setToUserId(''); setSubject(''); setBody(''); setSearch('')
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}>
      {/* 左：送信フォーム */}
      <div>
        <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,padding:'20px',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:'#1e293b',marginBottom:16}}>メッセージを送信</div>

          {/* ユーザー検索・選択 */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:'#64748b',fontWeight:600,display:'block',marginBottom:4}}>送信先ユーザー <span style={{color:'#ef4444'}}>*</span></label>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="名前またはメールで検索..."
              style={{width:'100%',padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,outline:'none',boxSizing:'border-box',marginBottom:6}}
            />
            <div style={{maxHeight:160,overflowY:'auto',border:'1px solid #e2e8f0',borderRadius:8}}>
              {filteredUsers.slice(0,30).map(u => (
                <div key={u.user_id}
                  onClick={()=>{setToUserId(u.user_id);setSearch(u.display_name)}}
                  style={{
                    padding:'8px 12px',cursor:'pointer',fontSize:12,
                    display:'flex',alignItems:'center',gap:8,
                    background: toUserId===u.user_id ? 'var(--color-brand-light)' : 'var(--base-color-1)',
                    borderBottom:'1px solid #f1f5f9',
                  }}>
                  {u.icon_url
                    ? <img src={u.icon_url} style={{width:22,height:22,borderRadius:'50%',objectFit:'cover'}} alt=""/>
                    : <div style={{width:22,height:22,borderRadius:'50%',background:'var(--color-brand-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'var(--color-brand)',fontWeight:700}}>{u.display_name?.[0]}</div>
                  }
                  <div>
                    <div style={{fontWeight:600,color: toUserId===u.user_id?'var(--color-brand)':'#1e293b'}}>{u.display_name}</div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>{u.email}</div>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div style={{padding:'16px',textAlign:'center',color:'#94a3b8',fontSize:12}}>該当するユーザーがいません</div>
              )}
            </div>
          </div>

          {/* 件名 */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:'#64748b',fontWeight:600,display:'block',marginBottom:4}}>件名 <span style={{color:'#ef4444'}}>*</span></label>
            <input
              value={subject}
              onChange={e=>{setSubject(e.target.value);setError('')}}
              placeholder="件名を入力..."
              style={{width:'100%',padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box'}}
            />
          </div>

          {/* 本文 */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:'#64748b',fontWeight:600,display:'block',marginBottom:4}}>本文 <span style={{color:'#ef4444'}}>*</span></label>
            <textarea
              value={body}
              onChange={e=>{setBody(e.target.value);setError('')}}
              rows={6}
              placeholder="メッセージ本文を入力..."
              style={{width:'100%',padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,outline:'none',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}}
            />
          </div>

          {error && <div style={{fontSize:11,color:'#ef4444',marginBottom:8}}>{error}</div>}
          {sent  && <div style={{fontSize:11,color:'#10b981',marginBottom:8}}>✓ 送信しました</div>}

          <button onClick={handleSend} disabled={loading}
            style={{...btn('var(--base-color-1)','var(--color-brand)','var(--color-brand)'),width:'100%',padding:'10px',fontSize:13,opacity:loading?0.6:1}}>
            {loading?'送信中...':'送信する'}
          </button>
        </div>
      </div>

      {/* 右：送信履歴 */}
      <div>
        <div style={{fontSize:13,fontWeight:700,color:'#1e293b',marginBottom:12}}>送信履歴（{messages.length}件）</div>
        <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
          {messages.length === 0 ? (
            <div style={{padding:'48px',textAlign:'center',color:'#94a3b8',fontSize:13}}>送信履歴がありません</div>
          ) : messages.map((m, idx) => (
            <div key={m.id}
              onClick={()=>setSelected(selected?.id===m.id?null:m)}
              style={{padding:'12px 16px',borderBottom:idx<messages.length-1?'1px solid #f1f5f9':'none',cursor:'pointer',
                background:selected?.id===m.id?'var(--color-brand-light)':'var(--base-color-1)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                <span style={{fontSize:12,fontWeight:700,color:'#1e293b',flex:1}}>{m.to_name}</span>
                <span style={{fontSize:10,color:'#94a3b8'}}>{new Date(m.created_at).toLocaleDateString('ja-JP')}</span>
                {m.is_read
                  ? <span style={{fontSize:9,color:'#10b981',background:'#f0fdf4',border:'1px solid #86efac',padding:'1px 5px',borderRadius:4}}>既読</span>
                  : <span style={{fontSize:9,color:'#f59e0b',background:'#fffbeb',border:'1px solid #fde68a',padding:'1px 5px',borderRadius:4}}>未読</span>
                }
              </div>
              <div style={{fontSize:11,color:'#64748b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.subject}</div>
              {selected?.id===m.id && (
                <div style={{marginTop:10,padding:'10px',background:'#f8fafc',borderRadius:8,fontSize:12,color:'#374151',lineHeight:1.7,whiteSpace:'pre-wrap'}}>
                  {m.body}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
