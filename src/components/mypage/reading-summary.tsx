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

/*
 * 輪の色。
 *
 * ★ 4 つとも、はっきり違う色にする。
 *
 *   前は紺・緑・薄い縁・灰で組んでいた。
 *   どれも暗くて近く、輪の切れ目が見えなかった。
 *   割合の数字を読まないと分からないなら、輪の意味がない。
 *
 * ★ このサイトに元からある色から選ぶ。
 *   紺は帯の色、琥珀は本棚の板の色。
 *   新しい色を持ち込むより、見慣れた色のほうが落ち着く。
 */
const TONES = [
    '#24506b', // 紺。帯の色
    '#d09a4e', // 琥珀。本棚の板の色
    '#6f9f74', // 若草
    '#c5c2b8', // その他。灰
]

/*
 * 文庫本 1 冊ぶんの字数。
 *
 * ★ 数字だけでは、多いのか少ないのか分からない。
 *   17 万字と言われても、手応えにならない。
 *   本の冊数に直すと、読んだ量として感じられる。
 *
 * ★ 10 万字は目安。作品によって大きく違う。
 *   だから「約」と書く。
 */
export const BOOK_CHARS = 100000

/** 原稿用紙 1 枚ぶんの字数 */
export const SHEET_CHARS = 400

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

    /*
     * 先月の文字数。
     *
     * 増えたか減ったかが分かると、続ける手応えになる。
     * 先月の記録が無ければ出さない。
     */
    const [year, month] = at.split('-').map(Number)
    const back = new Date(year, month - 2, 1)
    const beforeKey = `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, '0')}`
    const before = months[beforeKey]?.chars ?? null

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
                    {/*
                      * 数と内訳を、横一列に並べる。
                      *
                      * ★ 幅を余らせない。
                      *   前は数字が左に固まり、右が空いていた。
                      *   3 つの塊で埋める。
                      *
                      * ★ 狭い画面では、順に下へ落ちる。
                      */}
                    <div
                        style={{
                            display: 'grid',
                            gap: '22px 28px',
                            gridTemplateColumns:
                                'repeat(auto-fit, minmax(250px, 1fr))',
                            alignItems: 'start',
                        }}
                    >
                        {/* 読んだ量 */}
                        <div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: 'var(--color-text-muted)',
                                    marginBottom: 4,
                                }}
                            >
                                読んだ文字数
                            </div>

                            <div
                                style={{
                                    fontSize: 34,
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                    color: 'var(--color-brand)',
                                    letterSpacing: '.01em',
                                }}
                            >
                                {now.chars.toLocaleString()}
                            </div>

                            {/*
                              * ★ 冊数に直す。
                              *   17 万字と言われても手応えにならない。
                              *   本の数にすると、読んだ量として感じられる。
                              */}
                            <div
                                style={{
                                    marginTop: 8,
                                    fontSize: 13,
                                    color: 'var(--color-text)',
                                    lineHeight: 1.8,
                                }}
                            >
                                文庫本にすると{' '}
                                <b style={{ fontSize: 17, color: 'var(--color-forest)' }}>
                                    約{(now.chars / BOOK_CHARS).toFixed(1)}
                                </b>{' '}
                                冊ぶん
                                <br />
                                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                    原稿用紙 {Math.round(now.chars / SHEET_CHARS).toLocaleString()} 枚
                                </span>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    gap: 22,
                                    marginTop: 14,
                                    paddingTop: 12,
                                    borderTop: '1px solid var(--color-brand-light)',
                                }}
                            >
                                <Figure label="作品数" value={String(now.works)} />
                                <Figure label="話数" value={String(now.episodes)} />
                                {before !== null && (
                                    <Figure
                                        label="先月とくらべて"
                                        value={
                                            (now.chars >= before ? '+' : '−') +
                                            Math.abs(now.chars - before).toLocaleString()
                                        }
                                    />
                                )}
                            </div>
                        </div>

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
export function Ring({ title, rows }: { title: string; rows: [string, number][] }) {
    const total = rows.reduce((sum, one) => sum + one[1], 0)
    if (total === 0) return null

    /*
     * 輪の太さ。
     *
     * ★ 細いと、割合の差が読み取れない。
     *   1 割と 2 割の違いが、線の長さでしか分からなくなる。
     *   太くすると、面積として目に入る。
     */
    const R = 36
    const WIDTH = 22
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
                <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
                    {rows.map(([name, value], index) => {
                        const length = (value / total) * C
                        const dash = `${length} ${C - length}`
                        const start = -offset
                        offset += length

                        return (
                            <circle
                                key={name}
                                cx="52"
                                cy="52"
                                r={R}
                                fill="none"
                                stroke={TONES[index % TONES.length]}
                                strokeWidth={WIDTH}
                                strokeDasharray={dash}
                                strokeDashoffset={start}
                                transform="rotate(-90 52 52)"
                            />
                        )
                    })}
                </svg>

                {/*
                  * ★ 割合は名前のすぐ横に置く。
                  *   端まで飛ばすと、目が横に長く動く。
                  *   名前が長いときは、名前のほうを切る。
                  */}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {rows.map(([name, value], index) => (
                        <li
                            key={name}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                fontSize: 12,
                                color: 'var(--color-text-muted)',
                                lineHeight: 2,
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
                                    maxWidth: 150,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {name}
                            </span>
                            <span
                                style={{
                                    flexShrink: 0,
                                    color: 'var(--color-text)',
                                    fontWeight: 600,
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {Math.round((value / total) * 100)}%
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
