'use client'

import { useEffect, useState } from 'react'

import { BOOK_CHARS, Ring, type Slice } from '@/components/mypage/reading-summary'

/**
 * ============================================================
 * 原石航路 Studio
 * ReadingRecap — 先月のまとめを、月が変わって最初に出す
 *
 * ★ 出すのは、月ごとに 1 回だけ。
 *
 *   出した月を端末に覚えておく。
 *   同じ月に何度来ても、二度は出ない。
 *
 * ★ 1 日でなくてもよい。
 *
 *   「1 日に開いたら」だと、1 日に来なかった人には
 *   一生出ない。月が変わって最初に来たときに出す。
 *   それがその人にとっての 1 日目。
 *
 * ★ 読んでいない月は出さない。
 *
 *   0 文字のまとめを見せられても、うれしくない。
 *   出さずに、覚えだけ立てて次の月へ回す。
 *
 * ★ 読む向きの人だけ。
 *   書くだけの人に読書のまとめを出しても、意味がない。
 * ============================================================
 */

/** 出した月を覚えておく場所 */
const SEEN_KEY = 'genseki:reading-recap'

interface Month {
    chars: number
    works: number
    episodes: number
    genres: Slice[]
    authors: Slice[]
}

function keyOf(date: Date) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7)
}

function labelOf(key: string) {
    const [year, month] = key.split('-')
    return `${year}年${Number(month)}月`
}

export default function ReadingRecap() {
    const [shown, setShown] = useState<{ key: string; data: Month } | null>(null)

    useEffect(() => {
        /* 先月の鍵 */
        const now = new Date()
        const back = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const last = keyOf(back)

        let seen: string | null = null
        try {
            seen = window.localStorage.getItem(SEEN_KEY)
        } catch {
            /* 覚えられない端末では、毎月 1 回きり出せない。
             * それでも出さないよりはよい */
        }

        if (seen === last) return

        let alive = true

        void (async () => {
            try {
                const res = await fetch('/api/mypage/reading')
                const data = await res.json()
                const month = data?.months?.[last] as Month | undefined

                /* 読んでいない月は出さず、覚えだけ立てる */
                if (!month || month.chars <= 0) {
                    try {
                        window.localStorage.setItem(SEEN_KEY, last)
                    } catch {
                        /* 覚えられなくても、実害はない */
                    }
                    return
                }

                if (alive) setShown({ key: last, data: month })
            } catch {
                /* 読めなければ出さない。次に来たときに、また試す */
            }
        })()

        return () => {
            alive = false
        }
    }, [])

    function close() {
        if (shown) {
            try {
                window.localStorage.setItem(SEEN_KEY, shown.key)
            } catch {
                /* 覚えられなければ、次も出る。害はない */
            }
        }
        setShown(null)
    }

    if (!shown) return null

    const { data } = shown

    return (
        <div
            onClick={close}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 900,
                background: 'rgba(26, 33, 29, .45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${labelOf(shown.key)}の読書`}
                style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-brand-border)',
                    borderRadius: 16,
                    padding: '26px 28px',
                    maxWidth: 620,
                    width: '100%',
                    maxHeight: '86vh',
                    overflowY: 'auto',
                }}
            >
                <p
                    style={{
                        fontSize: 11.5,
                        color: 'var(--color-text-muted)',
                        letterSpacing: '.1em',
                        marginBottom: 4,
                    }}
                >
                    先月のまとめ
                </p>

                <h2
                    style={{
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        color: 'var(--color-text)',
                        fontFamily: 'garamond, "Hiragino Mincho ProN", serif',
                        marginBottom: 18,
                    }}
                >
                    {labelOf(shown.key)}の読書
                </h2>

                <div style={{ marginBottom: 18 }}>
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
                            fontSize: 36,
                            fontWeight: 700,
                            lineHeight: 1.1,
                            color: 'var(--color-brand)',
                        }}
                    >
                        {data.chars.toLocaleString()}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text)' }}>
                        文庫本にすると{' '}
                        <b style={{ fontSize: 18, color: 'var(--color-forest)' }}>
                            約{(data.chars / BOOK_CHARS).toFixed(1)}
                        </b>{' '}
                        冊ぶん　／　{data.works}作品・{data.episodes}話
                    </div>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gap: '20px 24px',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        borderTop: '1px solid var(--color-brand-light)',
                        paddingTop: 18,
                    }}
                >
                    <Ring title="ジャンルの内訳" rows={data.genres} />
                    <Ring title="作者別の文字数" rows={data.authors} />
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 10,
                        marginTop: 22,
                    }}
                >
                    <a
                        href="/mypage?tab=history"
                        style={{
                            fontSize: 12.5,
                            color: 'var(--color-brand)',
                            textDecoration: 'none',
                            border: '1px solid var(--color-brand-border)',
                            borderRadius: 10,
                            padding: '8px 14px',
                        }}
                    >
                        閲覧履歴を見る
                    </a>
                    <button
                        type="button"
                        onClick={close}
                        style={{
                            fontSize: 12.5,
                            color: 'var(--color-text-inverse)',
                            background: 'var(--color-brand)',
                            border: 'none',
                            borderRadius: 10,
                            padding: '8px 18px',
                            cursor: 'pointer',
                        }}
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    )
}
