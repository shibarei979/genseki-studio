import Link from 'next/link'

import { genreColor } from '@/types'
import type { HomeBook } from '@/types/home'

/**
 * ============================================================
 * 原石航路 Studio
 * RecommendBoard — 掲示板に貼った紙の札
 *
 * 木の枠のコルク板に、作品を書いた紙を留めていく。
 *
 * ★ .reader-home の外に置くこと。
 *   base.css の * { margin:0; padding:0 } に、
 *   札の余白がすべて消される。
 *
 * ★ 色はジャンルから取る。
 *   ジャンルの札もテープも、作品のジャンルの色にする。
 *   一色だと、どれも同じ話に見える。
 * ============================================================
 */

/*
 * 紙の色。わずかに違う 5 色を順に回す。
 * 全部同じ白だと、印刷物のようで「貼った」感じが出ない。
 */
const PAPERS = ['#fdfbf5', '#f8f5ec', '#fbf8f2', '#f6f4ee', '#fcf9f1']

/*
 * 紙の傾き。1 枚ずつ変える。
 * まっすぐ並べると、貼ったのではなく並べたように見える。
 * 大きく傾けると読みにくいので 1 度まで。
 */
const TILTS = ['-0.8deg', '0.6deg', '-0.4deg', '0.9deg', '-0.6deg', '0.5deg']

/*
 * 留め具。すべてに同じものを付けると煩い。
 * クリップ・テープ・何も無しを順に回す。
 */
const PINS = ['tape', 'clip', 'none', 'tape', 'none', 'clip'] as const

export default function RecommendBoard({
    books,
}: {
    books: HomeBook[]
}) {
    if (books.length === 0) {
        return (
            <div className="rb_board">
                {/*
                  * 何も無いときに板だけ残ると寂しい。
                  * 次にどこへ行けばよいかを書いておく。
                  */}
                <p className="rb_empty">
                    この条件に合う作品がまだありません。
                    <br />
                    <Link href="/recommend">条件を外して見る</Link>
                </p>
            </div>
        )
    }

    return (
        <div className="rb_board">
            <div className="rb_grid">
                {books.map((book, at) => {
                    const genre = book.tags?.[0] || ''
                    const color = genre ? genreColor(genre) : '#8a8378'
                    const pin = PINS[at % PINS.length]

                    /*
                     * 最初の 4 枚を大きくする。
                     * 全部同じ大きさだと、どれから読めばよいか分からない。
                     */
                    const isBig = at < 4

                    return (
                        <Link
                            key={`${book.id}-${at}`}
                            href={book.href}
                            className={`rb_card${isBig ? ' is-big' : ''}`}
                            style={{
                                background: PAPERS[at % PAPERS.length],
                                transform: `rotate(${TILTS[at % TILTS.length]})`,
                            }}
                        >
                            {/*
                              * 留め具。ジャンルの色に合わせる。
                              * 押せないようにする。押したら札が開いてほしい。
                              */}
                            {pin === 'clip' && (
                                <span className="rb_clip" aria-hidden="true"
                                    style={{ borderColor: color, color }} />
                            )}
                            {pin === 'tape' && (
                                <span className="rb_tape" aria-hidden="true"
                                    style={{ background: `${color}4d` }} />
                            )}

                            {genre && (
                                <span className="rb_genre" style={{ background: color }}>
                                    {genre}
                                </span>
                            )}

                            <span className="rb_card-title">{book.title}</span>

                            {book.head && (
                                <span className="rb_card-head">{book.head}</span>
                            )}

                            <span className="rb_card-author">{book.author}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
