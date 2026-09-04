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
import VoicePlayer from '@/components/novel/episode/voice-player'
import TypoReportButton from '@/components/novel/episode/typo-report-button'
import ValidReadTracker from '@/components/novel/episode/valid-read-tracker'
import { QuoteProvider } from '@/components/novel/episode/quote-context'
import { appConfig } from '@/config'
import { ageFromBirthdate, allowedRatings } from '@/lib/age'

interface Props { params: { id: string; epId: string } }

export default async function EpisodePage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // profile（user依存）・episode・novel（独立）を並列取得
  const [profileRes, episodeRes, novelRes] = await Promise.all([
    user ? supabase.from('profiles').select('*').eq('user_id', user.id).single() : Promise.resolve({ data: null }),
    supabase.from('episodes').select('*').eq('id', params.epId).maybeSingle(),
    supabase.from('novels').select('id, title, genre, is_serial, author_id, views, recommended_mode, age_rating').eq('id', params.id).maybeSingle(),
  ])
  const profile = profileRes.data
  const episode = episodeRes.data
  const novel = novelRes.data

  /*
   * 話の中の挿絵。
   *
   * ★ 1 話に何枚でも、好きな場所へ置ける。
   *   置き場所は「何文目の後ろか」で持っている。
   *
   * ★ 古い列（episodes.illust_url）も残してある。
   *   表に 1 枚も無いときだけ、そちらを本文の頭に出す。
   */
  const { data: illustRows } = await supabase
    .from('episode_illusts')
    .select('id, url, is_ai, after_sentence, size')
    .eq('episode_id', params.epId)
    .order('after_sentence', { ascending: true })

  const illusts = (illustRows ?? []) as { id: string; url: string; is_ai: boolean; after_sentence: number; size?: string | null }[]
  if (!episode) notFound()
  if (!novel) notFound()

  // ===== 予約投稿の自動公開判定 =====
  const isOwner = user?.id === novel.author_id

  /*
   * 年齢の確認。
   *
   * 作品ページと同じ。話の住所を直接叩けば、
   * 作品ページを通らずに本文へ入れてしまう。
   * 人に渡されるのは、たいてい話の住所のほう。
   */
  const viewerRatings = allowedRatings(ageFromBirthdate(profile?.birthdate))
  const rating = (novel.age_rating as 'all' | 'r15' | 'r18' | null) ?? 'all'

  if (!isOwner && !viewerRatings.includes(rating)) {
    const label = rating === 'r18' ? 'R18' : 'R15'
    return (
      <div className="min-h-screen bg-page">
        <Header breadcrumbs={[{ label: '作品' }]} />
        <div style={{maxWidth:520,margin:'0 auto',padding:'80px 24px',textAlign:'center'}}>
          <p style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:10}}>
            {label} の作品です
          </p>
          <p style={{fontSize:13,lineHeight:1.9,color:'var(--color-text-muted)',marginBottom:24}}>
            {!user
              ? 'ログインして、生年月日を設定すると読めます。'
              : !profile?.birthdate
                ? '生年月日を設定すると読めます。年齢の確認にだけ使い、ほかの人には見えません。'
                : `${label} の作品は、対象の年齢の方だけが読めます。`}
          </p>
          {/* 入ったあと、この話へ戻す */}
          <Link href={!user ? `/login?next=${encodeURIComponent(`/novel/${params.id}/episode/${params.epId}`)}` : '/mypage?tab=settings'}
            style={{display:'inline-block',padding:'9px 22px',borderRadius:8,
              background:'var(--color-brand)',color:'#fff',fontSize:13,
              fontWeight:600,textDecoration:'none'}}>
            {!user ? 'ログインする' : '生年月日を設定する'}
          </Link>
        </div>
        <Footer />
      </div>
    )
  }
  /* 見るのは is_published。published は既定 true で当てにならない */
  if (episode.is_published !== true && episode.scheduled_at) {
    const scheduledTime = new Date(episode.scheduled_at).getTime()
    if (scheduledTime <= Date.now()) {
      await supabase.from('episodes').update({ published: true, is_published: true, scheduled_at: null, publish_at: null, posted_at: new Date().toISOString() }).eq('id', episode.id)
      episode.published = true
      episode.is_published = true
      episode.scheduled_at = null
      const { data: novelPubCheck } = await supabase.from('novels').select('published').eq('id', novel.id).maybeSingle()
      if (novelPubCheck && novelPubCheck.published === false) {
        await supabase.from('novels').update({ published: true }).eq('id', novel.id)
      }
    } else if (!isOwner) {
      notFound()
    }
  } else if (episode.is_published !== true && !isOwner) {
    notFound()
  }

  // author・全話・コメント・話いいね数は互いに独立なので並列取得
  const [authorRes, allEpsRes, epLikeCountRes] = await Promise.all([
    supabase.from('public_profiles').select('display_name, user_id').eq('user_id', novel.author_id).maybeSingle(),
    supabase.from('episodes').select('id, ep_number, title, published, is_published, scheduled_at').eq('novel_id', params.id).order('ep_number', { ascending: true }),
    supabase.from('episode_likes').select('*', { count: 'exact', head: true }).eq('episode_id', params.epId),
  ])
  const authorData = authorRes.data
  const allEps = allEpsRes.data
  const epLikeCount = epLikeCountRes.count

  /*
   * 朗読ができているか。
   *
   * 裏で作り置きした話にだけ「聴く」を出す。
   * できていない話に出すと、押しても待たされる。
   */
  const { data: voiceRow } = await supabase
    .from('episode_voices')
    .select('episode_id')
    .eq('episode_id', params.epId)
    .limit(1)
    .maybeSingle()

  const hasVoice = Boolean(voiceRow)

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

  /*
   * 読者に見せるのは投稿された話だけ。
   * 印は is_published を見る（published は作った時点で立つ）。
   */
  const visibleEps = isOwner ? (allEps || []) : (allEps || []).filter(e => e.is_published === true)
  const currentIdx = visibleEps.findIndex(e => e.id === params.epId) ?? -1
  const prevEp = currentIdx > 0 ? visibleEps[currentIdx - 1] : null
  const nextEp = currentIdx >= 0 && currentIdx < visibleEps.length - 1 ? visibleEps[currentIdx + 1] : null

  /*
   * 次に出る話の予定。
   *
   * ★ 読み終えた人に見せる。
   *
   *   作品ページの上にも予告は出しているが、
   *   最新話を読み終えた人は、そこまで戻らない。
   *   「次はいつ」を知りたいのは、この場所。
   *
   * まだ投稿されていない話のうち、いちばん早い時刻のものを出す。
   */
  const upcomingEp = (allEps || [])
    .filter(e => e.is_published !== true && e.scheduled_at && new Date(e.scheduled_at).getTime() > Date.now())
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0] || null

  /* 次の話がまだ無いときだけ出す。続きがあるなら、そちらを読んでもらう */
  const showUpcoming = !nextEp && upcomingEp

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
      <div className="desktop-only" style={{maxWidth:1560,margin:'0 auto',padding:'20px 28px',display:'flex',gap:20,alignItems:'flex-start'}}>
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
          {showUpcoming && (
            <div style={{background:'var(--color-info-bg)',border:'1px solid var(--color-info-border)',borderRadius:8,padding:'8px 14px',marginBottom:16,fontSize:12,color:'var(--color-info)',textAlign:'center'}}>
              次の話は {new Date(upcomingEp!.scheduled_at!).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 頃の予定です
            </div>
          )}
          {/* 挿絵は EpisodeBody の中で、縦書きの流れに沿って出す */}
          {/*
           * 音声で聴く。
           *
           * 裏で作り置きした話にだけ出す。
           * 押してから作ると待たせるので、
           * できているものだけを見せる。
           */}
          {hasVoice && (
            <VoicePlayer episodeId={params.epId} isLoggedIn={Boolean(user)}/>
          )}

          <EpisodeBody novelId={params.id} episodeId={params.epId} illusts={illusts} illustUrl={episode.illust_url} illustIsAi={episode.illust_is_ai} title={episode.title} body={episode.body} preface={episode.preface} afterword={episode.afterword} authorName={author?.display_name} recommendedMode={((novel as { recommended_mode?: string }).recommended_mode as 'vertical' | 'horizontal' | undefined) ?? null}/>
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
                {/* 次の予定があるなら、目次に戻る前にそれを見せる */}
                {showUpcoming ? (
                  <span style={{fontSize:11,color:'var(--color-info)'}}>
                    次は {new Date(upcomingEp!.scheduled_at!).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 頃
                  </span>
                ) : (
                  <Link href={`/novel/${params.id}`} style={{fontSize:11,color:'var(--color-brand)',textDecoration:'none'}}>目次に戻る</Link>
                )}
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
          <CommentSection novelId={params.id} episodeId={params.epId} userId={user?.id||null} userName={profile?.display_name||null} userIconUrl={profile?.icon_url||null} authorId={novel.author_id} isAdmin={profile?.is_admin === true} comments={comments}/>
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

        {/* 挿絵は EpisodeBody の中で、縦書きの流れに沿って出す */}

        <EpisodeBody novelId={params.id} episodeId={params.epId} illusts={illusts} illustUrl={episode.illust_url} illustIsAi={episode.illust_is_ai} title={episode.title} body={episode.body} preface={episode.preface} afterword={episode.afterword} authorName={author?.display_name} recommendedMode={((novel as { recommended_mode?: string }).recommended_mode as 'vertical' | 'horizontal' | undefined) ?? null}/>

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
        <CommentSection novelId={params.id} episodeId={params.epId} userId={user?.id||null} userName={profile?.display_name||null} userIconUrl={profile?.icon_url||null} authorId={novel.author_id} isAdmin={profile?.is_admin === true} comments={comments}/>

        <div style={{height:80}}/>
      </div>
      <Footer />
    </div>
    </QuoteProvider>
  )
}
