import Link from 'next/link'
import BookmarkMark from '@/components/home/bookmark-mark'

import type { HomeBook } from '@/types/home'
import { genreColor } from '@/types'

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
  labels,
}: {
  title: string
  books: HomeBook[]
  moreHref: string
  /**
   * 作品ごとに添える言葉。作品の id で引く。
   *
   * 受賞作品の賞の名前に使う。
   * 出さないと、ただの推薦と見分けが付かない。
   */
  labels?: Record<string, string>
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
            {/*
              * ジャンルの色の縦線。
              *
              * 題名だけが並ぶと、どれも同じ話に見える。
              * 色で種類が分かると、目が拾いやすくなる。
              */}
            <span
              className="rwl_item-bar"
              style={{ background: book.tags?.[0] ? genreColor(book.tags[0]) : 'transparent' }}
              aria-hidden="true"
            />

            <span className="rwl_item-text">
              {/*
                * 賞の名前。題名の上に小さく出す。
                * 下に置くと作者名と紛れる。
                */}
              {labels?.[book.id] && (
                <span className="rwl_item-label">{labels[book.id]}</span>
              )}
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
