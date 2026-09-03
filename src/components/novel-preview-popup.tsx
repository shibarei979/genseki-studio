'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  novel: {
    id: string
    title: string
    genre: string
    novel_type?: string
    summary?: string | null
    catchcopy?: string | null
    display_name?: string
    like_count?: number
    tags?: string[]
  }
  children: React.ReactNode
  /**
   * 最初から開いた状態で出すか。
   *
   * 本棚の本は home.js が並べているので、
   * この部品で包めない。押されたのを拾って、
   * 開いた状態で呼び出す。
   */
  openAtOnce?: boolean
  /** 閉じたときに知らせる */
  onClosed?: () => void
}

export default function NovelPreviewPopup({ novel, children, openAtOnce = false, onClosed }: Props) {
  const [show, setShow] = useState(openAtOnce)

  /* 閉じたことを、呼んだ側にも伝える */
  function close() {
    setShow(false)
    onClosed?.()
  }
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  /*
   * 札（タグ）が 1 行に入りきったか。
   *
   * ★ 入らないときは、折り返さずに「…」で止める。
   *
   *   前は折り返していたので、狭い画面では札が 2 段 3 段になり、
   *   題名やあらすじが下へ押し出されていた。
   */
  const tagsRef = useRef<HTMLDivElement>(null)
  const [tagsCut, setTagsCut] = useState(false)

  /* 画面の高さ。原稿用紙の行数をここから決める */
  const [viewH, setViewH] = useState(900)

  useEffect(() => {
    setMounted(true)
    const check = () => {
      setIsMobile(window.innerWidth <= 768)
      setViewH(window.innerHeight)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /*
   * 札が入りきったかを測る。
   *
   * 幅は画面の大きさと縮め具合で変わるので、
   * 開いたときと、大きさが変わったときに測り直す。
   */
  useEffect(() => {
    const el = tagsRef.current
    if (!el) { setTagsCut(false); return }
    setTagsCut(el.scrollWidth > el.clientWidth + 2)
  }, [show, mounted, viewH, isMobile, novel.tags])

  const rawText = novel.catchcopy || novel.summary || ''

  function toVertical(text: string): string {
    return text
      .replace(/0/g, '０').replace(/1/g, '１').replace(/2/g, '２')
      .replace(/3/g, '３').replace(/4/g, '４').replace(/5/g, '５')
      .replace(/6/g, '６').replace(/7/g, '７').replace(/8/g, '８')
      .replace(/9/g, '９')
  }

  function isHorizontalChar(ch: string): boolean {
    return ['ー','〜','…','‥','─','—','－'].includes(ch)
  }

  const ROWS      = isMobile ? 17 : 20
  const TEXT_COLS = 5
  /*
   * 縮め具合。
   *
   * ★ 入りきらないときは、小窓ぜんぶを同じ割合で縮める。
   *
   *   ますだけ縮めると、頭と足だけが大きいままで釣り合わない。
   *   題名・作者名・押し具まで、同じ k を掛けて縮める。
   *
   *   頭と足と余白で 250px ほど要る（ますが元の大きさのとき）。
   *   小窓は画面の 88% まで。そこへ収まる割合を出す。
   *   0.5 より小さくはしない。読めなくなる。
   */
  const CELL_BASE = isMobile ? 18 : 27
  const CHROME    = 250
  const k         = Math.max(0.5, Math.min(1,
                      (viewH * 0.88) / (CHROME + ROWS * CELL_BASE)))

  /** k を掛けて、下限を切る */
  const sz = (base: number, min = 9) => Math.max(min, Math.round(base * k))

  const CELL      = Math.max(12, Math.round(CELL_BASE * k))

  const lines = rawText.split('\n').map(toVertical)
  const processedChars: (string | null)[] = []
  for (const line of lines) {
    const usedInCurrentCol = processedChars.length % ROWS
    if (usedInCurrentCol > 0) {
      const remaining = ROWS - usedInCurrentCol
      for (let i = 0; i < remaining; i++) processedChars.push(null)
    }
    for (const ch of line.split('')) {
      processedChars.push(ch)
      if (processedChars.length >= ROWS * TEXT_COLS) break
    }
    if (processedChars.length >= ROWS * TEXT_COLS) break
  }
  const textCells = Array.from({ length: ROWS * TEXT_COLS }, (_, i) => processedChars[i] ?? null)

  const mobileWidth = Math.round((CELL * TEXT_COLS + 36 + 24 + 32) * 1.3)

  function handleCardClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShow(true)
  }

  const modal = show && mounted ? createPortal(
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:isMobile?'16px':20}}
      onClick={()=>close()}>
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          background:'var(--color-bg-card)',
          border:'2px solid var(--color-brand)',
          borderRadius:16,
          boxShadow:'0 8px 24px rgba(0,0,0,0.15)',
          overflow:'hidden',
          animation:'modalIn .2s ease',
          width: isMobile ? mobileWidth : CELL * (TEXT_COLS + 6) + 56,
          maxWidth: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}>

        {/* ヘッダー */}
        <div style={{background:'var(--color-brand-light)',padding:`${sz(10,5)}px ${sz(14,8)}px`,borderBottom:'1px solid var(--color-brand-border)',position:'relative',flexShrink:0}}>
          <button onClick={()=>close()}
            style={{position:'absolute',top:8,right:10,background:'none',border:'none',fontSize:18,color:'var(--color-text-faint)',cursor:'pointer'}}>
            ×
          </button>
          <div style={{display:'flex',gap:5,marginBottom:3,flexWrap:'wrap'}}>
            <span style={{fontSize:sz(10),background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',padding:'1px 6px',borderRadius:3}}>{novel.genre}</span>
            {novel.novel_type && <span style={{fontSize:sz(10),background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'1px 6px',borderRadius:3}}>{novel.novel_type}</span>}
          </div>
          <div style={{fontSize: sz(isMobile ? 13 : 15, 11),fontWeight:700,color:'var(--color-text)',lineHeight:1.4,fontFamily:"'Noto Serif JP',serif",paddingRight:20}}>{novel.title}</div>
          {novel.display_name && (
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3,flexWrap:'wrap'}}>
              <span style={{fontSize:sz(11),color:'var(--color-text-muted)'}}>作者：{novel.display_name}</span>
              {novel.like_count !== undefined && novel.like_count > 0 && (
                <span style={{fontSize:sz(11),color:'var(--color-text-muted)'}}>♡ {novel.like_count}</span>
              )}
            </div>
          )}
          {(novel.tags||[]).length > 0 && (
            <div style={{display:'flex',alignItems:'center',gap:4,marginTop:4,minWidth:0}}>
              <div ref={tagsRef} style={{display:'flex',gap:4,flexWrap:'nowrap',overflow:'hidden',minWidth:0}}>
                {(novel.tags||[]).slice(0,5).map((t:string) => (
                  <span key={t} style={{flexShrink:0,whiteSpace:'nowrap',fontSize:sz(9),background:'var(--color-bg)',color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',padding:'1px 5px',borderRadius:3}}>#{t}</span>
                ))}
              </div>
              {tagsCut && (
                <span style={{flexShrink:0,fontSize:sz(9),color:'var(--color-text-faint)'}}>…</span>
              )}
            </div>
          )}
        </div>

        {/* 本文エリア */}
        <div style={{flex:1,overflowY:'auto',minHeight:0}}>
          {rawText ? (
            <div style={{padding:`${sz(12,4)}px 0`,background:'var(--color-bg-card)'}}>
              <div style={{fontSize:sz(10),color:'var(--color-text-faint)',marginBottom:sz(6,2),textAlign:'center',letterSpacing:'0.1em'}}>
                {novel.catchcopy ? '― キャッチコピー ―' : '― あらすじ ―'}
              </div>
              <div style={{margin: isMobile ? '0 8px' : '0 28px'}}>
                <div style={{
                  display:'flex',flexDirection:'row',
                  border:'1px solid var(--color-brand-border)',
                  borderRadius:3,overflow:'hidden',padding:'8px 0',
                  background:'var(--color-bg-card)',
                }}>
                  <div style={{flex:1,display:'flex',flexDirection:'column'}}>
                    {Array.from({length: ROWS}, (_, row) => (
                      <div key={row} style={{flex:1,height:CELL,borderBottom:row<ROWS-1?'1px solid var(--color-brand-border)':'none',borderRight:'1px solid var(--color-brand-border)'}}/>
                    ))}
                  </div>
                  {Array.from({length: TEXT_COLS}, (_, col) => {
                    const actualCol = TEXT_COLS - 1 - col
                    return (
                      <div key={col} style={{display:'flex',flexDirection:'column',borderRight:'1px solid var(--color-brand-border)'}}>
                        {Array.from({length: ROWS}, (_, row) => {
                          const char = textCells[actualCol * ROWS + row]
                          return (
                            <div key={row} style={{
                              width:CELL,height:CELL,
                              borderBottom:row<ROWS-1?'1px solid var(--color-brand-border)':'none',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              /* 字はますに合わせる。ますだけ縮めると、はみ出す */
                              fontSize: Math.max(9, Math.round(CELL * (isMobile ? 0.61 : 0.556))),
                              color: char ? 'var(--color-text)' : 'transparent',
                              fontFamily:"'Noto Serif JP',serif",
                              lineHeight:1,flexShrink:0,
                            }}>
                              <span style={{
                                display:'inline-block',
                                transform:isHorizontalChar(char||'')?'rotate(90deg)':'none',
                                lineHeight:1,
                              }}>{char||'　'}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                  <div style={{flex:1,display:'flex',flexDirection:'column'}}>
                    {Array.from({length: ROWS}, (_, row) => (
                      <div key={row} style={{flex:1,height:CELL,borderBottom:row<ROWS-1?'1px solid var(--color-brand-border)':'none'}}/>
                    ))}
                  </div>
                </div>
              </div>
              {rawText.replace(/\n/g,'').length > ROWS * TEXT_COLS && (
                <div style={{fontSize:11,color:'var(--color-text-faint)',textAlign:'center',marginTop:6}}>…続く</div>
              )}
            </div>
          ) : (
            <div style={{padding:'20px',textAlign:'center',color:'var(--color-text-faint)',fontSize:13}}>
              あらすじがありません
            </div>
          )}
        </div>

        {/* ボタン */}
        <div style={{padding:`${sz(10,5)}px ${sz(14,8)}px`,borderTop:'1px solid var(--color-brand-border)',background:'var(--color-bg)',display:'flex',gap:8,flexShrink:0}}>
          <button onClick={()=>close()}
            style={{flex:1,padding:`${sz(9,5)}px`,border:'1px solid var(--color-brand-border)',borderRadius:8,background:'var(--color-bg-card)',color:'var(--color-text-muted)',fontSize:sz(13,11),cursor:'pointer'}}>
            閉じる
          </button>
          <a href={`/novel/${novel.id}`}
            style={{flex:2,display:'block',padding:`${sz(9,5)}px 0`,background:'var(--color-brand)',color:'var(--color-text-inverse)',
              fontWeight:700,fontSize:sz(14,12),borderRadius:8,textDecoration:'none',textAlign:'center'}}>
            作品を読む →
          </a>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity:0; transform:scale(.95) }
          to   { opacity:1; transform:scale(1) }
        }
      `}</style>
    </div>,
    document.body
  ) : null

  return (
    <>
      <div onClick={handleCardClick} style={{cursor:'pointer'}}>
        {children}
      </div>
      {modal}
    </>
  )
}
