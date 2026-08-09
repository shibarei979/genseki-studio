'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TYPE_OPTIONS_ARRAY, getAnnouncementType } from '@/types/announcement'

interface Announcement {
  id: string; title: string; body: string; type: string;
  link: string | null; image_url: string | null; is_published: boolean; created_at: string
}

const btn = (color: string, bg: string, border: string) => ({
  padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',
  color,background:bg,border:`1px solid ${border}`,
})

function validate(form: { title:string; body:string; link:string; type:string; image_url:string }) {
  const errors: Record<string, string> = {}
  if (!form.type) errors.type = '種別は必須です'
  if (!form.title.trim()) errors.title = 'タイトルは必須です'
  if (!form.body.trim()) errors.body = '本文は必須です'
  return errors
}

export default function AnnouncementManager({ initialAnnouncements }: { initialAnnouncements: Announcement[] }) {
  const supabase = createClient()
  const [items, setItems] = useState(initialAnnouncements)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title:'', body:'', type:'info', link:'', image_url:'', is_published:true })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notifyAll, setNotifyAll] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [notifyResult, setNotifyResult] = useState('')

  function openCreate() {
    setForm({title:'',body:'',type:'info',link:'',image_url:'',is_published:true})
    setErrors({}); setNotifyAll(false); setCreating(true); setEditing(null)
  }
  function openEdit(a: Announcement) {
    setForm({title:a.title,body:a.body,type:a.type,link:a.link||'',image_url:a.image_url||'',is_published:a.is_published})
    setErrors({}); setNotifyAll(false); setEditing(a); setCreating(false)
  }
  function closeForm() { setCreating(false); setEditing(null); setErrors({}); setNotifyAll(false); setNotifyResult('') }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `announcements/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('images').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('images').getPublicUrl(path)
      setForm(f => ({...f, image_url: data.publicUrl}))
    }
    setUploading(false)
  }

  async function handleSave() {
    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setLoading(true)
    const payload = { ...form, image_url: form.image_url || null, link: form.link || null }
    let savedId: string | null = null
    if (creating) {
      const { data } = await supabase.from('announcements').insert(payload).select().single()
      if (data) { setItems([data, ...items]); savedId = data.id }
    } else if (editing) {
      await supabase.from('announcements').update(payload).eq('id', editing.id)
      setItems(items.map(i => i.id === editing.id ? {...i,...payload} : i))
      savedId = editing.id
    }
    if (notifyAll && form.is_published && savedId) {
      setNotifying(true); setNotifyResult('')
      try {
        const res = await fetch('/api/notify-all', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ title: form.title.trim(), message: `お知らせ：${form.title.trim()}`, link: `/announcements/${savedId}` }) })
        const data = await res.json()
        setNotifyResult(res.ok ? `${data.sent}人に通知を送信しました` : '通知の送信に失敗しました')
      } catch { setNotifyResult('通知の送信に失敗しました') }
      setNotifying(false)
    }
    setLoading(false)
    if (!notifyAll) closeForm()
  }

  async function handleDelete(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('announcements').delete().eq('id', id)
    setItems(items.filter(i => i.id !== id))
  }

  async function togglePublish(a: Announcement) {
    await supabase.from('announcements').update({is_published:!a.is_published}).eq('id', a.id)
    setItems(items.map(i => i.id === a.id ? {...i,is_published:!a.is_published} : i))
  }

  const inputStyle = (key: string) => ({
    padding:'7px 12px', border:`1px solid ${errors[key] ? '#fca5a5' : '#e2e8f0'}`,
    borderRadius:6, fontSize:13, width:'100%', background: errors[key] ? '#fef2f2' : 'var(--base-color-1)'
  })

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        <button onClick={openCreate} style={{...btn('var(--base-color-1)','var(--color-brand)','var(--color-brand)'),fontSize:13,padding:'8px 20px'}}>＋ お知らせを作成</button>
      </div>

      {(creating || editing) && (
        <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,padding:'24px',marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:700,color:'#1e293b',marginBottom:16}}>{creating?'新規作成':'編集'}</div>
          <div style={{display:'grid',gap:12}}>
            <div>
              <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:4}}>種別 <span style={{color:'#ef4444'}}>*</span></label>
              <select value={form.type} onChange={e=>{setForm({...form,type:e.target.value});setErrors(ev=>({...ev,type:''}))}} style={inputStyle('type')}>
                {TYPE_OPTIONS_ARRAY.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {errors.type && <div style={{fontSize:11,color:'#ef4444',marginTop:3}}>{errors.type}</div>}
            </div>
            <div>
              <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:4}}>URL <span style={{color:'#94a3b8',fontSize:10}}>(任意)</span></label>
              <input value={form.link} onChange={e=>setForm({...form,link:e.target.value})} style={inputStyle('link')} placeholder="https://..."/>
            </div>
            <div>
              <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:4}}>タイトル <span style={{color:'#ef4444'}}>*</span></label>
              <input value={form.title} onChange={e=>{setForm({...form,title:e.target.value});setErrors(ev=>({...ev,title:''}))}} style={inputStyle('title')} placeholder="タイトルを入力"/>
              {errors.title && <div style={{fontSize:11,color:'#ef4444',marginTop:3}}>{errors.title}</div>}
            </div>
            <div>
              <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:4}}>本文 <span style={{color:'#ef4444'}}>*</span></label>
              <textarea value={form.body} onChange={e=>{setForm({...form,body:e.target.value});setErrors(ev=>({...ev,body:''}))}} rows={4}
                style={{...inputStyle('body'),resize:'vertical' as const}} placeholder="本文を入力"/>
              {errors.body && <div style={{fontSize:11,color:'#ef4444',marginTop:3}}>{errors.body}</div>}
            </div>
            <div>
              <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:6}}>
                バナー画像 <span style={{color:'#94a3b8',fontSize:10}}>(任意)</span>
                <span style={{fontSize:10,color:'#94a3b8',fontWeight:400,marginLeft:6}}>推奨サイズ：600×300px（2:1）</span>
              </label>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{fontSize:12,marginBottom:4}}/>
              {uploading && <div style={{fontSize:12,color:'#64748b'}}>アップロード中...</div>}
              {form.image_url && (
                <div style={{marginTop:8}}>
                  <img src={form.image_url} alt="プレビュー" style={{maxWidth:400,maxHeight:150,objectFit:'contain',borderRadius:8,border:'1px solid #e2e8f0',display:'block',marginBottom:8}}/>
                  <button onClick={()=>setForm(f=>({...f,image_url:''}))} style={{...btn('#dc2626','#fef2f2','#fca5a5'),fontSize:11}}>画像を削除</button>
                </div>
              )}
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})}/>公開する
            </label>
            <div style={{background:notifyAll?'#fff7ed':'#f8fafc',border:`1.5px solid ${notifyAll?'#fdba74':'#e2e8f0'}`,borderRadius:8,padding:'12px 14px'}}>
              <label style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:13,cursor:form.is_published?'pointer':'not-allowed',opacity:form.is_published?1:0.5}}>
                <input type="checkbox" checked={notifyAll} disabled={!form.is_published} onChange={e=>setNotifyAll(e.target.checked)} style={{marginTop:2}}/>
                <span>
                  <span style={{fontWeight:700,color:'#1e293b'}}>全ユーザーに通知する</span>
                  <span style={{display:'block',fontSize:11,color:'#64748b',marginTop:2}}>
                    {form.is_published?'チェックすると、保存と同時に全ユーザーへ通知が送られます':'「公開する」がオフの場合は通知できません'}
                  </span>
                </span>
              </label>
              {notifying && <div style={{fontSize:12,color:'var(--color-brand)',marginTop:8,fontWeight:600}}>通知を送信中...</div>}
              {notifyResult && <div style={{fontSize:12,color:notifyResult.includes('失敗')?'#dc2626':'#16a34a',marginTop:8,fontWeight:600}}>{notifyResult}</div>}
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}>
            <button onClick={closeForm} style={btn('#64748b','var(--base-color-1)','#e2e8f0')}>{notifyResult?'閉じる':'キャンセル'}</button>
            <button onClick={handleSave} disabled={loading||notifying}
              style={{...btn('var(--base-color-1)',(loading||notifying)?'#fdba74':'var(--color-brand)',(loading||notifying)?'#fdba74':'var(--color-brand)'),opacity:(loading||notifying)?0.7:1}}>
              {loading?'保存中...':notifying?'通知送信中...':'保存する'}
            </button>
          </div>
        </div>
      )}

      <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
        {items.length === 0 ? (
          <div style={{padding:'48px',textAlign:'center',color:'#94a3b8',fontSize:13}}>お知らせがありません</div>
        ) : items.map((a, idx) => {
          const t = getAnnouncementType(a.type)
          return (
            <div key={a.id} style={{padding:'14px 20px',borderBottom:idx<items.length-1?'1px solid #f1f5f9':'none',display:'flex',alignItems:'center',gap:12}}>
              {a.image_url
                ? <img src={a.image_url} alt="" style={{width:90,height:30,objectFit:'contain',borderRadius:4,flexShrink:0}}/>
                : <div style={{width:90,height:30,borderRadius:4,flexShrink:0,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#94a3b8'}}>画像なし</div>
              }
              <span style={{fontSize:10,fontWeight:700,color:t.color,background:`${t.color}18`,border:`1px solid ${t.color}40`,padding:'2px 8px',borderRadius:4,flexShrink:0}}>{t.label}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:1}}>{a.title}</div>
                <div style={{fontSize:11,color:'#94a3b8'}}>{new Date(a.created_at).toLocaleDateString('ja-JP')}</div>
              </div>
              {!a.is_published && <span style={{fontSize:11,color:'#94a3b8',background:'#f1f5f9',padding:'2px 8px',borderRadius:4}}>非公開</span>}
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>togglePublish(a)} style={btn(a.is_published?'#4a7fa5':'#10b981',a.is_published?'#fffbeb':'#f0fdf4',a.is_published?'#fde68a':'#86efac')}>
                  {a.is_published?'非公開':'公開'}
                </button>
                <button onClick={()=>openEdit(a)} style={btn('#3b82f6','#eff6ff','#bfdbfe')}>編集</button>
                <button onClick={()=>handleDelete(a.id)} style={btn('#dc2626','#fef2f2','#fca5a5')}>削除</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
