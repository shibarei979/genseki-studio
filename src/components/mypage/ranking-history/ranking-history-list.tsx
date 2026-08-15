'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const PERIOD_LABEL: Record<string, string> = {
  daily: '日間', weekly: '週間', monthly: '月間', quarterly: '四半期', yearly: '年間', all: '累計', rising: '注目度',
}

interface Row { id: string; novel_id: string; period: string; rank: number; from_time: string; to_time: string; created_at: string }

const fmtRange = (from: string, to: string) => {
  const f = new Date(from), t = new Date(to)
  const sameDay = f.toDateString() === t.toDateString()
  const day = `${f.getMonth() + 1}/${f.getDate()}`
  return `${day} ${f.getHours()}時から${sameDay ? '' : `${t.getMonth() + 1}/${t.getDate()} `}${t.getHours()}時`
}

export default function RankingHistoryList({ history, titleMap, initialReadKeys }: { history: Row[]; titleMap: Record<string, string>; initialReadKeys: string[] }) {
  const supabase = createClient()
  const [readSet, setReadSet] = useState(new Set(initialReadKeys))

  async function markRead(key: string) {
    setReadSet(prev => new Set(prev).add(key))
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('read_feedbacks').insert({ user_id: user.id, item_key: key })
  }

  if (history.length === 0) {
    return (
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, padding: '48px 20px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-faint)', lineHeight: 1.8 }}>
        まだランクインの記録がありません。<br/>作品がランキング上位に入るとここに残ります。
      </div>
    )
  }

  return (
    <>
      {history.map(h => {
        const itemKey = `r-${h.id}`
        const isNew = !readSet.has(itemKey)
        return (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg-card)', border: `1px solid ${isNew ? 'var(--color-brand)' : 'var(--color-brand-border)'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 9 }}>
            <div style={{ flexShrink: 0, width: 52, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: h.rank <= 3 ? 'var(--color-brand)' : 'var(--color-text)', lineHeight: 1 }}>{h.rank}<span style={{ fontSize: 11, fontWeight: 600 }}>位</span></div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                {isNew && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 8px', borderRadius: 10 }}>NEW</span>}
                <Link href={`/novel/${h.novel_id}`} style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', textDecoration: 'none' }}>
                  {titleMap[h.novel_id] || '（削除された作品）'}
                </Link>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {fmtRange(h.from_time, h.to_time)}　{h.rank}位（総合・{PERIOD_LABEL[h.period] || h.period}）
              </div>
            </div>
            {isNew ? (
              <button onClick={() => markRead(itemKey)}
                style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-brand)', background: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 12, padding: '4px 12px', cursor: 'pointer', flexShrink: 0 }}>
                既読にする
              </button>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--color-text-faint)', flexShrink: 0 }}>既読</span>
            )}
          </div>
        )
      })}
    </>
  )
}
