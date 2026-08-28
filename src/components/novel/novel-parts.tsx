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
 * 第二部を読んでいる人にとって、第一部の目次はもう要らない。
 *
 * 出すのは札だけにする。
 * 部の名前をもう一度見出しに出すと、
 * 作者が「第一部」という名前を付けたときに
 * 「第一部　第一部」と重なって出てしまう。
 * 札に名前が出ていれば、それで足りる。
 *
 * 画面そのものは作り直さない。
 * 部を切り替えるたびに、あらすじも表紙もおすすめも
 * 読み直すことになり、1〜2秒待たされる。
 * 切り替わるのは目次だけでよい。
 *
 * そのかわり URL は変わらない。
 * 第二部を開いた状態を人に渡すことはできない。
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
    /* 部かどうかの印。中が空でも部のまま */
    is_part?: boolean | null
  }
  episodes: Episode[]
}

interface Props {
  novelId: string
  chapterGroups: ChapterGroup[]
  unassignedEpisodes: Episode[]
  readEpisodeIds: string[]
  epLikeCounts: Record<string, number>
  epCommentCounts: Record<string, number>
}

/** その他の札を表す目印。部の id と混ざらないようにする */
const OTHER = '__other__'

export default function NovelParts({
  novelId, chapterGroups, unassignedEpisodes,
  readEpisodeIds, epLikeCounts, epCommentCounts,
}: Props) {
  /*
   * 部とは「子を持つ章」のこと。
   * この見分け方は執筆画面と揃えてある。
   */
  const childrenOf = (id: string) =>
    chapterGroups.filter((g) => g.chapter.parent_id === id)

  /*
   * 部かどうかは印で決める。
   *
   * 印を持たない古い章のために、子がいれば部として扱う。
   * SQL を流す前でも見え方が壊れない。
   */
  const isPart = (g: ChapterGroup) =>
    g.chapter.is_part === true || childrenOf(g.chapter.id).length > 0

  const parts = chapterGroups.filter((g) => !g.chapter.parent_id && isPart(g))

  /* どの部にも入っていない章 */
  const looseChapters = chapterGroups.filter(
    (g) => !g.chapter.parent_id && !isPart(g),
  )

  const hasOther = looseChapters.length > 0 || unassignedEpisodes.length > 0

  const [currentId, setCurrentId] = useState<string>(
    parts.length > 0 ? parts[0].chapter.id : OTHER,
  )

  /*
   * 部を作っていない作品は、ここで打ち切る。
   *
   * 札も出さず、これまでとまったく同じ目次を出す。
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

  /*
   * 札の見出し。
   *
   * 作者が名前を付けていれば、それをそのまま出す。
   * 付けていないときだけ「第一部」で補う。
   *
   * こちらで番号を足すと、作者が「第一部」と
   * 名付けたときに二重になる。
   */
  const tabs: { id: string; label: string }[] = [
    ...parts.map((part, at) => ({
      id: part.chapter.id,
      label: part.chapter.title.trim() || formatBigChapterLabel({ title: '' }, at),
    })),
    ...(hasOther ? [{ id: OTHER, label: 'その他' }] : []),
  ]

  const at = tabs.findIndex((t) => t.id === currentId)
  const current = at < 0 ? tabs[0] : tabs[at]

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
          ...chapterGroups.filter(
            (g) => g.chapter.id === current.id && g.episodes.length > 0,
          ),
          ...childrenOf(current.id),
        ].map((g) => ({ ...g, chapter: { ...g.chapter, parent_id: null } }))

  const showingUnassigned = current.id === OTHER ? unassignedEpisodes : []

  return (
    <div>
      {/*
        * 部の札。横に並べる。
        *
        * 数が増えると入りきらないので、横に送れるようにする。
        * 折り返すと札の高さが変わり、目次の位置が動く。
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
              {tab.label}
            </button>
          )
        })}
      </div>

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
    </div>
  )
}
