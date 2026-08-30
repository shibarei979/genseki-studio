'use client'

import Link from 'next/link'

import { COVERS, hashOf } from '@/components/home/home-work-table'

/**
 * ============================================================
 * 原石航路 Studio
 * FeaturedShowcase — 受賞作品・運営のおすすめの見せ場
 *
 * 板の上に本を 3 冊、横に並べる。
 * 吹き出しは全体に 1 つだけ、見出しの横に出す。
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

/** 一度に並べる冊数 */
const SHOW = 3

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
    if (items.length === 0) return null

    const shown = items.slice(0, SHOW)

    /*
     * 吹き出しの言葉。
     *
     * 賞の名前が 1 つでもあれば、それを出す。
     * 無ければ「今週のおすすめ作品」。
     * 3 冊それぞれに付けると、同じ札が 3 つ並んで煩い。
     */
    const bubble = shown.find((one) => one.label)?.label || '今週のおすすめ作品'

    return (
        <div className="fs">
            <div className="fs_head">
                <span className="fs_title">{title}</span>
                <span className="fs_bubble">{bubble}</span>
            </div>

            <div className="fs_stage book-shelf-area">
                <div className="fs_row">
                    {shown.map((item) => {
                        const cover = COVERS[hashOf(item.title || item.id) % COVERS.length]

                        return (
                            <div
                                key={item.id}
                                style={{ position: 'relative', width: BOOK_WIDTH, height: BOOK_HEIGHT }}
                            >
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
                        )
                    })}
                </div>

                {/*
                  * 板。
                  *
                  * ★ globals.css の .book-shelf-board をそのまま使う。
                  *   執筆向けホームと同じもの。
                  *   本体・上面・影の 3 層でできていて、
                  *   上面が台形に切られているから奥行きが出る。
                  */}
                <div className="book-shelf-board" aria-hidden="true" />
            </div>
        </div>
    )
}
