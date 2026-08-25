'use client'

import { useState } from 'react'

/**
 * ============================================================
 * 原石航路
 * VoicePlayer — AI 音声で聴く
 *
 * 見た目は「聴く β」に合わせた。
 * 同じ話のページに 2 つの読み上げが並ぶので、
 * 形が違うと別の機能に見えてしまう。
 *
 * 中身は違う。あちらは端末の声、こちらは作った音声。
 * 作るのに費用がかかるので、一度作ったら保存して使い回す。
 * 新しく作れるのは 1 人 1 日 3 回まで。
 * すでにある音声を聴くのは、何度でもできる。
 * ============================================================
 */

/*
 * 選べる声。
 *
 * 裏で作り置きするのはこの 2 つだけ。
 * 増やすと、その分だけ聴ける話が増えるのが遅くなる。
 */
const VOICES = [
  { id: 'ja-JP-Wavenet-A', label: '女性' },
  { id: 'ja-JP-Wavenet-C', label: '男性' },
] as const

export default function VoicePlayer({
  episodeId,
  isLoggedIn,
  isMobile = false,
}: {
  episodeId: string
  isLoggedIn: boolean
  isMobile?: boolean
}) {
  const [voice, setVoice] = useState<string>(VOICES[0].id)
  const [url, setUrl] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [showVoice, setShowVoice] = useState(false)

  const current = VOICES.find((v) => v.id === voice) ?? VOICES[0]

  async function load() {
    if (isBusy) return

    setIsBusy(true)
    setError('')
    setUrl(null)

    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId, voice }),
      })

      const data = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !data.url) {
        setError(data.error || '読み上げを用意できませんでした')
        setIsBusy(false)
        return
      }

      setUrl(data.url)
    } catch {
      setError('読み上げを用意できませんでした')
    }
    setIsBusy(false)
  }

  const box = {
    background: 'var(--color-bg-card)',
    border: '1.5px solid var(--color-brand-border)',
    borderRadius: 12,
    padding: isMobile ? '12px 14px' : '14px 18px',
    marginBottom: 12,
  } as const

  if (!isLoggedIn) {
    return (
      <div style={box}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <SpeakerIcon />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            AIで聴く
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 8, lineHeight: 1.8 }}>
          ログインすると、この話をAIの声で聴けます。
        </p>
      </div>
    )
  }

  return (
    <div style={box}>
      {/* 1行目：ラベル＋声の選択 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <SpeakerIcon />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            AIで聴く
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowVoice(!showVoice)}
            style={{
              fontSize: 11, padding: '5px 10px',
              border: '1px solid var(--color-brand-border)', borderRadius: 8,
              background: showVoice ? 'var(--color-brand-light)' : 'var(--color-bg-card)',
              color: 'var(--color-text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {current.label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showVoice && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setShowVoice(false)}/>
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)',
                borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                minWidth: 'min(180px, 100%)', zIndex: 99, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '8px 12px', fontSize: 11, color: 'var(--color-text-faint)',
                  borderBottom: '1px solid var(--color-brand-border)', fontWeight: 600,
                }}>
                  声を選ぶ
                </div>
                {VOICES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setVoice(item.id)
                      setUrl(null)
                      setError('')
                      setShowVoice(false)
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', fontSize: 12, cursor: 'pointer', border: 'none',
                      background: voice === item.id ? 'var(--color-brand-light)' : 'transparent',
                      color: voice === item.id ? 'var(--color-brand)' : 'var(--color-text)',
                      fontWeight: voice === item.id ? 700 : 400,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2行目：再生＋状態 */}
      {url ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio src={url} controls autoPlay style={{ width: '100%', height: 38 }}/>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => void load()}
            disabled={isBusy}
            style={{
              width: 46, height: 46, borderRadius: '50%', border: 'none',
              background: 'var(--color-brand)', cursor: isBusy ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px color-mix(in srgb, var(--color-brand) 35%, transparent)',
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-bg-card)">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </button>

          <div style={{ flex: 1 }}>
            {isBusy ? (
              <div style={{ fontSize: 11, color: 'var(--color-brand)', fontWeight: 600 }}>
                用意しています…
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>
                ▶ を押すと{current.label}の声で読み上げます
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 11, lineHeight: 1.8, color: 'var(--color-danger)', marginTop: 8 }}>
          {error}
        </p>
      )}

      <p style={{ fontSize: 10, lineHeight: 1.7, color: 'var(--color-text-faint)', marginTop: 8 }}>
        AIが読み上げます。人の朗読ではありません。
      </p>
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  )
}
