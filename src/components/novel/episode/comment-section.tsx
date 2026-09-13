'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLoginRequired } from '@/hooks/use-login-required'
import Link from 'next/link'
import { useQuote } from '@/components/novel/episode/quote-context'
import ReportButton from '@/components/common/report-button'

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
  /**
   * 見ている人が運営か。
   *
   * 決まりの側では運営も消せるようにしてあるのに、
   * 画面が運営かどうかを知らないので、
   * 押し具が出ていなかった。
   */
  isAdmin?: boolean
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

export default function CommentSection({ novelId, episodeId, userId, userName, userIconUrl, authorId, isAdmin = false, comments: initialComments }: Props) {
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

  /*
   * コメントを読み終えたか。
   *
   * ★ 読む前に「まだ感想がありません」を出さない。
   *   読む前は必ず 0 件なので、
   *   コメントが付いている話でも一瞬それが出る。
   */
  const [loaded, setLoaded] = useState(false)
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [posting, setPosting] = useState(false)

  /*
   * 書いたあとの知らせ。
   *
   * 承認待ちのとき、書いたのに出てこないと
   * 失敗したと思って二度書くことになる。
   */
  const [notice, setNotice] = useState('')
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

    /*
     * その話のコメントだけを頼む。
     *
     * 渡さないと作品ぜんぶが返り、
     * 第3話の感想が第1話にも並ぶ。
     */
    setLoaded(false)

    fetch(`/api/novel/${novelId}/comments?episode=${encodeURIComponent(episodeId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!alive) return
        if (data?.comments) setComments(buildTree(data.comments))
        setLoaded(true)
      })
      .catch(() => {
        /* 届かなくても、本文は読める */
        if (alive) setLoaded(true)
      })

    return () => { alive = false }
    /*
     * 話が変わったら読み直す。
     * episodeId を見ていないと、次の話へ進んだときに
     * 前の話のコメントが残ったままになる。
     */
  }, [novelId, episodeId, initialComments.length])

  useEffect(() => {
    if (quotedText && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [quotedText])

  /*
   * 通知から来たとき、その感想まで送る。
   *
   * ★ 住所の後ろに #comment-〇〇 が付いている。
   *
   *   ブラウザの標準の飛び先だけでは届かない。
   *   感想は後から読み込むので、飛ぼうとした時点では
   *   まだ画面に無い。読み込み終えてから自分で送る。
   *
   * ★ 少しのあいだ色を付ける。
   *   どれのことか、見て分かるようにする。
   */
  useEffect(() => {
    if (comments.length === 0) return
    if (typeof window === 'undefined') return

    const hash = window.location.hash
    if (!hash.startsWith('#comment-')) return

    /*
     * ★ 何度か探しに行く。
     *
     *   一度きりだと、返信がまだ描かれていないときに空振りする。
     *   0.3 秒ごとに、見つかるまで 10 回まで探す。
     */
    let tries = 0
    let colorTimer = 0

    const finder = window.setInterval(() => {
      tries += 1

      const found = document.getElementById(hash.slice(1))
      if (!found) {
        if (tries >= 10) window.clearInterval(finder)
        return
      }

      window.clearInterval(finder)
      found.scrollIntoView({ behavior: 'smooth', block: 'center' })

      const before = found.style.background
      found.style.background = 'var(--color-brand-light)'
      colorTimer = window.setTimeout(() => { found.style.background = before }, 2400)
    }, 300)

    return () => {
      window.clearInterval(finder)
      if (colorTimer) window.clearTimeout(colorTimer)
    }
  }, [comments])

  useEffect(() => {
    if (!userId) return guard('感想を書く', () => {})()
    /*
     * どれに いいね を付けているか。
     *
     * ★ 返信も数に入れる。
     *
     *   前は親のコメントだけを見ていた。
     *   返信に いいね を付けても、開き直すと白い心のままだった。
     */
    const commentIds = comments.flatMap(c => [c.id, ...(c.replies || []).map(r => r.id)])
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

    /*
     * ★ 承認が要る作品か、書く直前に見る。
     *
     *   作者が「承認後に公開」にしているなら、
     *   書き込みは未承認として入れる。
     *   作者が認めるまで、ほかの人には出ない。
     *
     * ★ 読めなかったときは、承認済みとして入れる。
     *
     *   設定が読めないせいで書き込みが消えるのは、
     *   書いた人にとって理不尽。
     *   黙って出ないより、出るほうがまし。
     */
    let needsApproval = false
    try {
      const { data: work } = await supabase
        .from('novels')
        .select('moderate_comments')
        .eq('id', novelId)
        .maybeSingle()

      needsApproval = work?.moderate_comments === true
    } catch {
      /* 読めなくても、書き込みは通す */
    }

    const insertData: any = {
      novel_id: novelId,
      episode_id: episodeId,
      user_id: userId,
      body: trimmed,
      quoted_text: quotedText || null,
      is_approved: !needsApproval,
    }
    if (rating > 0) insertData.rating = rating

    const { data, error } = await supabase.from('comments').insert(insertData).select().single()

    if (!error && data && needsApproval) {
      /*
       * ★ 承認待ちであることを、その場で伝える。
       *
       *   書いたのに出てこないと、
       *   失敗したと思って二度書くことになる。
       */
      setNotice('この作品は、作者が確認してから公開されます。')
      setBody('')
      setRating(0)
      setPosting(false)
      return
    }

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

      /*
       * 作者に知らせる。
       *
       * ★ 渡すのは comment_id だけ。
       *   宛先も文も、受け口の側で組み立てる。
       */
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: data.id }),
      }).catch(() => {})
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

      /* 返された相手に知らせる。自分あては受け口の側で外す */
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: data.id }),
      }).catch(() => {})

      setReplyBody('')
      setReplyTo(null)
    }
    setReplyPosting(false)
  }

  /*
   * いいね の数を、親でも返信でも書き換える。
   *
   * ★ 返信は c.replies の中にいる。
   *
   *   前は親だけを見ていたので、返信の いいね は
   *   表には入るのに、画面の数が動かなかった。
   *   押しても何も起きないように見える。
   */
  function applyLikeCount(list: Comment[], commentId: string, diff: number): Comment[] {
    return list.map(c => {
      if (c.id === commentId) {
        return { ...c, like_count: Math.max(0, c.like_count + diff) }
      }
      if (c.replies?.some(r => r.id === commentId)) {
        return {
          ...c,
          replies: c.replies.map(r =>
            r.id === commentId ? { ...r, like_count: Math.max(0, r.like_count + diff) } : r
          ),
        }
      }
      return c
    })
  }

  async function toggleLike(commentId: string) {
    if (!userId) return guard('いいねする', () => {})()
    const isLiked = likedComments.has(commentId)
    if (isLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId)
      setLikedComments(prev => { const s = new Set(prev); s.delete(commentId); return s })
      setComments(prev => applyLikeCount(prev, commentId, -1))
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId })
      setLikedComments(prev => new Set(prev).add(commentId))
      setComments(prev => applyLikeCount(prev, commentId, 1))
    }
  }

  async function handleDelete(commentId: string) {
    /*
     * 運営が消すときは、そう分かる文にする。
     * 自分のものを消すのと、他人のものを消すのとでは重みが違う。
     */
    const isMine = comments.some(c =>
      (c.id === commentId && c.user_id === userId)
      /* 返信は入れ子になっているので、そちらも見る */
      || (c.replies || []).some(r => r.id === commentId && r.user_id === userId)
    )
    const message = isMine
      ? 'このコメントを削除しますか？'
      : '他の人のコメントを削除します。よろしいですか？'
    if (!confirm(message)) return

    /*
     * 消えたことを確かめてから、画面からも消す。
     *
     * 前は確かめずに画面から先に消していた。
     * 表の側で弾かれても消えたように見え、
     * 開き直すと戻ってくる。
     * 嫌がらせのコメントを消したつもりで、消せていなかった。
     */
    const { error, count } = await supabase
      .from('comments')
      .delete({ count: 'exact' })
      .eq('id', commentId)

    if (error) {
      window.alert(`削除できませんでした：${error.message}`)
      return
    }
    if (!count) {
      window.alert('削除できませんでした。権限がないか、すでに消えています。')
      return
    }

    setComments(prev => prev
      .filter(c => c.id !== commentId)
      .map(c => ({ ...c, replies: (c.replies || []).filter(r => r.id !== commentId) }))
    )
  }

  async function togglePin(commentId: string, current: boolean) {
    /* 固定も同じ。効かなかったことを黙って飲まない */
    const { error } = await supabase
      .from('comments')
      .update({ is_pinned: !current })
      .eq('id', commentId)

    if (error) {
      window.alert(`固定を変えられませんでした：${error.message}`)
      return
    }

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
    {/*
      * まだ感想が無いときの誘い。
      *
      * ★ ここで出す。前は話の頁の側にあった。
      *
      *   あちらはコメントを読んでいない（読むのはこの部品）。
      *   いつも 0 件として見ていたので、
      *   コメントが付いていても「まだ感想がありません」が出ていた。
      *
      *   数を持っている側が出す。
      */}
    {loaded && comments.length === 0 && (
      <div style={{ background: 'var(--color-brand-light)', border: '1.5px solid var(--color-brand-border)', borderRadius: 12, padding: '18px 20px', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>✍️</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand)', marginBottom: 4 }}>まだ感想がありません</div>
        <div style={{ fontSize: 12, color: 'var(--color-text)', lineHeight: 1.7 }}>
          あなたの一言が、作者の次の一話につながります。<br/>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>最初の感想を書いてみませんか？</span>
        </div>
      </div>
    )}

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
            <button onClick={() => {
                const next = !selecting
                setSelecting(next)

                /*
                 * 入れたら、本文の頭まで戻す。
                 *
                 * ★ この押し具は本文のずっと下にある。
                 *   押しても画面はここのまま。
                 *   「文を押してください」と出ても、
                 *   その本文が画面に無かった。
                 */
                if (next) {
                  document
                    .querySelector('[data-sentence="0"]')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', marginBottom: 10, background: selecting ? 'var(--color-brand-light)' : 'var(--color-bg-card)', border: `1.5px dashed ${selecting ? 'var(--color-brand)' : 'var(--color-brand-border)'}`, borderRadius: 8, fontSize: 12, color: selecting ? 'var(--color-brand)' : 'var(--color-text-muted)', cursor: 'pointer', fontWeight: 500 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              {selecting ? '本文の文を押してください（もう一度押すと取り消し）' : '本文から引用する（なぞっても引けます）'}
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
          {/*
            * 書いたあとの知らせ。
            *
            * 承認待ちのときに出す。
            * 出ないと、書いたのに消えたと思われる。
            */}
          {notice && (
            <p style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6,
              background: 'var(--color-brand-light)', color: 'var(--color-brand)',
              fontSize: 12, lineHeight: 1.7 }}>
              {notice}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={handleSubmit} disabled={posting || !body.trim()}
              style={{ background: 'var(--color-brand)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: posting || !body.trim() ? 'not-allowed' : 'pointer', opacity: posting || !body.trim() ? 0.5 : 1 }}>
              {posting ? '投稿中...' : '投稿する'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px 16px', textAlign: 'center', borderBottom: '1px solid var(--color-brand-light)' }}>
          {/* 入ったあと、いま読んでいる話へ戻す */}
          <Link href={`/login?next=${encodeURIComponent(`/novel/${novelId}/episode/${episodeId}`)}`} style={{ fontSize: 13, color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 600 }}>ログインしてコメントする</Link>
        </div>
      )}

      {/* コメント一覧 */}
      {sortedComments.length === 0 ? (
        <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-faint)' }}>
          まだコメントがありません
        </div>
      ) : (
        sortedComments.map((c, i) => (
          /* 通知から、この感想へ直に来られるようにする目印 */
          <div key={c.id} id={`comment-${c.id}`} style={{ scrollMarginTop: 80, padding: '14px 16px', margin: '0 12px 10px', border: `1px solid ${c.is_pinned ? 'var(--color-brand)' : 'var(--color-brand-border)'}`, borderRadius: 12, background: c.is_pinned ? 'var(--color-brand-light)' : 'var(--color-bg-card)' }}>
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
                  {/* 通報。自分のものには出ない（部品の側で判断） */}
                  <ReportButton
                    target="comment"
                    targetId={c.id}
                    accusedId={c.user_id}
                    accusedName={c.display_name}
                    quotedBody={c.body}
                    userId={userId}
                    userName={userName}
                  />

                  {(userId === c.user_id || userId === authorId || isAdmin) && (
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
                      /* 返信にも目印。通知はここへ飛ぶことがある */
                      <div key={r.id} id={`comment-${r.id}`} style={{ scrollMarginTop: 80, display: 'flex', gap: 8 }}>
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
                          {/*
                            * 返信の いいね。
                            *
                            * ★ 親のコメントと同じ形にする。
                            *
                            *   返信にだけ押し具が無く、返された側は
                            *   受け取ったことを返す手立てが無かった。
                            */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                            <button onClick={() => toggleLike(r.id)} disabled={!userId}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: userId ? 'pointer' : 'default', fontSize: 11, color: likedComments.has(r.id) ? 'var(--color-danger)' : 'var(--color-text-muted)', padding: 0 }}>
                              {likedComments.has(r.id) ? '♥' : '♡'} {r.like_count > 0 && r.like_count}
                            </button>
                            {(userId === r.user_id || userId === authorId || isAdmin) && (
                              <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-danger)', padding: 0 }}>削除</button>
                            )}
                          </div>
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
