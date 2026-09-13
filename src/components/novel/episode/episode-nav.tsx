'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeNav — 次の話・前の話
 *
 * ★ 読む向きに合わせて並べる。
 *
 *   縦書きは右から左へ読み進む。
 *   そこで「次の話」が右にあると、
 *   読んできた向きと逆になって手が止まる。
 *
 *     縦書き  ← 次の話    目次    前の話 →
 *     横書き  ← 前の話    目次    次の話 →
 *
 * ★ 読む人が選んだ向きを見る。
 *
 *   作品の推奨だけを見ていた頃は、
 *   読む人が横書きに切り替えても並びが変わらなかった。
 *   向きは端末に覚えてあるので、そちらを読む。
 *
 * ★ 読めるまでは、作品の推奨で出す。
 *
 *   端末の覚えは、画面が出たあとでないと読めない。
 *   その間だけ推奨に従い、読めたら合わせ直す。
 *   何も出さないより、一瞬違うほうがまし。
 * ============================================================
 */

interface Props {
    novelId: string
    prev: { id: string; title: string } | null
    next: { id: string; title: string } | null
    /** 作者が「こちらで読んでほしい」と決めた向き */
    recommended: 'vertical' | 'horizontal' | null
    /** 小さく出すか。頁の上に置くときは true */
    compact?: boolean
    /** 次が無いときに、代わりに出すもの */
    tail?: React.ReactNode
}

const STORAGE_KEY = 'reading_settings'

export default function EpisodeNav({
    novelId,
    prev,
    next,
    recommended,
    compact = false,
    tail,
}: Props) {
    /* 初めは作品の推奨に従う。決めていなければ縦書き */
    const [isVertical, setIsVertical] = useState(recommended !== 'horizontal')

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (!saved) return

            const parsed = JSON.parse(saved) as {
                writingMode?: string
                writingModeChosen?: boolean
            }

            /*
             * ★ 読む人が自分で選んだときだけ、そちらに従う。
             *
             *   選んでいなければ、作品の推奨のまま。
             *   「決めていない」と「横書きを選んだ」は違う。
             */
            if (parsed.writingModeChosen === true && parsed.writingMode) {
                setIsVertical(parsed.writingMode === 'vertical')
            }
        } catch {
            /* 読めなくても、推奨で出せばよい */
        }
    }, [])

    const prevLabel = isVertical ? '前の話 →' : '← 前の話'
    const nextLabel = isVertical ? '← 次の話' : '次の話 →'

    if (compact) {
        const navBtn: React.CSSProperties = {
            fontSize: 13,
            color: 'var(--color-brand)',
            textDecoration: 'none',
        }

        const prevLink = prev ? (
            <Link href={`/novel/${novelId}/episode/${prev.id}`} style={navBtn}>
                {prevLabel}
            </Link>
        ) : (
            <div />
        )

        const nextLink = next ? (
            <Link href={`/novel/${novelId}/episode/${next.id}`} style={navBtn}>
                {nextLabel}
            </Link>
        ) : (
            <div />
        )

        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    gap: 8,
                }}
            >
                {isVertical ? nextLink : prevLink}

                <Link
                    href={`/novel/${novelId}`}
                    style={{ ...navBtn, color: 'var(--color-text-muted)' }}
                >
                    目次
                </Link>

                {isVertical ? prevLink : nextLink}
            </div>
        )
    }

    const cardBase: React.CSSProperties = {
        flex: 1,
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--color-brand)',
        padding: '10px',
        borderRadius: 10,
        textDecoration: 'none',
    }

    return (
        /*
         * ★ 並びの向きだけを変える。
         *   中身を書き分けると、片方だけ直し忘れる。
         */
        <div
            style={{
                display: 'flex',
                flexDirection: isVertical ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 16,
            }}
        >
            {prev ? (
                <Link
                    href={`/novel/${novelId}/episode/${prev.id}`}
                    style={{
                        ...cardBase,
                        border: '1.5px solid var(--color-brand-border)',
                        background: 'var(--color-bg-card)',
                    }}
                >
                    {prevLabel}
                    <br />
                    <span
                        style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
                    >
                        {prev.title}
                    </span>
                </Link>
            ) : (
                <div style={{ flex: 1 }} />
            )}

            {next ? (
                <Link
                    href={`/novel/${novelId}/episode/${next.id}`}
                    style={{
                        ...cardBase,
                        border: '1.5px solid var(--color-brand)',
                        background: 'var(--color-brand-light)',
                    }}
                >
                    {nextLabel}
                    <br />
                    <span
                        style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
                    >
                        {next.title}
                    </span>
                </Link>
            ) : (
                <div style={{ flex: 1 }}>{tail}</div>
            )}
        </div>
    )
}
