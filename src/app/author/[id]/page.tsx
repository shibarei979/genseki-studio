import { createClient } from '@/lib/supabase/server'
import GuestFollowButton from '@/components/guest-follow-button'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import TweetSection from '@/components/tweet-section'
import MessageButton from '@/components/community/message-button'
import Link from 'next/link'
import FollowButton from '@/components/follow-button'
import BlockButton from '@/components/block-button'

interface Props { params: { id: string } }

export default async function AuthorPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    profile = data
  }

  const { data: author } = await supabase
    .from('profiles')
    .select('user_id, display_name, icon_url, bio, user_number, created_at, x_account')
    .eq('user_id', params.id)
    .single()

  if (!author) notFound()

  const { data: novels } = await supabase
    .from('novels')
    .select('id, title, genre, summary, tags, novel_type, is_serial, created_at, is_r18')
    .eq('author_id', params.id)
    /*
     * 公開されているものだけ。
     *
     * published は GENSEKIKORO 側の印、
     * visibility は Studio 側の印。
     * 両方を見ないと、下書きが表に出る。
     */
    .eq('published', true)
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  /*
   * 1 話も投稿していない作品は一覧に出さない。
   *
   * 開いても空の目次しか無く、作品ページ側でも弾いている。
   * ここに出したままだと、押した先が「見つかりません」になる。
   */
  const listedIds = (novels || []).map((n: any) => n.id)
  const publishedEpisodeNovelIds = new Set<string>()
  if (listedIds.length > 0) {
    const { data: liveEps } = await supabase
      .from('episodes')
      .select('novel_id')
      .in('novel_id', listedIds)
      .eq('is_published', true)
    for (const row of liveEps || []) publishedEpisodeNovelIds.add(row.novel_id)
  }

  const filteredNovels = (novels || []).filter((n: any) =>
    publishedEpisodeNovelIds.has(n.id) && (user ? true : !n.is_r18)
  )

  // シリーズ取得
  const { data: seriesList } = await supabase
    .from('series').select('id, title, description')
    .eq('user_id', params.id).order('order_num')
  const seriesIds = (seriesList || []).map((s: any) => s.id)
  const seriesNovelsMap: Record<string, any[]> = {}
  if (seriesIds.length > 0) {
    const { data: sn } = await supabase
      .from('series_novels')
      .select('series_id, order_num, novels(id, title, genre, novel_type, is_serial, is_r18, summary)')
      .in('series_id', seriesIds).order('order_num')
    ;(sn || []).forEach((s: any) => {
      if (!seriesNovelsMap[s.series_id]) seriesNovelsMap[s.series_id] = []
      seriesNovelsMap[s.series_id].push({ ...s.novels, order_num: s.order_num })
    })
  }

  const novelIds = filteredNovels.map((n: any) => n.id)
  const likeMap: Record<string, number> = {}
  if (novelIds.length > 0) {
    const { data: likes } = await supabase.from('likes').select('novel_id').in('novel_id', novelIds)
    likes?.forEach((l: any) => { likeMap[l.novel_id] = (likeMap[l.novel_id] || 0) + 1 })
  }

  const { count: followerCount } = await supabase
    .from('follows').select('*', { count: 'exact', head: true })
    .eq('following_id', params.id)

  let isFollowing = false
  let isBlocked = false
  let isMuted = false
  if (user && user.id !== params.id) {
    const [followRes, blockRes, muteRes] = await Promise.all([
      supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', params.id).maybeSingle(),
      supabase.from('user_blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', params.id).maybeSingle(),
      supabase.from('user_mutes').select('id').eq('muter_id', user.id).eq('muted_id', params.id).maybeSingle(),
    ])
    isFollowing = !!followRes.data
    isBlocked   = !!blockRes.data
    isMuted     = !!muteRes.data
  }

  const isMe = user?.id === params.id
  const joinDate = new Date(author.created_at)
  const joinStr = `${joinDate.getFullYear()}年${joinDate.getMonth() + 1}月`
  const totalLikes = Object.values(likeMap).reduce((a, b) => a + b, 0)

  const NovelList = () => (
    <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>
      {filteredNovels.length === 0 ? (
        <div style={{padding:'48px',textAlign:'center',color:'var(--color-text-faint)',fontSize:13}}>
          公開中の作品はありません
        </div>
      ) : filteredNovels.map((n: any, i: number) => (
        <Link key={n.id} href={`/novel/${n.id}`} style={{textDecoration:'none',display:'block'}}>
          <div style={{padding:'14px 16px',borderBottom:i<filteredNovels.length-1?'1px solid var(--color-brand-light)':'none',background:i%2===0?'var(--color-bg-card)':'#fbfcfc',cursor:'pointer'}}>
            <div style={{display:'flex',gap:6,marginBottom:5,flexWrap:'wrap',alignItems:'center'}}>
              <span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',padding:'1px 6px',borderRadius:3}}>{n.genre}</span>
              <span style={{fontSize:10,background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'1px 6px',borderRadius:3}}>{n.novel_type}</span>
              {n.is_serial
                ? <span style={{fontSize:10,background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',padding:'1px 6px',borderRadius:3}}>連載中</span>
                : <span style={{fontSize:10,background:'#f5f5f5',color:'#757575',border:'1px solid #e0e0e0',padding:'1px 6px',borderRadius:3}}>完結</span>}
              {n.is_r18 && <span style={{fontSize:10,background:'#fef2f2',color:'var(--color-danger)',border:'1px solid #fca5a5',padding:'1px 6px',borderRadius:3}}>R18</span>}
            </div>
            <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:3}}>{n.title}</div>
            <div style={{fontSize:11,color:'var(--color-text-muted)',marginBottom:n.summary?5:0}}>♡ {likeMap[n.id]||0}</div>
            {n.summary && (
              <div style={{fontSize:12,color:'var(--color-text)',lineHeight:1.8,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any}}>
                {n.summary}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )

  // シリーズに属する作品IDのセット
  const seriesNovelIds = new Set(
    Object.values(seriesNovelsMap).flat().map((n: any) => n.id)
  )
  const nonSeriesNovels = filteredNovels.filter((n: any) => !seriesNovelIds.has(n.id))

  const NovelListWithSeries = () => (
    <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>
      {filteredNovels.length === 0 ? (
        <div style={{padding:'48px',textAlign:'center',color:'var(--color-text-faint)',fontSize:13}}>公開中の作品はありません</div>
      ) : (
        <>
          {/* シリーズ（折りたたみ） */}
          {(seriesList||[]).map((s: any) => {
            const sNovels = seriesNovelsMap[s.id] || []
            if (sNovels.length === 0) return null
            return (
              <details key={s.id} style={{borderBottom:'1px solid var(--color-brand-light)'}}>
                <summary style={{padding:'12px 16px',cursor:'pointer',listStyle:'none',display:'flex',alignItems:'center',gap:10,background:'var(--color-bg-card)'}}>
                  <span style={{fontSize:10,background:'var(--color-brand)',color:'var(--color-text-inverse)',padding:'1px 7px',borderRadius:10,fontWeight:700,flexShrink:0}}>シリーズ</span>
                  <span style={{fontSize:14,fontWeight:700,color:'var(--color-text)',flex:1}}>{s.title}</span>
                  <span style={{fontSize:11,color:'var(--color-text-faint)'}}>{sNovels.length}作品 ▼</span>
                </summary>
                {s.description && (
                  <div style={{padding:'6px 16px 0',fontSize:12,color:'var(--color-text-muted)'}}>{s.description}</div>
                )}
                {sNovels.map((n: any, i: number) => (
                  <Link key={n.id} href={`/novel/${n.id}`} style={{textDecoration:'none',display:'block'}}>
                    <div style={{padding:'14px 16px',borderTop:'1px solid var(--color-brand-light)',background:i%2===0?'var(--color-bg-card)':'#fbfcfc',cursor:'pointer'}}>
                      <div style={{display:'flex',gap:6,marginBottom:5,flexWrap:'wrap',alignItems:'center'}}>
                        <span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',padding:'1px 6px',borderRadius:3}}>{n.genre}</span>
                        <span style={{fontSize:10,background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'1px 6px',borderRadius:3}}>{n.novel_type}</span>
                        {n.is_serial
                          ? <span style={{fontSize:10,background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',padding:'1px 6px',borderRadius:3}}>連載中</span>
                          : <span style={{fontSize:10,background:'#f5f5f5',color:'#757575',border:'1px solid #e0e0e0',padding:'1px 6px',borderRadius:3}}>完結</span>}
                        {n.is_r18 && <span style={{fontSize:10,background:'#fef2f2',color:'var(--color-danger)',border:'1px solid #fca5a5',padding:'1px 6px',borderRadius:3}}>R18</span>}
                      </div>
                      <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:3}}>{n.title}</div>
                      <div style={{fontSize:11,color:'var(--color-text-muted)',marginBottom:n.summary?5:0}}>♡ {likeMap[n.id]||0}</div>
                      {n.summary && (
                        <div style={{fontSize:12,color:'var(--color-text)',lineHeight:1.8,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any}}>
                          {n.summary}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </details>
            )
          })}
          {/* シリーズ外の作品 */}
          {nonSeriesNovels.map((n: any, i: number) => (
            <Link key={n.id} href={`/novel/${n.id}`} style={{textDecoration:'none',display:'block'}}>
              <div style={{padding:'14px 16px',borderBottom:i<nonSeriesNovels.length-1?'1px solid var(--color-brand-light)':'none',background:i%2===0?'var(--color-bg-card)':'#fbfcfc',cursor:'pointer'}}>
                <div style={{display:'flex',gap:6,marginBottom:5,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',padding:'1px 6px',borderRadius:3}}>{n.genre}</span>
                  <span style={{fontSize:10,background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'1px 6px',borderRadius:3}}>{n.novel_type}</span>
                  {n.is_serial
                    ? <span style={{fontSize:10,background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',padding:'1px 6px',borderRadius:3}}>連載中</span>
                    : <span style={{fontSize:10,background:'#f5f5f5',color:'#757575',border:'1px solid #e0e0e0',padding:'1px 6px',borderRadius:3}}>完結</span>}
                  {n.is_r18 && <span style={{fontSize:10,background:'#fef2f2',color:'var(--color-danger)',border:'1px solid #fca5a5',padding:'1px 6px',borderRadius:3}}>R18</span>}
                </div>
                <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:3}}>{n.title}</div>
                <div style={{fontSize:11,color:'var(--color-text-muted)',marginBottom:n.summary?5:0}}>♡ {likeMap[n.id]||0}</div>
                {n.summary && (
                  <div style={{fontSize:12,color:'var(--color-text)',lineHeight:1.8,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any}}>
                    {n.summary}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </>
      )}
    </div>
  )

  return (
    <div style={{minHeight:'100vh',fontFamily:"'Noto Sans JP',sans-serif"}}>
      <Header />

      {/* ===== デスクトップ ===== */}
      <div className="desktop-only" style={{maxWidth:1200,margin:'0 auto',padding:'28px 32px',display:'flex',gap:20,alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'28px',marginBottom:20}}>
            <div style={{display:'flex',gap:20,alignItems:'flex-start'}}>
              <div style={{flexShrink:0}}>
                {author.icon_url
                  ? <img src={author.icon_url} style={{width:80,height:80,borderRadius:'50%',objectFit:'cover'}} alt=""/>
                  : <div style={{width:80,height:80,borderRadius:'50%',background:'var(--color-brand-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,color:'var(--color-brand)',fontWeight:700}}>
                      {author.display_name?.[0] || '?'}
                    </div>
                }
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:6}}>
                  <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',margin:0}}>{author.display_name}</h1>
                  {!isMe && (
                    user ? (
                      <>
                      <FollowButton authorId={params.id} userId={user.id} initialFollowing={isFollowing} followerCount={followerCount || 0}/>
                      <MessageButton targetId={params.id} userId={user.id}/>
                      <BlockButton targetId={params.id} userId={user.id} initialBlocked={isBlocked} initialMuted={isMuted}/>
                      </>
                    ) : (
                      <GuestFollowButton followerCount={followerCount || 0}/>
                    )
                  )}
                </div>
                <div style={{display:'flex',gap:20,marginBottom:12,fontSize:13}}>
                  <div><strong style={{fontSize:16}}>{(followerCount||0).toLocaleString()}</strong><span style={{color:'var(--color-text-muted)',marginLeft:4}}>フォロワー</span></div>
                  <div><strong style={{fontSize:16}}>{filteredNovels.length}</strong><span style={{color:'var(--color-text-muted)',marginLeft:4}}>作品</span></div>
                  <div><strong style={{fontSize:16}}>{totalLikes.toLocaleString()}</strong><span style={{color:'var(--color-text-muted)',marginLeft:4}}>総いいね</span></div>
                </div>
                <div style={{fontSize:12,color:'var(--color-text-faint)',marginBottom:author.bio?10:0}}>{joinStr}から活動中</div>
                {author.bio && <p style={{fontSize:13,color:'var(--color-text)',lineHeight:1.8,margin:0,whiteSpace:'pre-wrap'}}>{author.bio}</p>}

                {/*
                 * X への入口。連携している人にだけ出す。
                 * 持っているのは id だけなので、ここで住所を組み立てる。
                 * 別の窓で開く。読んでいた頁を置き去りにしない。
                 */}
                {author.x_account && (
                  <a
                    href={`https://x.com/${author.x_account}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:author.bio?10:0,padding:'6px 12px',border:'1px solid var(--color-brand-border)',borderRadius:16,fontSize:12,color:'var(--color-text)',textDecoration:'none',background:'var(--color-bg-card)'}}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.53 3h3.2l-6.99 7.99L22 21h-6.44l-5.04-6.6L4.75 21H1.54l7.48-8.55L2 3h6.6l4.56 6.03L17.53 3Zm-1.12 16.06h1.77L7.68 4.84H5.78l10.63 14.22Z"/>
                    </svg>
                    @{author.x_account}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div style={{marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <h2 style={{fontSize:17,fontWeight:700,color:'var(--color-text)',margin:0}}>
              投稿作品 <span style={{fontSize:13,fontWeight:400,color:'var(--color-text-muted)'}}>（{filteredNovels.length}作品）</span>
            </h2>
          </div>
          <NovelListWithSeries/>
          <TweetSection authorId={author.user_id} currentUserId={user?.id||null} currentUserName={profile?.display_name||null} currentUserIconUrl={profile?.icon_url||null} isOwner={false}/>
        </div>
      </div>

      {/* ===== モバイル ===== */}
      <div className="mobile-only" style={{padding:'12px 16px 0'}}>
        <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:14,padding:'16px',marginBottom:14}}>
          {/*
           * 狭い画面では、押し具を下の段へ回す。
           *
           * 1 行に詰めると、名前と「◯年◯月から活動中」の
           * 置き場所が押し具に潰され、1 文字ずつ縦に割れる。
           */}
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
            {author.icon_url
              ? <img src={author.icon_url} style={{width:56,height:56,borderRadius:'50%',objectFit:'cover',flexShrink:0}} alt=""/>
              : <div style={{width:56,height:56,borderRadius:'50%',background:'var(--color-brand-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,color:'var(--color-brand)',fontWeight:700,flexShrink:0}}>
                  {author.display_name?.[0] || '?'}
                </div>
            }
            <div style={{flex:'1 1 140px',minWidth:0}}>
              <h1 style={{fontSize:17,fontWeight:700,color:'var(--color-text)',margin:0,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{author.display_name}</h1>
              <div style={{fontSize:11,color:'var(--color-text-faint)',whiteSpace:'nowrap'}}>{joinStr}から活動中</div>
            </div>
            {/*
             * 未ログインでもフォローの押し具は出す。
             * 隠すと、その人を追えること自体が伝わらない。
             */}
            {!isMe && (
              <div style={{display:'flex',gap:6,flexWrap:'wrap',width:'100%'}}>
                {user ? (
                  <>
                    <FollowButton authorId={params.id} userId={user.id} initialFollowing={isFollowing} followerCount={followerCount || 0}/>
                    <MessageButton targetId={params.id} userId={user.id}/>
                    <BlockButton targetId={params.id} userId={user.id} initialBlocked={isBlocked} initialMuted={isMuted}/>
                  </>
                ) : (
                  <GuestFollowButton followerCount={followerCount || 0}/>
                )}
              </div>
            )}
          </div>
          <div style={{display:'flex',background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:10,overflow:'hidden',marginBottom:author.bio?12:0}}>
            {[
              {label:'フォロワー', value:(followerCount||0).toLocaleString()},
              {label:'作品', value:filteredNovels.length},
              {label:'総いいね', value:totalLikes.toLocaleString()},
            ].map((item,i,arr)=>(
              <div key={item.label} style={{flex:1,textAlign:'center',padding:'8px 4px',borderRight:i<arr.length-1?'1px solid var(--color-brand-border)':'none'}}>
                <div style={{fontSize:15,fontWeight:700,color:'var(--color-brand)'}}>{item.value}</div>
                <div style={{fontSize:10,color:'var(--color-text-muted)'}}>{item.label}</div>
              </div>
            ))}
          </div>
          {author.bio && <p style={{fontSize:13,color:'var(--color-text)',lineHeight:1.8,margin:0,whiteSpace:'pre-wrap'}}>{author.bio}</p>}
        </div>
        <div style={{marginBottom:10}}>
          <h2 style={{fontSize:15,fontWeight:700,color:'var(--color-text)',margin:0}}>
            投稿作品 <span style={{fontSize:12,fontWeight:400,color:'var(--color-text-muted)'}}>（{filteredNovels.length}作品）</span>
          </h2>
        </div>
        <NovelListWithSeries/>
        <TweetSection authorId={author.user_id} currentUserId={user?.id||null} currentUserName={profile?.display_name||null} currentUserIconUrl={profile?.icon_url||null} isOwner={false}/>
        <div style={{height:80}}/>
      </div>
      <Footer />
    </div>
  )
}
