'use client'
import { useState } from 'react'
import Link from 'next/link'

interface Episode {
  id: string
  title: string
  ep_number: number
  created_at: string
  illust_url: string | null
  chapter_id: string | null
}

interface ChapterGroup {
  chapter: { id: string; title: string; order_num: number }
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
  // デフォルトで全て開いた状態にする
  const [openIds, setOpenIds] = useState<Set<string>>(
    new Set([...chapterGroups.map(g => g.chapter.id), 'unassigned'])
  )
  const readSet = new Set(readEpisodeIds)

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
          {ep.illust_url && (
            <img src={ep.illust_url} alt="" style={{width:36,height:36,objectFit:'cover',borderRadius:4,flexShrink:0}}/>
          )}
          <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:5}}>
            {isReadEp && <span style={{fontSize:10,color:'#10b981',fontWeight:700,flexShrink:0}}>✓</span>}
            <span style={{fontSize:13,fontWeight:500,color: isReadEp ? '#4b5563' : 'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ep.title}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
            {epLikeCounts[ep.id] > 0 && <span style={{fontSize:10,color:'var(--color-text-muted)'}}>♡ {fmtNum(epLikeCounts[ep.id])}</span>}
            {epCommentCounts[ep.id] > 0 && <span style={{fontSize:10,color:'var(--color-text-muted)'}}>💬 {fmtNum(epCommentCounts[ep.id])}</span>}
            <span style={{fontSize:10,color:'var(--color-text-faint)'}}>{fmtDate(ep.created_at)}</span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <>
      {chapterGroups.map(({ chapter, episodes: chEps }) => {
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
            {isOpen && chEps.map((ep) => <EpisodeRow key={ep.id} ep={ep} />)}
          </div>
        )
      })}

      {unassignedEpisodes.length > 0 && (
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
          {openIds.has('unassigned') && unassignedEpisodes.map((ep) => <EpisodeRow key={ep.id} ep={ep} />)}
        </div>
      )}
    </>
  )
}
