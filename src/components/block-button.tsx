'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  targetId: string
  userId: string
  initialBlocked: boolean
  initialMuted?: boolean
}

export default function BlockButton({ targetId, userId, initialBlocked, initialMuted = false }: Props) {
  const supabase = createClient()
  const [blocked, setBlocked] = useState(initialBlocked)
  const [muted,   setMuted]   = useState(initialMuted)
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  async function handleBlock() {
    if (loading) return
    if (blocked) {
      if (!confirm('ブロックを解除しますか？')) return
      setLoading(true)
      await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', targetId)
      setBlocked(false)
    } else {
      if (!confirm('このユーザーをブロックしますか？\nブロックすると相手はコメントできなくなります。')) return
      setLoading(true)
      await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: targetId })
      setBlocked(true)
    }
    setLoading(false)
    setShowMenu(false)
  }

  async function handleMute() {
    if (loading) return
    setLoading(true)
    if (muted) {
      await supabase.from('user_mutes').delete().eq('muter_id', userId).eq('muted_id', targetId)
      setMuted(false)
    } else {
      await supabase.from('user_mutes').insert({ muter_id: userId, muted_id: targetId })
      setMuted(true)
    }
    setLoading(false)
    setShowMenu(false)
  }

  return (
    <div style={{position:'relative'}}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={loading}
        title="ブロック・ミュート"
        style={{
          padding:'3px 10px', borderRadius:16, fontSize:12, fontWeight:600,
          cursor:'pointer', transition:'all .15s',
          border: blocked ? '1px solid #fca5a5' : '1px solid var(--color-brand-border)',
          background: blocked ? '#fef2f2' : 'var(--color-bg-card)',
          color: blocked ? 'var(--color-danger)' : muted ? '#9ca3af' : 'var(--color-text-faint)',
          opacity: loading ? 0.6 : 1,
        }}>
        {blocked ? 'ブロック中' : muted ? 'ミュート中' : '⋯'}
      </button>

      {showMenu && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:99}} onClick={()=>setShowMenu(false)}/>
          {/*
            * ★ 幅を、はっきり決める。
            *
            *   前は min(160px, 100%) と書いていた。
            *   この 100% は画面ではなく、外側の箱を指す。
            *   外側は「⋯」の押し具だけなので 30px ほどしかない。
            *
            *     min(160px, 30px) → 30px
            *
            *   30px の箱に文字を入れれば、1 文字ずつ折り返す。
            *   「縦書きで斬新ですね」と言われたのは、これ。
            *   縦書きではなく、ただ潰れていた。
            */}
          <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:10,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',zIndex:100,width:'max-content',minWidth:160,overflow:'hidden'}}>
            <button onClick={handleMute}
              style={{width:'100%',padding:'10px 14px',border:'none',borderBottom:'1px solid var(--color-brand-border)',background:'none',fontSize:13,color:muted?'var(--color-danger)':'var(--color-text)',cursor:'pointer',textAlign:'left' as const,whiteSpace:'nowrap' as const}}>
              {muted ? 'ミュート解除' : 'ミュートする'}
            </button>
            <button onClick={handleBlock}
              style={{width:'100%',padding:'10px 14px',border:'none',background:'none',fontSize:13,color:blocked?'var(--color-danger)':'var(--color-text)',cursor:'pointer',textAlign:'left' as const,whiteSpace:'nowrap' as const}}>
              {blocked ? 'ブロック解除' : 'ブロックする'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
