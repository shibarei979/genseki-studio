import { createClient } from '@/lib/supabase/server'
import EpisodeChunks, { CHUNK_THRESHOLD } from '@/components/novel/episode-chunks'
export const revalidate = 10

export async function generateMetadata({ params }: { params: { id: string } }) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: novel } = await supabase
    .from('novels')
    .select('title, summary, cover_url, visibility, deleted_at')
    .eq('id', params.id).maybeSingle()

  /*
   * 題の「| 原石航路」は layout の型が付けるので、ここでは付けない。
   * 二重に付くと「作品名 | 原石航路 | 原石航路」になる。
   */
  const title = novel?.title || '作品'
  const description =
    novel?.summary?.slice(0, 120) ||
    '原石航路で公開されている作品です。'
  // 表紙が無い作品は、LP の一番上と同じ共有カードで代える
  const image = novel?.cover_url || '/og.jpg'
  const isOpen = novel?.visibility === 'public' && !novel?.deleted_at

  return {
    title,
    description,
    // 下書きと限定公開は検索に載せない
    robots: isOpen ? undefined : { index: false, follow: false },
    alternates: { canonical: `/novel/${params.id}` },
    openGraph: {
      type: 'book',
      url: `/novel/${params.id}`,
      title,
      description,
      siteName: '原石航路',
      locale: 'ja_JP',
      images: [{ url: image, alt: `${title} 表紙` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

import { notFound } from 'next/navigation'

import RecommendSection from '@/components/novel/recommend-section'
import Link from 'next/link'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import NovelActions from '@/components/novel/novel-actions'
import ReportButton from '@/components/common/report-button'
import { ageFromBirthdate, allowedRatings } from '@/lib/age'
import ObiBelt from '@/components/novel/obi-belt'
import { calcQualityScore } from '@/lib/quality-score'
import FollowButton from '@/components/follow-button'
import NovelParts from '@/components/novel/novel-parts'

export default async function NovelPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // profile（user依存）とnovel（独立）を並列取得
  const [profileRes, novelRes] = await Promise.all([
    user ? supabase.from('profiles').select('*').eq('user_id', user.id).single() : Promise.resolve({ data: null }),
    supabase.from('novels')
      .select('id, title, summary, genre, tags, is_serial, published, views, author_id, created_at, novel_type, official_tags, ai_usage, cover_url, cover_is_ai, age_rating, visibility, deleted_at')
      .eq('id', params.id).maybeSingle(),
  ])
  const profile = profileRes.data
  const novel = novelRes.data
  const novelError = (novelRes as any).error

  if (!novel || novelError) notFound()

  /*
   * 公開されていないものは見せない。
   *
   * ただし書いた本人だけは見られる。
   * 出す前に、どう見えるか確かめたい。
   */
  const isOwner = user?.id === novel.author_id
  const isOpen = novel.visibility === 'public' && !novel.deleted_at

  if (!isOpen && !isOwner) notFound()

  /*
   * 年齢の確認。
   *
   * 一覧では allowedRatings で隠していたが、
   * ページそのものには確認が無かった。
   * 住所を直接叩けば、誰でも R18 を開けていた。
   * R18 の作品ほど URL で人に渡されるので、ここが抜けていると意味がない。
   *
   * 作者は自分の作品なので、いつでも開ける。
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
          {/*
            * ★ 入ったあと、この作品へ戻す。
            *
            *   前は行き先を渡していなかったので、
            *   入ったあとホームに落ちていた。
            *   読みに来た人が、もう一度探し直すことになる。
            */}
          <Link href={!user ? `/login?next=${encodeURIComponent(`/novel/${params.id}`)}` : '/mypage?tab=settings'}
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

  /*
   * 1 話も投稿していない作品は、読者には出さない。
   * （話を読んだあと、下でもう一度確かめる）
   *
   * 作品を「公開」にしただけで中身が無いと、
   * 開いた人は空の目次を見ることになる。
   */

  // author・シリーズ情報・話一覧は互いに独立なので並列取得
  const [authorRes, seriesNovelRes, episodesRes] = await Promise.all([
    supabase.from('public_profiles').select('display_name, user_id').eq('user_id', novel.author_id).maybeSingle(),
    supabase.from('series_novels').select('series_id').eq('novel_id', params.id).maybeSingle(),
    supabase.from('episodes').select('id, title, ep_number, created_at, updated_at, posted_at, illust_url, chapter_id, published, is_published, scheduled_at')
      /* 上限を上げる。既定 1,000 件だと目次の後ろが消える */
      .eq('novel_id', params.id).order('ep_number', { ascending: true }).limit(5000),
  ])
  const authorProfile = authorRes.data
  const seriesNovelData = seriesNovelRes.data
  const rawEpisodes = episodesRes.data

  // シリーズ情報の詳細（series_idがある場合のみ）
  let seriesNovels: any[] = []
  let seriesTitle = ''
  if (seriesNovelData?.series_id) {
    const [seriesDataRes, snRes] = await Promise.all([
      supabase.from('series').select('title').eq('id', seriesNovelData.series_id).single(),
      supabase.from('series_novels').select('order_num, novels(id, title, genre)').eq('series_id', seriesNovelData.series_id).order('order_num'),
    ])
    seriesTitle = seriesDataRes.data?.title || ''
    seriesNovels = (snRes.data || []).map((s: any) => ({ ...s.novels, order_num: s.order_num }))
  }

  const isAuthor = user?.id === novel.author_id


  const nowMs = Date.now()
  /*
   * 時間の来た予約を公開する。
   *
   * 見るのは is_published。published は既定が true なので、
   * 「published === false」では 1 件も当たらず、
   * 予約しても時間が過ぎて出なかった。
   */
  const toPublish = (rawEpisodes || []).filter(ep =>
    ep.is_published !== true && ep.scheduled_at && new Date(ep.scheduled_at).getTime() <= nowMs
  )
  /*
   * 直すのは作者が開いたときだけ。
   *
   * 目次を見え方から読むようになったので、読者にも
   * 予約の行が見えるようになった。
   * 読者の画面でここを走らせても、話を書き換える決まりが
   * 無いので失敗する。それなのに画面の上だけ
   * 「公開済み」に見え、開くと本文が出ない話ができる。
   *
   * 時間の来た予約は、1 分ごとの定期実行が公開する。
   * ここは、その取りこぼしを作者が拾うための道。
   */
  if (isAuthor && toPublish.length > 0) {
    await supabase.from('episodes')
      /* 印は 2 つあるので、両方そろえて立てる */
      .update({ published: true, is_published: true, scheduled_at: null, publish_at: null })
      .in('id', toPublish.map(ep => ep.id))
    toPublish.forEach(ep => { ep.published = true; ep.is_published = true; ep.scheduled_at = null })
    if (novel.published === false) {
      await supabase.from('novels').update({ published: true }).eq('id', novel.id)
    }
  }

  /*
   * 読者に見せるのは、投稿された話だけ。
   *
   * 公開の印は表に 2 つある。
   *   is_published  既定 false。投稿ボタンで立つ。こちらが本物
   *   published     既定 true。作った時点で立ってしまう
   *
   * 以前は published を見ていたので、保存しただけの話まで
   * 並んでいた。見るのは is_published に統一する。
   * 予約投稿はどちらも一緒に立てているので、食い違わない。
   */
  /*
   * 作者にも、読者と同じものを見せる。
   *
   * 前は作者にだけ未公開の話も渡していた。
   * 自分の作品ページを開いたときに、読者が見る形と
   * 違って見え、公開できているかを確かめられなかった。
   *
   * 書きかけを見たいときは執筆画面がある。
   * 作品ページは「読者に何がどう見えているか」を
   * 確かめる場所にする。
   */
  const episodes = (rawEpisodes || []).filter(ep => ep.is_published === true)

  /*
   * 投稿された話が 1 つも無ければ、読者には見せない。
   * 作者には見せる（これから投稿する場所なので）。
   */
  if (!isOwner && (episodes || []).length === 0) notFound()

  /*
   * いちばん新しい更新の日時。
   *
   * 投稿された話の中から、いちばん新しいものを取る。
   * 直しただけの話は数えない。読者が知りたいのは「次の話が出た日」。
   */
  const lastUpdatedAt = (episodes || [])
    .filter(ep => ep.is_published === true)
    .map(ep => ep.posted_at || ep.created_at)
    .sort()
    .slice(-1)[0] || null

  /* 予告も読者と同じ。読者に出ないものは作者にも出さない */
  /*
   * ★ 元の一覧（rawEpisodes）から探す。
   *
   *   episodes は「投稿された話」だけに絞ったあとのもの。
   *   そこから「まだ投稿されていない話」を探しても、
   *   1 件も見つからない。予告が一度も出なかったのはこれ。
   */
  const upcomingEpisode = (rawEpisodes || [])
    .filter(ep => ep.is_published !== true && ep.scheduled_at && new Date(ep.scheduled_at).getTime() > nowMs)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0] || null

  /*
   * 章は chapters（箱A）だけを読む。
   *
   * 前は novel_chapters（箱B）も一緒に読んで混ぜていた。
   * 章の入れ物が 2 つあり、画面ごとに別の箱を見ていたため、
   * 執筆画面で作った章がマイページに出ない、という食い違いが
   * 起きていた。
   *
   * 箱Bの中身は箱Aへ写したので、ここは箱Aだけでよい。
   * 箱Bはしばらく残してあるが、もう読まない。
   */
  const { data: workChapters } = await supabase
    .from('chapters').select('id, title, sort_order, parent_id, is_part')
    .eq('novel_id', params.id)

  const chapters = (workChapters || []).map((c: any) => ({
    id: c.id as string,
    title: c.title as string,
    order_num: (c.sort_order as number) ?? 0,
    /* 部の 2 段を保つ */
    parent_id: (c.parent_id as string | null) ?? null,
  })).sort((a, b) => a.order_num - b.order_num)

  const epIds = (episodes || []).map(e => e.id)
  let epLikeCounts: Record<string,number>    = {}
  let epCommentCounts: Record<string,number> = {}
  let readEpisodeIds = new Set<string>()

  if (epIds.length > 0) {
    const [elData, ecData] = await Promise.all([
      supabase.from('episode_likes').select('episode_id').in('episode_id', epIds),
      supabase.from('comments').select('episode_id').in('episode_id', epIds).not('episode_id','is',null),
    ])
    elData.data?.forEach((el: any) => { epLikeCounts[el.episode_id] = (epLikeCounts[el.episode_id] || 0) + 1 })
    ecData.data?.forEach((ec: any) => { if (ec.episode_id) epCommentCounts[ec.episode_id] = (epCommentCounts[ec.episode_id] || 0) + 1 })
    if (user) {
      const { data: readData } = await supabase
        .from('read_episodes').select('episode_id')
        .eq('user_id', user.id).in('episode_id', epIds)
      readData?.forEach((r: any) => readEpisodeIds.add(r.episode_id))
    }
  }

  const [likeCountRes, viewDataRes, discoverCountRes, bookmarkCountRes] = await Promise.all([
    supabase.from('likes').select('*',{count:'exact',head:true}).eq('novel_id', params.id),
    supabase.from('novel_views').select('view_count').eq('novel_id', params.id).maybeSingle(),
    supabase.from('discovers').select('*',{count:'exact',head:true}).eq('novel_id', params.id).eq('is_pending', false),
    supabase.from('bookmarks').select('*',{count:'exact',head:true}).eq('novel_id', params.id),
  ])
  const likeCount = likeCountRes.count
  const viewCount = viewDataRes.data?.view_count || 0
  const discoverCount = discoverCountRes.count
  const bookmarkCount = bookmarkCountRes.count

  // ドット絵帯：承認済み・自分の帯・（作者なら）承認待ち
  const isAuthorViewing = !!user && user.id === novel.author_id
  const [obiApprovedRes, obiMineRes, obiPendingRes] = await Promise.all([
    supabase.from('obi_dots').select('id, creator_id, creator_name, dots, show_in_comments, approved').eq('novel_id', params.id).eq('approved', true).limit(30),
    user ? supabase.from('obi_dots').select('id, creator_id, creator_name, dots, show_in_comments, approved').eq('novel_id', params.id).eq('creator_id', user.id).maybeSingle() : Promise.resolve({ data: null } as any),
    isAuthorViewing ? supabase.from('obi_dots').select('id, creator_id, creator_name, dots, show_in_comments, approved').eq('novel_id', params.id).eq('approved', false).limit(30) : Promise.resolve({ data: [] } as any),
  ])

  let liked = false, discovered = false, bookmarked = false
  if (user) {
    const [l, d, b] = await Promise.all([
      supabase.from('likes').select('user_id').eq('novel_id', params.id).eq('user_id', user.id).maybeSingle(),
      supabase.from('discovers').select('user_id').eq('novel_id', params.id).eq('user_id', user.id).maybeSingle(),
      supabase.from('bookmarks').select('user_id').eq('novel_id', params.id).eq('user_id', user.id).maybeSingle(),
    ])
    liked      = !!l.data
    discovered = !!d.data
    bookmarked = !!b.data
  }

  const author = authorProfile as any

  let isFollowing = false
  let followerCount = 0
  if (author?.user_id) {
    const [{ count: fc }, followData] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', author.user_id),
      user ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', author.user_id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    followerCount = fc || 0
    isFollowing = !!followData.data
  }

  const { data: discoverComments } = await supabase
    .from('discovers').select('comment, display_name, created_at, user_id')
    .eq('novel_id', params.id).not('comment', 'is', null).eq('is_pending', false)
    .order('created_at', { ascending: false }).limit(5)

  // シリーズ内の作品IDを収集
  const seriesNovelIds = new Set(seriesNovels.map((n: any) => n.id))

  /*
   * おすすめ作品は、画面が出たあとに読む。
   *
   * 好みを拾って点を付けるのに 20 回近くかかるが、
   * 出るのは画面の一番下。
   * ここで待つと、あらすじも目次も遅れる。
   */
  const recommendedNovels: any[] = []
  const recAuthorMap: Record<string,string> = {}

  function fmtNum(n: number): string {
    if (n >= 10000) return (Math.floor(n / 1000) / 10) + '万'
    if (n >= 1000) return (Math.floor(n / 100) / 10) + 'K'
    return n.toString()
  }

  /**
   * 日付と時刻。
   *
   * ★ 何時に出たかまで見せる。
   *   同じ日に何話も出す作品では、日付だけだと順が分からない。
   */
  function fmtDateTime(d: string) {
    const dt = new Date(d)
    return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
  }

  function fmtDate(d: string) {
    const dt = new Date(d)
    return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()}`
  }

  const readCount  = readEpisodeIds.size
  const totalCount = episodes?.length ?? 0

  const allEpisodes = episodes || []
  const hasChapters = (chapters || []).length > 0
  const unassignedEpisodes = allEpisodes.filter(ep => !ep.chapter_id)
  const chapterGroups = (chapters || []).map(ch => ({
    chapter: ch,
    episodes: allEpisodes.filter(ep => ep.chapter_id === ch.id),
  })).filter(g =>
    /*
     * 話の入っている章は出す。
     *
     * あわせて、子を持つ章（大きい章）も残す。
     * 大きい章そのものには話が入らないので、
     * 数だけで切ると消えてしまい、
     * 中の小さい章ごと見えなくなる。
     */
    g.episodes.length > 0 ||
    (chapters || []).some((c: any) => c.parent_id === g.chapter.id)
  )

  function EpisodeRow({ ep }: { ep: any }) {
    const isReadEp = readEpisodeIds.has(ep.id)
    /* 予約の札も出さない。読者には見えないもの */
    const isScheduled = false
    return (
      <Link href={`/novel/${params.id}/episode/${ep.id}`} style={{textDecoration:'none',display:'block'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderBottom:'1px solid var(--color-brand-light)',background: isReadEp ? '#e5e7eb' : 'var(--color-bg-card)'}}>
          {/*
           * ★ 挿絵は、ここには出さない。
           *
           *   話ごとの挿絵は、読む画面の本文の前にだけ出す。
           *   目次に並べると、そちらが主役になって
           *   題名が読み取りにくくなる。
           */}
          <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:5}}>
            {isReadEp && <span style={{fontSize:10,color:'var(--color-success)',fontWeight:700,flexShrink:0}}>✓</span>}
            <span style={{fontSize:13,fontWeight:500,color: isReadEp ? '#4b5563' : 'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ep.title}</span>
            {isScheduled && (
              <span style={{fontSize:9,background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'1px 7px',borderRadius:10,flexShrink:0,whiteSpace:'nowrap'}}>
                予約 {new Date(ep.scheduled_at).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
              </span>
            )}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
            {epLikeCounts[ep.id] > 0 && <span style={{fontSize:10,color:'var(--color-text-muted)'}}>♡ {fmtNum(epLikeCounts[ep.id])}</span>}
            {epCommentCounts[ep.id] > 0 && (
              <span style={{fontSize:10,color:'var(--color-text-muted)',display:'inline-flex',alignItems:'center',gap:2}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {fmtNum(epCommentCounts[ep.id])}
              </span>
            )}
            {/*
              * ★ 日付は 2 つ出す。
              *
              *   前は 1 つだけで、そこに（済）と付けていた。
              *   何の印か伝わらず、出た日も分からなかった。
              *
              *   投稿   読めるようになった日
              *   改稿   そのあと本文を直した日（1日以上あいたときだけ）
              */}
            <span style={{fontSize:10,color:'var(--color-text-faint)',whiteSpace:'nowrap'}}>
              {fmtDateTime(ep.posted_at || ep.created_at)}
              {/* ★ 少しでも直していれば、改稿として出す */}
              {ep.updated_at &&
                new Date(ep.updated_at).getTime() > new Date(ep.posted_at || ep.created_at).getTime() + 60000 && (
                  <span style={{marginLeft:4,color:'var(--color-text-muted)'}}>
                    改稿 {fmtDateTime(ep.updated_at)}
                  </span>
                )}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div style={{minHeight:'100vh'}}>
      {/*
       * 構造化データ。
       * 「これは本で、作者は誰で、いつからあるか」を
       * 検索エンジンに機械の言葉（schema.org）で伝える。
       * 公開中の作品だけ。下書きは名乗らない。
       */}
      {isOpen && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Book',
              name: novel.title,
              description: novel.summary || undefined,
              author: authorRes.data?.display_name
                ? { '@type': 'Person', name: authorRes.data.display_name }
                : undefined,
              image: novel.cover_url || undefined,
              genre: novel.genre || undefined,
              inLanguage: 'ja',
              dateCreated: novel.created_at || undefined,
            }),
          }}
        />
      )}
      <Header />

      <div className="nv-page" style={{maxWidth:1200,margin:'0 auto',padding:'20px 32px',display:'flex',gap:20,alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:0}}>

          <div style={{fontSize:12,color:'var(--color-text-muted)',marginBottom:12,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
            <Link href="/" style={{color:'var(--color-brand)',textDecoration:'none'}}>ホーム</Link>
            <span>›</span>
            {/*
              * ★ 行き先は「作品を探す」。
              *
              *   前は /genre/◯◯ を指していたが、その頁は無い。
              *   押すと、絞り込みだけ選ばれた空の画面に落ちていた。
              */}
            <Link href={`/search?genre=${encodeURIComponent(novel.genre)}`} style={{color:'var(--color-brand)',textDecoration:'none'}}>{novel.genre}</Link>
            <span>›</span>
            <span style={{color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth: '60vw'}}>{novel.title}</span>
          </div>

          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'16px',marginBottom:14}}>
            <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
              <span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',padding:'2px 8px',borderRadius:4}}>{novel.genre}</span>
              <span style={{fontSize:10,background:novel.is_serial?'#e8f5e9':'#f5f5f5',color:novel.is_serial?'#2e7d32':'#757575',border:`1px solid ${novel.is_serial?'#a5d6a7':'#e0e0e0'}`,padding:'2px 8px',borderRadius:4}}>
                {novel.is_serial?'連載中':'完結'}
              </span>
              {novel.novel_type && (
                <span style={{fontSize:10,background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'2px 8px',borderRadius:4}}>{novel.novel_type}</span>
              )}
              {novel.ai_usage === 'generated' && (
                <span style={{fontSize:10,background:'#ede9fe',color:'#6d28d9',border:'1px solid #c4b5fd',padding:'2px 8px',borderRadius:4,fontWeight:700}}>AI作品</span>
              )}
              {(novel.official_tags||[]).map((tag:string) => (
                <span key={tag} style={{fontSize:10,background:'#fef9c3',color:'#854d0e',border:'1px solid #fde047',padding:'2px 8px',borderRadius:4,fontWeight:700}}>
                  {tag}
                </span>
              ))}
              {(novel.tags||[]).map((t: string) => (
                <span key={t} style={{fontSize:10,background:'var(--color-bg)',color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',padding:'2px 8px',borderRadius:4}}>#{t}</span>
              ))}
            </div>
            <h1 style={{fontSize:20,fontWeight:700,color:'var(--color-text)',lineHeight:1.4,marginBottom:8,fontFamily:"'Noto Serif JP',serif"}}>{novel.title}</h1>
            {upcomingEpisode && (
              <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--color-info-bg)',border:'1.5px solid #93c5fd',borderRadius:8,padding:'8px 14px',marginBottom:10,fontSize:12,color:'#1d4ed8',fontWeight:600}}>
                次回更新予告：{new Date(upcomingEpisode.scheduled_at!).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 頃
              </div>
            )}
            <div style={{fontSize:13,color:'var(--color-text-muted)',marginBottom:12,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              作者：
              <a href={`/author/${author?.user_id}`} style={{color:'var(--color-brand)',textDecoration:'none',fontWeight:600}}>{author?.display_name}</a>
              {!isAuthor && user && author?.user_id && (
                <FollowButton authorId={author.user_id} userId={user.id} initialFollowing={isFollowing} followerCount={followerCount}/>
              )}
              {!user && author?.user_id && (
                <span style={{fontSize:11,color:'var(--color-text-faint)'}}>フォロワー {followerCount}</span>
              )}
            </div>
            <ObiBelt
              novelId={params.id}
              novelTitle={novel.title}
              userId={user?.id || null}
              userName={(profile as any)?.display_name || ''}
              isAuthor={isAuthorViewing}
              hasDiscovered={discovered}
              approvedObis={(obiApprovedRes.data || []) as any}
              myObi={(obiMineRes.data || null) as any}
              pendingObis={(obiPendingRes.data || []) as any}
            />
            {(() => {
              /*
               * 表紙とあらすじを横に並べる。
               *
               * 表紙だけ上に大きく出すと、あらすじまで指を送ることになる。
               * 絵と文が並んでいるほうが、どんな話か一目で掴める。
               * 狭い画面では縦に積む。
               *
               * ★ 表紙が無いときに、1話目の挿絵を借りるのはやめた。
               *
               *   作者は表紙として登録していない絵が出るとは思っていない。
               *   挿絵を本文の途中に置けるようになって、
               *   なおさら「なぜこの絵が表紙に」と見える。
               */
              const coverImg = novel.cover_url
              if (!coverImg && !novel.summary) return null

              return (
                <div style={{
                  display:'flex',
                  gap:14,
                  alignItems:'flex-start',
                  marginBottom:14,
                  flexWrap:'wrap',
                  /*
                   * あらすじが無いときは、表紙を真ん中に。
                   *
                   * 左に寄せたままだと、右が大きく空いて
                   * 置き忘れたように見える。
                   */
                  justifyContent: novel.summary ? 'flex-start' : 'center',
                }}>
                  {novel.summary && (
                    /*
                     * あらすじ。
                     *
                     * ★ 5 行で止めて、続きは押して出す。
                     *
                     *   長いあらすじは 20 行を超えることがあり、
                     *   目次や「最初から読む」が画面の外へ押し出される。
                     *   読むかどうかを決める前に、その道が見えなくなる。
                     *
                     * ★ 印（checkbox）と札（label）だけで作る。
                     *   このページはサーバー側で組み立てるので、
                     *   状態を持つ部品にすると作りが増える。
                     */
                    <div className="nv-summary" style={{flex:'1 1 320px',minWidth:0}}>
                      <input type="checkbox" id="nv-more" className="nv-summary-check" />

                      <div className="nv-summary-text" style={{fontSize:13,color:'var(--color-text)',lineHeight:1.85,padding:'10px 12px',background:'var(--color-bg)',borderRadius:8,borderLeft:'3px solid #f5a060',whiteSpace:'pre-wrap'}}>
                        {novel.summary}
                      </div>

                      <label htmlFor="nv-more" className="nv-summary-label">
                        <span className="nv-summary-open">続きを読む</span>
                        <span className="nv-summary-close">とじる</span>
                      </label>
                    </div>
                  )}

                  {coverImg && (
                    /*
                     * 表紙を枠で囲む。
                     *
                     * ハンコを絵の右上に重ねるには、
                     * 絵と同じ大きさの入れ物が要る。
                     * 絵そのものには重ねられない。
                     */
                    <div style={{position:'relative', flexShrink:0, alignSelf:'flex-start', lineHeight:0}}>
                    {novel.cover_is_ai && (
                      /*
                       * AI のハンコ。
                       *
                       * 絵を見ただけでは分からないので、
                       * 作者の申告をそのまま出す。
                       *
                       * 右上の角に、少しだけはみ出して重ねる。
                       * 中へ入れきると表紙の絵を隠しすぎ、
                       * 外へ出しきると表紙と関わりが無く見える。
                       *
                       * 暗い表紙では赤が沈むので、
                       * 白いふちを回して読めるようにする。
                       */
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src="/images/ai-cover-stamp.png"
                        alt="この表紙はAI画像を使っています"
                        title="この表紙はAI画像を使っています"
                        style={{
                          position:'absolute',
                          top:-6,
                          right:-6,
                          zIndex:1,
                          width:72,
                          height:72,
                          transform:'rotate(-8deg)',
                          /*
                           * 薄くする。
                           *
                           * 濃いままだと表紙より先に目に入り、
                           * 作品の顔をハンコが食ってしまう。
                           * 見えればよいものなので、後ろへ下げる。
                           */
                          opacity:.55,
                          filter:'drop-shadow(0 0 2px rgba(255,255,255,.9)) drop-shadow(0 1px 2px rgba(0,0,0,.18))',
                          pointerEvents:'none',
                        }}/>
                    )}
                    {/*
                     * 表紙。
                     *
                     * 150px では、描いた絵の細部が潰れる。
                     * 作品の顔なので、読む前にきちんと見せたい。
                     *
                     * 縦横は切らずに全体を出す（contain）。
                     * cover で切ると、題字や人物が欠けることがある。
                     */}
                    <img src={coverImg} alt={`${novel.title} 表紙`}
                      style={{
                        /*
                         * 幅。
                         *
                         * 縦長を基準に 200px。
                         * ただし横長の絵は、同じ幅だと高さが半分以下になり
                         * 切手のように小さく見える。
                         * 上限を高さで決め、横長は横へ伸ばす。
                         */
                        width:'auto',
                        maxWidth:'min(340px, 100%)',
                        maxHeight:290,
                        borderRadius:10,
                        border:'1px solid var(--color-brand-border)',
                        objectFit:'contain',
                        background:'var(--color-bg)',
                        flexShrink:0,
                        alignSelf:'flex-start',
                      }}/>
                    </div>
                  )}
                </div>
              )
            })()}
            <NovelActions
              novelId={params.id}
              userId={user?.id || null}
              authorId={novel.author_id}
              novelTitle={novel.title}
              isAuthor={isAuthor}
              userDisplayName={profile?.display_name || ''}
              initialLiked={liked}
              initialBookmarked={bookmarked}
              initialDiscovered={discovered}
              likeCount={likeCount??0}
              bookmarkCount={bookmarkCount??0}
              discoverCount={discoverCount??0}
              hideStats={Date.now() - new Date(novel.created_at).getTime() < 7*24*60*60*1000 || (likeCount??0) < 50}
            />
            {/*
              * 通報。作品ページの押し具の下に、控えめに置く。
              *
              * いいねや保存と同じ大きさで並べると、
              * 押し間違いが起きる。
              */}
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
              <ReportButton
                target="novel"
                targetId={params.id}
                accusedId={novel.author_id}
                accusedName={author?.display_name || ''}
                quotedBody={novel.title}
                userId={user?.id || null}
                userName={profile?.display_name || ''}
              />
            </div>
            {/*
              * 読者へのダウンロードは出さない。
              *
              * ログインしていない人でも作品ぜんぶを
              * .txt・Word・PDF で落とせる状態だった。
              *
              * 本文はページの中に文字として入っているので、
              * 消しても無断転載そのものは防げない。
              * 防げるのは「原石航路が公式に配っている」という
              * 見え方のほうで、作家が不安を持つのはそこだった。
              *
              * 作者本人は、設定 → 原稿管理から今までどおり
              * 落とせる。そちらは触っていない。
              *
              * 求める声が出たら、作品ごとに作者が選べる形へ広げる。
              */}
          </div>

          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:4}}>
                <span style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>目次（{totalCount}話）</span>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  {user && totalCount > 0 && (
                    <span style={{fontSize:11,color:'var(--color-success)',fontWeight:600}}>✓ {fmtNum(readCount)}/{fmtNum(totalCount)}話 既読</span>
                  )}
                  {/*
                    * ★ 最終更新は、いちばん新しい話の日時を見る。
                    *
                    *   前は目次の最後の話の「作った日」を見ていた。
                    *   話の並び順は作者が決めるので、最後の話が
                    *   いちばん新しいとは限らない。
                    */}
                  <span style={{fontSize:11,color:'var(--color-text-muted)'}}>最終更新：{lastUpdatedAt ? fmtDate(lastUpdatedAt) : '—'}</span>
                </div>
              </div>
            </div>

            {/*
              * 次に出る話の予定。
              *
              * ★ 目次にも出す。
              *   「次はいつか」を見に来る人は、まず目次を開く。
              */}
            {upcomingEpisode && (
              <div style={{padding:'8px 14px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-info-bg)',fontSize:12,color:'var(--color-info)',textAlign:'center'}}>
                次の話は {new Date(upcomingEpisode.scheduled_at!).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 頃の予定です
              </div>
            )}

            {!episodes || episodes.length === 0 ? (
              <div style={{padding:'32px',textAlign:'center',color:'var(--color-text-faint)',fontSize:13}}>まだ話がありません</div>
            ) : !hasChapters ? (
              /*
               * 話が多いときは 50 話ずつ束ねる。
               * 全部並べると、目当ての話まで指を送り続けることになる。
               */
              allEpisodes.length > CHUNK_THRESHOLD ? (
                <EpisodeChunks
                  episodes={allEpisodes}
                  renderRow={(ep) => <EpisodeRow key={ep.id} ep={ep} />}
                />
              ) : (
                allEpisodes.map((ep) => <EpisodeRow key={ep.id} ep={ep} />)
              )
            ) : (
              /*
               * 部があれば、部ごとに切り替える目次を出す。
               * 部を作っていない作品は、この中で
               * これまでどおりの目次に素通りする。
               */
              <NovelParts
                novelId={params.id}
                chapterGroups={chapterGroups}
                unassignedEpisodes={unassignedEpisodes}
                readEpisodeIds={Array.from(readEpisodeIds)}
                epLikeCounts={epLikeCounts}
                epCommentCounts={epCommentCounts}
              />
            )}

            {episodes && episodes.length > 0 && (
              <div style={{padding:'12px 16px',textAlign:'center',borderTop:'1px solid var(--color-brand-border)'}}>
                <Link href={`/novel/${params.id}/episode/${episodes[0].id}`}
                  style={{display:'inline-block',background:'var(--color-brand)',color:'var(--color-bg-card)',fontWeight:700,padding:'10px 32px',borderRadius:20,fontSize:14,textDecoration:'none'}}>
                  最初から読む
                </Link>
              </div>
            )}
          </div>

          {/* ===== 読者の声（拡散推薦文） ===== */}
          {discoverComments && discoverComments.length > 0 && (
            <div style={{marginTop:20,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'10px 14px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)'}}>
                <span style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>読者の声</span>
              </div>
              {discoverComments.map((d: any) => d.comment && (
                <div key={d.user_id} style={{padding:'12px 16px',borderBottom:'1px solid var(--color-brand-light)'}}>
                  <p style={{fontSize:13,color:'var(--color-text)',lineHeight:1.7,margin:0,marginBottom:4}}>{d.comment}</p>
                  <div style={{fontSize:11,color:'var(--color-text-muted)'}}>{d.display_name}</div>
                </div>
              ))}
            </div>
          )}

          {/* ===== 同シリーズの作品 ===== */}
          {seriesNovels.length > 1 && (
            <div style={{marginTop:20,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'10px 14px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)',display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:4,height:16,background:'var(--color-brand)',borderRadius:2,display:'inline-block'}}/>
                <span style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>シリーズ：{seriesTitle}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column'}}>
                {seriesNovels.map((n: any, i: number) => (
                  <Link key={n.id} href={`/novel/${n.id}`}
                    style={{textDecoration:'none',display:'block',borderBottom:i<seriesNovels.length-1?'1px solid var(--color-brand-light)':'none',background:n.id===params.id?'var(--color-brand-light)':'none'}}>
                    <div style={{padding:'10px 14px',display:'flex',gap:10,alignItems:'center'}}>
                      <span style={{fontSize:12,fontWeight:700,color:'var(--color-brand)',minWidth:24,flexShrink:0}}>#{i+1}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:n.id===params.id?700:500,color:n.id===params.id?'var(--color-brand)':'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {n.title}{n.id===params.id?' ◀ 現在':''}
                        </div>
                        <div style={{fontSize:10,color:'var(--color-text-muted)'}}>{n.genre}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* おすすめ作品。画面が出たあとに読む */}
          <RecommendSection
            novelId={params.id}
            genre={novel.genre || ''}
            excludeIds={Array.from(seriesNovelIds).join(',')}
          />

          <div className="mobile-only" style={{height:80}}/>
        </div>

      </div>
      <Footer />
    </div>
  )
}
