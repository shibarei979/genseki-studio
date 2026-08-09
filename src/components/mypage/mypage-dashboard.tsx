'use client'
import Link from 'next/link'
import { READER_MISSIONS, WRITER_MISSIONS, type MissionStats } from '@/components/mypage/mission-client'

interface Props {
  novels: any[]
  historyItems: any[]
  bookmarkedNovels: any[]
  bmAuthorMap: Record<string, string>
  novelLikeMap: Record<string, number>
  novelViewMap: Record<string, number>
  charCountMap: Record<string, number>
  missionStats: MissionStats
  claimedMissionIds: string[]
  isWriter: boolean
  monthlySummary: { novels: number; novelsPrev: number; chars: number; charsPrev: number; views: number; viewsPrev: number; likes: number; likesPrev: number }
  recentTweet: any
  onEditName: () => void
  onEditBio: () => void
  onTabChange?: (tab: string) => void
}

const card: React.CSSProperties = { background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column' }
const cardHead: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }
const seeAll: React.CSSProperties = { fontSize: 11.5, color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 600 }
const emptyText: React.CSSProperties = { fontSize: 12.5, color: 'var(--color-text-faint)', padding: '10px 0' }

function fmtDate(s?: string) {
  if (!s) return ''
  const d = new Date(s), now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 86400000)
  if (diff <= 0) return '今日'
  if (diff === 1) return '1日前'
  if (diff === 2) return '2日前'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function diffLabel(cur: number, prev: number) {
  const d = cur - prev
  if (d === 0) return <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>先月比 ±0</span>
  const up = d > 0
  return <span style={{ fontSize: 11, color: up ? 'var(--color-success, #15803d)' : 'var(--color-text-muted)' }}>先月比 {up ? '+' : ''}{d.toLocaleString()}</span>
}

export default function MypageDashboard({ novels, historyItems, bookmarkedNovels, bmAuthorMap, novelLikeMap, novelViewMap, charCountMap, missionStats, claimedMissionIds, isWriter, monthlySummary, recentTweet, onTabChange }: Props) {
  const published = novels.filter(n => n.published)
  const drafts = novels.filter(n => !n.published)
  const missions = isWriter ? [...READER_MISSIONS, ...WRITER_MISSIONS] : READER_MISSIONS
  const claimedSet = new Set(claimedMissionIds)
  const missionPreview = missions.filter(m => !claimedSet.has(m.id)).slice(0, 4)


  const RecentWorks = (
    <div style={card}>
      <div style={cardHead}><span style={cardTitle}>最近の投稿作品</span><button onClick={()=>onTabChange?.('works')} style={{...seeAll, background:'none', border:'none', cursor:'pointer', padding:0}}>すべて見る →</button></div>
      {published.length === 0 ? <div style={emptyText}>まだ公開作品がありません</div> : published.slice(0, 2).map(n => (
        <Link key={n.id} href={`/mypage/novel/${n.id}`} className="dash-link" style={{ display: 'block', marginBottom: 12, textDecoration: 'none', borderRadius: 6 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--color-brand)', border: '1px solid var(--color-brand-border)', borderRadius: 4, padding: '1px 7px' }}>{n.genre}</span>
            <span style={{ fontSize: 10, color: 'var(--color-info)', border: '1px solid var(--color-info)', borderRadius: 4, padding: '1px 7px' }}>{n.is_serial ? '連載中' : '完結'}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{(charCountMap[n.id] || 0).toLocaleString()}文字　{fmtDate(n.updated_at)}更新　♡ {novelLikeMap[n.id] || 0}　👁 {(novelViewMap[n.id] || 0).toLocaleString()}</div>
        </Link>
      ))}
    </div>
  )

  const Drafts = (
    <div style={card}>
      <div style={cardHead}><span style={cardTitle}>下書き</span><button onClick={()=>onTabChange?.('works')} style={{...seeAll, background:'none', border:'none', cursor:'pointer', padding:0}}>すべて見る →</button></div>
      {drafts.length === 0 ? <div style={emptyText}>下書きはありません</div> : drafts.slice(0, 3).map(n => (
        <Link key={n.id} href={`/mypage/novel/${n.id}`} className="dash-link" style={{ display: 'block', marginBottom: 10, textDecoration: 'none', borderRadius: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
          <div style={{ fontSize: 10.5, color: 'var(--color-text-faint)' }}>{n.genre}　{(charCountMap[n.id] || 0).toLocaleString()}文字　{fmtDate(n.updated_at)}更新</div>
        </Link>
      ))}
    </div>
  )

  const History = (
    <div style={card}>
      <div style={cardHead}><span style={cardTitle}>最近の閲覧履歴</span><button onClick={()=>onTabChange?.('history')} style={{...seeAll, background:'none', border:'none', cursor:'pointer', padding:0}}>すべて見る →</button></div>
      {historyItems.length === 0 ? <div style={emptyText}>まだ閲覧履歴がありません</div> : historyItems.slice(0, 2).map((h, i) => (
        <Link key={i} href={h.episodeId ? `/novel/${h.novelId}/episode/${h.episodeId}` : `/novel/${h.novelId}`} className="dash-link" style={{ display: 'block', marginBottom: 10, textDecoration: 'none', borderRadius: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.novelTitle}</div>
          <div style={{ fontSize: 10.5, color: 'var(--color-text-faint)' }}>{h.authorName}</div>
        </Link>
      ))}
    </div>
  )

  const Bookmarks = (
    <div style={card}>
      <div style={cardHead}><span style={cardTitle}>保存済み作品</span><button onClick={()=>onTabChange?.('bookmarks')} style={{...seeAll, background:'none', border:'none', cursor:'pointer', padding:0}}>すべて見る →</button></div>
      {bookmarkedNovels.length === 0 ? <div style={emptyText}>保存済み作品はありません</div> : bookmarkedNovels.slice(0, 2).map((b: any, i: number) => (
        <Link key={i} href={`/novel/${b.novels?.id}`} className="dash-link" style={{ display: 'block', marginBottom: 10, textDecoration: 'none', borderRadius: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.novels?.title}</div>
          <div style={{ fontSize: 10.5, color: 'var(--color-text-faint)' }}>{bmAuthorMap[b.novels?.author_id] || ''}</div>
        </Link>
      ))}
    </div>
  )

  const Tweet = (
    <div style={card}>
      <div style={cardHead}><span style={cardTitle}>最近のつぶやき</span><button onClick={()=>onTabChange?.('tweet')} style={{...seeAll, background:'none', border:'none', cursor:'pointer', padding:0}}>すべて見る →</button></div>
      {recentTweet ? (
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 6 }}>
            {recentTweet.body.length > 80 ? recentTweet.body.slice(0, 80) + '…' : recentTweet.body}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>♡ {recentTweet.like_count || 0}　💬 {recentTweet.reply_count || 0}</div>
        </div>
      ) : <div style={emptyText}>まだつぶやきがありません</div>}
    </div>
  )

  const Missions = (
    <div style={card}>
      <div style={cardHead}><span style={cardTitle}>ミッション進捗</span><button onClick={()=>onTabChange?.('mission')} style={{...seeAll, background:'none', border:'none', cursor:'pointer', padding:0}}>すべて見る →</button></div>
      {missionPreview.length === 0 ? <div style={emptyText}>すべて達成しました！</div> : missionPreview.map(m => {
        const cur = Math.min(m.target, m.cur(missionStats))
        return (
          <div key={m.id} style={{ marginBottom: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>{cur}/{m.target}</span>
            </div>
            <div style={{ height: 5, background: 'var(--color-bg)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${(cur / m.target) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-brand), #4a7fa5)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )


  return (
    <div id="mypage-dashboard" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* CSS 内の > や " は React がエスケープしてしまうため、
          dangerouslySetInnerHTML で素通しする（ハイドレーション不一致も回避） */}
      <style dangerouslySetInnerHTML={{ __html: `
        #mypage-dashboard a.dash-link:hover > div,
        #mypage-dashboard a.dash-link:hover,
        #mypage-dashboard a.dash-link:focus > div,
        #mypage-dashboard a.dash-link:active > div,
        #mypage-dashboard a.dash-link:hover *,
        #mypage-dashboard a.dash-link:focus * {
          background: none !important;
          background-color: transparent !important;
          opacity: 1 !important;
          transition: none !important;
          box-shadow: none !important;
        }
      ` }} />
      {/* 左：コンテンツ系カード群 */}
      <div style={{ flex: '2 1 440px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {RecentWorks}
          {Drafts}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {History}
          {Bookmarks}
        </div>
        {Tweet}
      </div>
      {/* 右：ミッション進捗＋活動サマリー */}
      <div style={{ flex: '1 1 260px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Missions}
      </div>
    </div>
  )
}
