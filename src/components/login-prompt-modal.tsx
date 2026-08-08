'use client'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

interface Props {
  show: boolean
  onClose: () => void
  message?: string
}

export default function LoginPromptModal({ show, onClose, message = 'この機能を使うにはログインが必要です' }: Props) {
  useEffect(() => {
    if (!show) return
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [show, onClose])

  if (!show || typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={onClose}>
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          background:'var(--color-bg-card)',
          border:'2px solid var(--color-brand)',
          borderRadius:16,
          padding:'32px 28px',
          width:340,
          maxWidth:'95vw',
          textAlign:'center',
          boxShadow:'0 8px 32px rgba(0,0,0,0.15)',
          animation:'modalIn .2s ease',
        }}>
        <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',marginBottom:8}}>{message}</div>
        <div style={{fontSize:13,color:'var(--color-text-muted)',marginBottom:24,lineHeight:1.7}}>
          ログインすると、いいね・ブックマーク・拡散・コメントなどの機能が使えます。
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose}
            style={{flex:1,padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:10,background:'var(--color-bg-card)',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>
            閉じる
          </button>
          <Link href="/auth/register"
            style={{flex:1,padding:'10px',background:'var(--color-brand)',color:'var(--color-bg-card)',borderRadius:10,fontSize:13,fontWeight:700,textDecoration:'none',display:'block'}}>
            新規登録
          </Link>
        </div>
        <Link href="/auth/login"
          style={{display:'block',marginTop:10,fontSize:12,color:'var(--color-brand)',textDecoration:'none'}}>
          すでにアカウントをお持ちの方はこちら
        </Link>
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>,
    document.body
  )
}
