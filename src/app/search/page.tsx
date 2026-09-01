import { createClient } from '@/lib/supabase/server'
import { ageFromBirthdate, allowedRatings } from '@/lib/age'
import { ROOT_ADMIN_EMAIL } from '@/types'
import { GENRE_LEGACY_MATCH } from '@/types'
export const dynamic = 'force-dynamic'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import AdBanner from '@/components/layout/ad-banner'
import Link from 'next/link'
import NovelPopup from '@/components/novel-popup'
import SearchForm from '@/components/search/search-form'
import { loadBlockedIds } from '@/lib/social/blocks'
import WorkShelf from '@/components/common/work-shelf'

const PAGE_SIZE = 50

/* 検索していないときに出す数。まず量を見せる */
const BROWSE_SIZE = 100

interface Props {
  searchParams: {
    q?: string; exclude?: string; genre?: string; type?: string
    serial?: string; tag?: string; sort?: string; page?: string
    author?: string; contest?: string; name?: string
    charMin?: string; charMax?: string; ptMin?: string; ptMax?: string
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    profile = data
  }

  const q        = searchParams.q       || ''
  const exclude  = searchParams.exclude || ''
  const genre    = searchParams.genre   || ''
  const type     = searchParams.type    || ''
  const serial   = searchParams.serial  || ''
  const tagParam = searchParams.tag     || ''
  const sort     = searchParams.sort    || 'new'
  const page     = Number(searchParams.page || 1)
  const offset   = (page - 1) * PAGE_SIZE
  const tags     = tagParam ? tagParam.split(',').filter(Boolean) : []
  const authorQ  = searchParams.author  || ''
  /*
   * 題名と作者名をまとめて探す枠。
   *
   * 「あの作品」か「あの人」かを分けて考えずに
   * 打てるようにする。どちらかに当たれば出す。
   */
  const nameQ    = searchParams.name    || ''
  /*
   * ブロックした作者の作品は、一覧に出さない。
   *
   * 読み終えてから落とす。問い合わせの側で外そうとすると、
   * 相手が多いときに URL が長くなりすぎて通らない。
   */
  const blockedAuthors = await loadBlockedIds(supabase, user?.id)
  const contestId = searchParams.contest || ''
  const charMin = Number(searchParams.charMin) || 0
  const charMax = Number(searchParams.charMax) || 0
  const ptMin = Number(searchParams.ptMin) || 0
  const ptMax = Number(searchParams.ptMax) || 0
  const hasMetaFilter = !!(charMin || charMax || ptMin || ptMax)
  const hasSearch = !!(q || nameQ || exclude || genre || type || serial || tags.length > 0 || authorQ || contestId || hasMetaFilter)

  const isAgeVerified = profile?.age_verified || false

  /*
   * その人が見てよい区分。
   *
   * 生年月日が未設定なら all だけ。
   * 「たぶん大人だろう」で通すと、通した側が責を負う。
   *
   * 15 歳以上で r15、18 歳以上で r18 まで。
   */
  const viewerAge = ageFromBirthdate((profile as { birthdate?: string })?.birthdate)
  const ratings = allowedRatings(viewerAge)

  /* 運営は全部見える */
  const isAdmin =
    user?.email === ROOT_ADMIN_EMAIL ||
    (profile as { role?: string })?.role === 'admin'

  // コンテスト絞り込み用の一覧（サイト内・公開中）
  const { data: searchContests } = await supabase
    .from('contests').select('id, title')
    .eq('is_published', true).eq('is_site_contest', true)
    .order('created_at', { ascending: false })

  let results: any[] = []
  let count = 0

  // 日間・週間・月間いいね用の期間
  const now = Date.now()
  const oneDayAgo   = new Date(now - 1  * 24 * 60 * 60 * 1000).toISOString()
  const oneWeekAgo  = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString()
  const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  // いいね数・ブックマーク数・閲覧数・コメント数を後で集計するためnovel_idsを先に取得
  if (!hasSearch) {
    let q2 = supabase.from('novels')
      .select('id, title, cover_url, cover_is_ai, summary, catchcopy, genre, tags, novel_type, is_serial, author_id, created_at, updated_at, is_r18, ai_usage', { count: 'exact' })
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(200)
    if (!isAdmin) {
      /*
       * 年齢で絞る。
       *
       * 昔からある is_r18 も一緒に見る。
       * age_rating を入れる前の作品は、そちらにしか印が無い。
       */
      /*
       * 自分の作品は、年齢に関わらず見える。
       *
       * 書いた本人から自作が消えると、
       * 消されたのかと思って問い合わせが来る。
       */
      const mine = user ? `,author_id.eq.${user.id}` : ''
      q2 = (q2 as any).or(
        `age_rating.in.(${ratings.join(',')})${mine}`,
      )
    }

    if (profile?.show_ai_works === false) {
      q2 = (q2 as any).neq('ai_usage', 'full')
    }
    const { data: allData, count: allCount } = await q2
    const shuffled = [...(allData || [])].sort(() => Math.random() - 0.5)
    /*
     * 検索していないときは、多めに出す。
     *
     * ★ 探しに来た人に、まず量を見せる。
     *   30 件だと「これだけしか無いのか」に見える。
     *   並べ替えていないので、送っても見終わらない。
     */
    results = shuffled.slice(0, BROWSE_SIZE)
    count = allCount || 0
  } else {
    let query = supabase.from('novels')
      .select('id, title, cover_url, cover_is_ai, summary, catchcopy, genre, tags, novel_type, is_serial, author_id, created_at, updated_at, is_r18, ai_usage', { count: 'exact' })
      .eq('published', true)

    if (!isAdmin) {
      const mine = user ? `,author_id.eq.${user.id}` : ''
      query = (query as any).or(
        `age_rating.in.(${ratings.join(',')})${mine}`,
      )
    }

    if (profile?.show_ai_works === false) {
      query = (query as any).neq('ai_usage', 'full')
    }
    if (q) {
      query = (query as any).or(`title.ilike.%${q}%,summary.ilike.%${q}%,catchcopy.ilike.%${q}%`)
    }
    /*
     * 題名と作者名。どちらかに当たれば出す。
     *
     * 作者名は別の表にあるので、先に人を探して
     * その id で作品を絞る。
     * 誰にも当たらなければ、題名だけで探す。
     */
    if (nameQ) {
      const { data: matchedByName } = await supabase
        .from('public_profiles').select('user_id').ilike('display_name', `%${nameQ}%`)
      const nameIds = (matchedByName||[]).map((a:any) => a.user_id)
      const parts = [`title.ilike.%${nameQ}%`]
      if (nameIds.length > 0) parts.push(`author_id.in.(${nameIds.join(',')})`)
      query = (query as any).or(parts.join(','))
    }
    if (exclude) query = (query as any).not('title', 'ilike', `%${exclude}%`)
    if (authorQ) {
      const { data: matchedAuthors } = await supabase
        .from('public_profiles').select('user_id').ilike('display_name', `%${authorQ}%`)
      const authorIds2 = (matchedAuthors||[]).map((a:any) => a.user_id)
      if (authorIds2.length > 0) {
        query = (query as any).in('author_id', authorIds2)
      } else {
        results = []; count = 0
      }
    }
    if (genre) {
      /*
       * 昔のジャンルも一緒に拾う。
       *
       * ファンタジーを 3 つに分けた日に、それまで
       * 「SF / ファンタジー」で出していた作品が
       * 検索から消えてしまう。書き手が選び直すまでの間、
       * 新しいジャンルのどれで探しても出るようにする。
       */
      const legacy = GENRE_LEGACY_MATCH[genre] ?? []
      query = legacy.length > 0
        ? (query as any).in('genre', [genre, ...legacy])
        : (query as any).eq('genre', genre)
    }
    if (type)   query = (query as any).eq('novel_type', type)
    if (serial === 'serial')   query = (query as any).eq('is_serial', true)
    if (serial === 'complete') query = (query as any).eq('is_serial', false)
    if (contestId) {
      // 指定コンテストの参加作品に絞り込み
      const { data: contestEntries } = await supabase
        .from('contest_entries').select('novel_id').eq('contest_id', contestId)
      const entryNovelIds = (contestEntries||[]).map((e:any) => e.novel_id)
      if (entryNovelIds.length > 0) {
        query = (query as any).in('id', entryNovelIds)
      } else {
        results = []; count = 0
      }
    }
    if (tags.length > 0) {
      for (const tag of tags) {
        query = (query as any).contains('tags', [tag])
      }
    }

    // 基本ソート（後で並び替えが必要なものはcreated_at降順で全件取得）
    const needsPostSort = ['like','like_daily','like_weekly','like_monthly','bookmark','view','comment','rising','ep_count','char_count','award'].includes(sort)
    if (needsPostSort) {
      query = (query as any).order('created_at', { ascending: false }).limit(500)
    } else if (sort === 'old') {
      query = (query as any).order('created_at', { ascending: true }).range(offset, offset + PAGE_SIZE - 1)
    } else {
      query = (query as any).order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
    }

    const { data, count: c2 } = await (query as any)
    results = data || []
    count = c2 || 0
  }

  /* ブロックした作者の作品を落とす */
  if (blockedAuthors.size > 0) {
    results = results.filter((n: any) => !blockedAuthors.has(n.author_id))
  }

  let novelIds = results.map((n: any) => n.id)

  /*
   * 1 話も投稿していない作品は結果から外す。
   *
   * 作品ページ側でも弾いているので、ここに残すと
   * 押した先が「見つかりません」になる。
   */
  if (novelIds.length > 0) {
    const { data: liveEps } = await supabase
      .from('episodes')
      .select('novel_id')
      .in('novel_id', novelIds)
      .eq('is_published', true)

    const hasLive = new Set((liveEps || []).map((e: any) => e.novel_id))
    const before = results.length
    /* 題名の無いものも外す。並べても何の話か分からない */
    results = results.filter(
      (n: any) => hasLive.has(n.id) && (n.title ?? '').trim() !== '',
    )
    count = Math.max(0, count - (before - results.length))
    novelIds = results.map((n: any) => n.id)
  }

  // 文字数・ポイント（RPCで一括集計：本文転送なしで軽量）
  const charCountMap: Record<string, number> = {}
  const pointsMap: Record<string, number> = {}
  if (novelIds.length > 0) {
    const { data: metaData } = await supabase.rpc('get_novel_search_meta', { ids: novelIds })
    metaData?.forEach((m: any) => {
      charCountMap[m.novel_id] = Number(m.char_count) || 0
      pointsMap[m.novel_id] = Number(m.points) || 0
    })
  }
  // 文字数・Pt範囲フィルタ
  if (hasMetaFilter) {
    results = results.filter((n: any) => {
      const ch = charCountMap[n.id] || 0
      const pt = pointsMap[n.id] || 0
      if (charMin && ch < charMin) return false
      if (charMax && ch > charMax) return false
      if (ptMin && pt < ptMin) return false
      if (ptMax && pt > ptMax) return false
      return true
    })
    count = results.length
    novelIds = results.map((n: any) => n.id)
  }
  // （旧集計コードの残骸吸収）
  if (false) {
    const epData: any[] = []
    epData?.forEach((ep: any) => {
      charCountMap[ep.novel_id] = (charCountMap[ep.novel_id] || 0) + (ep.body?.length || 0)
    })
  }

  // いいね（総合）
  const likeMap: Record<string, number> = {}
  if (novelIds.length > 0) {
    const { data: likes } = await supabase.from('likes').select('novel_id').in('novel_id', novelIds)
    likes?.forEach((l: any) => { likeMap[l.novel_id] = (likeMap[l.novel_id] || 0) + 1 })
  }

  // 日間・週間・月間いいね
  const likeDailyMap:   Record<string, number> = {}
  const likeWeeklyMap:  Record<string, number> = {}
  const likeMonthlyMap: Record<string, number> = {}
  if (novelIds.length > 0 && ['like_daily','like_weekly','like_monthly'].includes(sort)) {
    const since = sort === 'like_daily' ? oneDayAgo : sort === 'like_weekly' ? oneWeekAgo : oneMonthAgo
    const targetMap = sort === 'like_daily' ? likeDailyMap : sort === 'like_weekly' ? likeWeeklyMap : likeMonthlyMap
    const { data: periodLikes } = await supabase
      .from('likes').select('novel_id').in('novel_id', novelIds).gte('created_at', since)
    periodLikes?.forEach((l: any) => { targetMap[l.novel_id] = (targetMap[l.novel_id] || 0) + 1 })
  }

  // ブックマーク
  const bookmarkMap: Record<string, number> = {}
  if (novelIds.length > 0 && sort === 'bookmark') {
    const { data: bookmarks } = await supabase.from('bookmarks').select('novel_id').in('novel_id', novelIds)
    bookmarks?.forEach((b: any) => { bookmarkMap[b.novel_id] = (bookmarkMap[b.novel_id] || 0) + 1 })
  }

  // コメント
  const commentMap: Record<string, number> = {}
  if (novelIds.length > 0 && sort === 'comment') {
    const { data: comments } = await supabase.from('comments').select('novel_id').in('novel_id', novelIds)
    comments?.forEach((c: any) => { commentMap[c.novel_id] = (commentMap[c.novel_id] || 0) + 1 })
  }

  // 閲覧数（page_views）
  const viewMap: Record<string, number> = {}
  if (novelIds.length > 0 && sort === 'view') {
    const { data: views } = await supabase.from('page_views').select('novel_id').in('novel_id', novelIds)
    views?.forEach((v: any) => { viewMap[v.novel_id] = (viewMap[v.novel_id] || 0) + 1 })
  }

  // 話数
  const epCountMap: Record<string, number> = {}
  if (novelIds.length > 0 && sort === 'ep_count') {
    const { data: eps } = await supabase.from('episodes').select('novel_id').in('novel_id', novelIds).eq('published', true)
    eps?.forEach((e: any) => { epCountMap[e.novel_id] = (epCountMap[e.novel_id] || 0) + 1 })
  }

  // 受賞（is_award や award_tag フィールドがある想定、なければlikeで代替）
  const awardMap: Record<string, number> = {}
  if (novelIds.length > 0 && sort === 'award') {
    // award_rankカラムがあれば使う、なければlikeで代替
    results.forEach((n: any) => {
      awardMap[n.id] = n.award_rank || likeMap[n.id] || 0
    })
  }

  // 作者情報
  const authorIds = Array.from(new Set(results.map((n: any) => n.author_id)))
  const authorMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: authors } = await supabase.from('public_profiles').select('user_id, display_name').in('user_id', authorIds as string[])
    authors?.forEach((a: any) => { authorMap[a.user_id] = a.display_name })
  }

  // 新人バッジ
  const newbieSet = new Set<string>()
  if (authorIds.length > 0) {
    const { data: authorNovels } = await supabase
      .from('novels').select('author_id').eq('published', true).in('author_id', authorIds as string[])
    const authorCount: Record<string,number> = {}
    authorNovels?.forEach((n: any) => { authorCount[n.author_id] = (authorCount[n.author_id]||0)+1 })
    Object.entries(authorCount).forEach(([id, cnt]) => { if (cnt <= 3) newbieSet.add(id) })
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  let novels = results.map((n: any) => {
    const likeCount = likeMap[n.id] || 0
    const isNewWork = new Date(n.created_at).getTime() > sevenDaysAgo
    // 投稿7日以内 または いいねが50未満の場合、数値を非表示
    const hideStats = isNewWork || likeCount < 50
    return {
      ...n,
      display_name: authorMap[n.author_id] || '',
      is_newbie: newbieSet.has(n.author_id),
      likeCount,
      charCount: charCountMap[n.id] || 0,
      hideStats,
    }
  })

  // ポストソート（いいね・ブックマーク・閲覧数・コメント・話数・文字数・受賞）
  if (hasSearch) {
    if (sort === 'like') {
      novels.sort((a, b) => (likeMap[b.id]||0) - (likeMap[a.id]||0))
    } else if (sort === 'like_daily') {
      novels.sort((a, b) => (likeDailyMap[b.id]||0) - (likeDailyMap[a.id]||0))
    } else if (sort === 'like_weekly') {
      novels.sort((a, b) => (likeWeeklyMap[b.id]||0) - (likeWeeklyMap[a.id]||0))
    } else if (sort === 'like_monthly') {
      novels.sort((a, b) => (likeMonthlyMap[b.id]||0) - (likeMonthlyMap[a.id]||0))
    } else if (sort === 'bookmark') {
      novels.sort((a, b) => (bookmarkMap[b.id]||0) - (bookmarkMap[a.id]||0))
    } else if (sort === 'view') {
      novels.sort((a, b) => (viewMap[b.id]||0) - (viewMap[a.id]||0))
    } else if (sort === 'comment') {
      novels.sort((a, b) => (commentMap[b.id]||0) - (commentMap[a.id]||0))
    } else if (sort === 'ep_count') {
      novels.sort((a, b) => (epCountMap[b.id]||0) - (epCountMap[a.id]||0))
    } else if (sort === 'char_count') {
      novels.sort((a, b) => (charCountMap[b.id]||0) - (charCountMap[a.id]||0))
    } else if (sort === 'award') {
      novels.sort((a, b) => (awardMap[b.id]||0) - (awardMap[a.id]||0))
    } else if (sort === 'rising') {
      // 急上昇：週間いいねで代替
      const { data: risingLikes } = await supabase
        .from('likes').select('novel_id').in('novel_id', novelIds).gte('created_at', oneWeekAgo)
      const risingMap: Record<string, number> = {}
      risingLikes?.forEach((l: any) => { risingMap[l.novel_id] = (risingMap[l.novel_id] || 0) + 1 })
      novels.sort((a, b) => (risingMap[b.id]||0) - (risingMap[a.id]||0))
    }

    // ポストソート後にページネーション
    const needsPostSort = ['like','like_daily','like_weekly','like_monthly','bookmark','view','comment','rising','ep_count','char_count','award'].includes(sort)
    if (needsPostSort) {
      count = novels.length
      novels = novels.slice(offset, offset + PAGE_SIZE)
    }
  }

  function fmtNum(n: number | undefined | null): string {
    if (!n) return '0'
    if (n >= 10000) return (Math.floor(n / 1000) / 10) + '万'
    if (n >= 1000)  return (Math.floor(n / 100)  / 10) + 'K'
    return n.toString()
  }

  /*
   * 文字と本、どちらで見るか。
   *
   * ★ 住所に付ける。
   *   このページはサーバー側で組み立てるので、
   *   状態を持つ部品にすると作りが増える。
   *
   * 何も付いていないときは、設定で覚えたほうを使う。
   */
  const viewParam = (searchParams as Record<string, string | undefined>).view || ''
  /*
   * 本の形で見るか。
   *
   * ★ 何も選んでいない人には、文字を出す。
   *
   *   表紙のある作品はまだ少ない。
   *   はじめから本の形にすると、
   *   題名の紙ばかりが並んで、何が違うのか分からない。
   *
   *   自分で選んだ人にだけ、本の形を出す。
   *
   * 住所に付いていれば、それが勝つ。
   * 付いていなければ、マイページで覚えたものを使う。
   */
  const shelfView =
    viewParam === 'shelf'
    || (viewParam === ''
        && (profile as { work_popup_style?: string } | null)?.work_popup_style === 'book')

  function buildUrl(params: Record<string, string>) {
    const base: Record<string, string> = {}
    if (q)       base.q = q
    if (exclude) base.exclude = exclude
    if (genre)   base.genre = genre
    if (type)    base.type = type
    if (serial)  base.serial = serial
    if (tagParam) base.tag = tagParam
    if (sort)    base.sort = sort
    if (viewParam) base.view = viewParam
    Object.assign(base, params)
    const qs = Object.entries(base).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/search${qs ? '?' + qs : ''}`
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <div style={{minHeight:'100vh',fontFamily:"'Noto Sans JP',sans-serif"}}>
      <Header />

      <div className="main-layout sp-page" style={{maxWidth:1200,margin:'0 auto',padding:'24px 32px',display:'flex',gap:20,alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:0}}>

          <SearchForm
            defaultName={nameQ}
            defaultQ={q} defaultExclude={exclude} defaultGenre={genre}
            defaultType={type} defaultSerial={serial} defaultTag={tagParam}
            defaultSort={sort} ageVerified={isAgeVerified}
            defaultContest={contestId} contests={searchContests || []}
            defaultCharMin={searchParams.charMin || ''} defaultCharMax={searchParams.charMax || ''}
            defaultPtMin={searchParams.ptMin || ''} defaultPtMax={searchParams.ptMax || ''}
          />

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,fontSize:13,color:'var(--color-text-muted)'}}>
            {hasSearch
              ? <span>検索結果：<strong style={{color:'var(--color-text)'}}>{fmtNum(count)}作品</strong></span>
              : <span style={{color:'var(--color-text-muted)'}}>ランダム表示中</span>
            }
          </div>

          {/*
            * 文字と本の切り替え。
            *
            * ★ 住所に付ける。
            *   このページはサーバー側で組み立てるので、
            *   状態を持つ部品にすると作りが増える。
            *
            *   選んだ形は、マイページの work_popup_style に
            *   覚えてある。次に来たときも同じ形で開く。
            */}
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <div className="ws-switch">
              <Link
                href={buildUrl({ view: 'text' })}
                className={shelfView ? '' : 'is-on'}
                style={{padding:'6px 13px',fontSize:12,textDecoration:'none',
                  background:shelfView?'var(--color-bg-card)':'var(--color-brand)',
                  color:shelfView?'var(--color-text-muted)':'var(--base-color-1)',
                  fontWeight:shelfView?400:700}}>
                文字
              </Link>
              <Link
                href={buildUrl({ view: 'shelf' })}
                className={shelfView ? 'is-on' : ''}
                style={{padding:'6px 13px',fontSize:12,textDecoration:'none',
                  background:shelfView?'var(--color-brand)':'var(--color-bg-card)',
                  color:shelfView?'var(--base-color-1)':'var(--color-text-muted)',
                  fontWeight:shelfView?700:400}}>
                本
              </Link>
            </div>
          </div>

          {shelfView ? (
            <WorkShelf
              works={novels.map((n: any) => ({
                id: n.id,
                title: n.title,
                author: n.display_name,
                cover_url: n.cover_url,
                /* 表紙が AI かどうか。本の右上に札を出す */
                cover_is_ai: n.cover_is_ai,
                /* 押したときに出す札の中身 */
                novel: { ...n, like_count: n.hideStats ? 0 : (n.likeCount || 0) },
              }))}
            />
          ) : (

          <div className="sp-list" style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>
            {novels.length === 0 ? (
              <div style={{padding:'60px',textAlign:'center',color:'var(--color-text-faint)'}}>
                <div style={{fontSize:14,marginBottom:8}}>作品が見つかりませんでした</div>
                <div style={{fontSize:12}}>検索条件を変えてお試しください</div>
              </div>
            ) : novels.map((n: any, idx: number) => (
              <NovelPopup key={n.id} novel={{...n, like_count: n.hideStats ? 0 : (n.likeCount||0)}}>
              <div className="sp-card" style={{cursor:'pointer',padding:'16px 20px',borderBottom:idx<novels.length-1?'1px solid var(--color-brand-light)':'none'}}>
                <span style={{display:'flex',gap:5,marginBottom:6,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',padding:'1px 6px',borderRadius:3}}>{n.genre}</span>
                  <span style={{fontSize:10,background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'1px 6px',borderRadius:3}}>{n.novel_type}</span>
                  {n.is_newbie && <span style={{fontSize:10,background:'#f0fdf4',color:'#16a34a',border:'1px solid #86efac',padding:'1px 6px',borderRadius:3,fontWeight:700}}>新人</span>}
                  {n.is_serial
                    ? <span style={{fontSize:10,background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',padding:'1px 6px',borderRadius:3}}>連載中</span>
                    : <span style={{fontSize:10,background:'#f5f5f5',color:'#757575',border:'1px solid #e0e0e0',padding:'1px 6px',borderRadius:3}}>完結</span>}
                  {n.is_r18 && <span style={{fontSize:10,background:'#fef2f2',color:'var(--color-danger)',border:'1px solid #fca5a5',padding:'1px 6px',borderRadius:3}}>R18</span>}
                </span>
                <span className="sp-card-title" style={{display:'block',fontSize:17,fontWeight:700,color:'var(--color-text)',marginBottom:4,lineHeight:1.4}}>{n.title}</span>
                <span style={{display:'block',fontSize:12,color:'var(--color-text-muted)',marginBottom:6}}>作者：{n.display_name}</span>
                {n.summary && (
                  <span className="sp-summary" style={{display:'block',fontSize:12,color:'#5a3a20',lineHeight:1.7,marginBottom:7,overflow:'hidden',WebkitLineClamp:3,WebkitBoxOrient:'vertical' as any}}>
                    {n.summary}
                  </span>
                )}
                {(n.tags||[]).length > 0 && (
                  <span style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:7}}>
                    {(n.tags as string[]).map((t: string) => (
                      <span key={t} style={{fontSize:10,background:'var(--color-bg)',color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',padding:'1px 6px',borderRadius:3}}>#{t}</span>
                    ))}
                  </span>
                )}
                <span style={{display:'flex',gap:12,fontSize:11,color:'var(--color-text-faint)',flexWrap:'wrap',alignItems:'center'}}>
                  {n.charCount > 0 && <span>{n.charCount >= 10000 ? `${(n.charCount/10000).toFixed(1)}万文字` : `${n.charCount.toLocaleString()}文字`}</span>}
                  {n.updated_at && <span>最終更新：{new Date(n.updated_at).toLocaleDateString('ja-JP',{year:'numeric',month:'numeric',day:'numeric'})}</span>}
                  {!n.hideStats && n.likeCount > 0 && <span style={{color:'var(--color-text-muted)',fontWeight:600}}>♡ {fmtNum(n.likeCount)}</span>}
                </span>
              </div>
              </NovelPopup>
            ))}
          </div>
          )}

          {hasSearch && totalPages > 1 && (
            <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:20}}>
              {page > 1 && (
                <Link href={buildUrl({page: String(page-1)})}
                  style={{padding:'6px 16px',border:'1px solid var(--color-brand-border)',borderRadius:16,fontSize:12,color:'var(--color-brand)',textDecoration:'none',background:'var(--color-bg)'}}>
                  ‹ 前へ
                </Link>
              )}
              <span style={{padding:'6px 12px',fontSize:12,color:'var(--color-text-muted)'}}>{page} / {totalPages}</span>
              {page < totalPages && (
                <Link href={buildUrl({page: String(page+1)})}
                  style={{padding:'6px 16px',border:'1px solid var(--color-brand-border)',borderRadius:16,fontSize:12,color:'var(--color-brand)',textDecoration:'none',background:'var(--color-bg)'}}>
                  次へ ›
                </Link>
              )}
            </div>
          )}
        </div>

      </div>

      <AdBanner />
      <Footer />
    </div>
  )
}
