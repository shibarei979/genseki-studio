'use client'

import { useState } from 'react'

/**
 * ============================================================
 * 原石航路
 * VoicePlayer — AI 音声で聴く
 *
 * 話を選んだ声で読み上げる。
 *
 * 作るのに費用がかかるので、一度作った音声は保存して使い回す。
 * すでに誰かが作った声なら、押した瞬間に鳴る。
 * まだ無い声だと、作るのに少し待つ。
 *
 * 1 人が新しく作れるのは 1 日 3 回まで。
 * すでにある音声を聴くのは、何度でもできる。
 * ============================================================
 */

const VOICES = [
  { id: 'ja-JP-Wavenet-A', label: '女性A' },
  { id: 'ja-JP-Wavenet-B', label: '女性B' },
  { id: 'ja-JP-Wavenet-C', label: '男性A' },
  { id: 'ja-JP-Wavenet-D', label: '男性B' },
] as const

export default function VoicePlayer({
  episodeId,
  isLoggedIn,
}: {
  episodeId: string
  isLoggedIn: boolean
}) {
  const [voice, setVoice] = useState<string>(VOICES[0].id)
  const [url, setUrl] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

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
        return
      }

      setUrl(data.url)
    } catch {
      setError('読み上げを用意できませんでした')
    }
    setIsBusy(false)
  }

  if (!isLoggedIn) {
    return (
      <div style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-brand-border)',
        borderRadius: 12,
        padding: '14px 18px',
        marginTop: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
          音声で聴く
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.8 }}>
          ログインすると、この話を音声で聴けます。
        </p>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-brand-border)',
      borderRadius: 12,
      padding: '14px 18px',
      marginTop: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
        音声で聴く
      </div>

      {/*
       * 声を選ぶ。
       *
       * 声ごとに音声を作るので、変えるたびに待つことがある。
       * すでに作られている声なら、すぐ鳴る。
       */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {VOICES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setVoice(item.id)
              setUrl(null)
              setError('')
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 16,
              fontSize: 12,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: voice === item.id ? 'var(--color-brand)' : 'var(--color-brand-border)',
              background: voice === item.id ? 'var(--color-brand)' : 'var(--color-bg)',
              color: voice === item.id ? 'var(--base-color-1, #fff)' : 'var(--color-text)',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {url ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          src={url}
          controls
          autoPlay
          style={{ width: '100%', marginTop: 12 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => void load()}
          disabled={isBusy}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: 'var(--color-brand)',
            color: 'var(--base-color-1, #fff)',
            fontSize: 13,
            fontWeight: 600,
            cursor: isBusy ? 'default' : 'pointer',
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          {isBusy ? '用意しています…' : 'この声で聴く'}
        </button>
      )}

      {error && (
        <p style={{
          fontSize: 11,
          lineHeight: 1.8,
          color: 'var(--color-danger)',
          marginTop: 8,
        }}>
          {error}
        </p>
      )}

      <p style={{
        fontSize: 10.5,
        lineHeight: 1.8,
        color: 'var(--color-text-faint)',
        marginTop: 8,
      }}>
        AIが読み上げます。人の朗読ではありません。
        <br />
        新しく作れるのは1日3回までです。すでに作られた声は、何度でも聴けます。
      </p>
    </div>
  )
}
