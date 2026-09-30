'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  authorId: string
  userId: string
  initialFollowing: boolean
  followerCount: number
}

export default function FollowButton({ authorId, userId, initialFollowing, followerCount }: Props) {
  const supabase = createClient()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading,   setLoading]   = useState(false)
  const [hovered,   setHovered]   = useState(false)
  /*
   * ★ 押している最中は、次の押しを受けない（すぐ効く錠）。
   *   loading は画面が描き直されるまで変わらないので、
   *   素早く 2 回押すと両方とも通り、フォローの通知が 2 つ届いていた。
   */
  const busyRef = useRef(false)

  async function handleToggle() {
    if (busyRef.current) return
    busyRef.current = true
    setLoading(true)
    try {
    if (following) {
      await supabase.from('follows').delete()
        .eq('follower_id', userId).eq('following_id', authorId)
      setFollowing(false)
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: userId, following_id: authorId })
      setFollowing(true)
      /* 相手に知らせる。誰がフォローしたかは受け口の側で組み立てる（もうフォロー済みで弾かれたときは送らない） */
      if (!error) {
        fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ follow_user_id: authorId }) }).catch(() => {})
      }
    }
    } finally {
      busyRef.current = false
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={loading}
      style={{
        marginLeft:8,
        padding:'3px 14px',
        borderRadius:16,
        fontSize:12,
        fontWeight:600,
        cursor:'pointer',
        transition:'all .15s',
        border: following ? '1px solid var(--color-brand-border)' : '1px solid var(--color-brand)',
        background: following
          ? (hovered ? '#fef2f2' : 'var(--base-color-1)')
          : 'var(--color-brand)',
        color: following
          ? (hovered ? '#dc2626' : 'var(--color-text-muted)')
          : 'var(--base-color-1)',
        opacity: loading ? 0.6 : 1,
      }}>
      {following ? (hovered ? 'フォロー解除' : 'フォロー中') : 'フォローする'}
    </button>
  )
}
