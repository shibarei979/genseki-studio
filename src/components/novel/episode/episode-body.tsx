'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReadingSettings, { Settings } from '@/components/novel/episode/reading-settings'
import MobileEpisodeBody from '@/components/novel/episode/mobile-episode-body'
import { useQuote } from '@/components/novel/episode/quote-context'

interface Props {
  title: string
  body: string
  preface?: string | null
  afterword?: string | null
  authorName?: string
  episodeId?: string
  onQuote?: (text: string) => void
}

const DEFAULTS: Settings = { font: 'serif', fontSize: 16, lineHeight: 2.1, writingMode: 'horizontal' }

function renderBodyH(text: string): string {
  let r = text.replace(/｜([^《]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>')
  r = r.replace(/《《([^》]+)》》/g, '<em style="font-style:normal;font-weight:700;border-bottom:2px solid var(--color-brand)">$1</em>')
  r = r.replace(/\n/g, '<br/>')
  return r
}

function isHorizontalChar(ch: string): boolean {
  return ['ー','〜','…','‥','─','—','－','〰','ｰ','｜','|'].includes(ch)
}

function VerticalText({ text }: { text: string }) {
  let processed = text.replace(/[0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))
  processed = processed.replace(/…/g, '・・・')
  processed = processed.replace(/‥/g, '・・')
  processed = processed.replace(/ー/g, '｜')
  processed = processed.replace(/ｰ/g, '｜')
  processed = processed.replace(/〜/g, '｜')
  processed = processed.replace(/－/g, '｜')
  processed = processed.replace(/—/g, '｜')
  processed = processed.replace(/―/g, '｜')
  processed = processed.replace(/─/g, '｜')
  const chars = processed.split('')
  return (
    <>
      {chars.map((ch, i) =>
        ch === '\n'
          ? <br key={i}/>
          : (
            <span key={i} style={{
              display: 'inline-block',
              transform: isHorizontalChar(ch) ? 'rotate(90deg)' : 'none',
              lineHeight: 1.2,
            }}>
              {ch}
            </span>
          )
      )}
    </>
  )
}

// テキストのクリーニング
function cleanForSpeech(text: string): string {
  let t = text
    .replace(/｜([^《]+)《[^》]+》/g, '$1')
    .replace(/《《([^》]+)》》/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[#*`]/g, '')
    .replace(/　/g, '')
  t = t.replace(/\n\n+/g, '。')
  t = t.replace(/\n/g, '、')
  t = t.replace(/「/g, '。「')
  t = t.replace(/」/g, '」。')
  t = t.replace(/『/g, '。『')
  t = t.replace(/』/g, '』。')
  t = t.replace(/。。+/g, '。')
  t = t.replace(/、。/g, '。')
  t = t.replace(/。、/g, '。')
  t = t.replace(/――+/g, '。')
  t = t.replace(/…+/g, '、')
  t = t.replace(/‥+/g, '、')
  return t.trim()
}

// ===== 読み上げフック =====
function useSpeech(text: string) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused,  setIsPaused]  = useState(false)
  const [isStopped, setIsStopped] = useState(true)
  const [rate,      setRate]      = useState(1.0)
  const [supported, setSupported] = useState(false)
  const [voices,    setVoices]    = useState<SpeechSynthesisVoice[]>([])
  const [voiceIdx,  setVoiceIdx]  = useState(-1)

  const rateRef    = useRef(1.0)
  const voiceRef   = useRef<SpeechSynthesisVoice | null>(null)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppedRef = useRef(true)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    setSupported(true)
    const load = () => {
      const all   = window.speechSynthesis.getVoices()
      const jaVox = all.filter(v => v.lang.startsWith('ja'))
      setVoices(jaVox)
      if (voiceRef.current === null && jaVox.length > 0) {
        const prefer = jaVox.findIndex(v =>
          v.name.includes('Kyoko') || v.name.includes('Otoya') ||
          v.name.includes('Google') || v.name.includes('Microsoft')
        )
        const idx = prefer >= 0 ? prefer : 0
        voiceRef.current = jaVox[idx]
        setVoiceIdx(idx)
      }
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
  }, [])

  const startTimer = useCallback(() => {
    if (timerRef.current) return
    timerRef.current = setInterval(() => {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume()
    }, 10000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => {
    stopTimer()
    if (typeof window !== 'undefined') window.speechSynthesis.cancel()
  }, [stopTimer])

  const play = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    stoppedRef.current = false
    const clean = cleanForSpeech(text)
    const utter = new SpeechSynthesisUtterance(clean)
    utter.lang   = 'ja-JP'
    utter.rate   = rateRef.current
    utter.pitch  = 1.0
    utter.volume = 1.0
    if (voiceRef.current) utter.voice = voiceRef.current
    utter.onstart = () => { setIsPlaying(true); setIsPaused(false); setIsStopped(false) }
    utter.onend   = () => {
      if (!stoppedRef.current) {
        setIsPlaying(false); setIsPaused(false); setIsStopped(true); stopTimer()
      }
    }
    utter.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return
      setIsPlaying(false); setIsPaused(false); setIsStopped(true); stopTimer()
    }
    window.speechSynthesis.speak(utter)
    startTimer()
  }, [supported, text, startTimer, stopTimer])

  function pause() {
    if (!supported || !isPlaying) return
    window.speechSynthesis.pause()
    setIsPaused(true); setIsPlaying(false)
  }

  function resumeSpeech() {
    if (!supported || !isPaused) return
    window.speechSynthesis.resume()
    setIsPaused(false); setIsPlaying(true)
  }

  function stop() {
    if (!supported) return
    stoppedRef.current = true
    window.speechSynthesis.cancel()
    stopTimer()
    setIsPlaying(false); setIsPaused(false); setIsStopped(true)
  }

  function changeRate(r: number) {
    rateRef.current = r; setRate(r)
    if (isPlaying || isPaused) { window.speechSynthesis.cancel(); setTimeout(play, 80) }
  }

  function changeVoice(idx: number) {
    voiceRef.current = voices[idx] ?? null; setVoiceIdx(idx)
    if (isPlaying || isPaused) { window.speechSynthesis.cancel(); setTimeout(play, 80) }
  }

  return { isPlaying, isPaused, isStopped, rate, supported, voices, voiceIdx, play, pause, resumeSpeech, stop, changeRate, changeVoice }
}


// ===== 読み上げパネル UI =====
function SpeechPanel({ title, body, isMobile }: { title: string; body: string; isMobile: boolean }) {
  const fullText = `${title}。\n${body}`
  const { isPlaying, isPaused, isStopped, rate, supported, voices, voiceIdx, play, pause, resumeSpeech, stop, changeRate, changeVoice } = useSpeech(fullText)
  const [showVoice, setShowVoice] = useState(false)

  if (!supported) return null

  const RATES = [0.8, 1.0, 1.25, 1.5, 2.0]

  return (
    <div style={{background:'var(--color-bg-card)',border:'1.5px solid var(--color-brand-border)',borderRadius:12,padding:isMobile?'12px 14px':'14px 18px',marginBottom:12}}>
      {/* 1行目：ラベル＋速度 */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>聴く β</span>
        </div>
        <div style={{display:'flex',gap:3}}>
          {RATES.map(r => (
            <button key={r} onClick={()=>changeRate(r)} style={{
              padding:'2px 7px',fontSize:10,borderRadius:6,border:'1px solid',cursor:'pointer',
              background:rate===r?'var(--color-brand)':'var(--color-bg-card)',color:rate===r?'var(--color-bg-card)':'var(--color-text-muted)',
              borderColor:rate===r?'var(--color-brand)':'var(--color-brand-border)',fontWeight:rate===r?700:400,
            }}>{r}x</button>
          ))}
        </div>
      </div>

      {/* 2行目：操作ボタン＋状態＋音声選択 */}
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        {/* 停止 */}
        <button onClick={stop} disabled={!isPlaying && !isPaused}
          style={{width:34,height:34,borderRadius:'50%',border:'1.5px solid var(--color-brand-border)',background:'var(--color-bg-card)',cursor:isPlaying||isPaused?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',opacity:isPlaying||isPaused?1:0.35}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--color-text-muted)"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </button>

        {/* 再生/一時停止/再開 */}
        <button onClick={()=>{ if(isPlaying) pause(); else if(isPaused && !isStopped) resumeSpeech(); else if(!isPlaying && !isPaused) play() }}
          style={{width:46,height:46,borderRadius:'50%',border:'none',background:'var(--color-brand)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 10px color-mix(in srgb, var(--color-brand) 35%, transparent)'}}>
          {isPlaying
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-bg-card)"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-bg-card)"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>

        {/* 状態テキスト */}
        <div style={{flex:1}}>
          {isPlaying  && <div style={{fontSize:11,color:'var(--color-brand)',fontWeight:600}}>読み上げ中...</div>}
          {isPaused   && <div style={{fontSize:11,color:'var(--color-text-muted)'}}>一時停止 — ▶ で再開</div>}
          {!isPlaying && !isPaused && <div style={{fontSize:11,color:'var(--color-text-faint)'}}>▶ を押して読み上げ開始</div>}
        </div>

        {/* 音声選択 */}
        {voices.length > 0 && (
          <div style={{position:'relative'}}>
            <button onClick={()=>setShowVoice(!showVoice)}
              style={{fontSize:11,padding:'5px 10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:showVoice?'var(--color-brand-light)':'var(--color-bg-card)',color:'var(--color-text-muted)',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
              音声
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showVoice && (
              <>
                <div style={{position:'fixed',inset:0,zIndex:98}} onClick={()=>setShowVoice(false)}/>
                <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:10,boxShadow:'0 4px 20px rgba(0,0,0,0.12)',minWidth:'min(200px, 100%)',maxHeight:220,overflowY:'auto',zIndex:99}}>
                  <div style={{padding:'8px 12px',fontSize:11,color:'var(--color-text-faint)',borderBottom:'1px solid var(--color-brand-border)',fontWeight:600}}>日本語音声を選択</div>
                  {voices.map((v, i) => (
                    <button key={i} onClick={()=>{changeVoice(i);setShowVoice(false)}}
                      style={{width:'100%',padding:'9px 14px',textAlign:'left',background:voiceIdx===i?'var(--color-brand-light)':'var(--color-bg-card)',border:'none',borderBottom:'1px solid var(--color-brand-light)',fontSize:12,color:voiceIdx===i?'var(--color-brand)':'var(--color-text)',cursor:'pointer',fontWeight:voiceIdx===i?700:400}}>
                      {v.name}{voiceIdx===i && <span style={{marginLeft:6,fontSize:10}}>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== 文単位コメント機能 =====
function splitIntoSentences(text: string): string[] {
  const result: string[] = []
  let buf = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    buf += ch
    const isEnder = ch === '。' || ch === '！' || ch === '？' || ch === '」' || ch === '』'
    const next = text[i+1]
    if (ch === '\n') {
      result.push(buf)
      buf = ''
      continue
    }
    if (isEnder && next !== '」' && next !== '』') {
      result.push(buf)
      buf = ''
    }
  }
  if (buf) result.push(buf)
  return result.filter(s => s.length > 0)
}

function QuotableBody({ body, fontSize, lineHeight, fontFamily, onQuote, selecting, onAfterQuote }: {
  body: string; fontSize: number; lineHeight: number; fontFamily: string
  onQuote?: (text:string)=>void; selecting?: boolean; onAfterQuote?: () => void
}) {
  const sentences = splitIntoSentences(body)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  function handleClick(raw: string, idx: number) {
    if (!selecting) return
    const clean = raw
      .replace(/｜([^《]+)《[^》]+》/g, '$1')
      .replace(/《《([^》]+)》》/g, '$1')
      .replace(/\n/g, '')
      .trim()
    if (!clean) return
    if (onQuote) onQuote(clean)
    onAfterQuote?.()
  }

  return (
    <div style={{fontSize,lineHeight,color:'var(--color-text)',fontFamily,wordBreak:'break-all'}}>
      {sentences.map((raw, idx) => {
        const trimmedForDisplay = raw === '\n' ? '' : raw
        const htmlInner = renderBodyH(trimmedForDisplay)
        const isHover = selecting && hoverIdx === idx
        if (raw === '\n') return <br key={idx}/>
        return (
          <span
            key={idx}
            onMouseEnter={()=> selecting && setHoverIdx(idx)}
            onMouseLeave={()=> setHoverIdx(prev => prev===idx?null:prev)}
            style={{
              position:'relative',
              background: isHover ? 'color-mix(in srgb, var(--color-brand) 10%, transparent)' : 'transparent',
              borderRadius: 3,
              transition:'background .15s ease',
              cursor: selecting ? 'pointer' : 'inherit',
            }}
            onClick={()=>handleClick(raw, idx)}
          >
            <span dangerouslySetInnerHTML={{__html: htmlInner}} style={{pointerEvents: selecting ? 'none' : 'auto'}}/>
            {selecting && (
              <span
                aria-hidden="true"
                style={{
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  width:0, opacity:0, overflow:'hidden',
                  marginLeft: isHover ? 4 : 0,
                  ...(isHover ? { width:16, opacity:1 } : {}),
                  transition:'opacity .15s ease, width .15s ease',
                  verticalAlign:'middle',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

export default function EpisodeBody({ title, body, preface, afterword, authorName, episodeId, onQuote }: Props) {
  const { setQuotedText, selecting, setSelecting, commentAnchorRef } = useQuote()
  const handleQuote = onQuote || setQuotedText

  function handleAfterQuote() {
    setSelecting(false)
    if (commentAnchorRef.current) {
      commentAnchorRef.current.scrollIntoView({ behavior:'smooth', block:'start' })
    }
  }

  const [isMobile, setIsMobile] = useState(false)
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('reading_settings') : null
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS
    } catch { return DEFAULTS }
  })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const vertical = settings.writingMode === 'vertical'

  const fontFamily =
    settings.font === 'serif'   ? "'Noto Serif JP', serif" :
    settings.font === 'rounded' ? "'Zen Maru Gothic', 'Noto Sans JP', sans-serif" :
    settings.font === 'ud'      ? "'BIZ UDPGothic', 'Noto Sans JP', sans-serif" :
                                  "'Noto Sans JP', sans-serif"

  // ===== モバイル =====
  if (isMobile) {
    return (
      <>
        <SpeechPanel title={title} body={body} isMobile={true}/>
        <MobileEpisodeBody title={title} body={body} preface={preface} afterword={afterword} authorName={authorName}/>
      </>
    )
  }

  // ===== デスクトップ =====
  return (
    <>
      <SpeechPanel title={title} body={body} isMobile={false}/>
      <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden',marginBottom:16}}>
        <div style={{padding:'8px 16px',borderBottom:'1px solid var(--color-brand-light)',background:'var(--color-bg)',display:'flex',justifyContent:'flex-end',alignItems:'center'}}>
          <ReadingSettings onChange={setSettings} isMobile={false} showWritingMode={true}/>
        </div>

        {vertical ? (
          <VerticalBody title={title} body={body} preface={preface} afterword={afterword}
            authorName={authorName} fontSize={settings.fontSize} fontFamily={fontFamily}
            selecting={selecting} onQuote={handleQuote} onAfterQuote={handleAfterQuote}/>
        ) : (
          <>
            <div style={{padding:'32px 48px 40px'}}>
              <h1 style={{fontFamily,fontSize:20,fontWeight:700,color:'var(--color-text)',textAlign:'center',marginBottom:28,lineHeight:1.6}}>
                {title}
              </h1>
              {preface && (
                <div style={{fontSize:13,color:'var(--color-text-muted)',lineHeight:1.9,padding:'12px 16px',background:'var(--color-bg)',borderLeft:'3px solid var(--color-brand-border)',borderRadius:4,marginBottom:28,whiteSpace:'pre-wrap'}}>
                  {preface}
                </div>
              )}
              {selecting && (
                <div style={{
                  display:'flex', alignItems:'center', gap:8,
                  background:'#eef5f9', border:'1px solid #dcdfda', borderRadius:8,
                  padding:'9px 14px', marginBottom:20, fontSize:12.5, color:'#55605a',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                  </svg>
                  引用したい文をクリックしてください
                </div>
              )}
              <QuotableBody body={body} fontSize={settings.fontSize} lineHeight={settings.lineHeight} fontFamily={fontFamily} onQuote={handleQuote} selecting={selecting} onAfterQuote={handleAfterQuote}/>
            </div>
            {afterword && (
              <div style={{borderTop:'1px solid var(--color-brand-border)'}}>
                <div style={{padding:'10px 16px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)',display:'flex',alignItems:'center',gap:8}}>
                  <span style={{width:3,height:14,background:'var(--color-brand)',borderRadius:2,display:'inline-block'}}/>
                  <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>あとがき</span>
                  {authorName && <span style={{fontSize:11,color:'var(--color-text-muted)',marginLeft:'auto'}}>{authorName}</span>}
                </div>
                <div style={{padding:'16px 20px',fontSize:14,color:'var(--color-text)',lineHeight:1.9,whiteSpace:'pre-wrap',fontFamily:"'Noto Sans JP',sans-serif"}}>
                  {afterword}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

interface VerticalProps {
  title: string; body: string; preface?: string|null; afterword?: string|null
  authorName?: string; fontSize: number; fontFamily: string
  selecting?: boolean; onQuote?: (text:string)=>void; onAfterQuote?: () => void
}

function VerticalBody({ title, body, preface, afterword, authorName, fontSize, fontFamily, selecting, onQuote, onAfterQuote }: VerticalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [body])

  const sentences = splitIntoSentences(body)

  function handleClick(raw: string) {
    if (!selecting) return
    const clean = raw
      .replace(/｜([^《]+)《[^》]+》/g, '$1')
      .replace(/《《([^》]+)》》/g, '$1')
      .replace(/\n/g, '')
      .trim()
    if (!clean) return
    if (onQuote) onQuote(clean)
    onAfterQuote?.()
  }

  return (
    <div>
      {preface && (
        <div style={{padding:'12px 32px',background:'var(--color-bg)',borderBottom:'1px solid var(--color-brand-light)'}}>
          <div style={{fontSize:13,color:'var(--color-text-muted)',lineHeight:1.9,padding:'10px 14px',background:'var(--color-bg-card)',borderLeft:'3px solid var(--color-brand-border)',borderRadius:4,whiteSpace:'pre-wrap'}}>
            {preface}
          </div>
        </div>
      )}
      {selecting && (
        <div style={{display:'flex',alignItems:'center',gap:8,background:'#eef5f9',border:'1px solid #dcdfda',borderRadius:8,padding:'9px 14px',margin:'12px 32px',fontSize:12.5,color:'#55605a'}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          引用したい文をクリックしてください
        </div>
      )}
      <style>{`
        .v-scroll::-webkit-scrollbar { height: 14px; }
        .v-scroll::-webkit-scrollbar-track { background: var(--color-brand-light); border-radius: 7px; }
        .v-scroll::-webkit-scrollbar-thumb { background: var(--color-brand); border-radius: 7px; border: 2px solid var(--color-brand-light); }
        .v-scroll { scrollbar-width: thick; scrollbar-color: var(--color-brand) var(--color-brand-light); }
      `}</style>
      <div ref={scrollRef} className="v-scroll" style={{overflowX:'scroll',overflowY:'hidden',height:'calc(100vh - 180px)',paddingBottom:4}}>
        <div style={{
          writingMode:'vertical-rl',
          textOrientation:'mixed',
          display:'inline-block',
          padding:'32px 24px 32px 48px',
          height:'calc(100% - 18px)',
          boxSizing:'border-box',
        }}>
          <div style={{display:'inline-block',marginRight:'2em',verticalAlign:'top'}}>
            <div style={{fontSize:fontSize+4,fontWeight:700,color:'var(--color-text)',fontFamily,lineHeight:1.8}}>
              {title}
            </div>
          </div>
          <div style={{display:'inline-block',fontSize,lineHeight:2.1,color:'var(--color-text)',fontFamily,wordBreak:'break-all',verticalAlign:'top'}}>
            {selecting ? (
              sentences.map((raw, idx) => {
                if (raw === '\n') return <br key={idx}/>
                const isHover = hoverIdx === idx
                return (
                  <span key={idx}
                    onMouseEnter={()=>setHoverIdx(idx)}
                    onMouseLeave={()=>setHoverIdx(prev=>prev===idx?null:prev)}
                    onClick={()=>handleClick(raw)}
                    style={{
                      background: isHover ? 'color-mix(in srgb, var(--color-brand) 15%, transparent)' : 'transparent',
                      cursor: 'pointer',
                      borderRadius: 3,
                      transition: 'background .15s ease',
                    }}>
                    <VerticalText text={raw}/>
                  </span>
                )
              })
            ) : (
              <VerticalText text={body}/>
            )}
          </div>
        </div>
      </div>
      {afterword && (
        <div style={{borderTop:'1px solid var(--color-brand-border)'}}>
          <div style={{padding:'10px 16px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)',display:'flex',alignItems:'center',gap:8}}>
            <span style={{width:3,height:14,background:'var(--color-brand)',borderRadius:2,display:'inline-block'}}/>
            <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>あとがき</span>
            {authorName && <span style={{fontSize:11,color:'var(--color-text-muted)',marginLeft:'auto'}}>{authorName}</span>}
          </div>
          <div style={{padding:'16px 20px',fontSize:14,color:'var(--color-text)',lineHeight:1.9,whiteSpace:'pre-wrap'}}>
            {afterword}
          </div>
        </div>
      )}
    </div>
  )
}
