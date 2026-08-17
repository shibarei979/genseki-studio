'use client'
import { useState, useRef, useEffect } from 'react'
import ReadingSettings, { Settings } from '@/components/novel/episode/reading-settings'

interface Props {
  title: string
  body: string
  preface?: string | null
  afterword?: string | null
  authorName?: string
}

const DEFAULTS: Settings = { font: 'serif', fontSize: 16, lineHeight: 2.1, writingMode: 'horizontal' }

function fontFamilyOf(font: Settings['font']): string {
  return font === 'serif'   ? "'Noto Serif JP', serif"
       : font === 'rounded' ? "'Zen Maru Gothic', 'Noto Sans JP', sans-serif"
       : font === 'ud'      ? "'BIZ UDPGothic', 'Noto Sans JP', sans-serif"
       :                      "'Noto Sans JP', sans-serif"
}

function renderBody(text: string): string {
  let result = text.replace(/｜([^《]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>')
  result = result.replace(/《《([^》]+)》》/g, '<em style="font-style:normal;font-weight:700;border-bottom:2px solid var(--color-brand)">$1</em>')
  result = result.replace(/\n/g, '<br/>')
  return result
}

function VerticalText({ text }: { text: string }) {
  let processed = text.replace(/[0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))
  /*
   * 三点リーダも置き換えない。
   *
   * 「・・・」に差し替えると、字形も間隔も変わるうえ、
   * コピーした本文まで別の字になる。
   * 縦書きでの向きは、下で 1 字ずつ回して合わせる。
   */
  /*
   * 伸ばし棒は置き換えない。
   * 「コーヒー」が「コ｜ヒ｜」になるのを防ぐ。
   * 向きはブラウザの縦組みに任せる。
   */
  /*
   * ルビと傍点は、1 文字ずつに分ける前に取り出す。
   * そのまま分けると ｜漢字《かんじ》 の記号が
   * 素の文字として並んでしまう。
   */
  const parts: { type: 'text' | 'ruby' | 'dot'; body: string; ruby?: string }[] = []
  const pattern = /｜([^《]+)《([^》]+)》|《《([^》]+)》》/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = pattern.exec(processed)) !== null) {
    if (m.index > last) parts.push({ type: 'text', body: processed.slice(last, m.index) })
    if (m[1]) parts.push({ type: 'ruby', body: m[1], ruby: m[2] })
    else if (m[3]) parts.push({ type: 'dot', body: m[3] })
    last = m.index + m[0].length
  }
  if (last < processed.length) parts.push({ type: 'text', body: processed.slice(last) })

  function renderChars(text: string, keyPrefix: string) {
    /*
     * 1 文字ずつ回すのをやめた。
     * 回すと「――――」が 1 本ずつ立って細く並ぶ。
     * 執筆画面と同じく、ブラウザの縦組みに任せる。
     */
    return text.split('\n').map((line, i, all) => (
      <span key={`${keyPrefix}-${i}`}>
        {line}
        {i < all.length - 1 ? <br/> : null}
      </span>
    ))
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'ruby') {
          return (
            <ruby key={`r-${i}`} style={{ rubyPosition: 'over' }}>
              {part.body}
              <rt style={{ fontSize: '0.5em' }}>{part.ruby}</rt>
            </ruby>
          )
        }
        if (part.type === 'dot') {
          return (
            <span
              key={`d-${i}`}
              style={{
                textEmphasis: 'filled dot',
                WebkitTextEmphasis: 'filled dot',
                textEmphasisPosition: 'over right',
                WebkitTextEmphasisPosition: 'over right',
              } as React.CSSProperties}
            >
              {part.body}
            </span>
          )
        }
        return <span key={`t-${i}`}>{renderChars(part.body, `t${i}`)}</span>
      })}
    </>
  )
}

export default function MobileEpisodeBody({ title, body, preface, afterword, authorName }: Props) {
  const [isVertical, setIsVertical] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [containerHeight, setContainerHeight] = useState(600)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setContainerHeight(window.innerHeight - 200)
    try {
      const saved = localStorage.getItem('reading_settings')
      if (saved) {
        const s = { ...DEFAULTS, ...JSON.parse(saved) } as Settings
        setSettings(s)
        setIsVertical(s.writingMode === 'vertical')
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (isVertical && scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
        }
      }, 100)
    }
  }, [isVertical, body])

  function handleSettingsChange(s: Settings) {
    setSettings(s)
    setIsVertical(s.writingMode === 'vertical')
  }

  const fontFamily = fontFamilyOf(settings.font)

  const Afterword = afterword ? (
    <div style={{borderTop:'1px solid var(--color-brand-border)'}}>
      <div style={{padding:'10px 14px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)',display:'flex',alignItems:'center',gap:8}}>
        <span style={{width:3,height:14,background:'var(--color-brand)',borderRadius:2,display:'inline-block'}}/>
        <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>あとがき</span>
        {authorName && <span style={{fontSize:11,color:'var(--color-text-muted)',marginLeft:'auto'}}>{authorName}</span>}
      </div>
      <div style={{padding:'14px 16px',fontSize:14,color:'var(--color-text)',lineHeight:1.9,whiteSpace:'pre-wrap',fontFamily:"'Noto Sans JP',sans-serif"}}>
        {afterword}
      </div>
    </div>
  ) : null

  // ===== 縦書き =====
  if (isVertical) {
    return (
      <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden',marginBottom:16}}>
        <div style={{padding:'8px 12px',borderBottom:'1px solid var(--color-brand-light)',background:'var(--color-bg)',display:'flex',justifyContent:'flex-end',alignItems:'center'}}>
          <ReadingSettings onChange={handleSettingsChange} isMobile={true}/>
        </div>

        {preface && (
          <div style={{padding:'10px 14px',background:'var(--color-bg)',borderBottom:'1px solid var(--color-brand-light)'}}>
            <div style={{fontSize:13,color:'var(--color-text-muted)',lineHeight:1.9,padding:'8px 12px',background:'var(--color-bg-card)',borderLeft:'3px solid var(--color-brand-border)',borderRadius:4,whiteSpace:'pre-wrap'}}>
              {preface}
            </div>
          </div>
        )}

        <style>{`
          .vertical-body, .vertical-body * {
            writing-mode: vertical-rl !important;
            text-orientation: mixed !important;
          }
          .vertical-body .v-char {
            display: inline-block !important;
            writing-mode: vertical-rl !important;
          }
          .vertical-body .v-char-rotate {
            display: inline-block !important;
            writing-mode: vertical-rl !important;
            transform: rotate(90deg) !important;
          }
          .v-scroll-m::-webkit-scrollbar { height: 10px; }
          .v-scroll-m::-webkit-scrollbar-track { background: var(--color-brand-light); border-radius: 5px; }
          .v-scroll-m::-webkit-scrollbar-thumb { background: var(--color-brand); border-radius: 5px; border: 2px solid var(--color-brand-light); }
          .v-scroll-m { scrollbar-width: thin; scrollbar-color: var(--color-brand) var(--color-brand-light); }
        `}</style>

        <div
          ref={scrollRef}
          className="v-scroll-m"
          style={{
            overflowX: 'scroll',
            overflowY: 'hidden',
            height: containerHeight,
            paddingBottom: 4,
          }}
        >
          <div
            className="vertical-body"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              display: 'inline-block',
              padding: '24px 16px 24px 32px',
              height: 'calc(100% - 18px)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{display:'inline-block', marginRight:'2em', verticalAlign:'top', writingMode:'vertical-rl'}}>
              <div style={{fontSize: settings.fontSize + 4, fontWeight:700, color:'var(--color-text)', fontFamily, lineHeight:1.8}}>
                {title}
              </div>
            </div>
            <div style={{display:'inline-block', fontSize: settings.fontSize, lineHeight: settings.lineHeight, color:'var(--color-text)', fontFamily, wordBreak:'break-all', verticalAlign:'top', writingMode:'vertical-rl'}}>
              <VerticalText text={body}/>
            </div>
          </div>
        </div>

        <div style={{padding:'4px 12px',background:'var(--color-bg)',borderTop:'1px solid var(--color-brand-light)',textAlign:'center',fontSize:10,color:'var(--color-text-faint)'}}>
          ← 左にスワイプして読み進める
        </div>

        {Afterword}
      </div>
    )
  }

  // ===== 横書き =====
  return (
    <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden',marginBottom:16}}>
      <div style={{padding:'8px 12px',borderBottom:'1px solid var(--color-brand-light)',background:'var(--color-bg)',display:'flex',justifyContent:'flex-end',alignItems:'center'}}>
        <ReadingSettings onChange={handleSettingsChange} isMobile={true}/>
      </div>

      <div style={{padding:'20px 16px 28px'}}>
        <h1 style={{fontFamily, fontSize:settings.fontSize+2, fontWeight:700, color:'var(--color-text)', textAlign:'center', marginBottom:20, lineHeight:1.6}}>
          {title}
        </h1>
        {preface && (
          <div style={{fontSize:settings.fontSize-2, color:'var(--color-text-muted)', lineHeight:1.9, padding:'10px 12px', background:'var(--color-bg)', borderLeft:'3px solid var(--color-brand-border)', borderRadius:4, marginBottom:20, whiteSpace:'pre-wrap'}}>
            {preface}
          </div>
        )}
        <div
          style={{fontSize:settings.fontSize, lineHeight:settings.lineHeight, color:'var(--color-text)', fontFamily, wordBreak:'break-all'}}
          dangerouslySetInnerHTML={{__html: renderBody(body)}}
        />
      </div>

      {Afterword}
    </div>
  )
}
