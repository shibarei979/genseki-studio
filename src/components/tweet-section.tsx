'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Tweet {
  id: string
  user_id: string
  body: string
  image_url: string | null
  created_at: string
  display_name: string
  icon_url: string | null
  like_count: number
  comment_count: number
  liked: boolean
  comments: TweetComment[]
  showComments: boolean
  showCount: number
}

interface TweetComment {
  id: string
  user_id: string
  body: string
  created_at: string
  display_name: string
  icon_url: string | null
}

interface Props {
  authorId: string
  currentUserId: string | null
  currentUserName: string | null
  currentUserIconUrl: string | null
  isOwner: boolean
}

function fmtDate(s: string) {
  const d = new Date(s), now = new Date(), diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'たった今'
  if (diff < 3600000) return `${Math.floor(diff/60000)}分前`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}時間前`
  if (diff < 604800000) return `${Math.floor(diff/86400000)}日前`
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`
}

function Avatar({ name, iconUrl, size=32 }: { name: string; iconUrl?: string | null; size?: number }) {
  if (iconUrl) return <img src={iconUrl} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}} alt=""/>
  return <div style={{width:size,height:size,borderRadius:'50%',background:'var(--color-brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.38,fontWeight:700,color:'var(--color-bg-card)',flexShrink:0}}>{name?.[0]||'?'}</div>
}

// 線画アイコン
const IconImage = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
)
const IconHeart = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
const IconComment = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

export default function TweetSection({ authorId, currentUserId, currentUserName, currentUserIconUrl, isOwner }: Props) {
  const supabase = createClient()
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [commentBody, setCommentBody] = useState<Record<string, string>>({})
  const [commentPosting, setCommentPosting] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadTweets()
  }, [authorId])

  async function loadTweets() {
    setLoading(true)
    const { data: tweetsData } = await supabase
      .from('tweets')
      .select('id, user_id, body, image_url, created_at')
      .eq('user_id', authorId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!tweetsData || tweetsData.length === 0) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, icon_url')
      .eq('user_id', authorId)
      .single()

    const tweetIds = tweetsData.map(t => t.id)
    const { data: likesData } = await supabase
      .from('tweet_likes')
      .select('tweet_id, user_id')
      .in('tweet_id', tweetIds)

    const { data: commentsData } = await supabase
      .from('tweet_comments')
      .select('id, tweet_id, user_id, body, created_at')
      .in('tweet_id', tweetIds)
      .order('created_at', { ascending: true })

    const commentUserIds = Array.from(new Set((commentsData||[]).map(c => c.user_id)))
    const commentProfileMap: Record<string, any> = {}
    if (commentUserIds.length > 0) {
      const { data: cProfiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, icon_url')
        .in('user_id', commentUserIds)
      cProfiles?.forEach(p => { commentProfileMap[p.user_id] = p })
    }

    const likeMap: Record<string, number> = {}
    const likedSet = new Set<string>()
    likesData?.forEach(l => {
      likeMap[l.tweet_id] = (likeMap[l.tweet_id]||0) + 1
      if (l.user_id === currentUserId) likedSet.add(l.tweet_id)
    })

    const commentMap: Record<string, TweetComment[]> = {}
    commentsData?.forEach(c => {
      if (!commentMap[c.tweet_id]) commentMap[c.tweet_id] = []
      commentMap[c.tweet_id].push({
        id: c.id, user_id: c.user_id, body: c.body, created_at: c.created_at,
        display_name: commentProfileMap[c.user_id]?.display_name || '不明',
        icon_url: commentProfileMap[c.user_id]?.icon_url || null,
      })
    })

    setTweets(tweetsData.map(t => ({
      ...t,
      display_name: profile?.display_name || '',
      icon_url: profile?.icon_url || null,
      like_count: likeMap[t.id] || 0,
      comment_count: (commentMap[t.id] || []).length,
      liked: likedSet.has(t.id),
      comments: commentMap[t.id] || [],
      showComments: false,
      showCount: 5,
    })))
    setLoading(false)
  }

  async function handlePost() {
    if (!currentUserId || !body.trim()) return
    setPosting(true)
    let imageUrl: string | null = null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `tweets/${currentUserId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('illustrations').upload(path, imageFile)
      if (!upErr) {
        const { data } = supabase.storage.from('illustrations').getPublicUrl(path)
        imageUrl = data.publicUrl
      }
    }

    const { data, error } = await supabase
      .from('tweets')
      .insert({ user_id: currentUserId, body: body.trim(), image_url: imageUrl })
      .select('id, user_id, body, image_url, created_at')
      .single()

    setPosting(false)
    if (error || !data) return

    const newTweet: Tweet = {
      ...data,
      display_name: currentUserName || '',
      icon_url: currentUserIconUrl || null,
      like_count: 0, comment_count: 0,
      liked: false, comments: [], showComments: false, showCount: 5,
    }
    setTweets(prev => [newTweet, ...prev])
    setBody('')
    setImageFile(null)
    setImagePreview(null)
  }

  async function handleLike(tweetId: string, liked: boolean) {
    if (!currentUserId) return
    if (liked) {
      await supabase.from('tweet_likes').delete().eq('user_id', currentUserId).eq('tweet_id', tweetId)
    } else {
      await supabase.from('tweet_likes').insert({ user_id: currentUserId, tweet_id: tweetId })
    }
    setTweets(prev => prev.map(t => t.id === tweetId
      ? { ...t, liked: !liked, like_count: liked ? t.like_count-1 : t.like_count+1 }
      : t
    ))
  }

  async function handleComment(tweetId: string) {
    if (!currentUserId || !commentBody[tweetId]?.trim()) return
    setCommentPosting(prev => ({...prev, [tweetId]: true}))
    const { data, error } = await supabase
      .from('tweet_comments')
      .insert({ user_id: currentUserId, tweet_id: tweetId, body: commentBody[tweetId].trim() })
      .select('id, user_id, body, created_at')
      .single()
    setCommentPosting(prev => ({...prev, [tweetId]: false}))
    if (error || !data) return

    const newComment: TweetComment = {
      ...data,
      display_name: currentUserName || '',
      icon_url: currentUserIconUrl || null,
    }
    setTweets(prev => prev.map(t => t.id === tweetId
      ? { ...t, comments: [...t.comments, newComment], comment_count: t.comment_count+1, showComments: true }
      : t
    ))
    setCommentBody(prev => ({...prev, [tweetId]: ''}))
  }

  async function handleDelete(tweetId: string) {
    if (!confirm('このつぶやきを削除しますか？')) return
    await supabase.from('tweets').delete().eq('id', tweetId).eq('user_id', currentUserId!)
    setTweets(prev => prev.filter(t => t.id !== tweetId))
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  if (!isOwner && tweets.length === 0 && !loading) return null

  return (
    <div>
      {!isOwner && <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:12}}>つぶやき</div>}
      {isOwner && (
        <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'20px',marginBottom:20,boxShadow:'0 1px 3px rgba(0,0,0,0.02)'}}>
          <div style={{display:'flex',gap:12}}>
            <Avatar name={currentUserName||''} iconUrl={currentUserIconUrl} size={40}/>
            <div style={{flex:1}}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="今何してる？近況や作品の進捗を共有しよう"
                style={{width:'100%',padding:'12px 14px',border:'1px solid #dcdfda',borderRadius:10,fontSize:14,resize:'none',outline:'none',fontFamily:'inherit',boxSizing:'border-box',lineHeight:1.7}}
              />
              {imagePreview && (
                <div style={{position:'relative',display:'inline-block',marginTop:10}}>
                  <img src={imagePreview} style={{maxHeight:120,maxWidth:240,borderRadius:10,display:'block',objectFit:'cover'}} alt="preview"/>
                  <button onClick={()=>{setImageFile(null);setImagePreview(null)}}
                    style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'var(--color-bg-card)',border:'none',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <button onClick={()=>fileInputRef.current?.click()}
                    style={{display:'inline-flex',alignItems:'center',gap:6,height:36,padding:'0 14px',border:'1px solid #dcdfda',borderRadius:10,fontSize:13,color:'var(--color-text-muted)',background:'var(--color-bg-card)',cursor:'pointer'}}>
                    <IconImage/>
                    画像
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageSelect}/>
                  <span style={{fontSize:12,color:'var(--color-text-faint)'}}>{body.length}/500</span>
                </div>
                <button onClick={handlePost} disabled={posting||!body.trim()}
                  style={{height:40,padding:'0 24px',background:'var(--color-brand)',color:'var(--color-text-inverse)',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',opacity:posting||!body.trim()?0.5:1}}>
                  {posting ? '投稿中...' : '投稿'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:'32px',color:'var(--color-text-faint)',fontSize:14}}>読み込み中...</div>
      ) : tweets.length === 0 ? (
        isOwner ? (
          <div style={{textAlign:'center',padding:'56px 24px',color:'var(--color-text-faint)',fontSize:14,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16}}>
            まだつぶやきがありません。上の入力欄から投稿できます。
          </div>
        ) : null
      ) : tweets.map(tweet => (
        <div key={tweet.id} style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,marginBottom:16,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.02)'}}>
          <div style={{padding:'20px 22px'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <Avatar name={tweet.display_name} iconUrl={tweet.icon_url} size={40}/>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>{tweet.display_name}</div>
                <div style={{fontSize:12,color:'var(--color-text-faint)',marginTop:2}}>{fmtDate(tweet.created_at)}</div>
              </div>
              {isOwner && (
                <button onClick={()=>handleDelete(tweet.id)}
                  style={{fontSize:12,color:'var(--color-text-faint)',background:'none',border:'none',cursor:'pointer',padding:'4px 8px'}}>
                  削除
                </button>
              )}
            </div>

            <div style={{fontSize:14.5,color:'var(--color-text)',lineHeight:1.85,whiteSpace:'pre-wrap',marginBottom:tweet.image_url?12:14}}>
              {tweet.body}
            </div>

            {tweet.image_url && (
              <img src={tweet.image_url} style={{maxWidth:'100%',maxHeight:280,objectFit:'contain',borderRadius:10,display:'block',marginBottom:14}} alt=""/>
            )}

            <div style={{display:'flex',alignItems:'center',gap:10,paddingTop:12,borderTop:'1px solid #f4f5f3'}}>
              <button onClick={()=>handleLike(tweet.id, tweet.liked)}
                style={{display:'inline-flex',alignItems:'center',gap:6,height:34,padding:'0 14px',borderRadius:10,border:'1px solid',fontSize:13,cursor:currentUserId?'pointer':'default',
                  background:tweet.liked?'#FEF2F2':'var(--color-bg-card)',
                  borderColor:tweet.liked?'#FCA5A5':'#dcdfda',
                  color:tweet.liked?'var(--color-danger)':'var(--color-text-muted)'}}>
                <IconHeart filled={tweet.liked}/>
                {tweet.like_count}
              </button>
              <button onClick={()=>setTweets(prev=>prev.map(t=>t.id===tweet.id?{...t,showComments:!t.showComments}:t))}
                style={{display:'inline-flex',alignItems:'center',gap:6,height:34,padding:'0 14px',borderRadius:10,border:'1px solid',fontSize:13,cursor:'pointer',
                  background:tweet.showComments?'#eef2f5':'var(--color-bg-card)',
                  borderColor:tweet.showComments?'var(--color-brand)':'#dcdfda',
                  color:tweet.showComments?'var(--color-brand)':'var(--color-text-muted)'}}>
                <IconComment/>
                {tweet.comment_count}
              </button>
            </div>
          </div>

          {tweet.showComments && (
            <div style={{borderTop:'1px solid var(--color-brand-border)',background:'var(--color-bg)'}}>
              {currentUserId && (
                <div style={{display:'flex',gap:10,padding:'14px 22px',alignItems:'center',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg-card)'}}>
                  <Avatar name={currentUserName||''} iconUrl={currentUserIconUrl} size={28}/>
                  <input
                    value={commentBody[tweet.id]||''}
                    onChange={e=>setCommentBody(prev=>({...prev,[tweet.id]:e.target.value}))}
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleComment(tweet.id)}}}
                    placeholder="コメントを入力..."
                    maxLength={200}
                    style={{flex:1,height:38,padding:'0 14px',border:'1px solid #dcdfda',borderRadius:10,fontSize:13,outline:'none'}}
                  />
                  <button onClick={()=>handleComment(tweet.id)} disabled={commentPosting[tweet.id]||!commentBody[tweet.id]?.trim()}
                    style={{height:38,padding:'0 16px',background:'var(--color-brand)',color:'var(--color-text-inverse)',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',opacity:commentPosting[tweet.id]||!commentBody[tweet.id]?.trim()?0.5:1}}>
                    送信
                  </button>
                </div>
              )}
              {tweet.comments.slice(0, tweet.showCount||5).map(c => (
                <div key={c.id} style={{display:'flex',gap:10,padding:'14px 22px',borderBottom:'1px solid #f4f5f3'}}>
                  <Avatar name={c.display_name} iconUrl={c.icon_url} size={28}/>
                  <div>
                    <span style={{fontSize:13,fontWeight:600,color:'var(--color-text)',marginRight:8}}>{c.display_name}</span>
                    <span style={{fontSize:11.5,color:'var(--color-text-faint)'}}>{fmtDate(c.created_at)}</span>
                    <div style={{fontSize:13,color:'var(--color-text)',marginTop:4,lineHeight:1.7}}>{c.body}</div>
                  </div>
                </div>
              ))}
              {tweet.comments.length > (tweet.showCount||5) && (
                <div style={{padding:'12px 22px',textAlign:'center'}}>
                  <button
                    onClick={()=>setTweets(prev=>prev.map(t=>t.id===tweet.id?{...t,showCount:(t.showCount||5)+5}:t))}
                    style={{fontSize:13,color:'var(--color-brand)',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>
                    もっと表示する（残り{tweet.comments.length-(tweet.showCount||5)}件）
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
