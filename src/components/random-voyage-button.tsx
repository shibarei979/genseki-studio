'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RandomVoyageButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/random-voyage')
      const data = await res.json()
      if (data.novel?.id) {
        router.push(`/novel/${data.novel.id}`)
        return  // 遷移するのでloading解除しない（画面が変わる）
      }
    } catch (e) {}
    setLoading(false)
  }

  return (
    <button onClick={handleClick} disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12.5, fontWeight: 700, color: 'var(--color-bg-card)',
        background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))',
        border: 'none',
        borderRadius: 16, padding: '7px 16px',
        cursor: 'pointer', boxShadow: '0 2px 8px color-mix(in srgb, var(--color-brand) 35%, transparent)',
        opacity: loading ? 0.7 : 1,
      }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-bg-card)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
        <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="8 21 3 21 3 16"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>
      </svg>
      {loading ? '航海中...' : 'ランダム航海'}
    </button>
  )
}
