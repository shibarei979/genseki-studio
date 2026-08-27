import Link from 'next/link'
import BookmarkMark from '@/components/home/bookmark-mark'

import type { HomeBook } from '@/types/home'

/**
 * ============================================================
 * 原石航路
 * ReaderWorkList — 読者向けの作品一覧
 *
 * 題名と著者だけを 2 列で並べる。
 *
 * 表紙を大きく出すより、題名が一度に多く見えるほうが
 * 探しやすい。読む人は表紙ではなく題名で選ぶ。
 *
 * タグは出さない。
 * 1 行に何個も並ぶと、題名より目立ってしまう。
 * ============================================================
 */

export default function ReaderWorkList({
  title,
  books,
  moreHref,
}: {
  title: string
  books: HomeBook[]
  moreHref: string
}) {
  if (books.length === 0) return null

  return (
    <section className="rwl">
      <div className="rwl_head">
        <h2 className="rwl_title">{title}</h2>
        <Link href={moreHref} className="rwl_more">
          もっと見る ›
        </Link>
      </div>

      <div className="rwl_grid">
        {books.map((book) => (
          <Link
            key={book.id}
            href={book.href}
            className={`rwl_item${book.href === '#' ? ' is-empty' : ''}`}
          >
            <span className="rwl_item-text">
              <span className="rwl_item-title">{book.title}</span>
              <span className="rwl_item-author">著：{book.author}</span>
            </span>

            {/* 押すと保存できる。気になった本をその場で残す */}
            <BookmarkMark novelId={book.href.replace('/novel/', '')} />
          </Link>
        ))}
      </div>
    </section>
  )
}
