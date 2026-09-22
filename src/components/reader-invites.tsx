'use client'

/**
 * ============================================================
 * 原石航路
 * ReaderInvites — 読んでいる人を、会員登録へ誘う
 *
 * ★ 押したときに止めるのではなく、読んでいる流れの中で誘う。
 *
 *   H  右下の小さな誘い（2 話目を読んでいる人）
 *      「この作品を、本棚に入れておきませんか」
 *      ★ 押すと、その場で本当に本棚に入れる（この端末に）。
 *        入ったら「本棚に入れました」に変わり、そこで初めて登録を勧める。
 *        頼むだけの案内より、先に一つ役に立つほうが、登録してもらえる。
 *      閉じたら、しばらく出さない。すでに本棚にある作品では出さない。
 *      ★ 出すのは、読み進めて半分を過ぎてから（かつ少し時間がたってから）。
 *        読み始めてすぐ出ると、話の途中で邪魔になる。
 *
 * ★ ログインしている人には、何も出さない。
 * ★ 何話読んだかは、この端末にだけ覚える（作品ごと、話の頁ごとに一回）。
 * ★ 以前あった「ここまでで ○ 話 読みました」の案内（G）は、やめた。
 * ============================================================
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import { guestBookmarks, hasGuestBookmark, toggleGuestBookmark } from '@/lib/guest-bookmarks'
import { ShelfArt } from '@/components/login-invite-art'

interface Props {
  novelId: string
  /** 以前の G で使っていた。いまは使わない（渡されても構わない） */
  next?: { id: string; title: string } | null
  /** 右下の誘いを出すまでの待ち時間（ミリ秒）。ふだんは 15 秒 */
  cornerDelayMs?: number
}

/** 右下の誘いを閉じたら、この日数は出さない */
const QUIET_DAYS = 14

export default function ReaderInvites({ novelId, cornerDelayMs = 15000 }: Props) {
  const pathname = usePathname()

  /* null = まだ分からない（分かるまで何も出さない） */
  const [guest, setGuest] = useState<boolean | null>(null)
  const [readCount, setReadCount] = useState(0)
  const [cornerOpen, setCornerOpen] = useState(false)
  /* 右下の札で「本棚に入れる」を押したか */
  const [shelved, setShelved] = useState(false)
  /* この端末の本棚の冊数（入れたあとに見せる） */
  const [shelfCount, setShelfCount] = useState(0)

  /* ログインしているか */
  useEffect(() => {
    let alive = true
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (alive) setGuest(!data.user)
      })
      .catch(() => {
        if (alive) setGuest(false)
      })
    return () => {
      alive = false
    }
  }, [])

  /* この作品で、何話読んだか（この頁も数える） */
  useEffect(() => {
    try {
      const key = `reader-read:${novelId}`
      const list = JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
      if (!list.includes(pathname)) list.push(pathname)
      localStorage.setItem(key, JSON.stringify(list.slice(-200)))
      setReadCount(list.length)
    } catch {
      setReadCount(0)
    }
  }, [novelId, pathname])

  /* 右下の誘いは、2 話目を半分以上読み、少し時間がたってから出す */
  useEffect(() => {
    if (!guest || readCount !== 2) return
    if (hasGuestBookmark(novelId)) return
    try {
      const until = Number(localStorage.getItem('reader-corner-quiet') ?? 0)
      if (Date.now() < until) return
    } catch {
      /* 覚えられなくても出してよい */
    }

    let waited = false
    let halfway = false
    const tryOpen = () => {
      if (waited && halfway) setCornerOpen(true)
    }
    const onScroll = () => {
      const doc = document.documentElement
      const room = doc.scrollHeight - window.innerHeight
      /* 頁が短くて流せないときは、読み終えたものとみなす */
      if (room <= 40 || window.scrollY / room >= 0.5) {
        halfway = true
        tryOpen()
      }
    }
    const timer = window.setTimeout(() => {
      waited = true
      onScroll()
      tryOpen()
    }, cornerDelayMs)

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [guest, readCount, novelId, cornerDelayMs])

  /* 本棚に入れる（この端末に）。入ったら札の中身が変わる */
  function shelve() {
    if (!hasGuestBookmark(novelId)) toggleGuestBookmark(novelId)
    setShelfCount(guestBookmarks().length)
    setShelved(true)
  }

  /* 入れたのを取り消す（押し間違えたとき） */
  function unshelve() {
    if (hasGuestBookmark(novelId)) toggleGuestBookmark(novelId)
    setShelved(false)
  }

  function closeCorner() {
    setCornerOpen(false)
    try {
      localStorage.setItem('reader-corner-quiet', String(Date.now() + QUIET_DAYS * 86400000))
    } catch {
      /* 覚えられなくても閉じる */
    }
  }

  if (!guest) return null

  const back = encodeURIComponent(pathname)

  return (
    <>
      {cornerOpen && (
        /* ============ H 右下の小さな誘い ============ */
        <aside
          className="reader-invite-corner"
          aria-label="本棚のご案内"
          style={{
            position: 'fixed',
            right: 16,
            zIndex: 900,
            width: 316,
            maxWidth: 'calc(100vw - 32px)',
            background: 'linear-gradient(180deg, #f3f7fa 0px, #ffffff 90px)',
            border: '1px solid #e1e9ee',
            borderRadius: 20,
            boxShadow: '0 18px 44px rgba(16, 38, 54, 0.2)',
            padding: '18px 18px 16px',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={closeCorner}
            aria-label="閉じる"
            style={{
              position: 'absolute',
              top: 6,
              right: 8,
              width: 28,
              height: 28,
              border: 0,
              background: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: 16,
              cursor: 'pointer',
              zIndex: 1,
            }}
          >
            ×
          </button>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginRight: 16 }}>
            {/* 本棚。「本棚に入れる」を押すと、本が一冊すべり込む */}
            <div style={{ position: 'relative', width: 64, height: 64, flex: 'none' }}>
              <ShelfArt />
              {shelved && (
                <span className="reader-invite-flybook" aria-hidden="true" />
              )}
              {shelved && (
                <span className="reader-invite-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </div>

            <div key={shelved ? 'done' : 'ask'} className="reader-invite-swap" style={{ minWidth: 0 }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.02em', color: '#172a36' }}>
                {shelved ? '本棚に入れました' : 'この作品を、本棚に入れておきませんか'}
              </p>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: '#4d5a62' }}>
                {shelved
                  ? 'いまはこの端末だけ。登録すると、どの端末でも続きから読めます。'
                  : 'あとから、すぐに続きが読めます。'}
              </p>
              {shelved && shelfCount >= 2 && (
                <p className="reader-invite-shelf">
                  この端末の本棚　<b>{shelfCount}</b> 冊
                </p>
              )}
            </div>
          </div>

          {shelved ? (
            <Link
              href={`/login?mode=signup&next=${back}`}
              onClick={() => setCornerOpen(false)}
              className="reader-invite-cta reader-invite-swap"
              style={{
                position: 'relative',
                overflow: 'hidden',
                display: 'block',
                marginTop: 16,
                textAlign: 'center',
                padding: '13px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2f6f93 0%, #1f4e6b 55%, #183f57 100%)',
                color: '#fff',
                fontSize: 14.5,
                letterSpacing: '0.04em',
                boxShadow: '0 8px 18px rgba(31, 78, 107, 0.26)',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              無料で会員登録する
            </Link>
          ) : null}
          {shelved ? (
            <button
              type="button"
              onClick={unshelve}
              style={{
                display: 'block',
                margin: '8px auto 0',
                border: 0,
                background: 'transparent',
                fontSize: 11.5,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              入れたのを取り消す
            </button>
          ) : (
            <button
              type="button"
              onClick={shelve}
              className="reader-invite-cta"
              style={{
                position: 'relative',
                overflow: 'hidden',
                display: 'block',
                width: '100%',
                marginTop: 16,
                padding: '13px',
                border: 0,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2f6f93 0%, #1f4e6b 55%, #183f57 100%)',
                color: '#fff',
                fontSize: 14.5,
                letterSpacing: '0.04em',
                boxShadow: '0 8px 18px rgba(31, 78, 107, 0.26)',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              本棚に入れる
            </button>
          )}
        </aside>
      )}

      <style>{`
        .reader-invite-in { animation: readerInviteIn .4s ease-out both; }
        .reader-invite-corner { bottom: 16px; animation: readerInviteCorner .6s cubic-bezier(.2,1.4,.4,1) both; }
        /* スマホは下の帯（タブ）の上に出す */
        @media (max-width: 767px) { .reader-invite-corner { bottom: 84px; } }
        @keyframes readerInviteIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes readerInviteSlide { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }

        /* ---- 効果（はっきり見えるように。きらめきは使わない） ---- */
        /* H：本棚の本が、ぽんぽんと立つ */
        .lia-book { transform-box: fill-box; transform-origin: 50% 100%; animation: readerInviteBook .55s .5s cubic-bezier(.3,1.7,.5,1) both; }
        /* H：「本棚に入れる」を押すと、本が一冊すべり込み、印が付く */
        .reader-invite-flybook { position: absolute; left: 46px; top: 8px; width: 9px; height: 26px; border-radius: 2px;
          background: #d98c6a; animation: readerInviteFly .7s cubic-bezier(.3,1.2,.5,1) forwards; }
        .reader-invite-check { position: absolute; right: -4px; top: -4px; width: 22px; height: 22px; border-radius: 999px;
          background: #2d7f4f; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 3px var(--color-bg-card, #fff); animation: readerInviteCheck .45s .55s cubic-bezier(.3,1.8,.5,1) both; }
        .reader-invite-swap { animation: readerInviteIn .4s .1s ease-out both; }
        /* 押し具：光がときどき横切り、やわらかく息をする */
        .reader-invite-cta { animation: readerInviteBreath 2.8s ease-in-out 1.2s 4; transition: transform .15s; }
        .reader-invite-cta::after {
          content: ""; position: absolute; top: 0; bottom: 0; left: -40%; width: 30%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent);
          transform: skewX(-18deg); animation: readerInviteSheen 3.2s 1s ease-in-out 3; pointer-events: none;
        }
        .reader-invite-cta:hover { transform: translateY(-2px); }
        .reader-invite-cta:hover::after { animation: readerInviteSheenOnce .8s ease-in-out both; }
        .reader-invite-shelf { display: inline-block; margin: 6px 0 0; padding: 3px 10px; border-radius: 999px; background: #eaf1f5;
          font-size: 11.5px; color: var(--color-brand); animation: readerInviteCheck .45s .7s cubic-bezier(.3,1.8,.5,1) both; }
        .reader-invite-shelf b { font-size: 13px; }
        @keyframes readerInviteBook { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes readerInviteFly { 0% { transform: translate(40px, -40px) rotate(40deg); opacity: 0 } 60% { opacity: 1 } 100% { transform: translate(-10px, 14px) rotate(0); opacity: 1 } }
        @keyframes readerInviteCheck { from { opacity: 0; transform: scale(.2) } to { opacity: 1; transform: none } }
        @keyframes readerInviteCorner { from { opacity: 0; transform: translateY(40px) scale(.95) } to { opacity: 1; transform: none } }
        @keyframes readerInviteBreath { 0%, 100% { box-shadow: 0 8px 18px rgba(31,78,107,.28) } 50% { box-shadow: 0 10px 26px rgba(31,78,107,.46) } }
        @keyframes readerInviteSheen { 0% { left: -40% } 35%, 100% { left: 120% } }
        @keyframes readerInviteSheenOnce { from { left: -40% } to { left: 120% } }

        @media (prefers-reduced-motion: reduce) {
          .reader-invite-in, .reader-invite-corner,
          .lia-book, .reader-invite-cta, .reader-invite-cta::after, .reader-invite-flybook,
          .reader-invite-check, .reader-invite-swap, .reader-invite-shelf { animation: none !important; }
        }
      `}</style>
    </>
  )
}
