'use client'
import { useEffect, useRef } from 'react'

interface Props {
  episodeId: string
  enabled: boolean  // ログイン済み かつ 作者自身でない場合のみ計測
}

// 有効読者判定：話ページを開く＋10秒以上滞在＋本文30%以上スクロール
export default function ValidReadTracker({ episodeId, enabled }: Props) {
  const sentRef = useRef(false)
  const timeOkRef = useRef(false)
  const scrollOkRef = useRef(false)
  const maxScrollRef = useRef(0)
  const secondsRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    sentRef.current = false
    timeOkRef.current = false
    scrollOkRef.current = false
    maxScrollRef.current = 0
    secondsRef.current = 0

    function trySend() {
      if (sentRef.current) return
      if (!timeOkRef.current || !scrollOkRef.current) return
      sentRef.current = true
      fetch('/api/valid-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episode_id: episodeId,
          read_seconds: secondsRef.current,
          scroll_pct: Math.round(maxScrollRef.current),
        }),
        keepalive: true,
      }).catch(() => {})
    }

    // 滞在時間（タブが見えている間だけカウント）
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      secondsRef.current += 1
      if (secondsRef.current >= 10) {
        timeOkRef.current = true
        trySend()
      }
    }, 1000)

    // スクロール率（縦書き・横書き両対応：縦横それぞれの進捗の大きい方）
    function onScroll() {
      const doc = document.documentElement
      const vMax = doc.scrollHeight - window.innerHeight
      const hMax = doc.scrollWidth - window.innerWidth
      const vPct = vMax > 50 ? (window.scrollY / vMax) * 100 : 100
      const hPct = hMax > 50 ? (Math.abs(window.scrollX) / hMax) * 100 : 0
      const pct = Math.max(vPct, hPct)
      if (pct > maxScrollRef.current) maxScrollRef.current = Math.min(100, pct)
      if (maxScrollRef.current >= 30) {
        scrollOkRef.current = true
        trySend()
      }
    }
    // 短い話（スクロール不要）は開いた時点で30%条件を満たしたとみなす
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      clearInterval(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [episodeId, enabled])

  return null
}
