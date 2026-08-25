'use client'

import { useEffect, useState } from 'react'

/**
 * ============================================================
 * 原石航路
 * ShelfNav — 本棚を手で送る
 *
 * 本棚は放っておいても勝手に回る。
 * ただ、気になった本が通り過ぎたとき、
 * 一周待たないと戻ってこない。
 *
 * 押せば、その場で前後に動かせる。
 * ============================================================
 */

declare global {
  interface Window {
    bookshelfLoops?: { next: () => void; prev: () => void }[]
  }
}

export default function ShelfNav() {
  /*
   * 本棚が組み上がるまで押し具を出さない。
   *
   * 先に出すと、押しても何も起きない。
   * 「壊れている」と思われるより、出ないほうがよい。
   */
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      if ((window.bookshelfLoops?.length ?? 0) > 0) {
        setIsReady(true)
        window.clearInterval(timer)
      }
    }, 300)

    /* いつまでも探し続けない */
    const giveUp = window.setTimeout(() => window.clearInterval(timer), 10_000)

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(giveUp)
    }
  }, [])

  if (!isReady) return null

  function move(where: 'prev' | 'next') {
    window.bookshelfLoops?.forEach((shelf) => shelf[where]())
  }

  return (
    <>
      <button
        type="button"
        onClick={() => move('prev')}
        aria-label="前の本へ"
        className="rh_shelf-nav rh_shelf-nav-prev"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => move('next')}
        aria-label="次の本へ"
        className="rh_shelf-nav rh_shelf-nav-next"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </>
  )
}
