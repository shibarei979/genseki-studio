import { looksLikeBotRequest } from '@/lib/utils/bot'
import { countOne } from '@/lib/count-rows'
import ShareButtons from '@/components/common/share-buttons'
import EpisodeNav from '@/components/novel/episode/episode-nav'
import { ENTRY_COOKIE, entryName, nameSource } from '@/lib/utils/view-source'
import { createClient } from '@/lib/supabase/server'
import { cookies, headers } from 'next/headers'
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
  /*
   * ★ 正規の住所を名乗る。シェアの住所に付く ?from=x などを、
   *   検索が別の頁として数えないように（同じ本文が何枚もあるように見える）。
   */
  return { title, description, alternates: { canonical: `/novel/${params.id}/episode/${params.epId}` } }
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import CommentSection from '@/components/novel/episode/comment-section'
import MobileReadBar from '@/components/novel/episode/mobile-read-bar'
import EpisodeLikeButton from '@/components/novel/episode/episode-like-button'
import EpisodeStamps from '@/components/novel/episode/episode-stamps'
import ReadButton from '@/components/novel/episode/read-button'
import EpisodeBody from '@/components/novel/episode/episode-body'
import QuoteFromSelection from '@/components/novel/episode/quote-from-selection'
import CopyAttribution from '@/components/novel/episode/copy-attribution'
import VoicePlayer from '@/components/novel/episode/voice-player'
import TypoReportButton from '@/components/novel/episode/typo-report-button'
import MobileEpisodeHead from '@/components/novel/episode/mobile-episode-head'
import ValidReadTracker from '@/components/novel/episode/valid-read-tracker'
import ReadProgressTracker from '@/components/reader/read-progress-tracker'
import { QuoteProvider } from '@/components/novel/episode/quote-context'
import { appConfig } from '@/config'
import { ageFromBirthdate, allowedRatings } from '@/lib/age'

interface Props { params: { id: string; epId: string }; searchParams?: { from?: string } }

export default async function EpisodePage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // profile（user依存）・episode・novel（独立）を並列取得
  const [profileRes, episodeRes, novelRes] = await Promise.all([
    user ? supabase.from('profiles').select('*').eq('user_id', user.id).single() : Promise.resolve({ data: null }),
    supabase.from('episodes').select('*').eq('id', params.epId).maybeSingle(),
    /*
     * ★ 作者が決めた設定も読む。
     *
     *   「コメントを受け付ける」を切っても
     *   コメント欄が出たままだった。
     *   保存はされているのに、読者の側が見ていなかった。
     */
    supabase.from('novels').select('id, title, genre, is_serial, author_id, views, recommended_mode, age_rating, allow_comments, allow_likes').eq('id', params.id).maybeSingle(),
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
    .select('id, url, is_ai, after_sentence, size, rec_width, rec_align')
    .eq('episode_id', params.epId)
    .order('after_sentence', { ascending: true })

  const illusts = (illustRows ?? []) as { id: string; url: string; is_ai: boolean; after_sentence: number; size?: string | null; rec_width?: number | null; rec_align?: number | null }[]
  if (!episode) notFound()
  if (!novel) notFound()

  /*
   * ★ 作者の全体設定も見る。
   *
   *   マイページに「エピソードへのコメントを許可」があり、
   *   作品ごとの設定と同じことを言っている。
   *   どちらかが切られていれば、受け付けない。
   *
   *   二重にあること自体が分かりにくいが、
   *   片方だけ効くよりはましなので、両方見る。
   */
  const { data: authorProfile } = await supabase
    .from('profiles')
    .select('allow_comments')
    .eq('user_id', novel.author_id)
    .maybeSingle()

  const authorAllowsComments = authorProfile?.allow_comments

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
    /* ★ 話のいいねは自分の押した行しか読めない表。運営の鍵で数だけ読む */
    countOne('episode_likes', 'episode_id', params.epId).then((count) => ({ count })),
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
    /*
     * ★ 作者が自分の作品を開いたぶんは、印を付けて残す。
     *
     *   閲覧数には入れない。書いている人は確かめのために
     *   何度も開くので、入れると読まれた実感が濁る。
     *
     *   ただし記録は残す。消してしまうと
     *   「今日 読んだ人」から書き手が抜け、
     *   動いている人の数と噛み合わなくなる。
     */
    const isAuthorView = !!user && novel.author_id === user.id

    // デバイス判定（user-agentから）
    const head = await headers()
    const ua = head.get('user-agent') || ''
    const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop'

    /*
     * ★ どこから来たかも残す。
     *
     *   元の住所そのものは持たない。
     *   「X」「YouTube」など、来た先の名だけにする。
     *   住所ごと持つと、人を追える記録になってしまう。
     */
    /*
     * ★ 送り元が自分のサイトのとき（作品の頁から 1 話目を押した など）は、
     *   サイトに入ってきたときの先（middleware が札に書いたもの）を使う。
     *   こうしないと、X から来て作品の頁を経た人が「サイトの中」になる。
     * ★ 住所に ?from=x が付いていれば、それを先に信じる。
     *   X のアプリの中の窓は送り元を消すので、印が無いと「直接」に見える。
     */
    let source: string = entryName(searchParams?.from) ?? nameSource(head.get('referer') || '', new URL(appConfig.siteUrl).host)
    if (source === 'site') {
      source = entryName((await cookies()).get(ENTRY_COOKIE)?.value) ?? 'site'
    }

    /*
     * ★ 誰が来たかではなく、何人が来たかを数えるための札。
     *
     *   中身は、でたらめな並び。名前も住所も持たない。
     *   同じ機械から来た、ということしか分からない。
     *
     * ★ 見回りの機械には印を付ける。消さずに残す。
     *   混ぜて数えると、人数が実際より膨らむ。
     */
    const jar = await cookies()
    const visitorId = jar.get('gk-visitor')?.value ?? null
    const sessionId = jar.get('gk-session')?.value ?? null
    const isBot = looksLikeBotRequest(head)
    // 1日1人1話1PV制限：同じユーザーが同じ日に同じ話を見ていたらカウントしない
    /* 「同じ日」は日本時間の 0 時で区切る（サーバーの時計は世界標準時で、そのままだと朝 9 時が境目になる） */
    const todayStart = new Date(Math.floor((Date.now() + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000)
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
        /*
         * ★ どの作品かも一緒に残す。
         *
         *   前は話の id しか入れていなかった。
         *   マイページの作品ごとの閲覧数は novel_id で数えているので、
         *   いつまでも 0 のままだった。
         */
        await supabase.from('page_views').insert({ novel_id: params.id, episode_id: params.epId, user_id: user.id, device, source, is_author: isAuthorView, visitor_id: visitorId, session_id: sessionId, is_bot: isBot })
      }
    } else {
      // 未ログインは従来通り記録（IPやCookieでの制限は行わない）
      await supabase.from('page_views').insert({ novel_id: params.id, episode_id: params.epId, user_id: null, device, source, visitor_id: visitorId, session_id: sessionId, is_bot: isBot })
    }
  } catch (_) {}

  const author = authorData as any

  function fmtDate(d: string) {
    /* 日本時間で出す。この頁はサーバー（世界標準時）で組み立てるので、9 時間足して読む */
    const dt = new Date(new Date(d).getTime() + 9 * 60 * 60 * 1000)
    return `${dt.getUTCFullYear()}/${dt.getUTCMonth()+1}/${dt.getUTCDate()}`
  }

  const navBtn = {fontSize:12,color:'var(--color-brand)',border:'1px solid var(--color-brand-border)',padding:'6px 14px',borderRadius:16,background:'var(--color-bg-card)',textDecoration:'none'} as const

  /*
   * 「まだ感想がありません」は、ここでは出さない。
   *
   * ★ この頁はコメントを読んでいない（読むのは CommentSection）。
   *   上の comments はいつも空なので、
   *   コメントが付いていても誘いが出ていた。
   *
   *   数を持っている CommentSection の側に移した。
   */

  return (
    <QuoteProvider>
    {/*
      * なぞった文を引用する押し具。
      *
      * 本文の中で文字を選んだときだけ、画面の下に出る。
      * 頁に 1 つでよいので、ここに置く。
      */}
    <QuoteFromSelection/>

    {/*
      * 写した本文に、出どころを添える。
      *
      * 写すこと自体は止めない。止められないし、
      * 止めると引用も読み上げも使えなくなる。
      * 持ち出されたものに、出どころが残るようにする。
      */}
    <CopyAttribution
      workTitle={novel.title}
      episodeTitle={episode.title}
      authorName={author?.display_name}
    />
    {/*
      * どこまで読まれたかを控える。
      *
      * ★ 入っていない人も測る。
      *   読む人のほとんどは入っていない。
      *   入っている人だけ見ても、離脱の形は分からない。
      *
      * ★ 誰が読んだかは持たない。
      *   作者かどうか、機械かどうかは受け口の側で見分ける。
      */}
    <ReadProgressTracker episodeId={params.epId}/>

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
              📅 この話は予約投稿中です。{new Date(episode.scheduled_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} に公開されます（このプレビューは作者にのみ表示されています）
            </div>
          )}
          <EpisodeNav
            novelId={params.id}
            prev={prevEp ? { id: prevEp.id, title: prevEp.title } : null}
            next={nextEp ? { id: nextEp.id, title: nextEp.title } : null}
            recommended={novel.recommended_mode ?? null}
            compact
          />

          {showUpcoming && (
            <div style={{background:'var(--color-info-bg)',border:'1px solid var(--color-info-border)',borderRadius:8,padding:'8px 14px',marginBottom:16,fontSize:12,color:'var(--color-info)',textAlign:'center'}}>
              次の話は {new Date(upcomingEp!.scheduled_at!).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 頃の予定です
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
            <ShareButtons text={`「${novel.title}」\n「${episode.title}」\n#原石航路 #ライトノベル\n`} url={`${appConfig.siteUrl}/novel/${params.id}/episode/${params.epId}`} size="sm"/>
          </div>
          {/* スタンプ（アイテムツリーで交換したものを押せる） */}
          <EpisodeStamps episodeId={params.epId}/>
          <ValidReadTracker episodeId={params.epId} enabled={!!user && user.id !== novel.author_id}/>
          <div style={{textAlign:'center',marginBottom:16}}>
            <TypoReportButton novelId={params.id} episodeId={params.epId} authorId={novel.author_id} userId={user?.id||null} userName={profile?.display_name||null} novelTitle={novel.title} episodeTitle={episode.title}/>
          </div>
          <EpisodeNav
            novelId={params.id}
            prev={prevEp ? { id: prevEp.id, title: prevEp.title } : null}
            next={nextEp ? { id: nextEp.id, title: nextEp.title } : null}
            recommended={novel.recommended_mode ?? null}
            tail={
              <div style={{textAlign:'center',fontSize:13,color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',padding:'10px',borderRadius:10,background:'var(--color-bg-card)'}}>
                最新話です<br/>
                {/* 次の予定があるなら、目次に戻る前にそれを見せる */}
                {showUpcoming ? (
                  <span style={{fontSize:11,color:'var(--color-info)'}}>
                    次は {new Date(upcomingEp!.scheduled_at!).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 頃
                  </span>
                ) : (
                  <Link href={`/novel/${params.id}`} style={{fontSize:11,color:'var(--color-brand)',textDecoration:'none'}}>目次に戻る</Link>
                )}
              </div>
            }
          />

          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:10,padding:'14px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
            <div style={{flex:1}}>
              <Link href={`/novel/${params.id}`} style={{fontSize:14,fontWeight:700,color:'var(--color-text)',textDecoration:'none',display:'block',marginBottom:2}}>{novel.title}</Link>
              <span style={{fontSize:12,color:'var(--color-text)'}}>作者：{author?.display_name}</span>
            </div>
            <Link href={`/novel/${params.id}`} style={{fontSize:12,border:'1px solid var(--color-brand-border)',padding:'6px 14px',borderRadius:14,color:'var(--color-text-muted)',background:'var(--color-bg)',textDecoration:'none'}}>
              目次を見る
            </Link>
          </div>
          {/*
            * ★ 作者が切っていれば、出さない。
            *
            *   受け付けない作品に欄だけ出ていると、
            *   書こうとして書けない、ということが起きる。
            *
            * ★ 既に書かれたものは、そのまま読める。
            *   あとから切っても、過去のやり取りは消さない。
            */}
          {(novel.allow_comments === false || authorAllowsComments === false) &&
          comments.length === 0 ? null : (
            <CommentSection novelId={params.id} episodeId={params.epId} userId={user?.id||null} userName={profile?.display_name||null} userIconUrl={profile?.icon_url||null} authorId={novel.author_id} isAdmin={profile?.is_admin === true} comments={comments} allowNew={novel.allow_comments !== false && authorAllowsComments !== false}/>
          )}
        </div>
      </div>

      {/* ===== モバイルレイアウト ===== */}
      <div className="mobile-only" style={{padding:'12px 16px 0'}}>
        {/*
          * ★ 話の題の帯（見本どおり）。サイトの上ヘッダーはそのまま残し、その下に置く。
          *   前はパンくず（ホーム › 作品 › 話）だった。
          */}
        <MobileEpisodeHead novelId={params.id} novelTitle={novel.title} episodeTitle={episode.title}/>

        {/*
          * ★ 前の話・目次・次の話は、画面の下の帯（MobileReadBar）へ移した。
          *   読み終わってから上まで戻らなくていい。
          */}

        {/*
          * ★ パソコンにはあって、携帯に無かったものを出す。
          *   予約投稿中の知らせ（作者だけ）・次の話の予定・音声で聴く。
          */}
        {isOwner && episode.published === false && episode.scheduled_at && (
          <div style={{background:'#eff6ff',border:'1.5px solid #93c5fd',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#1d4ed8',fontWeight:600}}>
            この話は予約投稿中です。{new Date(episode.scheduled_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} に公開されます（このプレビューは作者にのみ表示されています）
          </div>
        )}
        {showUpcoming && (
          <div style={{background:'var(--color-info-bg)',border:'1px solid var(--color-info-border)',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:12,color:'var(--color-info)',textAlign:'center'}}>
            次の話は {new Date(upcomingEp!.scheduled_at!).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 頃の予定です
          </div>
        )}
        {/* 挿絵は EpisodeBody の中で、縦書きの流れに沿って出す */}
        {/* ★ 音声で聴くは、道具の段の「聴く β」を押したときに、段の下に出す */}

        <EpisodeBody novelId={params.id} episodeId={params.epId} illusts={illusts} illustUrl={episode.illust_url} illustIsAi={episode.illust_is_ai} title={episode.title} body={episode.body} preface={episode.preface} afterword={episode.afterword} authorName={author?.display_name} recommendedMode={((novel as { recommended_mode?: string }).recommended_mode as 'vertical' | 'horizontal' | undefined) ?? null}
          voice={hasVoice ? <VoicePlayer episodeId={params.epId} isLoggedIn={Boolean(user)}/> : undefined}/>

        <div className="mrb-endbtns" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          <EpisodeLikeButton episodeId={params.epId} userId={user?.id||null} initialLiked={epLiked} initialCount={epLikeCount??0}/>
          {user && <ReadButton novelId={params.id} episodeId={params.epId} userId={user.id} initialRead={isRead}/>}
          <ShareButtons text={`「${novel.title}」\n「${episode.title}」\n#原石航路 #ライトノベル\n`} url={`${appConfig.siteUrl}/novel/${params.id}/episode/${params.epId}`} size="sm"/>
        </div>

        {/* スタンプ（アイテムツリーで交換したものを押せる） */}
        <EpisodeStamps episodeId={params.epId}/>

        <div style={{textAlign:'center',marginBottom:14}}>
          <TypoReportButton novelId={params.id} episodeId={params.epId} authorId={novel.author_id} userId={user?.id||null} userName={profile?.display_name||null} novelTitle={novel.title} episodeTitle={episode.title}/>
        </div>

        {/*
          * ★ 読み終わったら、次の話を大きく。
          *   前の話は下の帯にあるので、ここは次の話だけ。
          */}
        {nextEp ? (
          <Link href={`/novel/${params.id}/episode/${nextEp.id}`}
            style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,padding:'14px 16px',borderRadius:14,background:'var(--color-brand)',color:'#fff',textDecoration:'none',boxShadow:'0 6px 16px rgba(31,78,107,.25)'}}>
            <span style={{flex:1,minWidth:0}}>
              <span style={{display:'block',fontSize:11,color:'#bcd3e2'}}>次の話</span>
              <span style={{display:'block',fontSize:16,fontWeight:600,fontFamily:"var(--font-serif), 'Noto Serif JP', serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nextEp.title}</span>
            </span>
            <span aria-hidden style={{fontSize:22}}>›</span>
          </Link>
        ) : (
          <div style={{textAlign:'center',fontSize:13,color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',padding:'12px 8px',borderRadius:12,background:'var(--color-bg-card)',marginBottom:14}}>
            最新話です<br/>
            {showUpcoming ? (
              <span style={{fontSize:11,color:'var(--color-info)'}}>
                次は {new Date(upcomingEp!.scheduled_at!).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 頃
              </span>
            ) : (
              <Link href={`/novel/${params.id}`} style={{fontSize:12,color:'var(--color-brand)',textDecoration:'none'}}>目次に戻る</Link>
            )}
          </div>
        )}

        <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:10,padding:'12px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <Link href={`/novel/${params.id}`} style={{fontSize:13,fontWeight:700,color:'var(--color-text)',textDecoration:'none',display:'block',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{novel.title}</Link>
            <span style={{fontSize:11,color:'var(--color-text)'}}>作者：{author?.display_name}</span>
          </div>
          <Link href={`/novel/${params.id}`} style={{fontSize:11,border:'1px solid var(--color-brand-border)',padding:'5px 10px',borderRadius:12,color:'var(--color-text-muted)',background:'var(--color-bg)',textDecoration:'none',flexShrink:0}}>
            目次
          </Link>
        </div>

        {/*
          * ★ 読んだ印（ValidReadTracker）は、ここには置かない。
          *   パソコン用の並びは隠れているだけで、中身は動いている。
          *   2 つ置くと、1 回読んだだけで 2 回に数えてしまう。
          */}

        {/* ★ パソコンと同じく、コメントを受け付けない作品では欄を出さない */}
        {(novel.allow_comments === false || authorAllowsComments === false) &&
        comments.length === 0 ? null : (
          <CommentSection novelId={params.id} episodeId={params.epId} userId={user?.id||null} userName={profile?.display_name||null} userIconUrl={profile?.icon_url||null} authorId={novel.author_id} isAdmin={profile?.is_admin === true} comments={comments} allowNew={novel.allow_comments !== false && authorAllowsComments !== false}/>
        )}

        <div style={{height:80}}/>

        <MobileReadBar
          prevHref={prevEp ? `/novel/${params.id}/episode/${prevEp.id}` : null}
          tocHref={`/novel/${params.id}`}
          nextHref={nextEp ? `/novel/${params.id}/episode/${nextEp.id}` : null}
        />
      </div>
      <Footer />
    </div>
    </QuoteProvider>
  )
}
