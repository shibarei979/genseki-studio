'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface MissionStats {
  likeCount: number
  discoverCount: number
  commentCount: number
  bookmarkCount: number
  novelCount: number
  episodeCount: number
  followCount: number
  readCount?: number
  hasBio?: boolean
  tweetCount?: number
  seriesCount?: number
}

interface Props {
  user: boolean
  stats: MissionStats
  initialClaimedIds: string[]
  isWriter: boolean
}

type MissionCat = 'start' | 'discover' | 'social' | 'creator'
interface Mission {
  id: string
  label: string
  desc: string
  target: number
  cat: MissionCat
  cur: (s: MissionStats) => number
}

const CAT_INFO: Record<MissionCat, { label: string; color: string; bg: string }> = {
  start:    { label: 'はじめの一歩', color: 'var(--color-brand)', bg: '#eef2f5' },
  discover: { label: '発掘を楽しむ', color: '#2a9d8f', bg: '#e6f5f3' },
  social:   { label: '交流を広げる', color: '#2563eb', bg: '#eef4ff' },
  creator:  { label: 'クリエイターへの道', color: '#9b5de5', bg: '#f3ecfd' },
}
const CatIcon = ({ cat }: { cat: MissionCat }) => {
  const p: Record<MissionCat, string> = {
    start: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    discover: 'M6 3h12l4 6-10 13L2 9z',
    social: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    creator: 'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586 M11 11a2 2 0 1 0 4 0 2 2 0 0 0-4 0z',
  }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={p[cat]}/></svg>
}

// 読み手10・書き手はさらに5個（計15）。クリアを押すとカードが消え、全達成でタブごと非公開
export const READER_MISSIONS: Mission[] = [
  { id: 'first-read',     label: 'はじめての読了',     desc: '作品を1話、最後まで読む',      target: 1,  cat: 'start',    cur: s => s.readCount || 0 },
  { id: 'read-5',         label: '読書の習慣',         desc: '5話読了する',                  target: 5,  cat: 'start',    cur: s => s.readCount || 0 },
  { id: 'first-follow',   label: '作家をフォロー',     desc: '気になる作家をフォローする',   target: 1,  cat: 'social',   cur: s => s.followCount },
  { id: 'first-like',     label: 'はじめてのいいね',   desc: '作品にいいねを送る',           target: 1,  cat: 'social',   cur: s => s.likeCount },
  { id: 'like-10',        label: '応援の達人',         desc: 'いいねを10回送る',             target: 10, cat: 'social',   cur: s => s.likeCount },
  { id: 'first-bookmark', label: 'はじめての保存',     desc: '気になる作品を保存する',       target: 1,  cat: 'start',    cur: s => s.bookmarkCount },
  { id: 'first-comment',  label: 'はじめてのコメント', desc: '作品にコメントを書く',         target: 1,  cat: 'social',   cur: s => s.commentCount },
  { id: 'comment-5',      label: '感想の語り部',       desc: 'コメントを5件書く',            target: 5,  cat: 'social',   cur: s => s.commentCount },
  { id: 'first-discover', label: 'はじめての発掘',     desc: '作品を発掘・拡散する',         target: 1,  cat: 'discover', cur: s => s.discoverCount },
  { id: 'discover-3',     label: '原石ハンター',       desc: '3作品を発掘する',              target: 3,  cat: 'discover', cur: s => s.discoverCount },
]
export const WRITER_MISSIONS: Mission[] = [
  { id: 'profile-setup',  label: '自己紹介を書く',     desc: 'プロフィールに自己紹介を設定', target: 1,  cat: 'creator',  cur: s => (s.hasBio ? 1 : 0) },
  { id: 'first-episode',  label: '投稿する',           desc: '最初の話を投稿する',           target: 1,  cat: 'creator',  cur: s => s.episodeCount },
  { id: 'episode-5',      label: '5回投稿する',        desc: '話を5回投稿する',              target: 5,  cat: 'creator',  cur: s => s.episodeCount },
  { id: 'first-tweet',    label: 'つぶやく',           desc: 'つぶやきを投稿する',           target: 1,  cat: 'creator',  cur: s => s.tweetCount || 0 },
  { id: 'first-series',   label: 'シリーズを作る',     desc: '作品をまとめるシリーズを作成', target: 1,  cat: 'creator',  cur: s => s.seriesCount || 0 },
]

export default function MissionClient({ user, stats, initialClaimedIds, isWriter }: Props) {
  const MISSIONS = isWriter ? [...READER_MISSIONS, ...WRITER_MISSIONS] : READER_MISSIONS
  const supabase = createClient()
  const [claimed, setClaimed] = useState(new Set(initialClaimedIds))
  const [claiming, setClaiming] = useState('')
  const [vanishing, setVanishing] = useState('')

  async function handleClaim(missionId: string) {
    setClaiming(missionId)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) {
      const { error } = await supabase.from('user_missions').insert({ user_id: u.id, mission_id: missionId })
      if (!error) {
        setClaiming('')
        setVanishing(missionId)
        setTimeout(() => {
          setClaimed(prev => new Set(Array.from(prev).concat(missionId)))
          setVanishing('')
        }, 450)
        return
      }
    }
    setClaiming('')
  }

  // クリア済みも表示（達成済みタブで見られる）。押した瞬間だけ消えるアニメ
  const [tab, setTab] = useState('all' as 'all' | 'progress' | 'done')
  const doneCount = MISSIONS.filter(m => claimed.has(m.id)).length
  const pct = Math.round((doneCount / MISSIONS.length) * 100)
  const REWARD_STEPS = [5, 10, 15]
  const nextReward = REWARD_STEPS.find(r => r > doneCount)
  const toNext = nextReward ? nextReward - doneCount : 0

  const filtered = MISSIONS.filter(m => {
    const isDone = claimed.has(m.id)
    if (tab === 'done') return isDone
    if (tab === 'progress') return !isDone
    return true
  }).sort((a, b) => {
    // 上から：クリア！ボタンが出る達成待ち → 挑戦中 → クリア済み
    const rank = (m: Mission) => {
      if (claimed.has(m.id)) return 2                         // クリア済み（最下部）
      if (Math.min(m.target, m.cur(stats)) >= m.target) return 0  // 達成待ち（最上部）
      return 1                                                // 挑戦中
    }
    return rank(a) - rank(b)
  })

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>ミッション</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 10, lineHeight: 1.7 }}>読んで、応援して、書いて。挑戦するとバッジや報酬がもらえます。</p>
      </div>

      {/* サマリーカード */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--color-brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        </div>
        <div style={{ flex: 1, minWidth:'min(200px, 100%)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>達成状況</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', marginBottom: 6 }}>{doneCount} <span style={{ fontSize: 15, fontWeight: 600 }}>/ {MISSIONS.length} クリア</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 8, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-brand), #4a7fa5)', transition: 'width .4s' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand)', flexShrink: 0 }}>{pct}%</span>
          </div>
          {nextReward && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>次の報酬まであと {toNext} ミッション</div>}
        </div>
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {([{v:'all',l:'すべて',c:MISSIONS.length},{v:'progress',l:'進行中',c:MISSIONS.length-doneCount},{v:'done',l:'達成済み',c:doneCount}] as const).map(({v,l,c})=>(
          <button key={v} onClick={()=>setTab(v as any)}
            style={{ fontSize: 12, fontWeight: tab===v?700:500, padding: '6px 16px', borderRadius: 16, cursor: 'pointer',
              border: `1px solid ${tab===v?'var(--color-brand)':'var(--color-brand-border)'}`,
              background: tab===v?'var(--color-brand)':'var(--color-bg-card)',
              color: tab===v?'var(--base-color-1)':'var(--color-text-muted)' }}>
            {l} {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: 14, fontWeight: 600 }}>
          {tab==='done' ? 'まだ達成したミッションはありません' : tab==='progress' ? '進行中のミッションはありません' : 'ミッションがありません'}
        </div>
      ) : (
        filtered.map(m => {
          const cur = Math.min(m.target, m.cur(stats))
          const isDone = claimed.has(m.id)
          const achieved = cur >= m.target
          const isVanishing = vanishing === m.id
          const ci = CAT_INFO[m.cat]
          return (
            <div key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderRadius: 12, marginBottom: 10,
                background: isDone ? '#fff9f4' : 'var(--color-bg-card)',
                border: isDone ? '1px solid var(--color-brand)' : '1px solid var(--color-brand-border)',
                opacity: isVanishing ? 0 : 1,
                transform: isVanishing ? 'translateX(24px) scale(0.96)' : 'none',
                transition: 'opacity .45s, transform .45s',
              }}>
              {/* カテゴリアイコン */}
              <div style={{ width: 44, height: 44, borderRadius: 10, background: ci.bg, color: ci.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CatIcon cat={m.cat} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ci.color, background: ci.bg, padding: '1px 8px', borderRadius: 10 }}>{ci.label}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 6 }}>{m.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, maxWidth: 220, height: 5, background: 'var(--color-bg)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(cur / m.target) * 100}%`, height: '100%', background: (achieved||isDone) ? 'linear-gradient(90deg, var(--color-brand), #4a7fa5)' : 'var(--color-brand-border)', transition: 'width .3s' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: (achieved||isDone) ? 'var(--color-brand)' : 'var(--color-text-faint)', flexShrink: 0 }}>{cur}/{m.target}</span>
                </div>
              </div>
              {isDone ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--color-success, #35a45d)', background: 'var(--color-success-soft, #eaf8ef)', borderRadius: 16, padding: '6px 14px', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  クリア
                </span>
              ) : achieved ? (
                <button onClick={() => handleClaim(m.id)} disabled={claiming === m.id || isVanishing}
                  style={{
                    fontSize: 13, fontWeight: 800, color: 'var(--color-text-inverse)', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--color-brand), #4a7fa5)',
                    border: 'none', borderRadius: 20, padding: '9px 20px', cursor: 'pointer',
                    boxShadow: '0 3px 10px color-mix(in srgb, var(--color-brand) 40%, transparent)',
                  }}>
                  {claiming === m.id ? '...' : 'クリア！'}
                </button>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--color-text-faint)', flexShrink: 0, border: '1px solid var(--color-brand-border)', borderRadius: 14, padding: '5px 12px' }}>挑戦中</span>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
