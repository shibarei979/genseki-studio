import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MypageClient from '@/components/mypage/mypage-client'

export default async function MypagePage() {
  /*
   * どこで時間がかかっているかを測る。
   *
   * Vercel の Logs に出る。
   * 原因が分かったら消してよい。
   */
  const t0 = Date.now()
  const mark = (name: string) => console.log(`[mypage] ${name}: ${Date.now() - t0}ms`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirectTo=/mypage')

  /* 自分の情報は 1 行なので、そのまま */
  mark('auth')
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
  mark('profile')

  if (!profile) {
    await supabase.from('profiles').upsert({
      user_id: user.id,
      display_name: user.email?.split('@')[0] || 'ユーザー',
      email: user.email || '',
      icon_url: '',
    })
  }

  const [
    { count: followerCount },
    { count: followingCount2 },
  ] = await Promise.all([
    supabase.from('follows').select('*', { count:'exact', head:true }).eq('following_id', user.id),
    supabase.from('follows').select('*', { count:'exact', head:true }).eq('follower_id', user.id),
  ])

  const nowIso = new Date().toISOString()

  /*
   * 互いに関わらないものを、まとめて頼む。
   *
   * 1 つずつ待つと、往復の時間が積み上がる。
   * 取ってくるものは前と同じ。
   */
  const [
    followingRes, novelRes, bookmarkRes, missionRes,
  ] = await Promise.all([
    supabase
      .from('follows')
      .select('following_id, profiles!follows_following_id_fkey(user_id, display_name, icon_url)')
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      /*
       * 使う列だけ。
       *
       * select('*') は、あとで足した列も全部運ぶ。
       * 運んでも画面では使わないので、そのぶんが待ち時間になる。
       */
      .from('novels')
      .select('id, author_id, title, summary, genre, tags, is_serial, published, novel_type, created_at, updated_at, views')
      .eq('author_id', user.id).order('created_at', { ascending: false }),

    supabase
      .from('bookmarks')
      .select('novel_id, created_at, folder_id, novels(id, title, genre, is_serial, novel_type, summary, tags, author_id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase.from('user_missions').select('mission_id').eq('user_id', user.id),
  ])

  mark('batch1')
  const followingData = followingRes.data
  const novels = novelRes.data
  const bookmarkedNovels = bookmarkRes.data
  const claimedMissions = missionRes.data

  const followingAuthors = (followingData || []).map((f: any) => f.profiles).filter(Boolean)

  // 作品ごとのいいね・コメント・閲覧数
  const novelIds = (novels || []).map((n: any) => n.id)
  const novelLikeMap: Record<string,number> = {}
  const novelCommentMap: Record<string,number> = {}
  const novelViewMap: Record<string,number> = {}
  const novelEpCountMap: Record<string,number> = {}
  if (novelIds.length > 0) {
    const [likesData, commentsData, viewsData, epsData] = await Promise.all([
      supabase.from('likes').select('novel_id').in('novel_id', novelIds),
      supabase.from('comments').select('novel_id').in('novel_id', novelIds),
      supabase.from('page_views').select('novel_id').in('novel_id', novelIds),
      supabase.from('episodes').select('novel_id').in('novel_id', novelIds).eq('published', true),
    ])
    likesData.data?.forEach((l:any) => { novelLikeMap[l.novel_id] = (novelLikeMap[l.novel_id]||0)+1 })
    commentsData.data?.forEach((c:any) => { novelCommentMap[c.novel_id] = (novelCommentMap[c.novel_id]||0)+1 })
    viewsData.data?.forEach((v:any) => { novelViewMap[v.novel_id] = (novelViewMap[v.novel_id]||0)+1 })
    epsData.data?.forEach((e:any) => { novelEpCountMap[e.novel_id] = (novelEpCountMap[e.novel_id]||0)+1 })
  }

  /*
   * カレンダー・保存済みの書き手・閲覧履歴。
   * どれも互いに関わらないので、まとめて頼む。
   */
  const bmAuthorIds = Array.from(new Set((bookmarkedNovels||[]).map((b:any) => b.novels?.author_id).filter(Boolean)))

  const [bmAuthorRes, viewRes] = await Promise.all([

    bmAuthorIds.length > 0
      ? supabase.from('profiles').select('user_id, display_name').in('user_id', bmAuthorIds as string[])
      : Promise.resolve({ data: [] } as any),

    supabase
      .from('page_views').select('episode_id, novel_id, viewed_at')
      /*
       * 閲覧履歴。
       *
       * 200 件読んでも、作品ごとに 1 つへ畳む。
       * 同じ作品を何度も開くので、200 件でも作品は数十。
       * 60 件あれば足りる。
       */
      .eq('user_id', user.id).order('viewed_at', { ascending: false }).limit(60),
  ])

  mark('batch2')
  /* カレンダーはどこにも出していないので読まない */

  const bmAuthorMap: Record<string,string> = {}
  bmAuthorRes.data?.forEach((a:any) => { bmAuthorMap[a.user_id] = a.display_name })


  // 未読の感想（コメント＋拡散）・未読ランクイン：read_feedbacksに無いもの＝未読
  let unreadFeedback = 0, unreadRanking = 0
  {
    const [cmRes, dcRes, rkRes, readRes] = await Promise.all([
      /*
       * 未読の数。
       *
       * 3,500 行を運んで、数を出すだけだった。
       * 出るのは「3」のような小さな数字なので、
       * そこまで正確でなくてよい。
       *
       * 新しいものから 100 件ずつ見る。
       * それより古い未読は、もう読まれない。
       */
      novelIds.length > 0 ? supabase.from('comments').select('id').in('novel_id',novelIds).neq('user_id',user.id).order('created_at',{ascending:false}).limit(100) : Promise.resolve({ data: [] } as any),
      novelIds.length > 0 ? supabase.from('discovers').select('novel_id, user_id, created_at').in('novel_id',novelIds).eq('is_pending',false).neq('user_id',user.id).order('created_at',{ascending:false}).limit(100) : Promise.resolve({ data: [] } as any),
      supabase.from('ranking_history').select('id').eq('author_id',user.id).order('created_at',{ascending:false}).limit(100),
      supabase.from('read_feedbacks').select('item_key').eq('user_id',user.id).order('created_at',{ascending:false}).limit(300),
    ])
    const readSet = new Set((readRes.data || []).map((r: any) => r.item_key))
    const fbKeys = [
      ...(cmRes.data || []).map((c: any) => `c-${c.id}`),
      ...(dcRes.data || []).map((d: any) => `d-${d.novel_id}-${d.user_id}-${d.created_at}`),
    ]
    unreadFeedback = fbKeys.filter(k => !readSet.has(k)).length
    unreadRanking = (rkRes.data || []).map((r: any) => `r-${r.id}`).filter(k => !readSet.has(k)).length
  }

  const claimedMissionIds = (claimedMissions || []).map((r: any) => r.mission_id)

  // 活動サマリー（今月・先月比）と最近のつぶやき
  const nowD = new Date()
  const thisMonthStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(nowD.getFullYear(), nowD.getMonth() - 1, 1).toISOString()
  /*
   * 活動サマリーは無くした。
   *
   * 今月と先月を比べるために、作品・話・閲覧・いいねを
   * 期間ごとに 8 回数えていた。
   * 出るのは小さな数字 4 つで、そこに 1 秒以上かかっていた。
   */
  const monthlySummary = null
  const recentTweet = null

  // 閲覧履歴
  const views = viewRes.data

  const epIds = Array.from(new Set((views||[]).map((v:any) => v.episode_id).filter(Boolean)))
  const latestViewMap: Record<string,string> = {}
  views?.forEach((v:any) => { if (v.episode_id && !latestViewMap[v.episode_id]) latestViewMap[v.episode_id] = v.viewed_at })

  let historyItems: any[] = []
  if (epIds.length > 0) {
    const { data: episodes } = await supabase
      .from('episodes').select('id, title, ep_number, novel_id, novels(id, title, genre, author_id, summary, tags, novel_type, is_serial)')
      .in('id', epIds as string[])

    const authorIds2 = Array.from(new Set((episodes||[]).map((e:any) => e.novels?.author_id).filter(Boolean)))
    const authorMap2: Record<string,string> = {}
    if (authorIds2.length > 0) {
      const { data: authors2 } = await supabase.from('profiles').select('user_id, display_name').in('user_id', authorIds2 as string[])
      authors2?.forEach((a:any) => { authorMap2[a.user_id] = a.display_name })
    }

    const novelMap: Record<string,any> = {}
    episodes?.forEach((ep:any) => {
      const novel = ep.novels; if (!novel) return
      const viewedAt = latestViewMap[ep.id]
      if (!novelMap[novel.id] || viewedAt > novelMap[novel.id].viewedAt) {
        novelMap[novel.id] = {
          novelId: novel.id, novelTitle: novel.title,
          genre: novel.genre, novelType: novel.novel_type||'',
          isSerial: novel.is_serial, authorId: novel.author_id,
          displayName: authorMap2[novel.author_id]||'',
          summary: novel.summary||'', tags: novel.tags||[],
          epId: ep.id, epTitle: ep.title, epNumber: ep.ep_number, viewedAt,
        }
      }
    })
    historyItems = Object.values(novelMap).sort((a,b) => b.viewedAt > a.viewedAt ? 1 : -1)
  }

  const historyNovelIds = historyItems.map((i:any) => i.novelId)
  const firstEpMap: Record<string,string> = {}
  if (historyNovelIds.length > 0) {
    /*
     * 第 1 話だけ欲しい。
     *
     * 全話を運んで最初だけ使っていた。
     * 10 作品 × 50 話なら 500 行を運んで、使うのは 10 行。
     *
     * 5 話目までに絞る。1 話から始まらない作品もあるので、
     * ちょうど 1 に限らず、少し幅を持たせる。
     */
    const { data: firstEps } = await supabase.from('episodes').select('id, novel_id, ep_number')
      .in('novel_id', historyNovelIds).eq('published', true)
      .lte('ep_number', 5).order('ep_number', { ascending: true })
    firstEps?.forEach((ep:any) => { if (!firstEpMap[ep.novel_id]) firstEpMap[ep.novel_id] = ep.id })
  }

  const charCountMap: Record<string,number> = {}
  const likeMap2: Record<string,number> = {}
  if (historyNovelIds.length > 0) {
    const [epData, likeData] = await Promise.all([
      supabase.from('episodes').select('novel_id, char_count').in('novel_id', historyNovelIds),
      supabase.from('likes').select('novel_id').in('novel_id', historyNovelIds),
    ])
    epData.data?.forEach((ep:any) => { charCountMap[ep.novel_id] = (charCountMap[ep.novel_id]||0)+(ep.char_count||0) })
    likeData.data?.forEach((l:any) => { likeMap2[l.novel_id] = (likeMap2[l.novel_id]||0)+1 })
  }

  // ミッション用stats
  let missionStats = { likeCount:0, discoverCount:0, commentCount:0, bookmarkCount:0, novelCount:0, episodeCount:0, followCount:0, readCount:0, hasBio:false, tweetCount:0, seriesCount:0 }
  const [likesM, discoversM, commentsM, bookmarksM, novelsCountM, followsCountM, readsM, tweetsM, seriesM] = await Promise.all([
    supabase.from('likes').select('*',{count:'exact',head:true}).eq('user_id',user.id),
    supabase.from('discovers').select('*',{count:'exact',head:true}).eq('user_id',user.id),
    supabase.from('comments').select('*',{count:'exact',head:true}).eq('user_id',user.id),
    supabase.from('bookmarks').select('*',{count:'exact',head:true}).eq('user_id',user.id),
    supabase.from('novels').select('*',{count:'exact',head:true}).eq('author_id',user.id).eq('published',true),
    /* フォロー数は上で数えている。使い回す */
    Promise.resolve({ count: followingCount2 } as any),
    supabase.from('read_episodes').select('*',{count:'exact',head:true}).eq('user_id',user.id),
    supabase.from('tweets').select('*',{count:'exact',head:true}).eq('user_id',user.id),
    supabase.from('series').select('*',{count:'exact',head:true}).eq('user_id',user.id),
  ])
  /* すでに読んだものを使う。同じ問い合わせを 2 度していた */
  const myNovelIds2 = novelIds
  let episodeCount2 = 0
  if (myNovelIds2.length > 0) {
    const {count} = await supabase.from('episodes').select('*',{count:'exact',head:true}).in('novel_id',myNovelIds2)
    episodeCount2 = count||0
  }
  missionStats = {
    likeCount: likesM.count||0, discoverCount: discoversM.count||0,
    commentCount: commentsM.count||0, bookmarkCount: bookmarksM.count||0,
    novelCount: novelsCountM.count||0, episodeCount: episodeCount2,
    followCount: followsCountM.count||0,
    readCount: readsM.count||0,
    hasBio: !!(profile?.bio && profile.bio.trim().length > 0),
    tweetCount: tweetsM.count||0,
    seriesCount: seriesM.count||0,
  }

  const defaultProfile = {
    user_id: user.id, display_name: user.email?.split('@')[0] || 'ユーザー',
    email: user.email || '', icon_url: '', login_provider: 'google',
    user_number: null, bio: null, birthdate: null, age_verified: false,
  }

  mark('done')

  return (
    <MypageClient
      profile={profile || defaultProfile}
      novels={novels ?? []}
      bookmarkedNovels={bookmarkedNovels ?? []}
      followingAuthors={followingAuthors}
      followerCount={followerCount || 0}
      followingCount={followingCount2 || 0}
      claimedMissionIds={claimedMissionIds}
      unreadFeedback={unreadFeedback}
      unreadRanking={unreadRanking}
      missionStats={missionStats}
      historyItems={historyItems}
      firstEpMap={firstEpMap}
      charCountMap={charCountMap}
      likeMap={likeMap2}
      novelLikeMap={novelLikeMap}
      novelCommentMap={novelCommentMap}
      novelViewMap={novelViewMap}
      novelEpCountMap={novelEpCountMap}
      bmAuthorMap={bmAuthorMap}
      monthlySummary={monthlySummary}
      recentTweet={recentTweet}
    />
  )
}
