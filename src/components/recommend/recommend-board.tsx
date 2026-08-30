import Link from 'next/link'

import type { HomeBook } from '@/types/home'

/**
 * ============================================================
 * 原石航路 Studio
 * RecommendBoard — 掲示板に貼った紙の札
 *
 * 木の枠のコルク板に、作品を書いた紙を留めていく見た目。
 * 文字だけの一覧より、眺めていて目が留まりやすい。
 *
 * ★ .reader-home の外に置くこと。
 *   base.css に .reader-home * { margin:0; padding:0 } があり、
 *   中へ入れると札の余白がすべて消える。
 *
 * ★ 数字（いいね・閲覧数）は出さない。
 *   少ないうちは、数の少なさが目立つだけになる。
 * ============================================================
 */

/*
 * 紙の色。
 *
 * 全部同じ白だと、印刷物のように見えて「貼った」感じが出ない。
 * わずかに違う 5 色を、順に回して使う。
 */
const PAPERS = [
    '#fdfbf5',
    '#f8f5ec',
    '#fbf8f2',
    '#f6f4ee',
    '#fcf9f1',
]

/*
 * 紙の傾き。
 *
 * まっすぐ並べると、貼ったのではなく並べたように見える。
 * 1 枚ずつ角度を変える。大きく傾けると読みにくいので 1 度まで。
 */
const TILTS = ['-0.8deg', '0.6deg', '-0.4deg', '0.9deg', '-0.6deg', '0.5deg']

/*
 * 留め具。
 *
 * すべてに同じものを付けると煩い。
 * クリップ・テープ・何も無しを順に回す。
 */
const PINS = ['clip', 'tape', 'none', 'tape', 'clip', 'none'] as const

export default function RecommendBoard({
    title,
    note,
    books,
    moreHref,
}: {
    title: string
    note?: string
    books: HomeBook[]
    moreHref: string
}) {
    return (
        <section className="rb">
            <div className="rb_head">
                <h2 className="rb_title">{title}</h2>
                {note && <p className="rb_note">{note}</p>}
                <Link href={moreHref} className="rb_more">
                    もっと見る →
                </Link>
            </div>

            <div className="rb_board">
                {books.length === 0 ? (
                    /*
                     * 何も無いときに板だけ残ると寂しい。
                     * 次にどこへ行けばよいかを書いておく。
                     */
                    <p className="rb_empty">
                        まだ紹介できる作品がありません。
                        <br />
                        <Link href="/search">作品を探す</Link>
                    </p>
                ) : (
                    <div className="rb_grid">
                        {books.map((book, at) => (
                            <Link
                                key={book.id}
                                href={book.href}
                                className="rb_card"
                                style={{
                                    background: PAPERS[at % PAPERS.length],
                                    transform: `rotate(${TILTS[at % TILTS.length]})`,
                                }}
                            >
                                {/*
                                  * 留め具。押せないようにする。
                                  * 押すと札そのものが開いてほしい。
                                  */}
                                {PINS[at % PINS.length] === 'clip' && (
                                    <span className="rb_clip" aria-hidden="true" />
                                )}
                                {PINS[at % PINS.length] === 'tape' && (
                                    <span className="rb_tape" aria-hidden="true" />
                                )}

                                {book.tags?.[0] && (
                                    <span className="rb_genre">{book.tags[0]}</span>
                                )}

                                <span className="rb_card-title">{book.title}</span>

                                {book.head && (
                                    <span className="rb_card-head">{book.head}</span>
                                )}

                                <span className="rb_card-author">{book.author}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
