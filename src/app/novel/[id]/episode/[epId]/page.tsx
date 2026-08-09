import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string; epId: string } }) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const [{ data: episode }, { data: novel }] = await Promise.all([
    supabase.from('episodes').select('title').eq('id', params.epId).maybeSingle(),
    supabase.from('novels').select('title').eq('id', params.id).maybeSingle(),
  ])
  const title = episode?.title && novel?.title
    ? `${novel.title}「${episode.title}」| 原石航路`
    : '原石航路'
  const description = novel?.title
    ? `${novel.title} - ライトノベル投稿サイト「原石航路」`
    : 'ライトノベル投稿サイト「原石航路」'
  return { title, description }
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import CommentSection from '@/components/novel/episode/comment-section'
import EpisodeLikeButton from '@/components/novel/episode/episode-like-button'
import ReadButton from '@/components/novel/episode/read-button'
import EpisodeBody from '@/components/novel/episode/episode-body'
import TypoReportButton from '@/components/novel/episode/typo-report-button'
import ValidReadTracker from '@/components/novel/episode/valid-read-tracker'
import { QuoteProvider } from '@/components/novel/episode/quote-context'
import { appConfig } from '@/config'

interface Props { params: { id: string; epId: string } }

export default async function EpisodePage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // profile（user依存）・episode・novel（独立）を並列取得
  const [profileRes, episodeRes, novelRes] = await Promise.all([
    user ? supabase.from('profiles').select('*').eq('user_id', user.id).single() : Promise.resolve({ data: null }),
    supabase.from('episodes').select('*').eq('id', params.epId).maybeSingle(),
    supabase.from('novels').select('id, title, genre, is_serial, author_id, views').eq('id', params.id).maybeSingle(),
  ])
  const profile = profileRes.data
  const episode = episodeRes.data
  const novel = novelRes.data
  if (!episode) notFound()
  if (!novel) notFound()

  // ===== 予約投稿の自動公開判定 =====
  const isOwner = user?.id === novel.author_id
  if (episode.published === false && episode.scheduled_at) {
    const scheduledTime = new Date(episode.scheduled_at).getTime()
    if (scheduledTime <= Date.now()) {
      await supabase.from('episodes').update({ published: true, scheduled_at: null }).eq('id', episode.id)
      episode.published = true
      episode.scheduled_at = null
      const { data: novelPubCheck } = await supabase.from('novels').select('published').eq('id', novel.id).maybeSingle()
      if (novelPubCheck && novelPubCheck.published === false) {
        await supabase.from('novels').update({ published: true }).eq('id', novel.id)
      }
    } else if (!isOwner) {
      notFound()
    }
  } else if (episode.published === false && !isOwner) {
    notFound()
  }

  // author・全話・コメント・話いいね数は互いに独立なので並列取得
  const [authorRes, allEpsRes, epLikeCountRes] = await Promise.all([
    supabase.from('profiles').select('display_name, user_id').eq('user_id', novel.author_id).maybeSingle(),
    supabase.from('episodes').select('id, ep_number, title, published, scheduled_at').eq('novel_id', params.id).order('ep_number', { ascending: true }),
    supabase.from('episode_likes').select('*', { count: 'exact', head: true }).eq('episode_id', params.epId),
  ])
  const authorData = authorRes.data
  const allEps = allEpsRes.data
  const epLikeCount = epLikeCountRes.count

  /*
   * コメントは、画面が出たあとに読む。
   *
   * いいねの数と書いた人の名前で 3 回かかるが、
   * 出るのは本文の下。読み終えるまで見えない。
   */
  const comments: any[] = []

  let epLiked = false
  if (user) {
    const { data: el } = await supabase.from('episode_likes').select('user_id')
      .eq('episode_id', params.epId).eq('user_id', user.id).maybeSingle()
    epLiked = !!el
  }

  let isRead = false
  if (user) {
    const { data: rd } = await supabase.from('read_episodes')
      .select('id').eq('user_id', user.id).eq('episode_id', params.epId).maybeSingle()
    isRead = !!rd
  }

  const visibleEps = isOwner ? (allEps || []) : (allEps || []).filter(e => e.published !== false)
  const currentIdx = visibleEps.findIndex(e => e.id === params.epId) ?? -1
  const prevEp = currentIdx > 0 ? visibleEps[currentIdx - 1] : null
  const nextEp = currentIdx >= 0 && currentIdx < visibleEps.length - 1 ? visibleEps[currentIdx + 1] : null

  try {
    // デバイス判定（user-agentから）
    const ua = (await headers()).get('user-agent') || ''
    const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop'
    // 1日1人1話1PV制限：同じユーザーが同じ日に同じ話を見ていたらカウントしない
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    if (user) {
      const { data: existingPv } = await supabase
        .from('page_views')
        .select('id')
        .eq('episode_id', params.epId)
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .limit(1)
        .maybeSingle()
      if (!existingPv) {
        await supabase.from('page_views').insert({ episode_id: params.epId, user_id: user.id, device })
      }
    } else {
      // 未ログインは従来通り記録（IPやCookieでの制限は行わない）
      await supabase.from('page_views').insert({ episode_id: params.epId, user_id: null, device })
    }
  } catch (_) {}

  const author = authorData as any

  function fmtDate(d: string) {
    const dt = new Date(d)
    return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()}`
  }

  const navBtn = {fontSize:12,color:'var(--color-brand)',border:'1px solid var(--color-brand-border)',padding:'6px 14px',borderRadius:16,background:'var(--color-bg-card)',textDecoration:'none'} as const

  const FirstCommentPrompt = () => comments.length === 0 ? (
    <div style={{background:'var(--color-brand-light)',border:'1.5px solid var(--color-brand-border)',borderRadius:12,padding:'18px 20px',marginBottom:16,textAlign:'center' as const}}>
      <div style={{fontSize:24,marginBottom:6}}>✍️</div>
      <div style={{fontSize:13,fontWeight:700,color:'var(--color-brand)',marginBottom:4}}>まだ感想がありません</div>
      <div style={{fontSize:12,color:'var(--color-text)',lineHeight:1.7}}>
        あなたの一言が、作者の次の一話につながります。<br/>
        <span style={{fontSize:11,color:'var(--color-text-muted)'}}>最初の感想を書いてみませんか？</span>
      </div>
    </div>
  ) : null

  return (
    <QuoteProvider>
    <div style={{minHeight:'100vh'}}>
      <Header />

      {/* ===== デスクトップレイアウト ===== */}
      <div className="desktop-only" style={{maxWidth:1200,margin:'0 auto',padding:'20px 32px',display:'flex',gap:20,alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,color:'var(--color-text-muted)',marginBottom:14,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
            <Link href="/" style={{color:'var(--color-brand)',textDecoration:'none'}}>ホーム</Link>
            <span>›</span>
            <Link href={`/novel/${params.id}`} style={{color:'var(--color-brand)',textDecoration:'none'}}>{novel.title}</Link>
            <span>›</span>
            <span style={{color:'var(--color-text)'}}>{episode.title}</span>
          </div>
          {isOwner && episode.published === false && episode.scheduled_at && (
            <div style={{background:'#eff6ff',border:'1.5px solid #93c5fd',borderRadius:10,padding:'10px 16px',marginBottom:14,fontSize:12,color:'#1d4ed8',fontWeight:600}}>
              📅 この話は予約投稿中です。{new Date(episode.scheduled_at).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} に公開されます（このプレビューは作者にのみ表示されています）
            </div>
          )}
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16,gap:8}}>
            {prevEp ? <Link href={`/novel/${params.id}/episode/${prevEp.id}`} style={navBtn}>← 前の話</Link> : <div/>}
            <Link href={`/novel/${params.id}`} style={{...navBtn,color:'var(--color-text-muted)'}}>目次</Link>
            {nextEp ? <Link href={`/novel/${params.id}/episode/${nextEp.id}`} style={navBtn}>次の話 →</Link> : <div/>}
          </div>
          {episode.illust_url && (
            <div style={{textAlign:'center',marginBottom:12}}>
              <img src={episode.illust_url} alt="挿絵" style={{maxWidth:'100%',maxHeight:480,objectFit:'contain',borderRadius:8}}/>
            </div>
          )}
          <EpisodeBody title={episode.title} body={episode.body} preface={episode.preface} afterword={episode.afterword} authorName={author?.display_name}/>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginBottom:16,flexWrap:'wrap'}}>
            <EpisodeLikeButton episodeId={params.epId} userId={user?.id||null} initialLiked={epLiked} initialCount={epLikeCount??0}/>
            {user && <ReadButton novelId={params.id} episodeId={params.epId} userId={user.id} initialRead={isRead}/>}
            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`「${novel.title}」\n「${episode.title}」\n#原石航路 #ライトノベル\n`)}&url=${encodeURIComponent(`${appConfig.siteUrl}/novel/${params.id}/episode/${params.epId}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:6,padding:'10px 20px',borderRadius:20,border:'1.5px solid #e2e8f0',background:'var(--color-bg-card)',color:'#374151',fontSize:13,fontWeight:500,textDecoration:'none'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              シェア
            </a>
          </div>
          <ValidReadTracker episodeId={params.epId} enabled={!!user && user.id !== novel.author_id}/>
          <div style={{textAlign:'center',marginBottom:16}}>
            <TypoReportButton novelId={params.id} episodeId={params.epId} authorId={novel.author_id} userId={user?.id||null} userName={profile?.display_name||null} novelTitle={novel.title} episodeTitle={episode.title}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:16}}>
            {prevEp ? (
              <Link href={`/novel/${params.id}/episode/${prevEp.id}`}
                style={{flex:1,textAlign:'center',fontSize:13,color:'var(--color-brand)',border:'1.5px solid var(--color-brand-border)',padding:'10px',borderRadius:10,background:'var(--color-bg-card)',textDecoration:'none'}}>
                ← 前の話<br/><span style={{fontSize:11,color:'var(--color-text-muted)'}}>{prevEp.title}</span>
              </Link>
            ) : <div style={{flex:1}}/>}
            {nextEp ? (
              <Link href={`/novel/${params.id}/episode/${nextEp.id}`}
                style={{flex:1,textAlign:'center',fontSize:13,color:'var(--color-brand)',border:'1.5px solid var(--color-brand)',padding:'10px',borderRadius:10,background:'var(--color-brand-light)',textDecoration:'none'}}>
                次の話 →<br/><span style={{fontSize:11,color:'var(--color-text-muted)'}}>{nextEp.title}</span>
              </Link>
            ) : (
              <div style={{flex:1,textAlign:'center',fontSize:13,color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',padding:'10px',borderRadius:10,background:'var(--color-bg-card)'}}>
                最新話です<br/>
                <Link href={`/novel/${params.id}`} style={{fontSize:11,color:'var(--color-brand)',textDecoration:'none'}}>目次に戻る</Link>
              </div>
            )}
          </div>
          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:10,padding:'14px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
            <div style={{flex:1}}>
              <Link href={`/novel/${params.id}`} style={{fontSize:14,fontWeight:700,color:'var(--color-text)',textDecoration:'none',display:'block',marginBottom:2}}>{novel.title}</Link>
              <span style={{fontSize:12,color:'var(--color-text)'}}>作者：{author?.display_name}</span>
            </div>
            <Link href={`/novel/${params.id}`} style={{fontSize:12,border:'1px solid var(--color-brand-border)',padding:'6px 14px',borderRadius:14,color:'var(--color-text-muted)',background:'var(--color-bg)',textDecoration:'none'}}>
              目次を見る
            </Link>
          </div>
          <FirstCommentPrompt/>
          <CommentSection novelId={params.id} episodeId={params.epId} userId={user?.id||null} userName={profile?.display_name||null} userIconUrl={profile?.icon_url||null} authorId={novel.author_id} comments={comments}/>
        </div>
      </div>

      {/* ===== モバイルレイアウト ===== */}
      <div className="mobile-only" style={{padding:'12px 16px 0'}}>
        <div style={{fontSize:11,color:'var(--color-text-muted)',marginBottom:10,display:'flex',alignItems:'center',gap:4,overflow:'hidden'}}>
          <Link href="/" style={{color:'var(--color-brand)',textDecoration:'none',flexShrink:0}}>ホーム</Link>
          <span style={{flexShrink:0}}>›</span>
          <Link href={`/novel/${params.id}`} style={{color:'var(--color-brand)',textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{novel.title}</Link>
          <span style={{flexShrink:0}}>›</span>
          <span style={{color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{episode.title}</span>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:6,marginBottom:12}}>
          {prevEp
            ? <Link href={`/novel/${params.id}/episode/${prevEp.id}`} style={{...navBtn,textAlign:'center',display:'block'}}>← 前の話</Link>
            : <div/>
          }
          <Link href={`/novel/${params.id}`} style={{...navBtn,color:'var(--color-text-muted)',textAlign:'center',display:'block',whiteSpace:'nowrap'}}>目次</Link>
          {nextEp
            ? <Link href={`/novel/${params.id}/episode/${nextEp.id}`} style={{...navBtn,textAlign:'center',display:'block'}}>次の話 →</Link>
            : <div/>
          }
        </div>

        {episode.illust_url && (
          <div style={{textAlign:'center',marginBottom:10}}>
            <img src={episode.illust_url} alt="挿絵" style={{maxWidth:'100%',maxHeight:300,objectFit:'contain',borderRadius:8}}/>
          </div>
        )}

        <EpisodeBody title={episode.title} body={episode.body} preface={episode.preface} afterword={episode.afterword} authorName={author?.display_name}/>

        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          <EpisodeLikeButton episodeId={params.epId} userId={user?.id||null} initialLiked={epLiked} initialCount={epLikeCount??0}/>
          {user && <ReadButton novelId={params.id} episodeId={params.epId} userId={user.id} initialRead={isRead}/>}
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`「${novel.title}」\n「${episode.title}」\n#原石航路 #ライトノベル\n`)}&url=${encodeURIComponent(`${appConfig.siteUrl}/novel/${params.id}/episode/${params.epId}`)}`}
            target="_blank" rel="noopener noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:5,padding:'8px 14px',borderRadius:20,border:'1.5px solid #e2e8f0',background:'var(--color-bg-card)',color:'#374151',fontSize:12,fontWeight:500,textDecoration:'none'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            シェア
          </a>
        </div>

        <div style={{textAlign:'center',marginBottom:14}}>
          <TypoReportButton novelId={params.id} episodeId={params.epId} authorId={novel.author_id} userId={user?.id||null} userName={profile?.display_name||null} novelTitle={novel.title} episodeTitle={episode.title}/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
          {prevEp ? (
            <Link href={`/novel/${params.id}/episode/${prevEp.id}`}
              style={{textAlign:'center',fontSize:12,color:'var(--color-brand)',border:'1.5px solid var(--color-brand-border)',padding:'10px 8px',borderRadius:10,background:'var(--color-bg-card)',textDecoration:'none',display:'block'}}>
              ← 前の話<br/><span style={{fontSize:10,color:'var(--color-text-muted)',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{prevEp.title}</span>
            </Link>
          ) : <div/>}
          {nextEp ? (
            <Link href={`/novel/${params.id}/episode/${nextEp.id}`}
              style={{textAlign:'center',fontSize:12,color:'var(--color-brand)',border:'1.5px solid var(--color-brand)',padding:'10px 8px',borderRadius:10,background:'var(--color-brand-light)',textDecoration:'none',display:'block'}}>
              次の話 →<br/><span style={{fontSize:10,color:'var(--color-text-muted)',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nextEp.title}</span>
            </Link>
          ) : (
            <div style={{textAlign:'center',fontSize:12,color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',padding:'10px 8px',borderRadius:10,background:'var(--color-bg-card)'}}>
              最新話です<br/>
              <Link href={`/novel/${params.id}`} style={{fontSize:11,color:'var(--color-brand)',textDecoration:'none'}}>目次に戻る</Link>
            </div>
          )}
        </div>

        <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:10,padding:'12px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <Link href={`/novel/${params.id}`} style={{fontSize:13,fontWeight:700,color:'var(--color-text)',textDecoration:'none',display:'block',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{novel.title}</Link>
            <span style={{fontSize:11,color:'var(--color-text)'}}>作者：{author?.display_name}</span>
          </div>
          <Link href={`/novel/${params.id}`} style={{fontSize:11,border:'1px solid var(--color-brand-border)',padding:'5px 10px',borderRadius:12,color:'var(--color-text-muted)',background:'var(--color-bg)',textDecoration:'none',flexShrink:0}}>
            目次
          </Link>
        </div>

        <FirstCommentPrompt/>
        <CommentSection novelId={params.id} episodeId={params.epId} userId={user?.id||null} userName={profile?.display_name||null} userIconUrl={profile?.icon_url||null} authorId={novel.author_id} comments={comments}/>

        <div style={{height:80}}/>
      </div>
      <Footer />
    </div>
    </QuoteProvider>
  )
}
