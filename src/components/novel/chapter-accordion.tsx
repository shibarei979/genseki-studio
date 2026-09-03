'use client'
import { useState } from 'react'
import EpisodeChunks, { CHUNK_THRESHOLD } from '@/components/novel/episode-chunks'
import Link from 'next/link'

interface Episode {
  id: string
  title: string
  ep_number: number
  created_at: string
  /** 読めるようになった日。無ければ作った日で代える */
  posted_at?: string | null
  /** 最後に本文を直した日 */
  updated_at?: string | null
  illust_url: string | null
  chapter_id: string | null
}

interface ChapterGroup {
  chapter: {
    id: string
    title: string
    order_num: number
    /* 親を持たない章が大きい章。持つものが小さい章 */
    parent_id?: string | null
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

function fmtNum(n: number): string {
  if (n >= 10000) return (Math.floor(n / 1000) / 10) + '万'
  if (n >= 1000) return (Math.floor(n / 100) / 10) + 'K'
  return n.toString()
}


function fmtDate(d: string) {
  const dt = new Date(d)
  return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()}`
}

export default function ChapterAccordion({
  novelId, chapterGroups, unassignedEpisodes,
  readEpisodeIds, epLikeCounts, epCommentCounts,
}: Props) {
  /*
   * 中身のある章が 1 つでもあるか。
   *
   * ★ 空の章しか無いときは、章の作りを使っていないのと同じ。
   *   全話が「その他」に入り、畳まれた見出しの下へ隠れてしまう。
   *   そのときは見出しを出さず、話をそのまま並べる。
   */
  const hasUsedChapter = chapterGroups.some((group) => group.episodes.length > 0)

  // デフォルトで全て開いた状態にする
  const [openIds, setOpenIds] = useState<Set<string>>(
    new Set([...chapterGroups.map(g => g.chapter.id), 'unassigned'])
  )
  const readSet = new Set(readEpisodeIds)

  /*
   * 章を 2 段に束ねる。
   *
   * 親を持たない章が大きい章。
   * 大きい章を作っていない作品では、
   * すべてが親なしなので、これまでと同じ見え方になる。
   */
  const bigGroups = chapterGroups.filter((g) => !g.chapter.parent_id)
  const childrenOf = (id: string) =>
    chapterGroups.filter((g) => g.chapter.parent_id === id)

  function toggle(id: string) {
    setOpenIds(prev => {
      const next = new Set(Array.from(prev))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function EpisodeRow({ ep }: { ep: Episode }) {
    const isReadEp = readSet.has(ep.id)
    return (
      <Link href={`/novel/${novelId}/episode/${ep.id}`} style={{textDecoration:'none',display:'block'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderBottom:'1px solid var(--color-brand-light)',background: isReadEp ? '#e5e7eb' : 'var(--color-bg-card)'}}>
          {/* 挿絵は読む画面の本文の前にだけ出す。目次には出さない */}
          <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:5}}>
            {isReadEp && <span style={{fontSize:10,color:'#10b981',fontWeight:700,flexShrink:0}}>✓</span>}
            <span style={{fontSize:13,fontWeight:500,color: isReadEp ? '#4b5563' : 'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ep.title}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
            {epLikeCounts[ep.id] > 0 && <span style={{fontSize:10,color:'var(--color-text-muted)'}}>♡ {fmtNum(epLikeCounts[ep.id])}</span>}
            {epCommentCounts[ep.id] > 0 && <span style={{fontSize:10,color:'var(--color-text-muted)'}}>💬 {fmtNum(epCommentCounts[ep.id])}</span>}
            {/* 投稿した日。1日以上あけて直していれば、改稿の日も出す */}
            <span style={{fontSize:10,color:'var(--color-text-faint)',whiteSpace:'nowrap'}}>
              {/* 日付だけ。改稿は日が変わったときだけ出す */}
              {fmtDate(ep.posted_at || ep.created_at)}
              {ep.updated_at &&
                fmtDate(ep.updated_at) !== fmtDate(ep.posted_at || ep.created_at) && (
                  <span style={{marginLeft:5,color:'var(--color-text-muted)'}}>改稿 {fmtDate(ep.updated_at)}</span>
                )}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  /**
   * 小さい章 1 つぶんを描く。
   *
   * これまでの見た目そのまま。
   * 大きい章の中でも、外でも同じ形で出す。
   */
  function renderChapter({ chapter, episodes: chEps }: ChapterGroup) {
        const isOpen = openIds.has(chapter.id)
        const readInChapter = chEps.filter(ep => readSet.has(ep.id)).length
        return (
          <div key={chapter.id}>
            <button
              onClick={() => toggle(chapter.id)}
              style={{
                width:'100%', padding:'9px 14px',
                background:'var(--color-brand-light)', borderBottom:'1px solid var(--color-brand-border)', borderTop:'1px solid var(--color-brand-border)',
                border:'none', cursor:'pointer',
                display:'flex', alignItems:'center', gap:8,
                textAlign:'left',
              }}>
              <span style={{width:3,height:14,background:'var(--color-brand)',borderRadius:2,display:'inline-block',flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:700,color:'var(--color-brand)'}}>{chapter.title}</span>
              <span style={{fontSize:11,color:'var(--color-text-faint)'}}>（{chEps.length}話{readInChapter>0?` / ✓${readInChapter}話既読`:''}）</span>
              <div style={{flex:1}}/>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform .2s', flexShrink:0}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {/* 章の中も、多ければ 50 話ずつ束ねる */}
            {isOpen && (
              chEps.length > CHUNK_THRESHOLD ? (
                <EpisodeChunks
                  episodes={chEps}
                  renderRow={(ep: any) => <EpisodeRow key={ep.id} ep={ep} />}
                />
              ) : (
                chEps.map((ep) => <EpisodeRow key={ep.id} ep={ep} />)
              )
            )}
          </div>
        )
  }

  return (
    <>
      {/*
        * ★ 章を使っていない作品では、章の枠を出さない。
        *
        *   空の章だけが作ってある作品で、
        *   見出しばかりが並んでいた。
        */}
      {hasUsedChapter && bigGroups.map((group) => {
        const children = childrenOf(group.chapter.id)

        /*
         * 子を持たない章は、いままでどおり。
         *
         * 大きい章を作っていない作品では、
         * すべてがこちらを通る。見え方は変わらない。
         */
        if (children.length === 0) return renderChapter(group)

        const isOpen = openIds.has(group.chapter.id)
        const total = children.reduce((sum, c) => sum + c.episodes.length, 0)

        return (
          <div key={group.chapter.id} style={{
            border:'2px solid var(--color-brand)',
            borderRadius:10,
            overflow:'hidden',
            marginBottom:10,
          }}>
            <button
              onClick={() => toggle(group.chapter.id)}
              style={{
                width:'100%', padding:'11px 14px',
                background:'var(--color-brand)', border:'none', cursor:'pointer',
                display:'flex', alignItems:'center', gap:8, textAlign:'left',
              }}>
              <span style={{fontSize:14,fontWeight:700,color:'var(--color-text-inverse, #fff)'}}>
                {group.chapter.title || '大きい章'}
              </span>
              <span style={{fontSize:11,color:'rgba(255,255,255,.8)'}}>
                （{children.length}章 / {total}話）
              </span>
              <div style={{flex:1}}/>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform .2s', flexShrink:0}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {isOpen && children.map((child) => renderChapter(child))}
          </div>
        )
      })}

      {/*
        * 章に入れていない話。
        *
        * ★ 章が 1 つも無いときは、見出しを出さない。
        *
        *   全部が「その他」になるので、束ねる意味がない。
        *   畳まれた見出しの下に全話が隠れて、
        *   読む人は一度開かないと目次が見えなかった。
        */}
      {unassignedEpisodes.length > 0 && !hasUsedChapter && (
        unassignedEpisodes.length > CHUNK_THRESHOLD ? (
          <EpisodeChunks
            episodes={unassignedEpisodes}
            renderRow={(ep: any) => <EpisodeRow key={ep.id} ep={ep} />}
          />
        ) : (
          unassignedEpisodes.map((ep) => <EpisodeRow key={ep.id} ep={ep} />)
        )
      )}

      {/* 章があるときだけ、残りを「その他」としてまとめる */}
      {unassignedEpisodes.length > 0 && hasUsedChapter && (
        <div>
          <button
            onClick={() => toggle('unassigned')}
            style={{
              width:'100%', padding:'9px 14px',
              background:'#F5F5F0', borderBottom:'1px solid var(--color-brand-border)', borderTop:'1px solid var(--color-brand-border)',
              border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', gap:8,
              textAlign:'left',
            }}>
            <span style={{width:3,height:14,background:'var(--color-text-faint)',borderRadius:2,display:'inline-block',flexShrink:0}}/>
            <span style={{fontSize:13,fontWeight:700,color:'var(--color-text-muted)'}}>その他</span>
            <span style={{fontSize:11,color:'var(--color-text-faint)'}}>（{unassignedEpisodes.length}話）</span>
            <div style={{flex:1}}/>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{transform: openIds.has('unassigned') ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform .2s', flexShrink:0}}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {openIds.has('unassigned') && (
            unassignedEpisodes.length > CHUNK_THRESHOLD ? (
              <EpisodeChunks
                episodes={unassignedEpisodes}
                renderRow={(ep: any) => <EpisodeRow key={ep.id} ep={ep} />}
              />
            ) : (
              unassignedEpisodes.map((ep) => <EpisodeRow key={ep.id} ep={ep} />)
            )
          )}
        </div>
      )}
    </>
  )
}
