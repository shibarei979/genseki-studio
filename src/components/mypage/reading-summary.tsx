'use client'

import { useEffect, useState } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * ReadingSummary — その月に読んだ量
 *
 * ★ 閲覧履歴の上に置く。
 *
 *   履歴は「何を読んだか」、これは「どれだけ読んだか」。
 *   同じものの 2 つの見方なので、同じ場所にある。
 *
 * ★ 1 話につき 1 回だけ数えている（入口の側で）。
 *   読み返しても文字数は増えない。
 *
 * ★ 輪の図は、線だけで描く。
 *   塗りつぶした円を並べると、頁の中で強く出すぎる。
 *   このサイトは本の色で組んであるので、細い輪にする。
 * ============================================================
 */

interface Month {
    chars: number
    works: number
    episodes: number
    genres: [string, number][]
    authors: [string, number][]
}

/* 輪の色。濃い順に。数が多いほど濃くする */
const TONES = [
    'var(--color-brand)',
    'var(--color-forest)',
    'var(--color-brand-border)',
    'var(--color-text-faint)',
]

function monthKey(date: Date) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7)
}

function monthLabel(key: string) {
    const [year, month] = key.split('-')
    return `${year}年${Number(month)}月`
}

export default function ReadingSummary() {
    const [months, setMonths] = useState<Record<string, Month> | null>(null)
    const [at, setAt] = useState(() => monthKey(new Date()))

    useEffect(() => {
        let alive = true
        void (async () => {
            try {
                const res = await fetch('/api/mypage/reading')
                const data = await res.json()
                if (alive) setMonths(data.months ?? {})
            } catch {
                if (alive) setMonths({})
            }
        })()
        return () => {
            alive = false
        }
    }, [])

    /* 月を送る。記録の無い月も出す。0 と分かるほうがよい */
    function step(direction: -1 | 1) {
        const [year, month] = at.split('-').map(Number)
        const next = new Date(year, month - 1 + direction, 1)
        setAt(
            `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
        )
    }

    if (!months) return null

    const now = months[at]
    const isThisMonth = at >= monthKey(new Date())

    return (
        <div
            style={{
                border: '1px solid var(--color-brand-border)',
                borderRadius: 14,
                background: 'var(--color-bg-card)',
                padding: '18px 20px',
                marginBottom: 20,
            }}
        >
            {/* 月と、送り */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                }}
            >
                <span
                    style={{
                        fontSize: 19,
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        color: 'var(--color-text)',
                        fontFamily: 'garamond, "Hiragino Mincho ProN", serif',
                    }}
                >
                    {monthLabel(at)}の読書
                </span>

                <span style={{ display: 'flex', gap: 6 }}>
                    <button
                        type="button"
                        onClick={() => step(-1)}
                        aria-label="前の月"
                        style={arrowStyle}
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        onClick={() => step(1)}
                        aria-label="次の月"
                        disabled={isThisMonth}
                        style={{
                            ...arrowStyle,
                            opacity: isThisMonth ? 0.35 : 1,
                            cursor: isThisMonth ? 'default' : 'pointer',
                        }}
                    >
                        ›
                    </button>
                </span>
            </div>

            {!now ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-faint)', lineHeight: 1.8 }}>
                    この月は、まだ読んだ記録がありません。
                </p>
            ) : (
                <>
                    {/* 数 */}
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '18px 40px',
                            marginBottom: 20,
                        }}
                    >
                        <Figure label="読んだ文字数" value={now.chars.toLocaleString()} big />
                        <Figure label="作品数" value={String(now.works)} />
                        <Figure label="話数" value={String(now.episodes)} />
                    </div>

                    {/* 内訳 */}
                    <div
                        style={{
                            display: 'grid',
                            gap: 20,
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            borderTop: '1px solid var(--color-brand-light)',
                            paddingTop: 18,
                        }}
                    >
                        <Ring title="ジャンルの内訳" rows={now.genres} />
                        <Ring title="作者別の文字数" rows={now.authors} />
                    </div>

                    <p
                        style={{
                            fontSize: 10.5,
                            color: 'var(--color-text-faint)',
                            lineHeight: 1.8,
                            marginTop: 16,
                        }}
                    >
                        同じ話を読み返しても、文字数は増えません。1話につき1回だけ数えています。
                        <br />
                        入っていない状態で読んだぶんは、記録に残りません。
                    </p>
                </>
            )}
        </div>
    )
}

const arrowStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '1px solid var(--color-brand-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-brand)',
    fontSize: 16,
    lineHeight: 1,
    cursor: 'pointer',
}

function Figure({
    label,
    value,
    big = false,
}: {
    label: string
    value: string
    big?: boolean
}) {
    return (
        <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>
                {label}
            </div>
            <div
                style={{
                    fontSize: big ? 28 : 20,
                    fontWeight: 700,
                    color: big ? 'var(--color-brand)' : 'var(--color-text)',
                    letterSpacing: '.02em',
                }}
            >
                {value}
            </div>
        </div>
    )
}

/**
 * 輪の図。
 *
 * ★ 塗らずに、太い線で描く。
 *   円を塗ると頁の中で強く出すぎる。
 *   本の色で組んだ画面に、色の円が浮く。
 *
 * ★ 真ん中は空ける。合計を置く場所にもなる。
 */
function Ring({ title, rows }: { title: string; rows: [string, number][] }) {
    const total = rows.reduce((sum, one) => sum + one[1], 0)
    if (total === 0) return null

    const R = 34
    const C = 2 * Math.PI * R

    let offset = 0

    return (
        <div>
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    marginBottom: 10,
                }}
            >
                {title}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
                    {rows.map(([name, value], index) => {
                        const length = (value / total) * C
                        const dash = `${length} ${C - length}`
                        const start = -offset
                        offset += length

                        return (
                            <circle
                                key={name}
                                cx="44"
                                cy="44"
                                r={R}
                                fill="none"
                                stroke={TONES[index % TONES.length]}
                                strokeWidth="12"
                                strokeDasharray={dash}
                                strokeDashoffset={start}
                                transform="rotate(-90 44 44)"
                            />
                        )
                    })}
                </svg>

                <ul style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 0, flex: 1 }}>
                    {rows.map(([name, value], index) => (
                        <li
                            key={name}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                fontSize: 11.5,
                                color: 'var(--color-text-muted)',
                                lineHeight: 2,
                                minWidth: 0,
                            }}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    width: 9,
                                    height: 9,
                                    borderRadius: 2,
                                    flexShrink: 0,
                                    background: TONES[index % TONES.length],
                                }}
                            />
                            <span
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {name}
                            </span>
                            <span style={{ flexShrink: 0, color: 'var(--color-text-faint)' }}>
                                {Math.round((value / total) * 100)}%
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
