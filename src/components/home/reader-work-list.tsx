import Link from 'next/link'

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

            {/*
             * 保存の印。
             *
             * いまは飾りとして置く。
             * 押せるようにするのは、保存の仕組みを繋いでから。
             */}
            <span className="rwl_mark" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
