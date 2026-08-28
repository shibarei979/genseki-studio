'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * SideScroller — 横に送って見る帯
 *
 * ジャンルの札は数が多く、画面の幅に収まらない。
 *
 * これまでも横へは送れたが、送り具（スクロールバー）を
 * 隠していたので、続きがあることに気づけなかった。
 * 折り返すと 2 段 3 段になり、下の一覧が押し下げられる。
 *
 * 矢印を出す。送りきったほうの矢印は消す。
 * 出しっぱなしにすると、押せない矢印を押させることになる。
 *
 * 触る画面では指で送れるので、矢印は邪魔になりにくい
 * 位置（両端に重ねる）に置く。
 * ============================================================
 */

export default function SideScroller({
    children,
    /** 一度に送る幅。決めなければ見えている幅の 7 割 */
    step,
    label = '横に送る',
}: {
    children: React.ReactNode
    step?: number
    label?: string
}) {
    const track = useRef<HTMLDivElement>(null)
    const [canLeft, setCanLeft] = useState(false)
    const [canRight, setCanRight] = useState(false)

    const update = useCallback(() => {
        const el = track.current
        if (!el) return

        /* 1px の誤差で矢印が出たり消えたりするので、少し余裕を持たせる */
        setCanLeft(el.scrollLeft > 4)
        setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }, [])

    useEffect(() => {
        const el = track.current
        if (!el) return

        update()
        el.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update)

        /*
         * 中身は文字なので、字体が届いたあとに幅が変わる。
         * 最初の一度だけでは、送れるかどうかを読み違える。
         */
        const timer = window.setTimeout(update, 300)

        return () => {
            el.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
            window.clearTimeout(timer)
        }
    }, [update])

    function go(direction: -1 | 1) {
        const el = track.current
        if (!el) return
        const width = step ?? Math.max(160, el.clientWidth * 0.7)
        el.scrollBy({ left: direction * width, behavior: 'smooth' })
    }

    const arrow = (side: 'left' | 'right'): React.CSSProperties => ({
        position: 'absolute',
        [side]: -4,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: '50%',
        border: '1px solid var(--color-brand-border)',
        background: 'var(--color-bg-card)',
        color: 'var(--color-brand)',
        cursor: 'pointer',
        padding: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,.14)',
    })

    return (
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            {canLeft && (
                <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label={`${label}（左へ）`}
                    style={arrow('left')}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="3"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
            )}

            <div
                ref={track}
                style={{
                    overflowX: 'auto',
                    /*
                     * 送り具は隠す。矢印で伝わるので、
                     * 太い棒が札の下に出ると窮屈になる。
                     */
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                    minWidth: 0,
                } as React.CSSProperties}
            >
                <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                    {children}
                </div>
            </div>

            {canRight && (
                <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label={`${label}（右へ）`}
                    style={arrow('right')}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="3"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            )}
        </div>
    )
}
