'use client'

import Link from 'next/link'

import { COVERS, hashOf } from '@/components/home/home-work-table'
import NovelPopup from '@/components/novel-popup'

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
 *     大きさ    180 × 234px
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

/* CSS 側と同じ寸法にする。題名の位置の計算に使う */
const BOOK_WIDTH = 180
const BOOK_HEIGHT = 234
const SPINE = 10
const EDGE = 7

export interface ShelfWork {
    id: string
    title: string
    author?: string
    /** 表紙の絵。無ければ紙の表紙を作る */
    cover_url?: string | null
    /** 表紙を AI で作ったか。右上に札を出す */
    cover_is_ai?: boolean | null
    /**
     * 押したときに出す札の中身。
     *
     * 渡されたときは、作品ページへ直に飛ばさず、
     * 文字の一覧と同じ札を出す。
     */
    novel?: Record<string, unknown>
    /** 表紙を AI で作ったか。作品ページと同じ印を出す */
}

export default function WorkShelf({ works }: { works: ShelfWork[] }) {
    if (works.length === 0) return null

    return (
        <div className="ws">
          {/*
            * ★ 段に分けない。
            *
            *   前は 5 冊ずつに切っていたが、
            *   携帯では 5 冊が入りきらず 2 行に折り返り、
            *   板が段の途中に出ていた。
            *
            *   何冊入るかは画面の幅で変わる。
            *   その判断は CSS に任せ、板は 1 本の背景として敷く。
            */}
          <div className="ws_books">
            {works.map((work) => {
                const cover = COVERS[hashOf(work.title || work.id) % COVERS.length]

                return (
                    <div key={work.id} className="ws_slot">
                        {/*
                          * 題名と作者は、本の上に置く。
                          *
                          * ★ 下に置くと、板との間に挟まって
                          *   本が板に載っているように見えない。
                          *
                          * 表紙の絵がある作品は、題名が絵に隠れる。
                          * どこかに出さないと、何の本か分からない。
                          */}
                        <Link href={`/novel/${work.id}`} className="ws_label">
                            <span className="ws_label-title">{work.title || '無題'}</span>
                            {work.author && (
                                <span className="ws_label-author">著：{work.author}</span>
                            )}
                        </Link>

                        {/*
                          * 板に落ちる影。
                          * 無いと、本が宙に浮いて見える。
                          */}
                        <span aria-hidden="true" className="ws_shadow" />

                        {/*
                          * ★ 押すと札を出す。
                          *
                          *   文字の一覧では NovelPopup を通していた。
                          *   本の形だけ作品ページへ直に飛ぶと、
                          *   同じものを押したのに違うことが起きる。
                          */}
                        {work.novel ? (
                            <NovelPopup novel={work.novel as never}>
                                <div className="ws_book" title={work.title}>

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

                                {/*
                                  * AI の印。
                                  *
                                  * ★ 作品ページと同じ場所（右上）に出す。
                                  *   場所が違うと、別の意味に見える。
                                  *
                                  * 表紙の絵があるときだけ。
                                  * 題名の紙には、そもそも絵が無い。
                                  */}
                                {work.cover_url && work.cover_is_ai && (
                                    /*
                                     * AI で作った表紙の印。
                                     *
                                     * ★ 作品ページと同じ絵を使う。
                                     *   /images/ai-cover-stamp.png
                                     *   別の形にすると、同じ意味の印が
                                     *   2 通りあることになる。
                                     *
                                     * 本は小さいので、絵も小さくする。
                                     * 薄くして、表紙の絵を隠しすぎない。
                                     */
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src="/images/ai-cover-stamp.png"
                                        alt="AIで作った表紙"
                                        title="AIで作った表紙"
                                        style={{
                                            position: 'absolute',
                                            top: -4,
                                            right: -4,
                                            zIndex: 3,
                                            width: 40,
                                            height: 40,
                                            transform: 'rotate(-8deg)',
                                            opacity: .55,
                                            filter:
                                                'drop-shadow(0 0 2px rgba(255,255,255,.9)) drop-shadow(0 1px 2px rgba(0,0,0,.25))',
                                            pointerEvents: 'none',
                                        }}
                                    />
                                )}

                                {/* 上からの光 */}
                                <span
                                    style={{
                                        position: 'absolute', inset: 0,
                                        background:
                                            'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.06) 100%)',
                                    }}
                                />
                            </span>
                                                        </div>
                            </NovelPopup>
                        ) : (
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

                                {/*
                                  * AI の印。
                                  *
                                  * ★ 作品ページと同じ場所（右上）に出す。
                                  *   場所が違うと、別の意味に見える。
                                  *
                                  * 表紙の絵があるときだけ。
                                  * 題名の紙には、そもそも絵が無い。
                                  */}
                                {work.cover_url && work.cover_is_ai && (
                                    <span className="ws_ai" aria-label="AIで作った表紙">
                                        AI
                                    </span>
                                )}

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
                        )}


                    </div>
                )
            })}
          </div>
        </div>
    )
}

export { BOOK_WIDTH, BOOK_HEIGHT }
