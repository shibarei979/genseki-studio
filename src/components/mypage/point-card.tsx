'use client'

import { useEffect, useState } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * PointCard — マイページに出す、無料ポイントの枠
 *
 * ★ 携帯では、ここだけが見せ場。
 *
 *   頭の帯は狭いので、携帯では出していない。
 *   ここに無いと、自分が何ポイント持っているか
 *   確かめる場所が無くなる。
 *
 * ★ 次に消える日も出す。
 *
 *   半年で消えるので、出さないと
 *   「知らないうちに減った」になる。
 *
 * ★ 有料ポイントは、まだ無い。
 *   できたら、ここに並べて出す。
 * ============================================================
 */

/**
 * 消えるまで 1 か月を切っているか。
 *
 * ★ それより前から出しても、目に入らなくなる。
 *   本当に気にしてほしいのは、消える間際。
 */
function isSoon(at: string): boolean {
    const left = new Date(at).getTime() - Date.now()
    if (Number.isNaN(left)) return false

    const month = 1000 * 60 * 60 * 24 * 30
    return left <= month
}

export default function PointCard() {
    const [free, setFree] = useState<number | null>(null)
    const [expiresAt, setExpiresAt] = useState<string | null>(null)
    const [expiresAmount, setExpiresAmount] = useState(0)

    useEffect(() => {
        let alive = true

        void (async () => {
            try {
                const response = await fetch('/api/points/me')
                if (!response.ok) return

                const data = (await response.json()) as {
                    free?: number
                    nextExpiresAt?: string | null
                    nextExpiresAmount?: number
                }

                if (!alive || typeof data.free !== 'number') return

                setFree(data.free)
                setExpiresAt(data.nextExpiresAt ?? null)
                setExpiresAmount(data.nextExpiresAmount ?? 0)
            } catch {
                /* 読めなくても、ほかは動く */
            }
        })()

        return () => {
            alive = false
        }
    }, [])

    /* 読めていないあいだは、場所を取らない */
    if (free === null) return null

    return (
        <section
            style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-brand-border)',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 16,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
                <span
                    style={{
                        fontSize: 11.5,
                        color: 'var(--color-text-muted)',
                        letterSpacing: '.04em',
                    }}
                >
                    無料ポイント
                </span>

                <span
                    style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: 'var(--color-brand)',
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.1,
                    }}
                >
                    {free.toLocaleString()}
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 400,
                            marginLeft: 3,
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        pt
                    </span>
                </span>
            </div>

            {/*
              * 次に消える日。
              *
              * ★ 1 か月前から出す。
              *
              *   半年先の日付を毎日見せても、
              *   そのうち目に入らなくなる。
              *   本当に気にしてほしいのは、消える間際。
              *
              * ★ 出さないと「知らないうちに減った」になる。
              * ★ 何も持っていない人には出さない。
              */}
            {free > 0 && expiresAt && isSoon(expiresAt) && (
                <p
                    style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: 'var(--color-text-faint)',
                    }}
                >
                    {/*
                      * ★ 短く。
                      *
                      *   年は要らない。1 か月前から出すので、
                      *   同じ年か、せいぜい年をまたぐ程度。
                      *   「消えます」だけで、使わないと、は言わずに済む。
                      */}
                    {new Date(expiresAt).toLocaleDateString('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        month: 'numeric',
                        day: 'numeric',
                    })}
                    に {expiresAmount.toLocaleString()} pt 消えます
                </p>
            )}

            {free === 0 && (
                <p
                    style={{
                        marginTop: 6,
                        fontSize: 11,
                        lineHeight: 1.8,
                        color: 'var(--color-text-faint)',
                    }}
                >
                    ミッションを達成すると貯まります。
                </p>
            )}
        </section>
    )
}
