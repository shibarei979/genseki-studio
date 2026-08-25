'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import LoginPromptModal from '@/components/login-prompt-modal'

interface Props {
  novelId: string
  userId: string | null
  authorId?: string
  novelTitle?: string
  isAuthor: boolean
  initialLiked: boolean
  initialBookmarked: boolean
  initialDiscovered: boolean
  likeCount: number
  bookmarkCount: number
  discoverCount: number
  userDisplayName?: string
  hideStats?: boolean
}

function fmtNum(n: number): string {
  if (n >= 10000) return (Math.floor(n / 1000) / 10) + '万'
  if (n >= 1000) return (Math.floor(n / 100) / 10) + 'K'
  return n.toString()
}

const DAILY_LIMIT = 3

export default function NovelActions({ novelId, userId, authorId, novelTitle, isAuthor, initialLiked, initialBookmarked, initialDiscovered, likeCount, bookmarkCount, discoverCount, userDisplayName, hideStats }: Props) {
  const supabase = createClient()
  const [liked,       setLiked]       = useState(initialLiked)
  const [bookmarked,  setBookmarked]  = useState(initialBookmarked)
  const [discovered,  setDiscovered]  = useState(initialDiscovered)
  const [likes,       setLikes]       = useState(likeCount)
  const [bookmarks,   setBookmarks]   = useState(bookmarkCount)
  const [discovers,   setDiscovers]   = useState(discoverCount)
  const [loading,     setLoading]     = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [comment,     setComment]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [showLogin,   setShowLogin]   = useState(false)
  const [loginMsg,    setLoginMsg]    = useState('')
  const [todayShares, setTodayShares] = useState(0)

  useEffect(() => {
    if (!userId) return
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('novel_shares').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('shared_at', today)
      .then(({ count }) => setTodayShares(count || 0))
  }, [userId])

  function requireLogin(msg: string) { setLoginMsg(msg); setShowLogin(true) }

  async function toggleLike() {
    if (!userId) return requireLogin('いいねするにはログインが必要です')
    if (loading) return
    setLoading(true)
    if (liked) {
      await supabase.from('likes').delete().eq('novel_id', novelId).eq('user_id', userId)
      setLiked(false); setLikes(c => Math.max(0, c - 1))
    } else {
      await supabase.from('likes').insert({ novel_id: novelId, user_id: userId })
      setLiked(true); setLikes(c => c + 1)
      if (authorId && userId !== authorId) {
        fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ user_id: authorId, type:'like',
            message: `${userDisplayName||'読者'}さんが「${novelTitle||'作品'}」にいいねしました`, link: `/novel/${novelId}` }) })
      }
    }
    setLoading(false)
  }

  async function toggleBookmark() {
    if (!userId) return requireLogin('ブックマークするにはログインが必要です')
    if (loading) return
    setLoading(true)
    if (bookmarked) {
      await supabase.from('bookmarks').delete().eq('novel_id', novelId).eq('user_id', userId)
      setBookmarked(false); setBookmarks(c => Math.max(0, c - 1))
    } else {
      await supabase.from('bookmarks').insert({ novel_id: novelId, user_id: userId })
      setBookmarked(true); setBookmarks(c => c + 1)
      if (authorId && userId !== authorId) {
        fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ user_id: authorId, type:'bookmark',
            message: `${userDisplayName||'読者'}さんが「${novelTitle||'作品'}」を保存しました`, link: `/novel/${novelId}` }) })
      }
    }
    setLoading(false)
  }

  async function handleDiscover() {
    if (!userId) return requireLogin('拡散するにはログインが必要です')
    if (isAuthor) return
    if (discovered) {
      if (!confirm('拡散を取り消すと、投稿したコメントも削除されます。よろしいですか？')) return
      await supabase.from('discovers').delete().eq('novel_id', novelId).eq('user_id', userId)
      setDiscovered(false); setDiscovers(c => Math.max(0, c - 1))
      setShowComment(false)
    } else {
      if (todayShares >= DAILY_LIMIT) {
        alert(`拡散は1日${DAILY_LIMIT}回までです。明日またご利用ください。`)
        return
      }
      setShowComment(true)
    }
  }

  async function submitDiscover() {
    if (!userId || !comment.trim()) return
    // 直前にもう一度チェック
    const today = new Date().toISOString().slice(0, 10)
    const { count } = await supabase.from('novel_shares').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('shared_at', today)
    if ((count || 0) >= DAILY_LIMIT) {
      alert(`拡散は1日${DAILY_LIMIT}回までです。明日またご利用ください。`)
      setShowComment(false); setComment('')
      return
    }

    setSubmitting(true)
    let isPending = false, pendingReason = ''
    try {
      const checkRes = await fetch('/api/check-discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
      })
      const checkData = await checkRes.json()
      isPending = checkData.pending || false
      pendingReason = checkData.reason || ''
    } catch (_) {}

    await supabase.from('discovers').insert({
      novel_id: novelId, user_id: userId, comment: comment.trim(),
      display_name: userDisplayName || '', is_pending: isPending,
      pending_reason: pendingReason || null,
    })

    // 拡散回数を記録
    await supabase.from('novel_shares').insert({ novel_id: novelId, user_id: userId })
    setTodayShares(c => c + 1)

    setDiscovered(true)
    if (!isPending) setDiscovers(c => c + 1)
    setShowComment(false); setComment(''); setSubmitting(false)
    if (isPending) {
      alert('コメントの内容を確認中です。審査通過後に公開されます。')
    } else {
      if (authorId && userId !== authorId) {
        fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ user_id: authorId, type:'discover',
            message: `${userDisplayName||'読者'}さんが「${novelTitle||'作品'}」を発掘・拡散しました`, link: `/novel/${novelId}` }) })
      }
    }
  }

  // ドット絵の帯で推薦：推薦文なしで拡散を確定し、帯エディタを開く
  async function submitObiDiscover() {
    if (!userId || submitting) return
    const today = new Date().toISOString().slice(0, 10)
    const { count } = await supabase.from('novel_shares').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('shared_at', today)
    if ((count || 0) >= DAILY_LIMIT) {
      alert(`拡散は1日${DAILY_LIMIT}回までです。明日またご利用ください。`)
      setShowComment(false); setComment('')
      return
    }
    setSubmitting(true)
    await supabase.from('discovers').insert({
      novel_id: novelId, user_id: userId, comment: null,
      display_name: userDisplayName || '', is_pending: false,
    })
    await supabase.from('novel_shares').insert({ novel_id: novelId, user_id: userId })
    setTodayShares(c => c + 1)
    setDiscovered(true)
    setDiscovers(c => c + 1)
    setShowComment(false); setComment(''); setSubmitting(false)
    if (authorId && userId !== authorId) {
      fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user_id: authorId, type:'discover',
          message: `${userDisplayName||'読者'}さんが「${novelTitle||'作品'}」を発掘・拡散しました`, link: `/novel/${novelId}` }) })
    }
    // 帯エディタを開く（ObiBeltが受け取る）
    window.dispatchEvent(new CustomEvent('open-obi-editor'))
  }

  function handleXShare() {
    const url = `${window.location.origin}/novel/${novelId}`
    const text = `「${novelTitle||'作品'}」\n#原石航路 #ライトノベル\n`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer')
  }

  const btn = (active: boolean, colorVar: string, activeBgFallback: string) => ({
    display:'inline-flex' as const, alignItems:'center' as const, gap:5,
    padding:'11px 14px', borderRadius:20, border:'1.5px solid', cursor:'pointer' as const,
    fontSize:13, fontWeight:500 as const,
    background: active ? activeBgFallback : 'var(--color-bg-card)',
    borderColor: active ? colorVar : 'var(--color-brand-border)',
    color: active ? colorVar : 'var(--color-text-muted)',
    transition: 'all .15s',
    opacity: loading ? 0.7 : 1,
  })

  const reachedLimit = !discovered && userId && !isAuthor && todayShares >= DAILY_LIMIT

  return (
    <div>
      <LoginPromptModal show={showLogin} onClose={()=>setShowLogin(false)} message={loginMsg} />

      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <button onClick={toggleLike} style={btn(liked,'var(--color-danger)','#fef2f2')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={liked?'var(--color-danger)':'none'} stroke={liked?'var(--color-danger)':'var(--color-text-faint)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {!hideStats && fmtNum(likes)}
        </button>
        <button onClick={toggleBookmark} style={btn(bookmarked,'var(--color-brand)','var(--color-brand-light)')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={bookmarked?'var(--color-brand)':'none'} stroke={bookmarked?'var(--color-brand)':'var(--color-text-faint)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          {!hideStats && fmtNum(bookmarks)}
        </button>
        <button onClick={handleDiscover}
          disabled={isAuthor || !!reachedLimit}
          style={isAuthor || reachedLimit
            ? {...btn(false,'var(--color-text-faint)','transparent'), cursor:'not-allowed' as const, opacity:0.4}
            : btn(discovered,'var(--color-brand)','var(--color-brand-light)')}
          title={isAuthor ? '自分の作品は拡散できません' : reachedLimit ? `本日の拡散上限（${DAILY_LIMIT}回）に達しました` : 'この作品をもっと広めたい！という気持ちを伝える'}>
          拡散する {!hideStats && discovers > 0 && fmtNum(discovers)}
          {/*
           * 残り回数はここに出さない。
           *
           * 押したあとの窓の中に書いてある。
           * 押し具の横に添えると、数が 2 つ並んで
           * どちらが拡散の数か分からなくなる。
           */}
        </button>
        <button onClick={handleXShare}
          style={{display:'inline-flex',alignItems:'center',gap:5,padding:'11px 14px',borderRadius:20,
            border:'1.5px solid #e2e8f0',background:'var(--color-bg-card)',color:'#374151',
            fontSize:13,fontWeight:500,cursor:'pointer',transition:'all .15s'}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          シェア
        </button>
      </div>

      {/* 拡散コメント入力 */}
      {showComment && (
        <div style={{marginTop:12,background:'var(--color-brand-light)',border:'1.5px solid var(--color-tag-border)',borderRadius:12,padding:'14px'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--color-brand)',marginBottom:6}}>この作品の魅力を伝えよう！</div>
          <div style={{fontSize:11,color:'var(--color-text)',marginBottom:8,lineHeight:1.6}}>
            紹介コメントを書いてください。作品ページに表示されます。
            <span style={{display:'block',color:'var(--color-text-muted)',marginTop:2}}>本日残り{DAILY_LIMIT - todayShares}回拡散できます</span>
          </div>
          <textarea value={comment} onChange={e=>setComment(e.target.value)}
            placeholder="例：世界観が独特で、主人公の成長が胸に刺さります！続きが気になりすぎる作品です。"
            rows={3}
            style={{width:'100%',padding:'10px 12px',border:'1.5px solid #c4b5fd',borderRadius:8,
              fontSize:13,resize:'none',outline:'none',fontFamily:'inherit',boxSizing:'border-box',
              background:'var(--color-bg-card)',lineHeight:1.7}}/>
          <button onClick={submitObiDiscover} disabled={submitting}
            style={{width:'100%',marginTop:8,padding:'9px 12px',border:'1.5px dashed var(--color-brand)',borderRadius:10,
              background:'var(--color-bg-card)',color:'var(--color-brand)',fontSize:12,fontWeight:700,cursor:'pointer',opacity:submitting?0.5:1}}>
            文字のかわりに、ドット絵の帯で推薦する
          </button>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8,flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:11,color:'var(--color-text-muted)'}}>{comment.length}/200文字</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{setShowComment(false);setComment('')}}
                style={{padding:'6px 14px',border:'1px solid var(--color-tag-border)',borderRadius:16,background:'var(--color-bg-card)',color:'var(--color-brand)',fontSize:12,cursor:'pointer'}}>
                キャンセル
              </button>
              <button onClick={submitDiscover} disabled={submitting||!comment.trim()}
                style={{padding:'6px 16px',border:'none',borderRadius:16,background:'var(--color-brand)',
                  color:'var(--color-bg-card)',fontSize:12,fontWeight:700,cursor:'pointer',opacity:submitting||!comment.trim()?0.5:1}}>
                {submitting?'送信中...':'拡散する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
