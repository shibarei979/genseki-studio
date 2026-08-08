'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  novelId: string
  episodeId: string
  userId: string | null
  initialRead: boolean
}

export default function ReadButton({ novelId, episodeId, userId, initialRead }: Props) {
  const supabase = createClient()
  const [read, setRead] = useState(initialRead)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!userId) {
      window.location.href = '/auth/login'
      return
    }
    setLoading(true)
    if (read) {
      await supabase.from('read_episodes')
        .delete()
        .eq('user_id', userId)
        .eq('episode_id', episodeId)
      setRead(false)
    } else {
      await supabase.from('read_episodes')
        .upsert({ user_id: userId, novel_id: novelId, episode_id: episodeId }, { onConflict: 'user_id,episode_id' })
      setRead(true)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        display:'flex',alignItems:'center',gap:6,
        padding:'10px 24px',borderRadius:20,
        border: read ? '1.5px solid #10b981' : '1.5px solid var(--color-brand-border)',
        background: read ? '#f0fdf4' : 'var(--base-color-1)',
        color: read ? '#10b981' : 'var(--color-text-muted)',
        fontSize:13,fontWeight:700,cursor:'pointer',
        transition:'all 0.2s ease',
      }}
    >
      {read ? '✓ 読了済み' : '読了にする'}
    </button>
  )
}
