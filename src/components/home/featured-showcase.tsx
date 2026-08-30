'use client'

import { useState } from 'react'
import Link from 'next/link'

import { COVERS, hashOf } from '@/components/home/home-work-table'

/**
 * ============================================================
 * 原石航路 Studio
 * FeaturedShowcase — 受賞作品・運営のおすすめの見せ場
 *
 * 板の上に本を 1 冊置き、横に賞の名前を吹き出しで出す。
 * 左右の矢印で次の作品へ送る。
 *
 * ★ 本の作りは、執筆向けホームの作品一覧をそのまま持ってきた。
 *
 *     大きさ    128 × 166px
 *     紙の端    右に 5px。上下 2px 内側
 *     表紙      その左。左角 2px、右角 4px
 *     背の影    左に 7px
 *     題名      上から 22% の位置に、中央そろえで 2 行まで
 *
 *   数字を変えると別の本に見えるので、そのまま使う。
 *
 * ★ 本棚（home.js）には触っていない。
 *   ここは数字と CSS だけで描いている。
 * ============================================================
 */

/** 執筆向けホームと同じ寸法。変えると別の本に見える */
const BOOK_WIDTH = 128
const BOOK_HEIGHT = 166
const SPINE = 7
const EDGE = 5
const TITLE_SIZE = 12

export interface FeaturedItem {
    id: string
    href: string
    title: string
    author: string
    /** 賞の名前。受賞のときだけ入る */
    label?: string
}

export default function FeaturedShowcase({
    title,
    items,
}: {
    title: string
    items: FeaturedItem[]
}) {
    const [at, setAt] = useState(0)

    if (items.length === 0) return null

    const item = items[at]
    const cover = COVERS[hashOf(item.title || item.id) % COVERS.length]

    /* 端まで来たら反対の端へ回る */
    const go = (step: 1 | -1) =>
        setAt((now) => (now + step + items.length) % items.length)

    return (
        <div className="fs">
            <div className="fs_title">{title}</div>

            <div className="fs_stage book-shelf-area">
                {items.length > 1 && (
                    <button type="button" onClick={() => go(-1)}
                        className="fs_arrow fs_arrow-prev" aria-label="前の作品">
                        ‹
                    </button>
                )}

                <div className="fs_center">
                    <div style={{ position: 'relative', width: BOOK_WIDTH, height: BOOK_HEIGHT }}>
                        {/*
                          * 板に落ちる影。
                          * 本の下に薄く敷く。無いと宙に浮いて見える。
                          */}
                        <span aria-hidden="true" style={{
                            position: 'absolute', bottom: -4, left: '8%', right: '4%', height: 5,
                            background: 'rgba(70, 45, 25, 0.16)', filter: 'blur(3px)',
                        }} />

                        <Link href={item.href} className="fs_book" title={item.title}>
                            {/* 紙の端 */}
                            <span style={{
                                position: 'absolute', top: 2, bottom: 2, right: 0,
                                width: EDGE, borderRadius: '0 3px 3px 0',
                                background: 'repeating-linear-gradient(90deg, #ebe4d5 0 1px, #f8f4ec 1px 2px)',
                                boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.10)',
                            }} />

                            {/* 表紙 */}
                            <span style={{
                                position: 'absolute', top: 0, bottom: 0, left: 0, right: EDGE - 2,
                                overflow: 'hidden',
                                borderRadius: '2px 4px 4px 2px',
                                background: cover.base,
                                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.07)',
                            }}>
                                {/* 背の側の影 */}
                                <span style={{
                                    position: 'absolute', top: 0, bottom: 0, left: 0, width: SPINE,
                                    background: 'linear-gradient(90deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.05) 60%, rgba(255,255,255,0.10) 100%)',
                                }} />

                                {/* 上からの光 */}
                                <span style={{
                                    position: 'absolute', inset: 0,
                                    background: 'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.06) 100%)',
                                }} />

                                {/* 題名。上から 22% の位置に、中央そろえで 2 行まで */}
                                <span style={{
                                    position: 'absolute', left: 0, right: 0,
                                    top: Math.round(BOOK_HEIGHT * 0.22),
                                    padding: `0 12px 0 ${SPINE + 10}px`,
                                }}>
                                    <span className="fs_book-title"
                                        style={{ fontSize: TITLE_SIZE, color: cover.ink }}>
                                        {item.title}
                                    </span>
                                </span>

                                {/* 作者名。下に小さく */}
                                <span style={{
                                    position: 'absolute', left: SPINE + 10, right: 12, bottom: 12,
                                    fontSize: 10, lineHeight: 1.5, color: cover.ink, opacity: .68,
                                }}>
                                    著：{item.author}
                                </span>
                            </span>
                        </Link>
                    </div>

                    {/*
                      * 吹き出しと、その下に題名。
                      * 本の横にまとめて置く。
                      */}
                    {/*
                      * 吹き出し。
                      *
                      * 題名と作者名は表紙に乗っているので、横には出さない。
                      * 同じ文字を 2 度出しても場所を取るだけ。
                      *
                      * 賞の名前が無いときは「今週のおすすめ作品」と出す。
                      * 空の吹き出しは、置いてあるだけで意味がない。
                      */}
                    <span className="fs_bubble">
                        {item.label || '今週のおすすめ作品'}
                    </span>
                </div>

                {items.length > 1 && (
                    <button type="button" onClick={() => go(1)}
                        className="fs_arrow fs_arrow-next" aria-label="次の作品">
                        ›
                    </button>
                )}

                {/*
                  * 板。
                  *
                  * ★ globals.css の .book-shelf-board をそのまま使う。
                  *   執筆向けホームと同じもの。
                  *   本体・上面・影の 3 層でできていて、
                  *   上面が台形に切られているから奥行きが出る。
                  *
                  *   自分で帯を書くと、ただの色の変化になって平らに見える。
                  */}
                <div className="book-shelf-board" aria-hidden="true" />
            </div>


            {items.length > 1 && (
                <div className="fs_dots">
                    {items.map((one, i) => (
                        <button key={one.id} type="button" onClick={() => setAt(i)}
                            className={`fs_dot${i === at ? ' is-on' : ''}`}
                            aria-label={`${i + 1} 冊目`} />
                    ))}
                </div>
            )}
        </div>
    )
}
