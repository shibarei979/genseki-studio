'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLoginRequired } from '@/hooks/use-login-required'
import Link from 'next/link'
import { useQuote } from '@/components/novel/episode/quote-context'

interface Comment {
  id: string
  body: string
  created_at: string
  user_id: string
  display_name: string
  icon_url: string
  like_count: number
  is_pinned: boolean
  rating?: number | null
  quoted_text?: string | null
  parent_id?: string | null
  replies?: Comment[]
}

interface Props {
  novelId: string
  episodeId: string
  userId: string | null
  userName: string | null
  userIconUrl: string | null
  authorId: string
  comments: Comment[]
}

function StarDisplay({ rating }: { rating?: number | null }) {
  if (!rating || rating < 1) return null
  return (
    <span style={{ display: 'inline-flex', gap: 1, marginLeft: 6 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: 12, color: i <= rating ? '#4a7fa5' : '#ddd' }}>★</span>
      ))}
    </span>
  )
}

export default function CommentSection({ novelId, episodeId, userId, userName, userIconUrl, authorId, comments: initialComments }: Props) {
  /* 読むのは誰でも。書くときにログインを求める */
  const { guard, prompt } = useLoginRequired(userId)

  const supabase = createClient()
  const { quotedText, setQuotedText, selecting, setSelecting, commentAnchorRef } = useQuote()

  // 初期コメントを親子構造に組み立て（parent_idがあるものは返信）
  const buildTree = (list: Comment[]): Comment[] => {
    const roots = list.filter(c => !c.parent_id)
    roots.forEach(r => { r.replies = list.filter(c => c.parent_id === r.id).sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()) })
    return roots
  }

  const [comments, setComments] = useState<Comment[]>(() => buildTree(initialComments))
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [posting, setPosting] = useState(false)
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyPosting, setReplyPosting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /*
   * コメントは、画面が出たあとに読む。
   *
   * 本文を読み終えるまで見えない場所なので、
   * 表で待つ理由が無い。
   */
  useEffect(() => {
    if (initialComments.length > 0) return

    let alive = true

    fetch(`/api/novel/${novelId}/comments`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (alive && data?.comments) setComments(buildTree(data.comments))
      })
      .catch(() => { /* 届かなくても、本文は読める */ })

    return () => { alive = false }
  }, [novelId, initialComments.length])

  useEffect(() => {
    if (quotedText && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [quotedText])

  useEffect(() => {
    if (!userId) return guard('感想を書く', () => {})()
    const commentIds = comments.map(c => c.id)
    if (commentIds.length === 0) return
    supabase.from('comment_likes').select('comment_id').eq('user_id', userId).in('comment_id', commentIds)
      .then(({ data }) => {
        if (data) setLikedComments(new Set(data.map((d: any) => d.comment_id)))
      })
  }, [userId])

  async function handleSubmit() {
    if (!userId) return guard('感想を書く', () => {})()
    const trimmed = body.trim()
    if (!trimmed) return
    setPosting(true)

    const insertData: any = {
      novel_id: novelId,
      episode_id: episodeId,
      user_id: userId,
      body: trimmed,
      quoted_text: quotedText || null,
    }
    if (rating > 0) insertData.rating = rating

    const { data, error } = await supabase.from('comments').insert(insertData).select().single()

    if (!error && data) {
      const newComment: Comment = {
        id: data.id,
        body: data.body,
        created_at: data.created_at,
        user_id: userId,
        display_name: userName || '名無し',
        icon_url: userIconUrl || '',
        like_count: 0,
        is_pinned: false,
        rating: rating > 0 ? rating : null,
        quoted_text: quotedText || null,
      }
      setComments([newComment, ...comments])
      setBody('')
      setRating(0)
      setQuotedText('')

      // 作者に通知
      if (authorId !== userId) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: authorId,
            type: 'comment',
            message: `${userName || '名無し'}さんがコメントしました`,
            link: `/novel/${novelId}/episode/${episodeId}`,
          }),
        }).catch(() => {})
      }
    }
    setPosting(false)
  }

  async function handleReplySubmit() {
    if (!userId || !replyTo) return
    const trimmed = replyBody.trim()
    if (!trimmed) return
    setReplyPosting(true)

    const { data, error } = await supabase.from('comments').insert({
      novel_id: novelId,
      episode_id: episodeId,
      user_id: userId,
      body: trimmed,
      parent_id: replyTo.id,
    }).select().single()

    if (!error && data) {
      const newReply: Comment = {
        id: data.id,
        body: data.body,
        created_at: data.created_at,
        user_id: userId,
        display_name: userName || '名無し',
        icon_url: userIconUrl || '',
        like_count: 0,
        is_pinned: false,
        parent_id: replyTo.id,
      }
      setComments(prev => prev.map(c =>
        c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), newReply] } : c
      ))

      // 親コメントの投稿者に返信通知（自分自身への返信は除く）
      const parentComment = comments.find(c => c.id === replyTo.id)
      if (parentComment && parentComment.user_id !== userId) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: parentComment.user_id,
            type: 'reply',
            message: `${userName || '名無し'}さんがあなたのコメントに返信しました`,
            link: `/novel/${novelId}/episode/${episodeId}`,
          }),
        }).catch(() => {})
      }

      setReplyBody('')
      setReplyTo(null)
    }
    setReplyPosting(false)
  }

  async function toggleLike(commentId: string) {
    if (!userId) return guard('いいねする', () => {})()
    const isLiked = likedComments.has(commentId)
    if (isLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId)
      setLikedComments(prev => { const s = new Set(prev); s.delete(commentId); return s })
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, like_count: Math.max(0, c.like_count - 1) } : c))
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId })
      setLikedComments(prev => new Set(prev).add(commentId))
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, like_count: c.like_count + 1 } : c))
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm('このコメントを削除しますか？')) return
    await supabase.from('comments').delete().eq('id', commentId)
    setComments(prev => prev
      .filter(c => c.id !== commentId)  // 親コメント削除
      .map(c => ({ ...c, replies: (c.replies || []).filter(r => r.id !== commentId) }))  // 返信削除
    )
  }

  async function togglePin(commentId: string, current: boolean) {
    await supabase.from('comments').update({ is_pinned: !current }).eq('id', commentId)
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_pinned: !current } : c))
  }

  function fmtDate(s: string) {
    const d = new Date(s)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'たった今'
    if (mins < 60) return `${mins}分前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}時間前`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}日前`
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }

  const sortedComments = [...comments].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <>
    <div ref={commentAnchorRef} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-brand-border)', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>コメント</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{comments.length}件</span>
      </div>

      {/* 投稿フォーム */}
      {userId ? (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-brand-light)' }}>
          {quotedText ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--color-brand-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-muted)', borderLeft: '3px solid var(--color-brand)', paddingLeft: 8, lineHeight: 1.6 }}>
                <span style={{fontSize:10,color:'var(--color-brand)',fontWeight:700,marginRight:4}}>引用</span>
                {quotedText.length > 80 ? quotedText.slice(0,80)+'…' : quotedText}
              </div>
              <button onClick={() => setQuotedText('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-faint)', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          ) : (
            <button onClick={() => setSelecting(!selecting)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', marginBottom: 10, background: selecting ? 'var(--color-brand-light)' : 'var(--color-bg-card)', border: `1.5px dashed ${selecting ? 'var(--color-brand)' : 'var(--color-brand-border)'}`, borderRadius: 8, fontSize: 12, color: selecting ? 'var(--color-brand)' : 'var(--color-text-muted)', cursor: 'pointer', fontWeight: 500 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              {selecting ? '本文中の文をクリックしてください（再度タップでキャンセル）' : '本文から引用する'}
            </button>
          )}

          {/* 星評価選択（5段階・任意で0もOK） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>評価</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i}
                  onClick={() => setRating(rating === i ? 0 : i)}
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 24, lineHeight: 1, color: i <= (hoverRating || rating) ? '#4a7fa5' : '#ddd' }}>
                  ★
                </button>
              ))}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="感想を書いてみましょう"
            style={{ width: '100%', minHeight: 70, padding: '10px 12px', border: '1px solid var(--color-brand-border)', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit', background: 'var(--color-bg-card)', color: 'var(--color-text)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={handleSubmit} disabled={posting || !body.trim()}
              style={{ background: 'var(--color-brand)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: posting || !body.trim() ? 'not-allowed' : 'pointer', opacity: posting || !body.trim() ? 0.5 : 1 }}>
              {posting ? '投稿中...' : '投稿する'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px 16px', textAlign: 'center', borderBottom: '1px solid var(--color-brand-light)' }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 600 }}>ログインしてコメントする</Link>
        </div>
      )}

      {/* コメント一覧 */}
      {sortedComments.length === 0 ? (
        <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-faint)' }}>
          まだコメントがありません
        </div>
      ) : (
        sortedComments.map((c, i) => (
          <div key={c.id} style={{ padding: '14px 16px', margin: '0 12px 10px', border: `1px solid ${c.is_pinned ? 'var(--color-brand)' : 'var(--color-brand-border)'}`, borderRadius: 12, background: c.is_pinned ? 'var(--color-brand-light)' : 'var(--color-bg-card)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {c.icon_url ? (
                <img src={c.icon_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-brand-light)', color: 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                  {(c.display_name || '?')[0]}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <Link href={`/author/${c.user_id}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', textDecoration: 'none' }}>{c.display_name}</Link>
                  {c.user_id === authorId && <span style={{ fontSize: 10, background: 'var(--color-brand)', color: 'var(--color-text-inverse)', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>作者</span>}
                  {c.is_pinned && <span style={{ fontSize: 10, background: 'var(--color-info-bg)', color: 'var(--color-info)', padding: '1px 6px', borderRadius: 3 }}>ピン留め</span>}
                  <span style={{ fontSize: 11, color: 'var(--color-text-faint)', marginLeft: 'auto' }}>{fmtDate(c.created_at)}</span>
                </div>
                {c.rating && c.rating >= 1 ? (
                  <div style={{ marginBottom: 5 }}>
                    {[1,2,3,4,5].map(s => (
                      <span key={s} style={{ fontSize: 15, color: s <= (c.rating||0) ? '#4a7fa5' : 'var(--color-brand-border)', letterSpacing: 1 }}>★</span>
                    ))}
                  </div>
                ) : null}
                {c.quoted_text && (
                  <div style={{ fontSize: 12, color: '#55605a', background: '#eef5f9', border: '1px solid #dcdfda', borderLeft: '3px solid var(--color-brand)', borderRadius: '2px 6px 6px 2px', padding: '6px 10px', lineHeight: 1.6, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--color-brand)', fontWeight: 700, marginRight: 4 }}>引用</span>
                    {c.quoted_text.length > 80 ? c.quoted_text.slice(0,80)+'…' : c.quoted_text}
                  </div>
                )}
                <div style={{ fontSize: 14, color: 'var(--color-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
                  <button onClick={() => toggleLike(c.id)} disabled={!userId}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: userId ? 'pointer' : 'default', fontSize: 12, color: likedComments.has(c.id) ? 'var(--color-danger)' : 'var(--color-text-muted)', padding: 0 }}>
                    {likedComments.has(c.id) ? '♥' : '♡'} {c.like_count > 0 && c.like_count}
                  </button>
                  {userId && (
                    <button onClick={() => { setReplyTo(replyTo?.id === c.id ? null : { id: c.id, name: c.display_name }); setReplyBody('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: replyTo?.id === c.id ? 'var(--color-brand)' : 'var(--color-text-muted)', padding: 0, fontWeight: replyTo?.id === c.id ? 700 : 400 }}>
                      返信
                    </button>
                  )}
                  {userId === authorId && (
                    <button onClick={() => togglePin(c.id, c.is_pinned)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-muted)', padding: 0 }}>
                      {c.is_pinned ? 'ピン解除' : 'ピン留め'}
                    </button>
                  )}
                  {(userId === c.user_id || userId === authorId) && (
                    <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-danger)', padding: 0 }}>
                      削除
                    </button>
                  )}
                </div>

                {/* 返信入力欄 */}
                {replyTo?.id === c.id && (
                  <div style={{ marginTop: 10, background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>{c.display_name}さんへ返信</div>
                    <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="返信を書く"
                      style={{ width: '100%', minHeight: 50, padding: '8px 10px', border: '1px solid var(--color-brand-border)', borderRadius: 6, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', background: 'var(--color-bg-card)', color: 'var(--color-text)' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                      <button onClick={() => { setReplyTo(null); setReplyBody('') }} style={{ background: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer' }}>キャンセル</button>
                      <button onClick={handleReplySubmit} disabled={replyPosting || !replyBody.trim()}
                        style={{ background: 'var(--color-brand)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: replyPosting || !replyBody.trim() ? 'not-allowed' : 'pointer', opacity: replyPosting || !replyBody.trim() ? 0.5 : 1 }}>
                        {replyPosting ? '送信中...' : '返信する'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 返信一覧 */}
                {c.replies && c.replies.length > 0 && (
                  <div style={{ marginTop: 10, paddingLeft: 14, borderLeft: '2px solid var(--color-brand-light)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {c.replies.map(r => (
                      <div key={r.id} style={{ display: 'flex', gap: 8 }}>
                        {r.icon_url ? (
                          <img src={r.icon_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-brand-light)', color: 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                            {(r.display_name || '?')[0]}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                            <Link href={`/author/${r.user_id}`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', textDecoration: 'none' }}>{r.display_name}</Link>
                            {r.user_id === authorId && <span style={{ fontSize: 9, background: 'var(--color-brand)', color: 'var(--color-text-inverse)', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>作者</span>}
                            <span style={{ fontSize: 10, color: 'var(--color-text-faint)', marginLeft: 'auto' }}>{fmtDate(r.created_at)}</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.body}</div>
                          {(userId === r.user_id || userId === authorId) && (
                            <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-danger)', padding: 0, marginTop: 4 }}>削除</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
    {prompt}
    </>
  )
}
