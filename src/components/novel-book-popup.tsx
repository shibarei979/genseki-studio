'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

/**
 * ============================================================
 * 原石航路
 * NovelBookPopup — 作品を本の見開きで見せる
 *
 * 札（NovelPreviewPopup）と同じ受け口にしてある。
 * マイページの設定で、どちらを出すか切り替える。
 *
 * 右ページに題名と著者、左ページにあらすじ。
 * 狭い画面では見開きをやめ、右ページだけを出す。
 * 2 ページ並べると、どちらも読めない幅になる。
 * ============================================================
 */

interface Props {
  novel: {
    id: string
    title: string
    genre: string
    novel_type?: string
    summary?: string | null
    catchcopy?: string | null
    display_name?: string
    like_count?: number
    tags?: string[]
  }
  children: React.ReactNode
}

export default function NovelBookPopup({ novel, children }: Props) {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsNarrow(window.innerWidth <= 720)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* 開いている間は、後ろを動かさない */
  useEffect(() => {
    if (!show) return
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [show])

  const summary = (novel.summary || novel.catchcopy || '').trim()

  return (
    <>
      <div onClick={() => setShow(true)} style={{ cursor: 'pointer' }}>
        {children}
      </div>

      {mounted && show && createPortal(
        <div
          onClick={() => setShow(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(20,30,40,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              display: 'flex',
              width: isNarrow ? 'min(420px,100%)' : 'min(900px,100%)',
              height: isNarrow ? 'min(560px,86vh)' : 'min(600px,84vh)',
              background: '#fdfcf8',
              borderRadius: 6,
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            {/* 左ページ。あらすじ */}
            {!isNarrow && (
              <div style={{
                position: 'relative',
                flex: 1,
                padding: '52px 44px',
                borderRight: '1px solid rgba(0,0,0,0.06)',
                background: 'linear-gradient(90deg,#fdfcf8 0%,#fdfcf8 92%,#f2ece0 100%)',
              }}>
                <p style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  fontSize: 15,
                  lineHeight: 2.3,
                  letterSpacing: '.05em',
                  height: '100%',
                  margin: 0,
                  color: 'var(--color-text)',
                  overflow: 'hidden',
                }}>
                  {summary || 'あらすじは書かれていません。'}
                </p>
              </div>
            )}

            {/* 右ページ。題名・著者・タグ・読む */}
            <div style={{
              position: 'relative',
              flex: 1,
              padding: '52px 44px 110px',
              background: 'linear-gradient(270deg,#fdfcf8 0%,#fdfcf8 92%,#f2ece0 100%)',
            }}>
              <button
                type="button"
                onClick={() => setShow(false)}
                aria-label="閉じる"
                style={{
                  position: 'absolute', top: 14, right: 14,
                  width: 32, height: 32, borderRadius: '50%',
                  border: 'none', background: 'var(--color-brand)',
                  color: '#fff', fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>

              {/*
               * 題名と著者。
               *
               * 縦書きで、別の列に分ける。
               * 続けて置くと同じ列に流れ込む。
               */}
              <div style={{
                display: 'flex',
                flexDirection: 'row-reverse',
                justifyContent: 'center',
                alignItems: 'flex-start',
                gap: 18,
                height: 'calc(100% - 40px)',
              }}>
                <p style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  fontSize: 26,
                  lineHeight: 1.4,
                  margin: 0,
                  maxHeight: '100%',
                  color: 'var(--color-text)',
                }}>
                  {novel.title}
                </p>

                {novel.display_name && (
                  <p style={{
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    fontSize: 13,
                    margin: 0,
                    color: 'var(--color-text-muted)',
                  }}>
                    著　{novel.display_name}
                  </p>
                )}
              </div>

              {/* 下。タグと読む */}
              <div style={{ position: 'absolute', left: 44, right: 44, bottom: 34 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {[novel.genre, ...(novel.tags || [])].filter(Boolean).slice(0, 4).map((tag, i) => (
                    <span key={i} style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11,
                      border: '1px solid var(--color-brand-border)',
                      color: 'var(--color-text-muted)',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>

                <Link
                  href={`/novel/${novel.id}`}
                  style={{
                    display: 'block', textAlign: 'center',
                    padding: '11px 0', borderRadius: 8,
                    background: 'var(--color-brand)', color: '#fff',
                    fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  この本を読む　→
                </Link>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
