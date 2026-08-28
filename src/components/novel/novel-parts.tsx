'use client'
import { useState } from 'react'
import ChapterAccordion from '@/components/novel/chapter-accordion'
import { formatBigChapterLabel } from '@/components/workspace/chapter-tree'

/**
 * ============================================================
 * 原石航路 Studio
 * NovelParts — 作品ページの部
 *
 * 部は、折りたたむものではなく「別のページ」として扱う。
 *
 * 折りたたみだと、部は目次の中の一区画でしかない。
 * 長い作品では、第二部を読んでいる人にとって
 * 第一部の目次はもう要らないものになる。
 *
 * 画面そのものは作り直さない。
 * 部を切り替えるたびに、あらすじも表紙もおすすめも
 * すべて読み直すことになり、1〜2秒待たされる。
 * 切り替わるのは目次だけでよい。
 *
 * そのかわり、URL は変わらない。
 * 第二部を開いた状態を人に渡すことはできない。
 * （そうしたくなったら、URL に部を足す作りへ寄せる）
 *
 * 部を作っていない作品は、ここを素通りして
 * これまでどおりの目次が出る。
 * ============================================================
 */

interface Episode {
  id: string
  title: string
  ep_number: number
  created_at: string
  illust_url: string | null
  chapter_id: string | null
}

interface ChapterGroup {
  chapter: {
    id: string
    title: string
    order_num: number
    parent_id?: string | null
  }
  episodes: Episode[]
}

interface Props {
  novelId: string
  novelTitle: string
  chapterGroups: ChapterGroup[]
  unassignedEpisodes: Episode[]
  readEpisodeIds: string[]
  epLikeCounts: Record<string, number>
  epCommentCounts: Record<string, number>
}

/** その他の札を表す目印。部の id と混ざらないようにする */
const OTHER = '__other__'

export default function NovelParts({
  novelId, novelTitle, chapterGroups, unassignedEpisodes,
  readEpisodeIds, epLikeCounts, epCommentCounts,
}: Props) {
  /*
   * 部とは「子を持つ章」のこと。
   *
   * 子を持たない章は、これまでどおりのただの章。
   * この見分け方は執筆画面と揃えてある。
   */
  const childrenOf = (id: string) =>
    chapterGroups.filter((g) => g.chapter.parent_id === id)

  const parts = chapterGroups.filter(
    (g) => !g.chapter.parent_id && childrenOf(g.chapter.id).length > 0,
  )

  /* どの部にも入っていない章 */
  const looseChapters = chapterGroups.filter(
    (g) => !g.chapter.parent_id && childrenOf(g.chapter.id).length === 0,
  )

  const hasOther = looseChapters.length > 0 || unassignedEpisodes.length > 0

  /* 最初に出す札。部があれば第一部から */
  const [currentId, setCurrentId] = useState<string>(
    parts.length > 0 ? parts[0].chapter.id : OTHER,
  )

  /*
   * 部を作っていない作品は、ここで打ち切る。
   *
   * 札も見出しも出さず、これまでとまったく同じ目次を出す。
   * 441話の作品の見え方が変わらないのは、ここのため。
   */
  if (parts.length === 0) {
    return (
      <ChapterAccordion
        novelId={novelId}
        chapterGroups={chapterGroups}
        unassignedEpisodes={unassignedEpisodes}
        readEpisodeIds={readEpisodeIds}
        epLikeCounts={epLikeCounts}
        epCommentCounts={epCommentCounts}
      />
    )
  }

  /* 札の並び。部のあとに「その他」を置く */
  const tabs: { id: string; label: string; short: string }[] = [
    ...parts.map((part, at) => ({
      id: part.chapter.id,
      label: formatBigChapterLabel({ title: part.chapter.title }, at),
      /* 札は幅が限られるので、番号だけ出す */
      short: formatBigChapterLabel({ title: '' }, at),
    })),
    ...(hasOther ? [{ id: OTHER, label: 'その他', short: 'その他' }] : []),
  ]

  const at = tabs.findIndex((t) => t.id === currentId)
  const current = at < 0 ? tabs[0] : tabs[at]
  const prev = at > 0 ? tabs[at - 1] : null
  const next = at >= 0 && at < tabs.length - 1 ? tabs[at + 1] : null

  /*
   * いま出す章。
   *
   * 部の中の章は parent_id を外して渡す。
   * 目次の側は「親を持たない章」だけを描く作りなので、
   * 外さないと 1 つも出ない。
   *
   * 部そのものに直接ぶら下がった話も、
   * 部の先頭の章として残す（束ねる途中でこうなることがある）。
   */
  const showing =
    current.id === OTHER
      ? looseChapters
      : [
          ...chapterGroups.filter((g) => g.chapter.id === current.id && g.episodes.length > 0),
          ...childrenOf(current.id),
        ].map((g) => ({ ...g, chapter: { ...g.chapter, parent_id: null } }))

  const showingUnassigned = current.id === OTHER ? unassignedEpisodes : []

  /* この部の話数。数の合計は作品ぜんぶで出すので、ここは目安 */
  const countHere =
    showing.reduce((sum, g) => sum + g.episodes.length, 0) +
    showingUnassigned.length

  return (
    <div>
      {/* 作品名と部名。いまどの部を見ているかを、上で言い切る */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--color-brand-border)',
        background: 'var(--color-brand-light)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>
          {novelTitle}
        </div>
        <div style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--color-brand)',
          fontFamily: "'Noto Serif JP',serif",
        }}>
          {current.label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 2 }}>
          {countHere}話
        </div>
      </div>

      {/*
        * 部の札。横に並べる。
        *
        * 数が増えると入りきらないので、横に送れるようにする。
        * 折り返すと、札の高さが変わって目次の位置が動く。
        */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '10px 14px',
        overflowX: 'auto',
        borderBottom: '1px solid var(--color-brand-border)',
        background: 'var(--color-bg)',
      }}>
        {tabs.map((tab) => {
          const isNow = tab.id === current.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentId(tab.id)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border: `1px solid ${isNow ? 'var(--color-brand)' : 'var(--color-brand-border)'}`,
                background: isNow ? 'var(--color-brand)' : 'var(--color-bg-card)',
                color: isNow ? 'var(--color-text-inverse, #fff)' : 'var(--color-text-muted)',
              }}
            >
              {tab.short}
            </button>
          )
        })}
      </div>

      {/*
        * 前の部へ戻る押し具。目次の上に置く。
        *
        * 読み返すときに探すのは、たいてい直前の部。
        * 札の列から選ばせるより、1 つで足りる。
        */}
      {prev && (
        <button
          type="button"
          onClick={() => setCurrentId(prev.id)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            border: 'none',
            borderBottom: '1px solid var(--color-brand-border)',
            background: 'var(--color-bg-card)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-brand)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)' }}>
            {prev.label}へ行く
          </span>
        </button>
      )}

      <ChapterAccordion
        /*
         * 部を変えたら、開いた章の記憶を捨てる。
         *
         * key を変えないと、前の部で開いていた章の id が
         * そのまま残り、別の部で勝手に閉じて見える。
         */
        key={current.id}
        novelId={novelId}
        chapterGroups={showing}
        unassignedEpisodes={showingUnassigned}
        readEpisodeIds={readEpisodeIds}
        epLikeCounts={epLikeCounts}
        epCommentCounts={epCommentCounts}
      />

      {/* 次の部へ。読み終えた人が下から続けられるように */}
      {next && (
        <button
          type="button"
          onClick={() => setCurrentId(next.id)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 14px',
            border: 'none',
            borderTop: '1px solid var(--color-brand-border)',
            background: 'var(--color-bg-card)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)' }}>
            {next.label}へ行く
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-brand)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  )
}
