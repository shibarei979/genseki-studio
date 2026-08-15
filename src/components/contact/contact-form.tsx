'use client'

import { useAuth } from '@/hooks/use-auth'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SENDER_TYPES = [
  { value: 'general',  label: '一般' },
  { value: 'business', label: 'ビジネス' },
]

const CATEGORIES: Record<string, string[]> = {
  general: [
    'アカウントに関する問題',
    'ログイン・登録について',
    '作品の閲覧・検索について',
    '投稿・編集機能について',
    '作品の表示・公開について',
    'コメント・評価・通知について',
    '不適切なコンテンツの報告',
    '権利侵害・盗作の報告',
    'バグ・不具合の報告',
    'その他',
  ],
  business: [
    '作品のメディア化・出版に関するご相談',
    '広告・タイアップのご相談',
    'キャンペーン・コンテストのご提案',
    '業務提携のご相談',
    '取材・プレス関連',
    'その他のビジネスに関するお問い合わせ',
  ],
}

/**
 * ログインしていれば、その人の情報を初めから入れる。
 * 毎回打ち直させるのは手間。
 */
export default function ContactForm() {
  const { user } = useAuth()

  const userId = user?.id ?? null
  const userEmail = user?.email ?? null
  /* 表示名は profiles にあるが、ここでは使わない。空でも困らない */
  const userName = null

  const supabase = createClient()
  const [senderType, setSenderType] = useState('')
  const [name,       setName]       = useState(userName || '')
  const [email,      setEmail]      = useState(userEmail || '')
  const [phone,      setPhone]      = useState('')
  const [company,    setCompany]    = useState('')
  const [category,   setCategory]   = useState('')
  const [body,       setBody]       = useState('')
  const [loading,    setLoading]    = useState(false)
  const [sent,       setSent]       = useState(false)
  const [error,      setError]      = useState('')

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: '1px solid #ddd', borderRadius: 4,
    fontSize: 13, outline: 'none', background: 'var(--color-bg-card)',
    fontFamily: 'inherit', boxSizing: 'border-box',
    color: 'var(--color-text)',
  }

  const rowStyle: React.CSSProperties = {
    padding: '16px 24px',
    borderBottom: '1px solid #f0f0f0',
  }

  function handleSenderType(val: string) {
    setSenderType(val)
    setCategory('')
  }

  async function handleSubmit() {
    setError('')
    if (!senderType)             { setError('お問い合わせ区分を選択してください'); return }
    if (!name.trim())            { setError('お名前を入力してください'); return }
    if (!email.includes('@'))    { setError('正しいメールアドレスを入力してください'); return }
    if (senderType === 'business' && !company.trim()) { setError('会社名を入力してください'); return }
    if (!category)               { setError('お問い合わせ内容を選択してください'); return }
    if (body.trim().length < 10) { setError('本文を10文字以上入力してください'); return }

    setLoading(true)
    const senderLabel = SENDER_TYPES.find(s => s.value === senderType)?.label || ''
    const { error: err } = await supabase.from('contact_messages').insert({
      name: name.trim(),
      email: email.trim(),
      category: `[${senderLabel}] ${category}`,
      body: `${company ? `会社名：${company}\n` : ''}${phone ? `電話番号：${phone}\n` : ''}\n${body.trim()}`,
      user_id: userId || null,
    })
    setLoading(false)
    /*
     * 理由も出す。
     *
     * 「送信に失敗しました」だけだと、
     * 送る側も受ける側も何が起きたか分からない。
     * ここが塞がると不具合の報告そのものが届かなくなる。
     */
    if (err) {
      console.error('[contact]', err)
      setError(`送信に失敗しました：${err.message}`)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'48px 32px',textAlign:'center'}}>
        <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',marginBottom:10}}>お問い合わせを受け付けました</div>
        <p style={{fontSize:13,color:'var(--color-text-muted)',lineHeight:1.9}}>
          内容を確認後、必要に応じて運営より返信いたします。<br/>
          返信まで数日かかる場合があります。
        </p>
      </div>
    )
  }

  return (
    <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>

      {/* お問い合わせ区分 */}
      <div style={rowStyle}>
        <label style={{fontSize:13,fontWeight:600,color:'var(--color-text)',display:'block',marginBottom:8}}>
          お問い合わせ区分<span style={{color:'var(--color-brand)',marginLeft:4,fontSize:11,fontWeight:700}}>必須</span>
        </label>
        <select value={senderType} onChange={e=>handleSenderType(e.target.value)}
          style={{...inp,maxWidth:300,cursor:'pointer'}}>
          <option value="">選択してください</option>
          {SENDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* お名前 */}
      <div style={rowStyle}>
        <label style={{fontSize:13,fontWeight:600,color:'var(--color-text)',display:'block',marginBottom:8}}>
          お名前<span style={{color:'var(--color-brand)',marginLeft:4,fontSize:11,fontWeight:700}}>必須</span>
        </label>
        <input value={name} onChange={e=>setName(e.target.value)}
          placeholder="原石 太郎" style={{...inp,maxWidth:320}}/>
      </div>

      {/* 会社名（ビジネスのみ） */}
      {senderType === 'business' && (
        <div style={rowStyle}>
          <label style={{fontSize:13,fontWeight:600,color:'var(--color-text)',display:'block',marginBottom:8}}>
            会社名・組織名<span style={{color:'var(--color-brand)',marginLeft:4,fontSize:11,fontWeight:700}}>必須</span>
          </label>
          <input value={company} onChange={e=>setCompany(e.target.value)}
            placeholder="株式会社 原石出版" style={{...inp,maxWidth:400}}/>
        </div>
      )}

      {/* メールアドレス */}
      <div style={rowStyle}>
        <label style={{fontSize:13,fontWeight:600,color:'var(--color-text)',display:'block',marginBottom:8}}>
          メールアドレス<span style={{color:'var(--color-brand)',marginLeft:4,fontSize:11,fontWeight:700}}>必須</span>
        </label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="example@email.com" style={{...inp,maxWidth:400}}/>
      </div>

      {/* 電話番号 */}
      <div style={rowStyle}>
        <label style={{fontSize:13,fontWeight:600,color:'var(--color-text)',display:'block',marginBottom:8}}>
          電話番号<span style={{color:'var(--color-text-faint)',marginLeft:4,fontSize:11}}>任意</span>
        </label>
        <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}
          placeholder="090-0000-0000" style={{...inp,maxWidth:280}}/>
      </div>

      {/* お問い合わせ内容 */}
      <div style={rowStyle}>
        <label style={{fontSize:13,fontWeight:600,color:'var(--color-text)',display:'block',marginBottom:8}}>
          お問い合わせ内容<span style={{color:'var(--color-brand)',marginLeft:4,fontSize:11,fontWeight:700}}>必須</span>
        </label>
        {senderType ? (
          <select value={category} onChange={e=>setCategory(e.target.value)}
            style={{...inp,maxWidth:480,cursor:'pointer'}}>
            <option value="">選択してください</option>
            {(CATEGORIES[senderType]||[]).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        ) : (
          <div style={{fontSize:12,color:'var(--color-text-faint)',padding:'8px 0'}}>先にお問い合わせ区分を選択してください</div>
        )}
      </div>

      {/* 本文 */}
      <div style={{padding:'16px 24px'}}>
        <label style={{fontSize:13,fontWeight:600,color:'var(--color-text)',display:'block',marginBottom:8}}>
          本文<span style={{color:'var(--color-brand)',marginLeft:4,fontSize:11,fontWeight:700}}>必須</span>
        </label>
        <textarea value={body} onChange={e=>setBody(e.target.value)} rows={10}
          placeholder={
            senderType === 'business'
              ? 'ご担当者名・ご用件・ご希望の連絡方法などをご記入ください。'
              : '問題の詳細・発生したページ・使用端末・ブラウザなどをご記入ください。'
          }
          style={{...inp,resize:'vertical',minHeight:200,lineHeight:1.8}}/>
        <div style={{fontSize:11,color:'var(--color-text-faint)',marginTop:4,textAlign:'right'}}>{body.length} / 1,000文字</div>
      </div>

      {/* 注意事項 */}
      <div style={{padding:'0 24px 8px'}}>
        <p style={{fontSize:12,color:'var(--color-text-muted)',lineHeight:1.8,margin:0}}>
          パスワードなどの機密情報は本文に記載しないでください。<br/>
          内容によっては返信まで数日かかる場合があります。
        </p>
      </div>

      {/* エラー */}
      {error && (
        <div style={{padding:'10px 24px',background:'#fef2f2',borderTop:'1px solid #fca5a5'}}>
          <p style={{fontSize:12,color:'#dc2626',margin:0}}>{error}</p>
        </div>
      )}

      {/* 送信ボタン */}
      <div style={{padding:'20px 24px',textAlign:'center'}}>
        <button onClick={handleSubmit} disabled={loading}
          style={{padding:'12px 48px',background:'var(--color-brand)',color:'var(--color-text-inverse)',border:'none',borderRadius:6,fontSize:14,fontWeight:700,cursor:'pointer',opacity:loading?0.6:1}}>
          {loading ? '送信中...' : '送信する'}
        </button>
      </div>
    </div>
  )
}
