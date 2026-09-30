'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const PERIOD_LABEL: Record<string, string> = {
  daily: '日間', weekly: '週間', monthly: '月間', quarterly: '四半期', yearly: '年間', all: '累計', rising: '急上昇',
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
      {/* 携帯だけの並び（上にまとめ・日ごと・メダル）。パソコンでは出ない */}
      <MobileHistory history={history} titleMap={titleMap} readSet={readSet} onRead={markRead} />

      {/* パソコンの並び（今までどおり）。携帯では出さない（p8-rh-pc） */}
      <div className="p8-rh-pc">
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
      </div>
    </>
  )
}


/* ============================================================
 * 携帯の並び
 *
 * ★ 上に「いちばん高い順位・入った回数・今月」をまとめ、
 *   その下に順位の動きを小さな線で出す。
 *   記録は日ごとに分け、1〜3位は金・銀・銅のメダル。
 * ★ 出すのは、この頁が読んでいる記録（直近 100 件）から数えたものだけ。
 * ★ 日付は日本時間で数える（サーバーで組み立てても、ずれないように）。
 * ============================================================ */

const JST_MS = 9 * 60 * 60 * 1000
/** 日本時間の日付と時 */
const jst = (s: string) => {
  const d = new Date(new Date(s).getTime() + JST_MS)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), key: d.toISOString().slice(0, 10) }
}
const jstNowKey = (backDays = 0) => new Date(Date.now() + JST_MS - backDays * 86400000).toISOString().slice(0, 10)

/** 「18時〜21時」。日をまたぐときは終わりに日付を添える */
const hourRange = (from: string, to: string) => {
  const f = jst(from), t = jst(to)
  return `${f.h}時〜${f.key === t.key ? '' : `${t.m}/${t.d} `}${t.h}時`
}

function MobileHistory({ history, titleMap, readSet, onRead }: {
  history: Row[]
  titleMap: Record<string, string>
  readSet: Set<string>
  onRead: (key: string) => void
}) {
  /* まとめの数 */
  const best = Math.min(...history.map(h => h.rank))
  const thisMonth = jstNowKey().slice(0, 7)
  const monthCount = history.filter(h => jst(h.from_time).key.slice(0, 7) === thisMonth).length
  /* 100 件で切れていて、いちばん古い記録も今月なら、本当はもっと多い */
  const monthMore = history.length >= 100 && jst(history[history.length - 1].from_time).key.slice(0, 7) === thisMonth

  /*
   * 順位の動き。
   *
   * ★ いちばん新しい記録の作品・同じ集計（日間など）の、この 2 週間ぶん。
   *   集計の違う順位を 1 本の線に混ぜると、上がり下がりが読めない。
   *   点が 2 つ未満なら線にならないので出さない。
   */
  const latest = history[0]
  const since = jstNowKey(13)
  const points = history
    .filter(h => h.novel_id === latest.novel_id && h.period === latest.period && jst(h.from_time).key >= since)
    .sort((x, y) => (x.from_time < y.from_time ? -1 : 1))

  /* 日ごとに分ける（新しい日が上） */
  const groups: { key: string; rows: Row[] }[] = []
  history.forEach(h => {
    const key = jst(h.from_time).key
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.rows.push(h)
    else groups.push({ key, rows: [h] })
  })
  const dayLabel = (key: string) => {
    const [, m, d] = key.split('-').map(Number)
    if (key === jstNowKey()) return `きょう ${m}/${d}`
    if (key === jstNowKey(1)) return `きのう ${m}/${d}`
    return `${m}/${d}`
  }

  return (
    <div className="p8-rh-sp">
      <div className="p8-rh-sum">
        <div><small>最高順位</small><b>{best}<i>位</i></b></div>
        <div><small>入った回数</small><b>{history.length >= 100 ? '100+' : history.length}<i>回</i></b></div>
        <div><small>今月</small><b>{monthMore ? `${monthCount}+` : monthCount}<i>回</i></b></div>
      </div>

      {points.length >= 2 && (
        <Spark
          title={`${titleMap[latest.novel_id] || '（削除された作品）'}の順位`}
          period={PERIOD_LABEL[latest.period] || latest.period}
          ranks={points.map(p => p.rank)}
        />
      )}

      {groups.map(g => (
        <section key={g.key} className="p8-rh-day">
          <h2>{dayLabel(g.key)}</h2>
          {g.rows.map(h => {
            const itemKey = `r-${h.id}`
            const isNew = !readSet.has(itemKey)
            const medal = h.rank === 1 ? 'gold' : h.rank === 2 ? 'silver' : h.rank === 3 ? 'bronze' : ''
            return (
              <div key={h.id} className={`p8-rh-card${isNew ? ' is-new' : ''}`}>
                <span className={`p8-rh-medal ${medal}`}>
                  <b>{h.rank}</b><small>位</small>
                </span>
                <div className="p8-rh-body">
                  <Link href={`/novel/${h.novel_id}`} className="p8-rh-title">
                    {titleMap[h.novel_id] || '（削除された作品）'}
                  </Link>
                  <div className="p8-rh-tags">
                    {isNew && <span className="new">NEW</span>}
                    <span>総合</span>
                    <span>{PERIOD_LABEL[h.period] || h.period}</span>
                  </div>
                  <div className="p8-rh-time">{hourRange(h.from_time, h.to_time)}</div>
                </div>
                {isNew ? (
                  <button type="button" className="p8-rh-read" onClick={() => onRead(itemKey)}>既読にする</button>
                ) : (
                  <span className="p8-rh-done">既読</span>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}

/**
 * 順位の小さな線。
 *
 * 上が 1 位、下が 20 位（20 位より下の記録があれば、その順位まで広げる）。
 * 最後の点だけ色を付けて、いまの位置を示す。
 */
function Spark({ title, period, ranks }: { title: string; period: string; ranks: number[] }) {
  const W = 300, H = 64, PAD = 6
  const worst = Math.max(20, ...ranks)
  const x = (i: number) => PAD + (i / (ranks.length - 1)) * (W - PAD * 2)
  const y = (r: number) => PAD + ((r - 1) / (worst - 1)) * (H - PAD * 2)
  const line = ranks.map((r, i) => `${x(i).toFixed(1)},${y(r).toFixed(1)}`).join(' ')
  const lastI = ranks.length - 1
  return (
    <div className="p8-rh-spark">
      <div className="p8-rh-spark-head">
        <b>{title}</b>
        <small>{period}・この2週間</small>
      </div>
      <div className="p8-rh-spark-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}（${period}）の動き`}>
        <line x1={PAD} x2={W - PAD} y1={y(1)} y2={y(1)} className="grid" />
        <line x1={PAD} x2={W - PAD} y1={y(worst)} y2={y(worst)} className="grid" />
        <polyline points={line} fill="none" className="path" />
        <circle cx={x(lastI)} cy={y(ranks[lastI])} r={3.5} className="dot" />
      </svg>
      <div className="p8-rh-spark-axis"><span>1位</span><span>{worst}位</span></div>
      </div>
    </div>
  )
}
