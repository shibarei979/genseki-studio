'use client'

import Link from 'next/link'

import { COVERS, hashOf } from '@/components/home/home-work-table'

/**
 * ============================================================
 * 原石航路 Studio
 * FeaturedShowcase — 受賞作品・運営のおすすめの見せ場
 *
 * 板の上に、催しの絵と本を並べる。
 *
 * ★ 受賞のときは、本屋の受賞台を真似る。
 *
 *     絵は額に入れて立てる
 *     本は賞の帯を巻く（本屋で見る、あの紙の帯）
 *     表紙は濃い色に金の罫
 *
 *   賞の名を吹き出しで横に置くより、
 *   帯にしたほうが「受賞した本」に見える。
 *   日本の本屋で、賞はいつも帯に刷ってある。
 *
 * ★ おすすめのときは、飾らない。
 *   金や帯を付けると、賞との区別が消える。
 *   表紙はいつもの色、賞の代わりに吹き出しを 1 つ。
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

/** 帯の高さ。表紙の下から 4 分の 1 ほど */
const OBI = 42

/*
 * 受賞の表紙。
 *
 * いつもの表紙は淡い色で、机の上の原稿に見える。
 * 賞を取った本は装丁が変わるので、濃い色に金の文字を置く。
 *
 * 3 色あるのは、3 冊並んだときに同じ本が並んで見えないため。
 * 帯が臙脂なので、赤系は入れない。
 */
const AWARD_COVERS = [
    { base: '#1c3b55', ink: '#f2e4bc' }, // 紺
    { base: '#2f4536', ink: '#eee2b6' }, // 深緑
    { base: '#3b3730', ink: '#f0e0b4' }, // 墨
]

export interface FeaturedItem {
    id: string
    href: string
    title: string
    author: string
    /** 賞の名前。受賞のときだけ入る */
    label?: string
    /** コンテストの名前。受賞のときだけ入る */
    contestTitle?: string
    /** コンテストの帯の絵。本の横に出す */
    contestBanner?: string | null
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
     * 受賞か、ただのおすすめか。
     * 賞の名前が 1 つでもあれば受賞として飾る。
     */
    const isAward = shown.some((one) => one.label)

    /*
     * 吹き出しの言葉。おすすめのときだけ出す。
     * 受賞のときは、賞の名前が帯に載るので要らない。
     */
    const bubble = '今週のおすすめ作品'

    /*
     * コンテストの絵と名前。
     * 3冊のうち、最初に見つかったものを使う。
     * 冊ごとに違う催しの絵を並べると、目が散る。
     */
    const banner = shown.find((one) => one.contestBanner)?.contestBanner || null
    const contestTitle = shown.find((one) => one.contestTitle)?.contestTitle || ''

    return (
        <div className={isAward ? 'fs fs--award' : 'fs'}>
            <div className="fs_head">
                <span className="fs_title">{title}</span>
            </div>

            <div className="fs_stage book-shelf-area">
                {/*
                  * ★ コンテストの絵を、額に入れて板に立てる。
                  *
                  *   賞の名前だけだと、どの催しの賞か伝わらない。
                  *   絵をそのまま置くと、板の上に紙が落ちているように見える。
                  *   額に入れると、飾ってあることが分かる。
                  *
                  *   絵が無い（おすすめ）ときは、本だけ並べる。
                  */}
                {banner && (
                    <div className="fs_contest">
                        <div className="fs_frame">
                            <div className="fs_mat">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={banner}
                                    alt={contestTitle || 'コンテスト'}
                                    className="fs_contest-img"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="fs_row">
                    {shown.map((item) => {
                        const table = isAward ? AWARD_COVERS : COVERS
                        const cover = table[hashOf(item.title || item.id) % table.length]

                        /* この本に帯を巻くか。賞の名前があるときだけ */
                        const obi = isAward && item.label ? item.label : null

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

                                        {/*
                                          * 金の罫。受賞のときだけ。
                                          * 表紙の内側を一周する細い線。
                                          * これがあるだけで、装丁された本に見える。
                                          */}
                                        {isAward && (
                                            <span aria-hidden="true" className="fs_rule" style={{
                                                left: SPINE + 4,
                                                bottom: obi ? OBI + 6 : 8,
                                            }} />
                                        )}

                                        {/* 題名。上から 22% の位置に、中央そろえで 2 行まで */}
                                        <span style={{
                                            position: 'absolute', left: 0, right: 0,
                                            top: Math.round(BOOK_HEIGHT * 0.22),
                                            padding: `0 12px 0 ${SPINE + 10}px`,
                                        }}>
                                            {/* 題名の上の短い罫。受賞のときだけ */}
                                            {isAward && (
                                                <span aria-hidden="true" className="fs_tick" />
                                            )}
                                            <span className="fs_book-title"
                                                style={{ fontSize: TITLE_SIZE, color: cover.ink }}>
                                                {item.title}
                                            </span>
                                        </span>

                                        {/*
                                          * 作者名。
                                          * 帯を巻くときは、その上へ逃がす。
                                          * 下のままだと帯に隠れる。
                                          */}
                                        <span style={{
                                            position: 'absolute', left: SPINE + 10, right: 12,
                                            bottom: obi ? OBI + 10 : 12,
                                            fontSize: 10, lineHeight: 1.5, color: cover.ink, opacity: .68,
                                        }}>
                                            著：{item.author}
                                        </span>

                                        {/*
                                          * 賞の帯。
                                          *
                                          * ★ 表紙の下に、紙を一本巻く。
                                          *   本屋に並ぶ受賞作と同じ形。
                                          *   賞の名前は、ここに刷る。
                                          */}
                                        {obi && (
                                            <span className="fs_obi" style={{ height: OBI }}>
                                                <span className="fs_obi-text">{obi}</span>
                                            </span>
                                        )}
                                    </span>
                                </Link>
                            </div>
                        )
                    })}

                    {/*
                      * 吹き出し。おすすめのときだけ。
                      *
                      * 受賞のときは帯があるので出さない。
                      * 帯と吹き出しが両方あると、同じことを二度言う。
                      */}
                    {!isAward && <span className="fs_bubble">{bubble}</span>}
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
