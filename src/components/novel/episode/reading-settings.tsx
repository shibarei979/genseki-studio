'use client'
import { useState, useEffect } from 'react'

export interface Settings {
  font: 'serif' | 'sans' | 'rounded' | 'ud'
  fontSize: number
  lineHeight: number
  writingMode: 'horizontal' | 'vertical'
}

const DEFAULTS: Settings = { font: 'serif', fontSize: 16, lineHeight: 2.1, writingMode: 'horizontal' }
const STORAGE_KEY = 'reading_settings'

const FONT_OPTIONS = [
  { label: '明朝', value: 'serif' as const },
  { label: 'ゴシック', value: 'sans' as const },
  { label: '丸ゴシック', value: 'rounded' as const },
  { label: 'UD', value: 'ud' as const },
]
const SIZE_OPTIONS = [
  { label: '小', value: 14 },
  { label: '中', value: 16 },
  { label: '大', value: 18 },
  { label: '特大', value: 21 },
]
const LINE_OPTIONS = [
  { label: '狭', value: 1.6 },
  { label: '普通', value: 2.1 },
  { label: '広', value: 2.6 },
  { label: '特広', value: 3.2 },
]

interface Props {
  onChange: (s: Settings) => void
  isMobile?: boolean
  showWritingMode?: boolean
}

export default function ReadingSettings({ onChange, isMobile = false, showWritingMode = false }: Props) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULTS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const s = { ...DEFAULTS, ...JSON.parse(saved) } as Settings
        setSettings(s)
        onChange(s)
      }
    } catch {}
  }, [])

  function update(partial: Partial<Settings>) {
    const next = { ...settings, ...partial }
    setSettings(next)
    onChange(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  const btnBase = (active: boolean) => ({
    padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
    border: active ? '1.5px solid var(--color-brand)' : '1px solid var(--color-brand-border)',
    background: active ? 'var(--color-brand-light)' : 'var(--base-color-1)',
    color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
  })

  return (
    <div style={{position:'relative', display:'inline-block'}}>
      <button
        onClick={() => setOpen(o => !o)}
        title="読書設定"
        style={{
          display:'flex', alignItems:'center', gap:5,
          padding:'5px 12px', borderRadius:16,
          border:'1px solid var(--color-brand-border)', background:'var(--color-bg-card)',
          fontSize:12, color:'var(--color-text-muted)', cursor:'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        読書設定
      </button>

      {open && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:98}} onClick={()=>setOpen(false)}/>
          <div style={{
            position:'absolute', top:'calc(100% + 8px)', right:0,
            background:'var(--color-bg-card)', border:'1px solid var(--color-brand-border)', borderRadius:12,
            boxShadow:'0 4px 20px rgba(0,0,0,0.12)',
            padding:'16px', minWidth:260, zIndex:99,
          }}>
            {/* 縦書き/横書き（モバイル または showWritingMode時） */}
            {(isMobile || showWritingMode) && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>読み方向</div>
                <div style={{display:'flex',gap:6}}>
                  {/* horizontal = 横書き（縦スクロール）、vertical = 縦書き（横スクロール） */}
                  <button onClick={()=>update({writingMode:'horizontal'})} style={btnBase(settings.writingMode==='horizontal')}>
                    横書き
                  </button>
                  <button onClick={()=>update({writingMode:'vertical'})} style={btnBase(settings.writingMode==='vertical')}>
                    縦書き
                  </button>
                </div>
              </div>
            )}
            {/* フォント */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>フォント</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {FONT_OPTIONS.map(o => (
                  <button key={o.value} onClick={()=>update({font:o.value})} style={btnBase(settings.font===o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {/* 文字サイズ */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>文字サイズ</div>
              <div style={{display:'flex',gap:6}}>
                {SIZE_OPTIONS.map(o => (
                  <button key={o.value} onClick={()=>update({fontSize:o.value})} style={btnBase(settings.fontSize===o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {/* 行間 */}
            <div>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>行間</div>
              <div style={{display:'flex',gap:6}}>
                {LINE_OPTIONS.map(o => (
                  <button key={o.value} onClick={()=>update({lineHeight:o.value})} style={btnBase(settings.lineHeight===o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
