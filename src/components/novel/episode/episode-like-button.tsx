'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  episodeId: string
  userId: string | null
  initialLiked: boolean
  initialCount: number
}

function fmtNum(n: number): string {
  if (n >= 10000) return (Math.floor(n / 1000) / 10) + '万'
  if (n >= 1000) return (Math.floor(n / 100) / 10) + 'K'
  return n.toString()
}

export default function EpisodeLikeButton({ episodeId, userId, initialLiked, initialCount }: Props) {
  const supabase = createClient()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  async function handleLike() {
    if (!userId || loading) return
    setLoading(true)
    if (liked) {
      await supabase.from('episode_likes').delete().eq('episode_id', episodeId).eq('user_id', userId)
      setLiked(false); setCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('episode_likes').insert({ episode_id: episodeId, user_id: userId })
      setLiked(true); setCount(c => c + 1)
      /* 作者に知らせる。押した本人かどうかは受け口の側で確かめる */
      fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ like_episode_id: episodeId }) }).catch(() => {})
    }
    setLoading(false)
  }

  return (
    <button onClick={handleLike} disabled={!userId||loading}
      style={{
        display:'inline-flex',alignItems:'center',gap:6,
        padding:'10px 24px',borderRadius:20,border:'1.5px solid',
        fontSize:13,fontWeight:600,
        cursor:userId?'pointer':'default',transition:'all .2s',
        background:liked?'#fef2f2':'var(--base-color-1)',
        borderColor:liked?'#dc2626':'var(--color-brand-border)',
        color:liked?'#dc2626':'var(--color-text-muted)',
      }}>
      {liked?'♥':'♡'}{count > 0 && <span style={{fontSize:12}}>{fmtNum(count)}</span>}
    </button>
  )
}
