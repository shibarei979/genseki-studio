'use client'

import Link from 'next/link'

import { COVERS, hashOf } from '@/components/home/home-work-table'

/**
 * ============================================================
 * 原石航路 Studio
 * WorkShelf — 作品を本の形で並べる
 *
 * 作品を探す・ランキングで、文字の一覧と切り替えて使う。
 *
 * ★ 本の描き方は、執筆向けホームのものをそのまま使う。
 *   同じサイトで本の見た目が違うと、別の場所に見える。
 *
 *     大きさ    120 × 156px
 *     紙の端    右に 5px
 *     背の影    左に 7px
 *     題名      上から 22% の位置に、中央そろえで 3 行まで
 *
 * ★ 表紙が無い作品も出す。
 *   いまは多くの作品に表紙が無い。
 *   出さないと、棚がすかすかになる。
 *   題名を書いた紙の表紙を当てる。
 * ============================================================
 */

const BOOK_WIDTH = 120
const BOOK_HEIGHT = 156
const SPINE = 7
const EDGE = 5

export interface ShelfWork {
    id: string
    title: string
    author?: string
    /** 表紙の絵。無ければ紙の表紙を作る */
    cover_url?: string | null
}

export default function WorkShelf({ works }: { works: ShelfWork[] }) {
    if (works.length === 0) return null

    return (
        <div className="ws">
            {works.map((work) => {
                const cover = COVERS[hashOf(work.title || work.id) % COVERS.length]

                return (
                    <div key={work.id} className="ws_slot">
                        {/*
                          * 板に落ちる影。
                          * 無いと、本が宙に浮いて見える。
                          */}
                        <span aria-hidden="true" className="ws_shadow" />

                        <Link
                            href={`/novel/${work.id}`}
                            className="ws_book"
                            title={work.title}
                        >
                            {/* 紙の端 */}
                            <span
                                style={{
                                    position: 'absolute', top: 2, bottom: 2, right: 0,
                                    width: EDGE, borderRadius: '0 3px 3px 0',
                                    background:
                                        'repeating-linear-gradient(90deg, #ebe4d5 0 1px, #f8f4ec 1px 2px)',
                                    boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.10)',
                                }}
                            />

                            {/* 表紙 */}
                            <span
                                style={{
                                    position: 'absolute', top: 0, bottom: 0, left: 0,
                                    right: EDGE - 2,
                                    overflow: 'hidden',
                                    borderRadius: '2px 4px 4px 2px',
                                    background: cover.base,
                                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.07)',
                                }}
                            >
                                {work.cover_url ? (
                                    /*
                                     * 表紙の絵がある作品。
                                     *
                                     * 背の影のぶんだけ右にずらして敷く。
                                     * 端まで敷くと、背の影に絵がかぶって
                                     * 本の形に見えなくなる。
                                     */
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={work.cover_url}
                                        alt=""
                                        style={{
                                            position: 'absolute',
                                            top: 0, bottom: 0, left: SPINE, right: 0,
                                            width: `calc(100% - ${SPINE}px)`,
                                            height: '100%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                ) : (
                                    /* 表紙が無い作品。題名を書いた紙にする */
                                    <span
                                        style={{
                                            position: 'absolute', left: 0, right: 0,
                                            top: Math.round(BOOK_HEIGHT * 0.22),
                                            padding: `0 10px 0 ${SPINE + 8}px`,
                                        }}
                                    >
                                        <span
                                            className="ws_title"
                                            style={{ color: cover.ink }}
                                        >
                                            {work.title || '無題'}
                                        </span>
                                    </span>
                                )}

                                {/* 背の側の影 */}
                                <span
                                    style={{
                                        position: 'absolute', top: 0, bottom: 0, left: 0,
                                        width: SPINE,
                                        background:
                                            'linear-gradient(90deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.05) 60%, rgba(255,255,255,0.10) 100%)',
                                    }}
                                />

                                {/* 上からの光 */}
                                <span
                                    style={{
                                        position: 'absolute', inset: 0,
                                        background:
                                            'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.06) 100%)',
                                    }}
                                />
                            </span>
                        </Link>

                        {/*
                          * 本の下に、題名と作者。
                          *
                          * 表紙の絵がある作品は、題名が絵に隠れる。
                          * 下に出さないと、何の本か分からない。
                          */}
                        <Link href={`/novel/${work.id}`} className="ws_label">
                            <span className="ws_label-title">{work.title || '無題'}</span>
                            {work.author && (
                                <span className="ws_label-author">著：{work.author}</span>
                            )}
                        </Link>
                    </div>
                )
            })}
        </div>
    )
}

export { BOOK_WIDTH, BOOK_HEIGHT }
