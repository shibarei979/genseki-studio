'use client'

/**
 * ============================================================
 * 原石航路
 * EpisodeChunks — 話が多いときに束ねて出す
 *
 * 100 話を超える作品では、目次に全部並べると
 * 目当ての話まで指を送り続けることになる。
 * 50 話ずつの束にして、押した束だけ開く。
 *
 * 最後の束は開いた状態で始める。
 * 続きを読みに来た人は、たいてい最新話に用がある。
 * ============================================================
 */

import { useState } from 'react'

/** これを超えたら束ねる */
export const CHUNK_THRESHOLD = 100

/** 1 つの束に入れる数 */
export const CHUNK_SIZE = 50

export default function EpisodeChunks({
  episodes,
  renderRow,
}: {
  episodes: { id: string; title?: string }[]
  /** 1 話ぶんの行。呼ぶ側の見た目をそのまま使う */
  renderRow: (episode: { id: string; title?: string }, index: number) => React.ReactNode
}) {
  const chunks: { from: number; to: number; items: typeof episodes }[] = []

  for (let at = 0; at < episodes.length; at += CHUNK_SIZE) {
    chunks.push({
      from: at + 1,
      to: Math.min(at + CHUNK_SIZE, episodes.length),
      items: episodes.slice(at, at + CHUNK_SIZE),
    })
  }

  /* 最後の束だけ開いておく */
  const [openIndexes, setOpenIndexes] = useState<number[]>([chunks.length - 1])

  function toggle(index: number) {
    setOpenIndexes((list) =>
      list.includes(index) ? list.filter((at) => at !== index) : [...list, index],
    )
  }

  return (
    <div>
      {chunks.map((chunk, index) => {
        const isOpen = openIndexes.includes(index)
        return (
          <div key={index}>
            <button
              type="button"
              onClick={() => toggle(index)}
              aria-expanded={isOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                gap: 10,
                padding: '11px 14px',
                borderBottom: '1px solid var(--color-brand-light)',
                background: isOpen ? 'var(--color-bg)' : 'var(--color-bg-card)',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                {chunk.from}〜{chunk.to}話
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                }}
              >
                {chunk.items.length}話
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    transition: 'transform .15s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                  }}
                >
                  ▾
                </span>
              </span>
            </button>

            {isOpen && (
              <div>
                {chunk.items.map((episode, at) =>
                  renderRow(episode, chunk.from - 1 + at),
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
