'use client'

/**
 * ============================================================
 * 原石航路 Studio
 * AnalyticsPro — ダッシュボードの詳しい分析（Pro）
 *
 * ★ 「何人に読まれたか」の先を見るための場所。
 *
 * ★ 見やすく・分析しやすく。
 *   ・いちばん上に「この作品のいま」を文で出す（図を読まなくても要点が分かる）
 *   ・その下に大事な数字を 5 つ
 *   ・図は 4 つの見方（読まれ方／読者の流れ／入り口／時間）に分けて切り替える。
 *     全部を縦に並べると長く、何を見ているのか分からなくなった
 *   ・図には目盛りと、指を乗せたときの数を付ける。数は表にも出す
 *
 * ★ 図の色は、データ用の決まった色（青を基本、目立たせたい 1 つだけ橙）。
 *   入り口の内訳は 8 色の決まった順。色だけに頼らず、名前と数も必ず並べる。
 *
 * ★ 誰が読んだかは出さない。人数と割合だけ。
 * ============================================================
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import ProBadge from '@/components/common/pro-badge'
import type { ProStats, SourceKey } from '@/lib/analytics/pro-stats'

/* ---------- 色（データ用） ---------- */
const BLUE = '#2a78d6'
const BLUE_WASH = 'rgba(42,120,214,.10)'
const BLUE_LIGHT = '#b7d3f6'
const ORANGE = '#eb6834'
const GRID = '#e6e9ec'
const TRACK = '#eef2f5'
const INK = 'var(--color-text)'
const INK2 = 'var(--color-text-muted)'
const INK3 = 'var(--color-text-faint)'
/* 量の濃さ（ヒートマップ）。薄い → 濃い */
const SEQ = ['#eef4fc', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']
/* 何話読んだか（順序のある区分）。薄い → 濃い */
const ORD = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab']

/* 入り口の色。決まった順（検証済み）。記録前は灰色 */
const SOURCE_ORDER: SourceKey[] = ['site', 'direct', 'x', 'search', 'youtube', 'instagram', 'note', 'other', 'unknown']
const SOURCE_COLOR: Record<SourceKey, string> = {
  site: '#2a78d6', direct: '#eb6834', x: '#1baf7a', search: '#eda100',
  youtube: '#e87ba4', instagram: '#008300', note: '#4a3aa7', other: '#e34948', unknown: '#c9ced3',
}
const SOURCE_LABEL: Record<SourceKey, string> = {
  site: 'サイトの中', direct: '直接・ブックマーク', x: 'X', search: '検索',
  youtube: 'YouTube', instagram: 'Instagram', note: 'note', other: 'その他のサイト', unknown: '記録前',
}
const DAYS = ['日', '月', '火', '水', '木', '金', '土']

const card: CSSProperties = { background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 16, padding: '20px 22px' }
const muted: CSSProperties = { fontSize: 12, color: INK2, lineHeight: 1.75 }

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}
function duration(sec: number) {
  if (!sec) return '—'
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}分${s}秒` : `${m}分`
}

/** 入れ物の幅を測る。図を、その幅に合わせて描くため */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

type Tab = 'read' | 'flow' | 'source' | 'time'
const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'read', label: '読まれ方', icon: <IconBook /> },
  { key: 'flow', label: '読者の流れ', icon: <IconFlow /> },
  { key: 'source', label: '入り口', icon: <IconDoor /> },
  { key: 'time', label: '時間', icon: <IconClock /> },
]

interface Props {
  isPro: boolean
  /** すべての作品の合計を見ているとき。作品をまたげない分析は出さない */
  isAll: boolean
  novelTitle: string
  pro: (Partial<ProStats> & Pick<ProStats, 'sources' | 'heat'>) | null
  /** 話ごとの閲覧数（書き出しに添える） */
  episodeViews: { title: string; views: number }[]
  /** 上の余白を取らない（ダッシュボードの「Pro」に切り替えたとき、すぐ下に置くため） */
  flush?: boolean
}

export default function AnalyticsPro({ isPro, isAll, novelTitle, pro, episodeViews, flush = false }: Props) {
  const [tab, setTab] = useState<Tab>(isAll ? 'source' : 'read')
  useEffect(() => {
    if (isAll && (tab === 'read' || tab === 'flow')) setTab('source')
  }, [isAll, tab])

  if (!isPro) return <Teaser top={flush ? 0 : 28} />
  if (!pro) return null
  const full = !isAll && pro.progress ? (pro as ProStats) : null

  return (
    <section
      className="ana-root"
      style={{
        marginTop: flush ? 0 : 28, borderRadius: 16, padding: '20px 20px 18px',
        background: 'linear-gradient(180deg, #f3f8fd 0%, var(--color-bg-card) 220px)',
        border: '1px solid var(--color-brand-border)',
      }}
    >
      {/* 見出し */}
      <div className="ana-head" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--color-brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconChart />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: INK, display: 'flex', alignItems: 'center', gap: 8 }}>
            詳しい分析 <ProBadge />
          </h2>
          <div style={{ fontSize: 12, color: INK2, marginTop: 2 }}>
            {isAll ? 'すべての作品' : `「${novelTitle}」`}が、どう読まれているか
          </div>
        </div>
        {full && (
          <button
            type="button"
            onClick={() => downloadCsv(novelTitle, full, episodeViews)}
            style={{
              marginLeft: 'auto', fontSize: 12, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--color-brand-border)', background: 'var(--color-bg-card)', color: INK2,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <IconDownload /> <span className="ana-csv-text">CSVで書き出す</span><span className="ana-csv-short">CSV</span>
          </button>
        )}
      </div>

      {/* この作品のいま */}
      <Insights pro={pro} full={full} />

      {/* 大事な数字 */}
      {full && <Kpis pro={full} />}

      {/* 見方の切り替え */}
      <div role="tablist" className="ana-tabs" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-brand-border)', margin: '20px 0 16px' }}>
        {TABS.map((one) => {
          const disabled = isAll && (one.key === 'read' || one.key === 'flow')
          const on = tab === one.key
          return (
            <button
              key={one.key}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={disabled}
              onClick={() => setTab(one.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', fontSize: 13.5, whiteSpace: 'nowrap',
                border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
                color: on ? 'var(--color-brand)' : disabled ? INK3 : INK2, fontWeight: on ? 700 : 500,
                borderBottom: on ? '2.5px solid var(--color-brand)' : '2.5px solid transparent', marginBottom: -1,
              }}
            >
              {one.icon}
              <span>{one.label}</span>
            </button>
          )
        })}
      </div>

      {isAll && (tab === 'source' || tab === 'time') && (
        <p style={{ ...muted, marginBottom: 12 }}>
          「読まれ方」「読者の流れ」は作品ごとに出します。上の「作品を選択」で作品を1つ選んでください。
        </p>
      )}

      {tab === 'read' && full && <ReadTab pro={full} />}
      {tab === 'flow' && full && <FlowTab pro={full} />}
      {tab === 'source' && <SourceTab sources={pro.sources} />}
      {tab === 'time' && <TimeTab heat={pro.heat} launch={full?.launch ?? null} />}

      <p style={{ fontSize: 10.5, color: INK3, marginTop: 16, lineHeight: 1.7 }}>
        人数は、ログインしている人とログインしていない人（端末ごとの印）を合わせて数えています。作者ご自身の閲覧と、見回りの機械は数えていません。「どこまで読まれたか」は、読書の記録を取り始めてからのぶんです。
      </p>
      {/*
        ★ 携帯（600px 以下）の形。YouTube Studio のアプリと同じ考え方で、
          ・枠の中の余白を小さくして、図に幅を回す
          ・数字の札は 2 列にきっちり並べる（横にすべらせると、途中で切れて見えた）
          ・見方の切り替えは 4 つを同じ幅で並べ、絵の下に名前（はみ出して切れない）
      */}
      <style>{`
        .ana-csv-short { display: none; }
        @media (max-width: 600px) {
          .ana-root { padding: 14px 12px 14px !important; border-radius: 14px !important; }
          .ana-head { flex-wrap: nowrap !important; gap: 10px !important; }
          .ana-head > span:first-child { width: 32px !important; height: 32px !important; }
          .ana-head h2 { font-size: 16px !important; }
          .ana-csv-text { display: none; }
          .ana-csv-short { display: inline; }
          .ana-insights { padding: 12px !important; }
          .ana-insights li { font-size: 12.5px !important; }
          .ana-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
          .ana-kpi { padding: 10px 12px !important; }
          .ana-kpi:first-child { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 10px; }
          .ana-kpi:first-child > div:first-child { flex-basis: 100%; }
          .ana-kpi-value { font-size: 22px !important; }
          .ana-tabs { gap: 0 !important; margin: 16px -12px 12px !important; }
          .ana-tabs > button { flex: 1 1 0; flex-direction: column; gap: 3px !important; padding: 8px 2px !important; font-size: 11.5px !important; }
          .ana-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .ana-metrics > button { padding: 9px 12px !important; border-right: 1px solid var(--color-brand-border) !important; }
          .ana-metrics > button:nth-child(2n) { border-right: none !important; }
          .ana-metric-value { font-size: 17px !important; }
          .ana-panel { padding: 14px 12px !important; }
          .ana-pad { padding: 12px 12px 14px !important; }
          .ana-stats3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 6px !important; }
          .ana-stat { padding: 10px 10px !important; gap: 7px !important; }
          .ana-stat-value { font-size: 19px !important; }
        }
      `}</style>
    </section>
  )
}

/* ============================================================
 * この作品のいま（文で）
 * ============================================================ */

function Insights({ pro, full }: { pro: Props['pro'] & object; full: ProStats | null }) {
  const lines: { icon: ReactNode; tone: string; text: ReactNode }[] = []

  if (full && full.progress.sessions > 0) {
    const points = survival(full.progress.buckets, full.progress.endRate)
    const drop = biggestDrop(points)
    lines.push({
      icon: <IconBook />, tone: BLUE,
      text: <>最後まで読まれるのは <b>{pct(full.progress.endRate)}</b>。{drop && <>読み進めた<b>{drop.at}%〜{drop.at + 10}%</b>のあたりで離れる人がいちばん多くいます。</>}</>,
    })
  }
  if (full && full.retention.length > 1 && full.retention[0].readers > 0) {
    const last = full.retention[full.retention.length - 1]
    const worst = worstStep(full.retention)
    lines.push({
      icon: <IconFlow />, tone: '#1baf7a',
      text: <>1話目の読者の <b>{pct(last.fromFirst)}</b> が最新話まで来ています。{worst && <>「<b>{full.retention[worst.i].title}</b>」で、前の話から読者がいちばん減っています。</>}</>,
    })
  }
  const outside = (Object.entries(pro.sources) as [SourceKey, number][])
    .filter(([k, v]) => v > 0 && k !== 'site' && k !== 'unknown')
    .sort((a, b) => b[1] - a[1])
  if (outside.length > 0) {
    const sum = outside.reduce((s, [, v]) => s + v, 0)
    lines.push({
      icon: <IconDoor />, tone: ORANGE,
      text: <>外から来る読者は <b>{SOURCE_LABEL[outside[0][0]]}</b> がいちばん多く、外からの <b>{pct(outside[0][1] / sum)}</b> です。</>,
    })
  }
  const peak = peakOf(pro.heat)
  if (peak.value > 0) {
    lines.push({
      icon: <IconClock />, tone: '#4a3aa7',
      text: <>いちばん読まれるのは <b>{DAYS[peak.day]}曜の{peak.hour}時台</b>。投稿時間の目安になります。</>,
    })
  }

  if (lines.length === 0) return null
  return (
    <div className="ana-insights" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconSpark /> この作品のいま
      </div>
      <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '8px 18px', listStyle: 'none', margin: 0, padding: 0 }}>
        {lines.map((line, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: INK, lineHeight: 1.7 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: line.tone, background: `${line.tone}14` }}>
              {line.icon}
            </span>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ============================================================
 * 大事な数字
 * ============================================================ */

function Kpis({ pro }: { pro: ProStats }) {
  const last = pro.retention[pro.retention.length - 1]
  const regular = pro.loyal.tenPlus + pro.loyal.threeToNine
  const tiles = [
    { label: '最後まで読まれた', value: pct(pro.progress.endRate), sub: `読み始めた ${pro.progress.sessions.toLocaleString()} 回のうち`, accent: true },
    { label: '平均の到達', value: `${pro.progress.avgPct}%`, sub: '本文のどこまで読まれたか' },
    { label: '読んだ時間', value: duration(pro.progress.medianSec), sub: '1回あたり（真ん中の値）' },
    { label: '最新話までの継続', value: last ? pct(last.fromFirst) : '—', sub: '1話目の読者のうち' },
    { label: '常連の読者', value: `${regular.toLocaleString()}人`, sub: pro.loyal.readers ? `3話以上・読者の ${pct(regular / pro.loyal.readers)}` : '3話以上' },
  ]
  /*
   * ★ 携帯の形は、いちばん下の <style>（.ana-kpis）にまとめてある。
   */
  return (
    <div className="ana-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="ana-kpi"
          style={{
            background: tile.accent ? 'var(--color-brand)' : 'var(--color-bg-card)',
            border: tile.accent ? 'none' : '1px solid var(--color-brand-border)',
            borderRadius: 12, padding: '12px 14px',
            color: tile.accent ? '#fff' : INK,
          }}
        >
          <div style={{ fontSize: 11.5, opacity: tile.accent ? 0.85 : 1, color: tile.accent ? '#fff' : INK2, whiteSpace: 'nowrap' }}>{tile.label}</div>
          <div className="ana-kpi-value" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginTop: 4, whiteSpace: 'nowrap' }}>{tile.value}</div>
          <div style={{ fontSize: 10.5, marginTop: 3, opacity: tile.accent ? 0.8 : 1, color: tile.accent ? '#fff' : INK3 }}>{tile.sub}</div>
        </div>
      ))}
    </div>
  )
}

/* ============================================================
 * 読まれ方
 * ============================================================ */

/** 本文の 0%・10%…90%・最後 の各位置に、まだ読んでいる人の割合 */
function survival(buckets: number[], endRate: number): number[] {
  const total = buckets.reduce((a, b) => a + b, 0)
  if (!total) return new Array(11).fill(0)
  const points: number[] = []
  for (let i = 0; i < 10; i++) points.push(buckets.slice(i).reduce((a, b) => a + b, 0) / total)
  points.push(endRate)
  return points
}
function biggestDrop(points: number[]) {
  let best: { at: number; value: number } | null = null
  for (let i = 1; i < points.length - 1; i++) {
    const d = points[i - 1] - points[i]
    if (!best || d > best.value) best = { at: (i - 1) * 10, value: d }
  }
  return best && best.value > 0 ? best : null
}

/* 話ごとに比べる数。上の札を押すと、下の図が切り替わる（YouTube Studio と同じ） */
type Metric = 'end' | 'avg' | 'time' | 'sessions'
const METRICS: { key: Metric; label: string; value: (row: ProgressLike) => number; format: (v: number) => string; max?: number }[] = [
  { key: 'end', label: '最後まで読まれた', value: (r) => r.endRate, format: (v) => pct(v), max: 1 },
  { key: 'avg', label: '平均の到達', value: (r) => r.avgPct / 100, format: (v) => `${Math.round(v * 100)}%`, max: 1 },
  { key: 'time', label: '読んだ時間', value: (r) => r.medianSec, format: (v) => duration(Math.round(v)) },
  { key: 'sessions', label: '読み始め', value: (r) => r.sessions, format: (v) => Math.round(v).toLocaleString() },
]
type ProgressLike = { endRate: number; avgPct: number; medianSec: number; sessions: number }

function ReadTab({ pro }: { pro: ProStats }) {
  const [metric, setMetric] = useState<Metric>('end')
  const [pick, setPick] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const def = METRICS.find((m) => m.key === metric)!
  const target = pick === null ? pro.progress : pro.progress.episodes[pick]
  const points = survival(target.buckets, target.endRate)
  const values = pro.progress.episodes.map((ep) => (ep.sessions ? def.value(ep) : 0))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* 比べる数を選ぶ札。押すと下の図が切り替わる */}
        <div role="tablist" className="ana-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderBottom: '1px solid var(--color-brand-border)' }}>
          {METRICS.map((m) => {
            const on = m.key === metric
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setMetric(m.key)}
                style={{
                  textAlign: 'left', padding: '12px 16px', border: 'none', cursor: 'pointer', minWidth: 0,
                  background: on ? 'var(--color-bg-card)' : '#f6f8fa',
                  borderBottom: on ? '3px solid var(--color-brand)' : '3px solid transparent',
                }}
              >
                <div style={{ fontSize: 11.5, color: on ? INK : INK2, whiteSpace: 'nowrap' }}>{m.label}</div>
                <div className="ana-metric-value" style={{ fontSize: 20, fontWeight: 700, color: on ? INK : INK2, marginTop: 2, whiteSpace: 'nowrap' }}>{m.format(m.value(pro.progress))}</div>
              </button>
            )
          })}
        </div>
        <div className="ana-pad" style={{ padding: '14px 16px 16px' }}>
          <div style={{ fontSize: 12, color: INK2, marginBottom: 8 }}>話ごとの「{def.label}」　<span style={{ color: INK3 }}>棒を押すと、下の図がその話に変わります</span></div>
          <ColumnChart
            values={values}
            labels={pro.progress.episodes.map((ep) => ep.title)}
            format={def.format}
            max={def.max}
            selected={pick}
            onSelect={(i) => setPick(i === pick ? null : i)}
          />
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            style={{ marginTop: 10, fontSize: 12, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showTable ? '▲ 表をとじる' : '▼ 表で見る'}
          </button>
          {showTable && <ProgressTable pro={pro} pick={pick} onPick={setPick} />}
        </div>
      </div>

      <Panel
        title="本文のどこまで読まれたか"
        note="読み始めた人のうち、その位置でまだ読んでいる割合"
        right={
          <select
            value={pick === null ? '' : String(pick)}
            onChange={(e) => setPick(e.target.value === '' ? null : Number(e.target.value))}
            style={{ fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-brand-border)', background: 'var(--color-bg-card)', color: INK, maxWidth: 200 }}
          >
            <option value="">作品全体</option>
            {pro.progress.episodes.map((ep, i) => <option key={i} value={i}>{ep.title}</option>)}
          </select>
        }
      >
        {target.sessions === 0 ? <Empty>まだ記録がありません</Empty> : <SurvivalChart points={points} />}
      </Panel>
    </div>
  )
}

/** 話ごとの表（図の数を、指を乗せずに読むため） */
function ProgressTable({ pro, pick, onPick }: { pro: ProStats; pick: number | null; onPick: (i: number | null) => void }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 8 }}>
      <thead>
        <tr style={{ color: INK2, fontSize: 11, textAlign: 'left' }}>
          <th style={th}>話</th>
          <th style={{ ...th, textAlign: 'right' }}>読み始め</th>
          <th style={{ ...th, textAlign: 'right' }}>最後まで</th>
          <th className="ana-hide-sm" style={{ ...th, textAlign: 'right' }}>平均の到達</th>
          <th className="ana-hide-sm" style={{ ...th, textAlign: 'right' }}>読んだ時間</th>
        </tr>
      </thead>
      <tbody>
        {[{ title: '作品全体', ...pro.progress }, ...pro.progress.episodes].map((row, index) => {
          const i = index - 1
          const on = (pick === null && i === -1) || pick === i
          return (
            <tr key={index} onClick={() => onPick(i === -1 ? null : i)} style={{ cursor: 'pointer', background: on ? 'var(--color-brand-light)' : 'transparent', borderTop: '1px solid var(--color-brand-light)' }}>
              <td style={{ ...td, fontWeight: i === -1 ? 700 : 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.sessions.toLocaleString()}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{row.sessions ? pct(row.endRate) : '—'}</td>
              <td className="ana-hide-sm" style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.sessions ? `${row.avgPct}%` : ''}</td>
              <td className="ana-hide-sm" style={{ ...td, textAlign: 'right', color: INK2 }}>{row.sessions ? duration(row.medianSec) : ''}</td>
            </tr>
          )
        })}
      </tbody>
      <style>{`@media (max-width: 600px) { .ana-hide-sm { display: none; } }`}</style>
    </table>
  )
}

const th: CSSProperties = { padding: '6px 8px', fontWeight: 500, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '9px 8px', color: INK }

/** 話ごとの縦棒。いちばん高い話を橙に。押した話は枠で示す */
function ColumnChart({ values, labels, format, max, selected, onSelect }: {
  values: number[]; labels: string[]; format: (v: number) => string; max?: number; selected: number | null; onSelect: (i: number) => void
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 200
  const m = { l: 44, r: 8, t: 22, b: 28 }
  const w = Math.max(0, width - m.l - m.r)
  const h = H - m.t - m.b
  const n = values.length
  const band = n ? w / n : 0
  const barW = Math.max(4, Math.min(24, band * 0.62))
  const top = max ?? niceMax(Math.max(1, ...values))
  const y = (v: number) => m.t + (1 - v / top) * h
  const best = values.indexOf(Math.max(...values))
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 30))))
  const show = hover ?? selected

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="話ごとの比較" onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + w} y1={y(top * t)} y2={y(top * t)} stroke={GRID} strokeWidth={1} />
              <text x={m.l - 8} y={y(top * t) + 4} textAnchor="end" fontSize={10.5} fill="currentColor" style={{ color: 'var(--color-text-faint)' }}>{format(top * t)}</text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = m.l + band * i + band / 2
            const yt = y(v)
            const r = Math.min(4, (y(0) - yt) / 2)
            const on = selected === i
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
                <rect x={m.l + band * i} y={m.t} width={band} height={h} fill={on ? 'rgba(42,120,214,.08)' : 'transparent'} />
                {v > 0 && (
                  <path
                    d={`M${cx - barW / 2},${y(0)} L${cx - barW / 2},${yt + r} Q${cx - barW / 2},${yt} ${cx - barW / 2 + r},${yt} L${cx + barW / 2 - r},${yt} Q${cx + barW / 2},${yt} ${cx + barW / 2},${yt + r} L${cx + barW / 2},${y(0)} Z`}
                    fill={i === best ? ORANGE : BLUE}
                    opacity={show === null || show === i ? 1 : 0.5}
                  />
                )}
                {(i === best || on) && v > 0 && (
                  <text x={cx} y={yt - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="currentColor" style={{ color: 'var(--color-text)' }}>{format(v)}</text>
                )}
                {(i % labelEvery === 0 || i === n - 1) && (
                  <text x={cx} y={H - 9} textAnchor="middle" fontSize={10.5} fontWeight={on ? 700 : 400} fill="currentColor" style={{ color: on ? 'var(--color-text)' : 'var(--color-text-faint)' }}>{i + 1}</text>
                )}
              </g>
            )
          })}
          <line x1={m.l} x2={m.l + w} y1={y(0)} y2={y(0)} stroke="#c9ced3" strokeWidth={1} />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tip x={m.l + band * hover + band / 2} y={y(values[hover])} width={width}>
          <div style={{ fontSize: 11, color: INK2 }}>{hover + 1}話目「{labels[hover]}」</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{values[hover] > 0 ? format(values[hover]) : '記録なし'}</div>
        </Tip>
      )}
      <Legend items={[{ color: BLUE, label: '話ごとの値（下の数字は何話目か）' }, { color: ORANGE, label: 'いちばん高い話' }]} />
    </div>
  )
}

function SurvivalChart({ points }: { points: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 220
  const m = { l: 40, r: 14, t: 14, b: 30 }
  const w = Math.max(0, width - m.l - m.r)
  const h = H - m.t - m.b
  const x = (i: number) => m.l + (i / 10) * w
  const y = (v: number) => m.t + (1 - v) * h
  const drop = biggestDrop(points)
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
  const area = `${line} L${x(10)},${y(0)} L${x(0)},${y(0)} Z`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="本文の位置ごとの、まだ読んでいる人の割合"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const i = Math.round(((e.clientX - box.left - m.l) / w) * 10)
            setHover(Math.max(0, Math.min(10, i)))
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={m.l} x2={m.l + w} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text x={m.l - 8} y={y(v) + 4} textAnchor="end" fontSize={10.5} fill="currentColor" style={{ color: 'var(--color-text-faint)' }}>{v * 100}%</text>
            </g>
          ))}
          {points.map((_, i) => (
            <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize={10.5} fill="currentColor" style={{ color: 'var(--color-text-faint)' }}>
              {i === 0 ? '読み始め' : i === 10 ? '最後' : i % 2 === 0 ? `${i * 10}%` : ''}
            </text>
          ))}
          {/* いちばん減った区間 */}
          {drop && (
            <rect x={x(drop.at / 10)} y={m.t} width={x(drop.at / 10 + 1) - x(drop.at / 10)} height={h} fill={ORANGE} opacity={0.08} />
          )}
          <path d={area} fill={BLUE_WASH} />
          <path d={line} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {drop && (
            <path d={`M${x(drop.at / 10)},${y(points[drop.at / 10])} L${x(drop.at / 10 + 1)},${y(points[drop.at / 10 + 1])}`} stroke={ORANGE} strokeWidth={2.5} strokeLinecap="round" />
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + h} stroke="#9aa3ab" strokeWidth={1} />}
          {points.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5.5 : 4} fill={drop && (i === drop.at / 10 + 1) ? ORANGE : BLUE} stroke="#fff" strokeWidth={2} />
          ))}
          {drop && (
            <text {...(x(drop.at / 10 + 1) + 120 > m.l + w
              ? /* 右端に近いときは、線の左下（線より下の空いた所）に置く */
                { x: x(drop.at / 10) - 8, y: Math.min(m.t + h - 6, y(points[drop.at / 10 + 1]) + 18), textAnchor: 'end' as const }
              : { x: x(drop.at / 10 + 1) + 8, y: Math.max(m.t + 12, y(points[drop.at / 10]) - 14), textAnchor: 'start' as const })} fontSize={11.5} fontWeight={700} fill="currentColor" stroke="#fff" strokeWidth={4} paintOrder="stroke" style={{ color: 'var(--color-text)' }}>
              ここで {Math.round(drop.value * 100)}ポイント減
            </text>
          )}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tip x={x(hover)} y={y(points[hover])} width={width}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{pct(points[hover])}</div>
          <div style={{ fontSize: 11, color: INK2 }}>
            {hover === 0 ? '読み始め' : hover === 10 ? '最後まで読んだ' : `本文の ${hover * 10}% まで読んだ`}
            {hover > 0 && `（前から −${Math.round((points[hover - 1] - points[hover]) * 100)}）`}
          </div>
        </Tip>
      )}
    </div>
  )
}

/* ============================================================
 * 読者の流れ
 * ============================================================ */

function worstStep(retention: ProStats['retention']) {
  return retention.slice(1).reduce<{ i: number; v: number } | null>((best, row, index) => {
    const i = index + 1
    if (retention[i - 1].readers < 3) return best
    return !best || row.fromPrev < best.v ? { i, v: row.fromPrev } : best
  }, null)
}

function FlowTab({ pro }: { pro: ProStats }) {
  const first = pro.retention[0]?.readers ?? 0
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Panel title="読み続けてくれた率" note={`1話目を読んだ ${first.toLocaleString()} 人のうち、その話まで来た割合`}>
        {first === 0 ? <Empty>1話目の読者がまだいません</Empty> : <RetentionChart retention={pro.retention} />}
      </Panel>
      <Panel title="常連の読者" note="何話まで読んでくれた人が何人いるか">
        {pro.loyal.readers === 0 ? <Empty>まだ記録がありません</Empty> : <LoyalBar loyal={pro.loyal} />}
      </Panel>
    </div>
  )
}

function RetentionChart({ retention }: { retention: ProStats['retention'] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const worst = worstStep(retention)
  const H = 230
  const m = { l: 40, r: 10, t: 22, b: 30 }
  const w = Math.max(0, width - m.l - m.r)
  const h = H - m.t - m.b
  const n = retention.length
  const band = n ? w / n : 0
  const barW = Math.max(4, Math.min(24, band * 0.62))
  const y = (v: number) => m.t + (1 - v) * h
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 34))))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="話ごとの、1話目からの継続率" onMouseLeave={() => setHover(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={m.l} x2={m.l + w} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text x={m.l - 8} y={y(v) + 4} textAnchor="end" fontSize={10.5} fill="currentColor" style={{ color: 'var(--color-text-faint)' }}>{v * 100}%</text>
            </g>
          ))}
          {retention.map((row, i) => {
            const cx = m.l + band * i + band / 2
            const v = Math.min(1, row.fromFirst)
            const top = y(v)
            const isWorst = worst?.i === i
            const r = Math.min(4, (y(0) - top) / 2)
            const d = `M${cx - barW / 2},${y(0)} L${cx - barW / 2},${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top} L${cx + barW / 2 - r},${top} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} L${cx + barW / 2},${y(0)} Z`
            const showValue = i === 0 || i === n - 1 || isWorst
            return (
              <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: 'default' }}>
                <rect x={m.l + band * i} y={m.t} width={band} height={h} fill="transparent" />
                {v > 0 && <path d={d} fill={isWorst ? ORANGE : BLUE} opacity={hover === null || hover === i ? 1 : 0.55} />}
                {showValue && (
                  <text x={cx} y={top - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="currentColor" style={{ color: 'var(--color-text)' }}>{pct(v)}</text>
                )}
                {(i % labelEvery === 0 || i === n - 1) && (
                  <text x={cx} y={H - 10} textAnchor="middle" fontSize={10.5} fill="currentColor" style={{ color: 'var(--color-text-faint)' }}>{i + 1}</text>
                )}
              </g>
            )
          })}
          <line x1={m.l} x2={m.l + w} y1={y(0)} y2={y(0)} stroke="#c9ced3" strokeWidth={1} />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tip x={m.l + band * hover + band / 2} y={y(Math.min(1, retention[hover].fromFirst))} width={width}>
          <div style={{ fontSize: 11, color: INK2 }}>{hover + 1}話目「{retention[hover].title}」</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{pct(Math.min(1, retention[hover].fromFirst))}<span style={{ fontSize: 11, fontWeight: 400, color: INK2 }}>（1話目から）</span></div>
          {hover > 0 && <div style={{ fontSize: 11.5 }}>前の話から <b>{pct(retention[hover].fromPrev)}</b> が進んだ</div>}
          <div style={{ fontSize: 11, color: INK2 }}>{retention[hover].readers}人が読んだ</div>
        </Tip>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 6 }}>
        <Legend items={[{ color: BLUE, label: '1話目の読者のうち、その話まで来た割合' }, { color: ORANGE, label: '前の話からいちばん減った話' }]} />
        <span style={{ fontSize: 11, color: INK3 }}>下の数字は何話目か。棒に指を乗せると話の名前が出ます</span>
      </div>
      {worst && (
        <p style={{ ...muted, marginTop: 8 }}>
          「<b style={{ color: INK }}>{retention[worst.i].title}</b>」（{worst.i + 1}話目）で、前の話の読者の <b style={{ color: INK }}>{pct(worst.v)}</b> しか進んでいません。前の話の終わり方や、この話の始まりを見直す目安になります。
        </p>
      )}
    </div>
  )
}

function LoyalBar({ loyal }: { loyal: ProStats['loyal'] }) {
  const parts = [
    { label: '1話だけ', value: loyal.one, color: ORD[0] },
    { label: '2話', value: loyal.two, color: ORD[1] },
    { label: '3〜9話', value: loyal.threeToNine, color: ORD[2] },
    { label: '10話以上', value: loyal.tenPlus, color: ORD[3] },
  ]
  const regular = loyal.tenPlus + loyal.threeToNine
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: INK, lineHeight: 1 }}>{regular.toLocaleString()}</span>
        <span style={{ fontSize: 13, color: INK2 }}>人が3話以上読んでいます（読者 {loyal.readers.toLocaleString()} 人の {pct(regular / loyal.readers)}）</span>
      </div>
      <div style={{ display: 'flex', gap: 2, height: 22 }}>
        {parts.map((p, i) => p.value > 0 && (
          <span key={p.label} title={`${p.label}：${p.value}人`} style={{
            flex: p.value, background: p.color,
            borderRadius: `${i === 0 ? 4 : 0}px ${i === parts.length - 1 ? 4 : 0}px ${i === parts.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px`,
          }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 12 }}>
        {parts.map((p) => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} />
            <span style={{ color: INK2 }}>{p.label}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: INK }}>{p.value.toLocaleString()}人</span>
            <span style={{ width: 36, textAlign: 'right', color: INK3, fontSize: 11 }}>{pct(p.value / loyal.readers)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
 * 入り口
 * ============================================================ */

function SourceTab({ sources }: { sources: ProStats['sources'] }) {
  const rows = SOURCE_ORDER.map((key) => [key, sources[key] ?? 0] as const).filter(([, v]) => v > 0)
  const total = rows.reduce((s, [, v]) => s + v, 0)
  const inside = sources.site ?? 0
  const unknown = sources.unknown ?? 0
  const outside = total - inside - unknown
  const sorted = [...rows].sort((a, b) => (a[0] === 'unknown' ? 1 : b[0] === 'unknown' ? -1 : b[1] - a[1]))
  const max = Math.max(1, ...rows.map(([, v]) => v))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ana-stats3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
        <Stat label="外から来た" value={outside.toLocaleString()} sub={total ? `閲覧の ${pct(outside / total)}` : ''} color={ORANGE} />
        <Stat label="サイトの中から" value={inside.toLocaleString()} sub={total ? `閲覧の ${pct(inside / total)}（話から話へ・一覧から）` : ''} color={BLUE} />
        <Stat label="記録前" value={unknown.toLocaleString()} sub="入り口を記録し始める前の閲覧" color="#c9ced3" />
      </div>
      <Panel title="入り口ごとの閲覧" note="どこから読みに来たか">
        {total === 0 ? <Empty>まだ記録がありません</Empty> : (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* ★ 名前と数を上の行、棒を下の行に。携帯でも棒が細くならない */}
            {sorted.map(([key, v]) => (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: SOURCE_COLOR[key], flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: key === 'unknown' ? INK3 : INK, flex: 1 }}>{SOURCE_LABEL[key]}</span>
                  <span style={{ fontSize: 12, color: INK2, fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()}</span>
                  <b style={{ fontSize: 14, color: INK, width: 44, textAlign: 'right' }}>{pct(v / total)}</b>
                </div>
                <div style={{ height: 10, background: TRACK, borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(v / max) * 100}%`, background: SOURCE_COLOR[key], borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ============================================================
 * 時間
 * ============================================================ */

function peakOf(heat: number[][]) {
  let day = 0, hour = 0, value = 0
  heat.forEach((row, d) => row.forEach((v, h) => { if (v > value) { value = v; day = d; hour = h } }))
  return { day, hour, value }
}

function TimeTab({ heat, launch }: { heat: number[][]; launch: ProStats['launch'] | null }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Panel title="読まれる曜日と時間帯" note="日本時間・閲覧の数">
        <Heatmap heat={heat} />
      </Panel>
      {launch && (
        <Panel title="投稿後の伸び" note="公開から24時間・7日の閲覧数">
          {launch.length === 0 ? <Empty>公開中の話がありません</Empty> : <LaunchChart launch={launch} />}
        </Panel>
      )}
    </div>
  )
}

/**
 * 曜日と時間帯。
 * ★ 曜日を横に 7 列、時間を縦に 24 行（YouTube Studio の「視聴者がいる時間帯」と同じ向き）。
 *   横に 24 列並べると、携帯では 1 マスが小さすぎて読めなかった。
 * ★ 押した（指を乗せた）マスの数を、上に出す。いちばん読まれる時間は最初から出しておく。
 */
function Heatmap({ heat }: { heat: number[][] }) {
  const peak = peakOf(heat)
  const [pickCell, setPickCell] = useState<{ d: number; h: number } | null>(null)
  const flat = heat.flat()
  const max = Math.max(1, ...flat)
  const total = flat.reduce((a, b) => a + b, 0)
  const byHour = useMemo(() => new Array(24).fill(0).map((_, h) => heat.reduce((s, row) => s + row[h], 0)), [heat])
  const byDay = heat.map((row) => row.reduce((a, b) => a + b, 0))
  const topSlots = useMemo(() => {
    const cells: { d: number; h: number; v: number }[] = []
    heat.forEach((row, d) => row.forEach((v, h) => cells.push({ d, h, v })))
    return cells.sort((a, b) => b.v - a.v).slice(0, 3)
  }, [heat])
  const color = (v: number) => (v === 0 ? '#f1f4f7' : SEQ[Math.min(SEQ.length - 1, 1 + Math.floor((v / max) * (SEQ.length - 1)))])
  const shown = pickCell ?? { d: peak.day, h: peak.hour }
  const dayMax = Math.max(1, ...byDay)

  if (total === 0) return <Empty>まだ記録がありません</Empty>
  return (
    <div className="ana-heat" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 360px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
      <div>
        {/* 選んだマスの数 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, minHeight: 28 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: INK }}>{heat[shown.d][shown.h].toLocaleString()}</span>
          <span style={{ fontSize: 12, color: INK2 }}>{DAYS[shown.d]}曜 {shown.h}時台{!pickCell && '（いちばん多い時間）'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '34px repeat(7, minmax(0, 1fr))', gap: 3 }}>
          <span />
          {DAYS.map((day, d) => (
            <span key={day} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: d === 0 ? '#c0392b' : d === 6 ? BLUE : INK2, paddingBottom: 2 }}>{day}</span>
          ))}
          {new Array(24).fill(0).map((_, h) => (
            <Fragment key={h}>
              <span style={{ fontSize: 10.5, color: INK3, textAlign: 'right', paddingRight: 4, lineHeight: '14px' }}>{h % 3 === 0 ? `${h}時` : ''}</span>
              {DAYS.map((_, d) => {
                const v = heat[d][h]
                const isPeak = d === peak.day && h === peak.hour
                const isPick = pickCell?.d === d && pickCell?.h === h
                return (
                  <button
                    key={d}
                    type="button"
                    aria-label={`${DAYS[d]}曜 ${h}時台 ${v}`}
                    onMouseEnter={() => setPickCell({ d, h })}
                    onClick={() => setPickCell({ d, h })}
                    style={{
                      height: 14, padding: 0, border: 'none', borderRadius: 3, cursor: 'pointer', background: color(v),
                      boxShadow: isPick ? `inset 0 0 0 2px ${INK}` : isPeak ? `inset 0 0 0 2px ${ORANGE}` : 'none',
                    }}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: INK2, marginTop: 10, flexWrap: 'wrap' }}>
          少ない {SEQ.slice(1).map((c) => <span key={c} style={{ width: 14, height: 10, borderRadius: 2, background: c }} />)} 多い
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, boxShadow: `inset 0 0 0 2px ${ORANGE}` }} /> いちばん多い
          </span>
        </div>
      </div>

      {/* よく読まれる時間と、曜日ごとの合計 */}
      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 8 }}>よく読まれる時間 トップ3</div>
          {topSlots.map((slot, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? '1px solid var(--color-brand-light)' : 'none' }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: i === 0 ? ORANGE : TRACK, color: i === 0 ? '#fff' : INK2, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13.5, color: INK }}>{DAYS[slot.d]}曜 {slot.h}時台</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{slot.v.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 8 }}>曜日ごと</div>
          {byDay.map((v, d) => (
            <div key={d} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) 52px', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: d === 0 ? '#c0392b' : d === 6 ? BLUE : INK2 }}>{DAYS[d]}</span>
              <span style={{ height: 10, borderRadius: 5, background: TRACK, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(v / dayMax) * 100}%`, background: d === peak.day ? ORANGE : BLUE, borderRadius: 5 }} />
              </span>
              <span style={{ fontSize: 12, color: INK2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 8 }}>時間ごと</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56 }}>
            {byHour.map((v, h) => (
              <span key={h} title={`${h}時台：${v}`} style={{ flex: 1, height: `${Math.max(3, (v / Math.max(1, ...byHour)) * 100)}%`, background: h === peak.hour ? ORANGE : BLUE_LIGHT, borderRadius: '3px 3px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: INK3, marginTop: 3 }}>
            <span>0時</span><span>6時</span><span>12時</span><span>18時</span><span>23時</span>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 760px) { .ana-heat { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

function LaunchChart({ launch }: { launch: ProStats['launch'] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 220
  const m = { l: 40, r: 10, t: 16, b: 30 }
  const w = Math.max(0, width - m.l - m.r)
  const h = H - m.t - m.b
  const n = launch.length
  const band = n ? w / n : 0
  const barW = Math.max(5, Math.min(24, band * 0.66))
  const max = Math.max(1, ...launch.map((r) => r.first7d))
  const nice = niceMax(max)
  const y = (v: number) => m.t + (1 - v / nice) * h
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 34))))
  const recent = launch.filter((r) => !r.isYoung)
  const avg24 = recent.length ? Math.round(recent.reduce((s, r) => s + r.first24h, 0) / recent.length) : 0
  const avg7 = recent.length ? Math.round(recent.reduce((s, r) => s + r.first7d, 0) / recent.length) : 0

  const col = (cx: number, value: number, bw: number, fill: string, key: string) => {
    if (value <= 0) return null
    const top = y(value)
    const r = Math.min(4, (y(0) - top) / 2)
    return <path key={key} d={`M${cx - bw / 2},${y(0)} L${cx - bw / 2},${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} L${cx + bw / 2 - r},${top} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} L${cx + bw / 2},${y(0)} Z`} fill={fill} />
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10, marginBottom: 12 }}>
        <Stat label="公開24時間の平均" value={avg24.toLocaleString()} sub="公開から7日たった話の平均" color={BLUE} />
        <Stat label="公開7日の平均" value={avg7.toLocaleString()} sub="同じく" color={BLUE_LIGHT} />
      </div>
      <div ref={ref} style={{ position: 'relative' }}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="話ごとの、公開後24時間と7日の閲覧数" onMouseLeave={() => setHover(null)}>
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + w} y1={y(nice * t)} y2={y(nice * t)} stroke={GRID} strokeWidth={1} />
                <text x={m.l - 8} y={y(nice * t) + 4} textAnchor="end" fontSize={10.5} fill="currentColor" style={{ color: 'var(--color-text-faint)' }}>{Math.round(nice * t).toLocaleString()}</text>
              </g>
            ))}
            {launch.map((row, i) => {
              const cx = m.l + band * i + band / 2
              return (
                <g key={i} onMouseEnter={() => setHover(i)}>
                  <rect x={m.l + band * i} y={m.t} width={band} height={h} fill={hover === i ? 'rgba(42,120,214,.05)' : 'transparent'} />
                  {col(cx, row.first7d, barW, BLUE_LIGHT, 'a')}
                  {col(cx, row.first24h, Math.max(3, barW * 0.55), BLUE, 'b')}
                  {row.isYoung && <text x={cx} y={y(row.first7d) - 5} textAnchor="middle" fontSize={9.5} fill="currentColor" style={{ color: 'var(--color-text-faint)' }}>集計中</text>}
                  {(i % labelEvery === 0 || i === n - 1) && (
                    <text x={cx} y={H - 10} textAnchor="middle" fontSize={10.5} fill="currentColor" style={{ color: 'var(--color-text-faint)' }}>{i + 1}</text>
                  )}
                </g>
              )
            })}
            <line x1={m.l} x2={m.l + w} y1={y(0)} y2={y(0)} stroke="#c9ced3" strokeWidth={1} />
          </svg>
        )}
        {hover !== null && width > 0 && (
          <Tip x={m.l + band * hover + band / 2} y={y(launch[hover].first7d)} width={width}>
            <div style={{ fontSize: 11, color: INK2 }}>{hover + 1}話目「{launch[hover].title}」</div>
            <div style={{ fontSize: 12.5 }}><Key color={BLUE} /> 24時間 <b style={{ fontSize: 14 }}>{launch[hover].first24h}</b></div>
            <div style={{ fontSize: 12.5 }}><Key color={BLUE_LIGHT} /> 7日 <b style={{ fontSize: 14 }}>{launch[hover].first7d}</b>{launch[hover].isYoung && <span style={{ color: INK3, fontSize: 11 }}>（集計中）</span>}</div>
          </Tip>
        )}
      </div>
      <Legend items={[{ color: BLUE, label: '公開から24時間' }, { color: BLUE_LIGHT, label: '公開から7日' }]} />
    </div>
  )
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= v) return s * p
  return 10 * p
}

/* ============================================================
 * 部品
 * ============================================================ */

function Panel({ title, note, right, children }: { title: string; note?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="ana-panel" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, padding: '16px 18px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{title}</div>
          {note && <div style={{ fontSize: 11.5, color: INK3, marginTop: 2 }}>{note}</div>}
        </div>
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="ana-stat" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, minWidth: 0 }}>
      <span style={{ width: 4, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11.5, color: INK2 }}>{label}</div>
        <div className="ana-stat-value" style={{ fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{value}</div>
        {sub && <div style={{ fontSize: 10.5, color: INK3 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
      {items.map((item) => (
        <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: INK2 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} /> {item.label}
        </span>
      ))}
    </div>
  )
}

function Key({ color }: { color: string }) {
  return <span style={{ display: 'inline-block', width: 10, height: 3, borderRadius: 2, background: color, verticalAlign: 'middle', marginRight: 4 }} />
}

/** 指を乗せたところの数。図の上に浮かべる */
function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(8, x + 12), width - 190)
  return (
    <div style={{
      position: 'absolute', left, top: Math.max(0, y - 20), width: 180, pointerEvents: 'none', zIndex: 5,
      background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 8,
      padding: '8px 10px', boxShadow: '0 8px 20px -10px rgba(0,0,0,.35)', color: INK, lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12.5, color: INK3, padding: '22px 0', textAlign: 'center' }}>{children}</div>
}

/* ---------- 小さな印 ---------- */
function Svg({ children }: { children: ReactNode }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
}
function IconBook() { return <Svg><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5" /></Svg> }
function IconFlow() { return <Svg><path d="M3 6h7M3 12h11M3 18h15" /></Svg> }
function IconDoor() { return <Svg><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></Svg> }
function IconClock() { return <Svg><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></Svg> }
function IconSpark() { return <Svg><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Svg> }
function IconChart() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg> }
function IconDownload() { return <Svg><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg> }

/* ============================================================
 * Pro でない人へ。何が見られるかの見本
 * ============================================================ */

function Teaser({ top = 28 }: { top?: number }) {
  const items = [
    ['どこまで読まれたか', '最後まで読まれた割合と、どのあたりで閉じられたか'],
    ['読み続けてくれた率', '1話目の読者が、何話まで付いてきてくれたか'],
    ['どこから来たか', 'X・検索・サイトの中など、読者の入り口'],
    ['常連の読者', '3話以上読んでくれた人が何人いるか'],
    ['読まれる曜日と時間帯', 'いちばん読まれる時間。投稿時間の目安に'],
    ['投稿後の伸び', '公開から24時間・7日の閲覧数'],
  ]
  return (
    <section style={{ marginTop: top, ...card, background: 'linear-gradient(135deg, var(--color-bg-card), var(--color-brand-light))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>詳しい分析</span>
        <ProBadge />
      </div>
      <p style={{ ...muted, marginBottom: 14 }}>読まれた数の先にある、「どう読まれているか」が分かります。サブスクに入ると使えます。</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {items.map(([title, text]) => (
          <div key={title} style={{ border: '1px solid var(--color-brand-border)', borderRadius: 10, padding: '10px 12px', background: 'var(--color-bg-card)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 3, lineHeight: 1.6 }}>{text}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ============================================================
 * 書き出し
 * ============================================================ */

function downloadCsv(title: string, pro: ProStats, episodeViews: { title: string; views: number }[]) {
  const head = ['話', '閲覧', '読み始めた回数', '最後まで読まれた割合(%)', '平均の到達(%)', '読んだ時間の中央値(秒)', '1話目からの継続(%)', '前の話からの継続(%)', '公開24時間の閲覧', '公開7日の閲覧']
  const rows = pro.progress.episodes.map((ep, i) => [
    ep.title,
    episodeViews[i]?.views ?? '',
    ep.sessions,
    Math.round(ep.endRate * 100),
    ep.avgPct,
    ep.medianSec,
    Math.round((pro.retention[i]?.fromFirst ?? 0) * 100),
    Math.round((pro.retention[i]?.fromPrev ?? 0) * 100),
    pro.launch[i]?.first24h ?? '',
    pro.launch[i]?.first7d ?? '',
  ])
  const escape = (value: unknown) => {
    const text = String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const csv = [head, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  /* 表計算ソフトで文字化けしないよう、先頭に印（BOM）を付ける */
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}_分析.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
