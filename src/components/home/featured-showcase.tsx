'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
 *     表紙は濃い色、題名は金、上下を罫で挟む
 *
 *   賞の名を吹き出しで横に置くより、
 *   帯にしたほうが「受賞した本」に見える。
 *   日本の本屋で、賞はいつも帯に刷ってある。
 *
 * ★ 本の形は、執筆向けホームの棚の本とそっくり同じ。
 *
 *   斜めに回して背表紙と天の面を立てたことがあるが、
 *   あちらの本は平らなので、別のサイトの本に見えた。
 *   飾るのは表紙の中だけにして、形はいじらない。
 *
 * ★ おすすめのときは、帯も付けない。
 *   賞との区別が消える。賞の代わりに吹き出しを 1 つ。
 *
 * ★ 本の作りは home-work-table.tsx の Tile と同じ。
 *   大きさだけ 1.16 倍にしてある（棚ではなく飾り台なので）。
 *
 *     小口      右に 6px。上下 2px 内側
 *     表紙      その左。左角 2px、右角 4px
 *     背の陰    左に 8px
 *     題名      上から 22% の位置に、中央そろえで 2 行まで
 *     影        右下へ 3px。触れると 4px 持ち上がる
 *
 *   あちらの数字が変わったら、ここも一緒に直す。
 *
 * ★ 本棚（home.js）には触っていない。
 *   ここは数字と CSS だけで描いている。
 * ============================================================
 */

/*
 * 本の寸法。
 *
 * 執筆向けホームの本は 128 × 166。
 * ここは棚ではなく飾り台なので、1.16 倍にして少し大きく見せる。
 * 縦横の比と各部の割合は、あちらと同じに保つ。
 * 崩すと、別のサイトの本に見える。
 */
const BOOK_WIDTH = 148
const BOOK_HEIGHT = 192
const SPINE = 8
const EDGE = 6
const TITLE_SIZE = 14

/*
 * 1 枚の板に載る、いちばん多い冊数。
 *
 * 6 冊以上は板からはみ出す。
 * 運営が切れ目を置き忘れても、ここで必ず切れる。
 */
const PAGE_MAX = 5

/** 帯の高さ。表紙の下から 4 分の 1 ほど */
const OBI = 46

/*
 * 受賞の表紙を濃い色にするか。
 *
 * ★ 濃い色にする。賞を取った本は装丁が変わる。
 *
 *   一度は淡い表紙に戻したが、賞らしさが出なかった。
 *   濃い色で本の形が消えていたのは、色のせいではなく
 *   本が小さく、天（上の紙の断面）が細かったため。
 *   大きくして、天と背をはっきりさせたら形は戻った。
 *
 *   いつもの淡い表紙に戻すなら、ここを false にする。
 */
const DARK_COVER = true

/*
 * 受賞の表紙。
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
    /** どのコンテストの賞か。ここが変わると、必ず板が変わる */
    contestId?: string | null
    /** ここから新しい板を始める。運営が管理画面で置いた切れ目 */
    startsPage?: boolean
    /** コンテストの名前。受賞のときだけ入る */
    contestTitle?: string
    /** コンテストの帯の絵。本の横に出す */
    contestBanner?: string | null
}

export default function FeaturedShowcase({
    title,
    items,
    autoSeconds = 0,
}: {
    title: string
    items: FeaturedItem[]
    /** 何秒でひとりでに送るか。0 なら送らない */
    autoSeconds?: number
}) {
    /*
     * 板の分け方。
     *
     * 並び順のとおりに前から置いていき、
     * 次の三つのどれかで、新しい板に移る。
     *
     *   1  運営が切れ目を置いたところ（starts_page）
     *   2  コンテストが変わるところ
     *      別の催しの本が同じ板に並ぶと、
     *      横に立つ額の絵と、その本が結び付かない
     *   3  5 冊を超えるところ
     *      それ以上は板からはみ出す
     *
     * 1 枚ごとの冊数は揃わなくてよい。
     * 大賞を 1 冊、佳作を 3 冊、という並べ方ができる。
     */
    const pages = useMemo(() => {
        const out: FeaturedItem[][] = []
        let current: FeaturedItem[] = []
        let lastContest: string | null = null

        for (const item of items) {
            const contest = item.contestId ?? ''

            const cut =
                current.length > 0 &&
                (item.startsPage === true ||
                    contest !== lastContest ||
                    current.length >= PAGE_MAX)

            if (cut) {
                out.push(current)
                current = []
            }

            current.push(item)
            lastContest = contest
        }

        if (current.length > 0) out.push(current)
        return out
    }, [items])

    const [at, setAt] = useState(0)

    /*
     * 手が触れているあいだは、ひとりでに送らない。
     * 読もうとしている本が、目の前で消えると腹が立つ。
     */
    const [held, setHeld] = useState(false)

    /* 頁が減ったとき、行き先が無くならないようにする */
    const count = pages.length
    const safeAt = count > 0 ? at % count : 0
    const lastCount = useRef(count)
    useEffect(() => {
        if (lastCount.current !== count) {
            lastCount.current = count
            setAt(0)
        }
    }, [count])

    /*
     * ひとりでに送る。
     *
     * ★ 動きを減らす設定の機械では送らない。
     * ★ 頁が 1 つしかないときも送らない。
     */
    useEffect(() => {
        if (count < 2 || autoSeconds <= 0 || held) return
        if (typeof window === 'undefined') return

        const quiet = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        if (quiet) return

        const timer = window.setInterval(() => {
            setAt((now) => (now + 1) % count)
        }, autoSeconds * 1000)

        return () => window.clearInterval(timer)
    }, [count, autoSeconds, held])

    if (items.length === 0 || count === 0) return null

    const shown = pages[safeAt] ?? []

    /*
     * 受賞か、ただのおすすめか。
     * 賞の名前が 1 つでもあれば受賞として飾る。
     *
     * ★ 頁ごとではなく、全体で決める。
     *   頁をめくるたびに額と帯が消えたら、別の枠に見える。
     */
    const isAward = items.some((one) => one.label)

    /*
     * 吹き出しの言葉。おすすめのときだけ出す。
     * 受賞のときは、賞の名前が帯に載るので要らない。
     */
    const bubble = '今週のおすすめ作品'

    /*
     * コンテストの絵と名前。
     * いま出ている頁のものを使う。頁をめくれば、額の絵も変わる。
     */
    const banner = shown.find((one) => one.contestBanner)?.contestBanner || null
    const contestTitle = shown.find((one) => one.contestTitle)?.contestTitle || ''

    /* 絵の行き先に使う。どのコンテストの絵か */
    const contestId = shown.find((one) => one.contestId)?.contestId || ''

    function step(direction: -1 | 1) {
        setAt((now) => (now + direction + count) % count)
    }

    return (
        <div className={isAward ? 'fs fs--award' : 'fs'}>
            <div className="fs_head">
                <span className="fs_title">{title}</span>
            </div>

            <div
                className="fs_stage book-shelf-area"
                onMouseEnter={() => setHeld(true)}
                onMouseLeave={() => setHeld(false)}
                onFocusCapture={() => setHeld(true)}
                onBlurCapture={() => setHeld(false)}
            >
                {/*
                  * ★ コンテストの絵を、額に入れて板に立てる。
                  *
                  *   賞の名前だけだと、どの催しの賞か伝わらない。
                  *   絵をそのまま置くと、板の上に紙が落ちているように見える。
                  *   額に入れると、飾ってあることが分かる。
                  *
                  *   絵が無い（おすすめ）ときは、本だけ並べる。
                  */}
                {/*
                  * ★ 頁が変わるたび、包みごと作り直す。
                  *   key を変えると、CSS の淡く現れる動きがもう一度走る。
                  *   額と本が同時に入れ替わるので、頁が変わったと分かる。
                  */}
                <div className="fs_page" key={safeAt}>
                {banner && (
                    <div className="fs_contest">
                        {/*
                          * ★ 絵に行き先を付ける。
                          *
                          *   前は絵を出すだけで、押しても何も起きなかった。
                          *   目に付く場所にあるのに、そこで行き止まりだった。
                          *
                          * ★ 行き先は、応募作品の一覧。
                          *
                          *   絵を見て気になった人が知りたいのは
                          *   「どんな作品が出ているか」。
                          *   説明の頁より、そちらへ送るほうが近い。
                          */}
                        {contestId ? (
                            <Link
                                href={`/contest/${contestId}/entries`}
                                className="fs_frame"
                                aria-label={`${contestTitle || 'コンテスト'}の応募作品を読む`}
                            >
                                <div className="fs_mat">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={banner}
                                        alt={contestTitle || 'コンテスト'}
                                        className="fs_contest-img"
                                    />
                                </div>
                            </Link>
                        ) : (
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
                        )}
                    </div>
                )}

                <div className="fs_row">
                    {shown.map((item) => {
                        const table = isAward && DARK_COVER ? AWARD_COVERS : COVERS
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
                                    {/*
                                      * 小口（紙の束）。表紙の右にわずかに覗かせる。
                                      * これが無いと、色板が立っているだけに見える。
                                      * 厚みは、この一本だけで表す。
                                      */}
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
                                        {/*
                                          * 背表紙側の陰。
                                          * 綴じてある側は光が回らず、必ず暗くなる。
                                          * 数字は棚の本と同じもの。
                                          */}
                                        <span style={{
                                            position: 'absolute', top: 0, bottom: 0, left: 0, width: SPINE,
                                            background: 'linear-gradient(90deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.05) 60%, rgba(255,255,255,0.30) 100%)',
                                        }} />

                                        {/* 上からの光 */}
                                        <span style={{
                                            position: 'absolute', inset: 0,
                                            background: 'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.06) 100%)',
                                        }} />

                                        {/*
                                          * 金の罫。受賞のときだけ。
                                          * 表紙の内側を一周する細い線。
                                          * 線 1 本で、刷り物が装丁に変わる。
                                          */}
                                        {isAward && (
                                            <span aria-hidden="true" className="fs_rule" style={{
                                                left: SPINE + 5,
                                                bottom: obi ? OBI + 7 : 9,
                                            }} />
                                        )}

                                        {/* 題名。上から 22% の位置に、中央そろえで 2 行まで */}
                                        <span style={{
                                            position: 'absolute', left: 0, right: 0,
                                            top: Math.round(BOOK_HEIGHT * 0.22),
                                            /*
                                              * 左右の余白。
                                              * 左が広いのは、背の影 8px がここに掛かるため。
                                              * これ以上詰めると、題名が影に沈む。
                                              */
                                            padding: `0 10px 0 ${SPINE + 8}px`,
                                        }}>
                                            {/*
                                              * 題名を上下から挟む短い罫。受賞のときだけ。
                                              *
                                              * 表彰状も本の扉も、題を罫で挟む。
                                              * 挟むだけで、ただの見出しが銘に変わる。
                                              */}
                                            {isAward && <span aria-hidden="true" className="fs_tick" />}

                                            <span
                                                className={isAward ? 'fs_book-title fs_book-title--award' : 'fs_book-title'}
                                                style={{ fontSize: TITLE_SIZE, color: cover.ink }}>
                                                {item.title}
                                            </span>

                                            {isAward && <span aria-hidden="true" className="fs_tick fs_tick--under" />}
                                        </span>

                                        {/*
                                          * 作者名。
                                          * 帯を巻くときは、その上へ逃がす。
                                          * 下のままだと帯に隠れる。
                                          */}
                                        <span style={{
                                            position: 'absolute', left: SPINE + 10, right: 12,
                                            bottom: obi ? OBI + 10 : 12,
                                            fontSize: 11, lineHeight: 1.5, color: cover.ink, opacity: .78,
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
                </div>

                {/*
                  * 横に送るボタン。
                  *
                  * ★ 頁が 1 つしかないときは出さない。
                  *   押しても何も起きないボタンは、置かないほうがよい。
                  */}
                {count > 1 && (
                    <>
                        <button
                            type="button"
                            className="fs_arrow fs_arrow--prev"
                            onClick={() => step(-1)}
                            aria-label="前を見る"
                        >
                            <span aria-hidden="true">‹</span>
                        </button>
                        <button
                            type="button"
                            className="fs_arrow fs_arrow--next"
                            onClick={() => step(1)}
                            aria-label="次を見る"
                        >
                            <span aria-hidden="true">›</span>
                        </button>
                    </>
                )}

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

            {/*
              * いま何枚目か。
              *
              * ★ 丸を並べる形にはしない。
              *   賞が 20 も 30 もあると、丸で埋まる。
              *   数字なら、いくつあっても幅が変わらない。
              */}
            {count > 1 && (
                <p className="fs_count">
                    {safeAt + 1} / {count}
                </p>
            )}
        </div>
    )
}
