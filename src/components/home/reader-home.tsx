import Link from 'next/link'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/server'
import BookshelfSection from '@/components/home/bookshelf-section'
import type { HomeBook } from '@/types/home'

/**
 * ============================================================
 * 原石航路
 * 読者向けのホーム
 *
 * 読む人のための入口。
 * 上に本棚を回し、その下に作品の一覧を並べる。
 *
 * 左の柱には、その人自身のもの（読みかけ・執筆室・お知らせ）。
 * 右の広い側には、新しい出会い。
 *
 * 執筆室は読む人でも入れる。
 * 「作品を書く」への入口は、ここには置かない。
 * ============================================================
 */

/** 本棚に並べる冊数。左右10冊＋中央1冊＋裏側 */
const SHELF_COUNT = 25

/** 一覧に出す冊数 */
const LIST_COUNT = 10

const HEAD_LENGTH = 120
const EXCERPT_LENGTH = 80

function truncate(text: string | null | undefined, length: number): string {
  if (!text) return ''
  const t = text.replace(/\r?\n/g, ' ').trim()
  return t.length > length ? t.slice(0, length) + '…' : t
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 冊数を揃えるために「準備中」で埋める。
 *
 * 本棚は冊数が決まっていて、足りないと回り方が崩れる。
 * 作品が集まるまでの間に合わせ。
 */
function padWithPlaceholders(books: HomeBook[], count: number, kind: string): HomeBook[] {
  const padded = books.slice(0, count)
  while (padded.length < count) {
    padded.push({
      id: `${kind}-placeholder-${padded.length}`,
      href: '#',
      title: '作品タイトル（準備中）',
      author: '作者（準備中）',
      tags: ['ジャンル'],
      head: '',
      excerpt: '',
      comment: '',
      likes: 0,
      placeholder: true,
    } as HomeBook)
  }
  return padded
}

interface NovelRow {
  id: string
  title: string
  summary: string | null
  catchcopy: string | null
  genre: string
  tags: string[] | null
  author_id: string
  created_at: string
}

/** 作品の行を、本の形に直す */
function toBook(
  novel: NovelRow,
  authorMap: Record<string, string>,
  likeMap: Record<string, number>,
): HomeBook {
  return {
    id: novel.id,
    href: `/novel/${novel.id}`,
    title: novel.title,
    author: authorMap[novel.author_id] || '不明な作者',
    tags: [novel.genre, ...(novel.tags || [])].filter(Boolean).slice(0, 7),
    head: truncate(novel.summary, HEAD_LENGTH),
    excerpt: truncate(novel.catchcopy || novel.summary, EXCERPT_LENGTH),
    comment: '',
    likes: likeMap[novel.id] || 0,
  } as HomeBook
}

export default async function ReaderHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  /* 公開されている作品 */
  const { data: novels } = await supabase
    .from('novels')
    .select('id, title, summary, catchcopy, genre, tags, author_id, created_at')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(120)

  const rows = (novels || []) as NovelRow[]

  /* 作者の名前 */
  const authorIds = Array.from(new Set(rows.map((n) => n.author_id)))
  /*
   * 作者の名前。
   *
   * novels.author_id が指しているのは profiles.user_id。
   * profiles.id で引くと、どれも見つからず
   * 「不明な作者」ばかりになる。
   */
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('user_id, display_name').in('user_id', authorIds)
    : { data: [] }

  const authorMap: Record<string, string> = {}
  ;(authors || []).forEach((a: any) => { authorMap[a.user_id] = a.display_name })

  /* いいねの数 */
  const { data: likes } = rows.length
    ? await supabase.from('likes').select('novel_id').in('novel_id', rows.map((n) => n.id))
    : { data: [] }

  const likeMap: Record<string, number> = {}
  ;(likes || []).forEach((l: any) => {
    likeMap[l.novel_id] = (likeMap[l.novel_id] || 0) + 1
  })

  const books = rows.map((n) => toBook(n, authorMap, likeMap))

  /* 本棚は毎回並びを変える。同じ顔ぶれでも、出会いが変わる */
  const shelfBooks = padWithPlaceholders(shuffle(books), SHELF_COUNT, 'shelf')

  /* 新着 */
  const newBooks = padWithPlaceholders(books, LIST_COUNT, 'new')

  /* いいねの多い順 */
  const popularBooks = padWithPlaceholders(
    [...books].sort((a, b) => b.likes - a.likes),
    LIST_COUNT,
    'popular',
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-canvas)' }}>
      {/* ヒーロー。本棚が回る */}
      <section style={{ padding: '48px 0 32px', textAlign: 'center' }}>
        <h1 style={{
          fontSize: 'clamp(22px, 4vw, 34px)',
          fontWeight: 700,
          color: 'var(--color-text)',
          letterSpacing: '0.02em',
          margin: 0,
        }}>
          物語との<span style={{ color: 'var(--color-brand)' }}>出会い</span>が、人生を変える。
        </h1>
        <p style={{
          fontSize: 14,
          color: 'var(--color-text-muted)',
          marginTop: 10,
        }}>
          まだ見ぬ一冊が、ここにある。
        </p>

        <div style={{ marginTop: 28 }}>
          <BookshelfSection books={shelfBooks} />
        </div>

        {/*
         * 本棚を回す仕掛け。
         *
         * 並べ方と回転は、この JS が受け持つ。
         * lazyOnload にするのは、本棚が画面に出そろってから
         * 測ってほしいため。早すぎると幅が 0 のまま計算され、
         * 本が左端に潰れて重なる。
         */}
        <Script src="/home/home.js" strategy="lazyOnload" />
      </section>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 16px 48px' }}>
        {/* 作品を探す */}
        <Link
          href="/search"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '18px 22px',
            marginBottom: 24,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-brand-border)',
            borderRadius: 12,
            textDecoration: 'none',
          }}
        >
          <span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
              作品を探す
            </span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
              ジャンル・タグ・キーワードで作品を検索できます
            </span>
          </span>
          <span style={{
            flexShrink: 0,
            padding: '9px 18px',
            background: 'var(--color-brand)',
            color: 'var(--base-color-1)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
          }}>
            詳細検索 ›
          </span>
        </Link>

        <BookList title="新しく届いた作品" books={newBooks} more="/search?sort=new" />
        <BookList title="注目の作品" books={popularBooks} more="/ranking" />
      </div>
    </div>
  )
}

/**
 * 作品の一覧。
 *
 * 2 列に並べる。1 列だと縦に長くなりすぎ、
 * 3 列だと題名が切れて読めない。
 */
function BookList({
  title,
  books,
  more,
}: {
  title: string
  books: HomeBook[]
  more: string
}) {
  return (
    <section style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-brand-border)',
      borderRadius: 12,
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid var(--color-brand-light)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          {title}
        </h2>
        <Link href={more} style={{ fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          もっと見る ›
        </Link>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      }}>
        {books.map((book, i) => (
          <Link
            key={book.id}
            href={book.href}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '11px 20px',
              borderTop: i >= 2 ? '1px solid var(--color-brand-light)' : 'none',
              textDecoration: 'none',
              pointerEvents: book.href === '#' ? 'none' : 'auto',
              opacity: book.href === '#' ? 0.45 : 1,
            }}
          >
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{
                display: 'block',
                fontSize: 13,
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {book.title}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-faint)', marginTop: 2 }}>
                著：{book.author}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
