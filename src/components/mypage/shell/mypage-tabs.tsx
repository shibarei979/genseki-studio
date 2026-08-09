/**
 * ============================================================
 * 原石航路 Studio
 * MypageTabs — マイページの行き先
 *
 * GENSEKIKORO の見た目をそのまま移した。
 *
 *   広い画面 … 左に縦の一覧。コンテストの帯もそこに置く
 *   狭い画面 … 上に横のタブ
 *
 * ページごとに分けたので、押すと道筋が変わる。
 * ============================================================
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

const TAB_ICONS: Record<string, React.ReactNode> = {
  mypage:    <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  works:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  series:    <><path d="M12 2L2 7l10 5 10-5-10-5z"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  bookmarks: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>,
  history:   <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  tweets:    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>,
  missions:  <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
}

const TABS: { id: string; href: string; label: string }[] = [
  { id:'mypage',    href:'/mypage',            label:'マイページ' },
  { id:'works',     href:'/mypage/works',      label:'作品管理' },
  { id:'series',    href:'/mypage/series',     label:'シリーズ' },
  { id:'bookmarks', href:'/mypage/bookmarks',  label:'保存済み' },
  { id:'history',   href:'/mypage/history',    label:'閲覧履歴' },
  { id:'tweets',    href:'/mypage/tweets',     label:'つぶやき' },
  { id:'missions',  href:'/mypage/missions',   label:'ミッション' },
  { id:'settings',  href:'/mypage/settings',   label:'設定' },
]

/** いまその場所にいるか。/mypage だけは完全一致で見る */
function isHere(pathname: string, href: string): boolean {
  return href === '/mypage' ? pathname === '/mypage' : pathname.startsWith(href)
}

/**
 * ------------------------------------------------------------
 * 広い画面。左の縦一覧
 * ------------------------------------------------------------
 */
export function MypageSideNav() {
  const pathname = usePathname()

  return (
    <div style={{width:232,flexShrink:0,borderRight:'1px solid var(--color-brand-border)',padding:'24px 12px',position:'sticky',top:60,height:'calc(100vh - 60px)',background:'var(--color-bg-card)',overflowY:'auto'}}>
      {TABS.map(tab => {
        const on = isHere(pathname, tab.href)

        return (
          <Link key={tab.id} href={tab.href}
            style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'11px 14px',textAlign:'left' as const,
              fontSize:14,fontWeight:on?700:500,
              color:on?'var(--color-brand)':'#555',
              background:on?'#eef5f9':'transparent',
              border:'none',borderRadius:8,cursor:'pointer',marginBottom:2,transition:'all .12s',position:'relative',textDecoration:'none'}}>
            {on && <span style={{position:'absolute',left:0,top:8,bottom:8,width:3,borderRadius:2,background:'var(--color-brand)'}}/>}
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              {TAB_ICONS[tab.id]}
            </svg>
            {tab.label}
          </Link>
        )
      })}

      {/* コンテスト開催中バナー */}
      <div style={{marginTop:28,background:'#eef5f9',border:'1px solid #cfe0ea',borderRadius:14,padding:'18px 16px',position:'relative',overflow:'hidden'}}>
        <div style={{fontSize:13.5,fontWeight:700,color:'var(--color-brand)',marginBottom:8}}>コンテスト開催中！</div>
        <div style={{fontSize:12,color:'var(--color-text-muted)',lineHeight:1.7,marginBottom:14}}>テーマに沿った作品を<br/>投稿してみませんか？</div>
        <Link href="/contest"
          style={{display:'inline-block',padding:'8px 14px',border:'1px solid var(--color-brand)',borderRadius:8,
            background:'var(--color-bg-card)',color:'var(--color-brand)',fontSize:12.5,fontWeight:600,textDecoration:'none'}}>
          コンテスト一覧へ
        </Link>

        {/* 羽ペンの装飾 */}
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{position:'absolute',right:-4,bottom:-6,opacity:0.5}}>
          <path d="M40 14c-8 2-16 9-19 17-2 5-3 10-2 15l-4 4a1.5 1.5 0 0 0 2 2l4-4c5 1 10 0 15-2 8-3 15-11 17-19 1-4 2-9 2-12 0-1-1-2-2-2-3 0-8 1-13 1z"
            fill="#dce9f1" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}

/**
 * ------------------------------------------------------------
 * 狭い画面。上の横タブ
 * ------------------------------------------------------------
 */
export function MypageTopTabs() {
  const pathname = usePathname()

  return (
    <div style={{background:'var(--color-bg-card)',borderBottom:'1px solid var(--color-brand-border)',overflowX:'auto',scrollbarWidth:'none' as any,position:'sticky',top:54,zIndex:10}}>
      <div style={{display:'flex',minWidth:'max-content'}}>
        {TABS.map(tab => {
          const on = isHere(pathname, tab.href)

          return (
            <Link key={tab.id} href={tab.href}
              style={{padding:'10px 14px',fontSize:12,fontWeight:on?700:400,color:on?'var(--color-brand)':'var(--color-text-muted)',background:'none',border:'none',cursor:'pointer',borderBottom:on?'2px solid var(--color-brand)':'2px solid transparent',whiteSpace:'nowrap' as const,textDecoration:'none'}}>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
