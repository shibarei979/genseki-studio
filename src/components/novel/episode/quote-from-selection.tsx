'use client'

import { useEffect, useState } from 'react'

import { useQuote } from '@/components/novel/episode/quote-context'

/**
 * ============================================================
 * 原石航路 Studio
 * QuoteFromSelection — なぞった文を引用する
 *
 * ★ なぜ足したか。
 *
 *   引用は「本文から引用する」を押してから、
 *   本文の文を押す作り。押す順が決まっている。
 *
 *   その押し具はコメント欄の中にあり、本文のずっと下。
 *   読んでいる人は、本文の途中で引用したくなる。
 *   そこで指で文をなぞる。長く押すので、
 *   携帯は虫めがねを出す。引用にはならない。
 *
 *   なぞる、という自然なやり方でも引けるようにする。
 *
 * ★ 本文の中で選んだときだけ出す。
 *   コメントや見出しをなぞっても出さない。
 *   本文の文には data-sentence が付いているので、それで見分ける。
 *
 * ★ 押し具は画面の下に横一本で出す。
 *   選んだ所のそばに出すと、
 *   携帯が出す「コピー」の小窓と場所を取り合う。
 * ============================================================
 */

/** 引ける長さの上と下 */
const MIN_LENGTH = 2
const MAX_LENGTH = 200

export default function QuoteFromSelection() {
    const { setQuotedText, setSelecting, commentAnchorRef } = useQuote()
    const [picked, setPicked] = useState('')

    useEffect(() => {
        function read() {
            const selection = window.getSelection?.()

            if (!selection || selection.isCollapsed) {
                setPicked('')
                return
            }

            const text = selection.toString().trim()
            if (text.length < MIN_LENGTH) {
                setPicked('')
                return
            }

            /* 本文の中で選んだものか確かめる */
            let node: Node | null = selection.anchorNode
            let inBody = false

            while (node) {
                if (
                    node instanceof HTMLElement &&
                    node.hasAttribute('data-sentence')
                ) {
                    inBody = true
                    break
                }
                node = node.parentNode
            }

            if (!inBody) {
                setPicked('')
                return
            }

            setPicked(text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH) : text)
        }

        document.addEventListener('selectionchange', read)
        return () => document.removeEventListener('selectionchange', read)
    }, [])

    if (!picked) return null

    return (
        <div
            style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
                zIndex: 80,
                display: 'flex',
                justifyContent: 'center',
                padding: '0 16px',
                /* 下の本文を押せるように、帯そのものは素通りさせる */
                pointerEvents: 'none',
            }}
        >
            <button
                type="button"
                onClick={() => {
                    setQuotedText(picked)

                    /*
                     * 押す順の引用が動いていたら、そちらは止める。
                     * 両方が動いていると、次に押した文まで引かれる。
                     */
                    setSelecting(false)

                    window.getSelection?.()?.removeAllRanges()
                    setPicked('')

                    commentAnchorRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                    })
                }}
                style={{
                    pointerEvents: 'auto',
                    maxWidth: 420,
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--color-brand)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(40, 35, 25, .28)',
                }}
            >
                なぞった文を引用する
            </button>
        </div>
    )
}
