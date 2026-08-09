/**
 * ============================================================
 * 原石航路 Studio
 * RecommendSection — おすすめ作品
 *
 * 画面が出たあとに読む。
 *
 * 好みを拾って点を付けるのに 20 回近くかかるが、
 * 出るのは画面の一番下。
 * 表で待つと、あらすじも目次も遅れる。
 * ============================================================
 */

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Props {
  novelId: string
  genre: string
  excludeIds: string
}

export default function RecommendSection({ novelId, genre, excludeIds }: Props) {
  const [recommendedNovels, setRecommendedNovels] = useState<any[]>([])
  const [recAuthorMap, setRecAuthorMap] = useState<Record<string,string>>({})

  useEffect(() => {
    let alive = true
    const query = new URLSearchParams({ genre, exclude: excludeIds })

    fetch(`/api/novel/${novelId}/recommend?${query}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!alive || !data) return
        setRecommendedNovels(data.recommendedNovels || [])
        setRecAuthorMap(data.recAuthorMap || {})
      })
      .catch(() => { /* 届かなくても、本編は読める */ })

    return () => { alive = false }
  }, [novelId, genre, excludeIds])

  /* まだ届いていないときは、何も出さない */
  if (recommendedNovels.length === 0) return null

  return (
                          <div style={{marginTop:20,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:4,height:16,background:'var(--color-brand)',borderRadius:2,display:'inline-block'}}/>
              <span style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>おすすめ作品</span>
            </div>
            <div style={{display:'flex',flexDirection:'column'}}>
              {recommendedNovels.map((n: any, i: number) => (
                <Link key={n.id} href={`/novel/${n.id}`} style={{textDecoration:'none',display:'block',borderBottom:i<recommendedNovels.length-1?'1px solid var(--color-brand-light)':'none'}}>
                  <div style={{padding:'12px 14px',display:'flex',gap:10,alignItems:'flex-start'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:4,marginBottom:4,flexWrap:'wrap'}}>
                        {n.isNew && <span style={{fontSize:10,background:'var(--color-brand)',color:'var(--color-text-inverse)',padding:'1px 6px',borderRadius:3,fontWeight:700}}>NEW</span>}
                        <span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',padding:'1px 6px',borderRadius:3}}>{n.genre}</span>
                        {n.novel_type && <span style={{fontSize:10,background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'1px 6px',borderRadius:3}}>{n.novel_type}</span>}
                        {n.is_serial && <span style={{fontSize:10,background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',padding:'1px 6px',borderRadius:3}}>連載中</span>}
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:2,lineHeight:1.4}}>{n.title}</div>
                      <div style={{fontSize:11,color:'var(--color-text-muted)'}}>作者：{recAuthorMap[n.author_id]||''}</div>
                      {n.summary && (
                        <div style={{fontSize:11,color:'var(--color-text-muted)',marginTop:3,lineHeight:1.6,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any}}>
                          {n.summary}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
  )
}
