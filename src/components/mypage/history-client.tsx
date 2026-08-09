/**
 * ============================================================
 * 原石航路 Studio
 * HistoryClient — 閲覧履歴
 *
 * GENSEKIKORO のものを、そのまま移した。
 * 見た目は変えていない。
 * ============================================================
 */

'use client'

import Link from 'next/link'
import { useState } from 'react'

import { fmtChars, fmtDate } from '@/components/mypage/shell/format'
import { createClient } from '@/lib/supabase/client'

interface Props {
  historyItems: any[]
  charCountMap: Record<string, number>
  /** 保存済みかどうかの印を出すために使う */
  myBookmarks?: any[]
  userId: string
  epCountMap?: Record<string, number>
  /** 作品ごとの第1話。「最初から読む」に使う */
  firstEpMap?: Record<string, string>
}

export default function HistoryClient({ historyItems, charCountMap, myBookmarks = [], userId, epCountMap = {}, firstEpMap = {} }: Props) {
  const supabase = createClient()

  const [histSort, setHistSort] = useState<'recent'|'title'>('recent')
  const [histGenre, setHistGenre] = useState('すべてのジャンル')
  const [histType, setHistType] = useState('すべての種別')
  const [items, setItems] = useState(historyItems)


    const bookmarkedIds = new Set(myBookmarks.map((b:any)=>b.novels?.id).filter(Boolean))
    return (
    <div>
      {/* ページ見出し：大きく、説明との間に呼吸を */}
      <div style={{marginBottom:32}}>
        <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',letterSpacing:'-0.01em',lineHeight:1.3}}>
          閲覧履歴 <span style={{fontSize:15,fontWeight:600,color:'var(--color-text-muted)'}}>（{items.length}件）</span>
        </h1>
        <p style={{fontSize:14,color:'var(--color-text-muted)',marginTop:10,lineHeight:1.7}}>過去に閲覧した作品の履歴です。続きから読むことができます。</p>
      </div>

      {/* フィルターバー */}
      {items.length > 0 && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',
          background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:14,padding:'14px 18px',marginBottom:24}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <select value={histSort} onChange={e=>setHistSort(e.target.value as any)}
              style={{height:42,padding:'0 34px 0 14px',border:'1px solid #EADFD4',borderRadius:10,fontSize:13.5,color:'var(--color-text)',background:'var(--color-bg-card)',cursor:'pointer',appearance:'none' as any,
                backgroundImage:"url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
                backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',backgroundSize:'14px'}}>
              <option value="recent">最近読んだ順</option>
              <option value="title">タイトル順</option>
            </select>
            <select value={histGenre} onChange={e=>setHistGenre(e.target.value)}
              style={{height:42,padding:'0 34px 0 14px',border:'1px solid #EADFD4',borderRadius:10,fontSize:13.5,color:'var(--color-text)',background:'var(--color-bg-card)',cursor:'pointer',appearance:'none' as any,
                backgroundImage:"url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
                backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',backgroundSize:'14px'}}>
              {['すべてのジャンル', ...Array.from(new Set(items.map((h:any)=>h.genre).filter(Boolean)))].map((g:any)=>(
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select value={histType} onChange={e=>setHistType(e.target.value)}
              style={{height:42,padding:'0 34px 0 14px',border:'1px solid #EADFD4',borderRadius:10,fontSize:13.5,color:'var(--color-text)',background:'var(--color-bg-card)',cursor:'pointer',appearance:'none' as any,
                backgroundImage:"url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
                backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',backgroundSize:'14px'}}>
              {['すべての形式','長編','短編'].map(t=>(<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <button onClick={async()=>{
              if(!confirm('閲覧履歴をすべて削除しますか？')) return
              await supabase.from('page_views').delete().eq('user_id', userId)
              window.location.reload()
            }}
            style={{height:42,display:'inline-flex',alignItems:'center',padding:'0 16px',border:'1px solid #EADFD4',borderRadius:10,
              fontSize:13.5,color:'var(--color-text-muted)',background:'var(--color-bg-card)',cursor:'pointer'}}>
            履歴をクリア
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{textAlign:'center',padding:'72px 24px',color:'var(--color-text-faint)',fontSize:14,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:20}}>
          まだ閲覧履歴がありません
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {items
          .filter((h:any)=> histGenre==='すべてのジャンル' || h.genre===histGenre)
          .filter((h:any)=> histType==='すべての形式' || h.novelType===histType)
          .sort((a:any,b:any)=> histSort==='title' ? String(a.novelTitle).localeCompare(String(b.novelTitle),'ja') : 0)
          .map((item:any) => {
          const totalEps = epCountMap[item.novelId] || 0
          return (
          <div key={item.novelId}
            style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'18px 22px',
              boxShadow:'0 1px 3px rgba(0,0,0,0.03)',display:'grid',gridTemplateColumns:'minmax(0,1fr) 200px',gap:24,alignItems:'center'}}>

            {/* 左：作品情報（サイズと色で階層をつける） */}
            <div style={{minWidth:0}}>
              <a href={`/novel/${item.novelId}`} className="history-title" style={{textDecoration:'none',display:'block'}}>
                <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',lineHeight:1.4,marginBottom:4,overflowWrap:'anywhere' as any}}>{item.novelTitle}</div>
              </a>
              <div style={{fontSize:12,color:'var(--color-text-muted)',marginBottom:8}}>作者：{item.displayName}</div>
              {item.summary && (
                <p style={{fontSize:12.5,color:'var(--color-text-muted)',lineHeight:1.7,marginBottom:10,maxWidth:640,
                  display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,overflow:'hidden',overflowWrap:'anywhere' as any}}>{item.summary}</p>
              )}
              <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',background:'#FFF0E5',color:'var(--color-brand)',padding:'0 10px',borderRadius:6,fontWeight:600}}>{item.genre}</span>
                {item.novelType && <span style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',background:'#EEF4FF',color:'#2563eb',padding:'0 10px',borderRadius:6,fontWeight:600}}>{item.novelType}</span>}
                {item.isSerial
                  ? <span style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',background:'#EAF8EF',color:'#35a45d',padding:'0 10px',borderRadius:6,fontWeight:600}}>連載中</span>
                  : <span style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',background:'#F4F4F5',color:'#71717a',padding:'0 10px',borderRadius:6,fontWeight:600}}>完結</span>}
                {item.tags.slice(0,3).map((t:string) => (
                  <span key={t} style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',color:'var(--color-text-faint)',padding:'0 8px',borderRadius:6}}>#{t}</span>
                ))}
              </div>
            </div>

            {/* 右：数値・ボタン（アイコン付き・ボタンは大きく） */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
              <div style={{textAlign:'right'}}>
                {charCountMap[item.novelId]>0 && (
                  <div style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:13.5,fontWeight:600,color:'var(--color-text)',marginBottom:4}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    {fmtChars(charCountMap[item.novelId])}
                  </div>
                )}
                <div style={{fontSize:12,color:'var(--color-text-faint)'}}>最終閲覧：{fmtDate(item.viewedAt)}</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {firstEpMap[item.novelId] && firstEpMap[item.novelId]!==item.epId && (
                  <Link href={`/novel/${item.novelId}/episode/${firstEpMap[item.novelId]}`}
                    style={{height:36,display:'inline-flex',alignItems:'center',padding:'0 12px',background:'var(--color-bg-card)',color:'var(--color-text-muted)',
                      border:'1px solid #EADFD4',borderRadius:8,fontSize:12.5,fontWeight:600,textDecoration:'none',whiteSpace:'nowrap'}}>
                    最初から
                  </Link>
                )}
                <Link href={`/novel/${item.novelId}/episode/${item.epId}`}
                  style={{height:36,display:'inline-flex',alignItems:'center',padding:'0 16px',background:'var(--color-brand)',color:'var(--color-text-inverse)',
                    borderRadius:8,fontSize:13,fontWeight:600,textDecoration:'none',whiteSpace:'nowrap'}}>
                  続きを読む
                </Link>
                {/* しおり（保存） */}
                <Link href={`/novel/${item.novelId}`}
                  title={bookmarkedIds.has(item.novelId)?'保存済み':'作品ページで保存する'}
                  style={{width:36,height:36,display:'inline-flex',alignItems:'center',justifyContent:'center',
                    border:'1px solid #EADFD4',borderRadius:8,background:'var(--color-bg-card)',cursor:'pointer',flexShrink:0}}>
                  <svg width="17" height="17" viewBox="0 0 24 24"
                    fill={bookmarkedIds.has(item.novelId)?'var(--color-brand)':'none'}
                    stroke={bookmarkedIds.has(item.novelId)?'var(--color-brand)':'var(--color-text-faint)'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                </Link>
              </div>
              {totalEps > 0 && (
                <div style={{fontSize:11.5,color:'var(--color-text-faint)'}}>全{totalEps}話</div>
              )}
            </div>
          </div>
          )
        })}
        </div>
      )}
    </div>
    )
}
