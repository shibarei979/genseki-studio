/**
 * ============================================================
 * 原石航路 Studio
 * /mypage — 表で読むもの
 *
 * 開いた瞬間に見えるものだけを読む。
 *
 *   自分の名乗り
 *   作品の一覧と、その数
 *   フォロワーの数
 *
 * 未読・ミッション・閲覧履歴・保存済みは、
 * 画面が出たあとに読む（/api/mypage/extra）。
 *
 * 全部を待つと、作品を見たいだけの人まで待たされる。
 * ============================================================
 */

import { redirect } from 'next/navigation'

import MypageClient from '@/components/mypage/mypage-client'
import { createClient } from '@/lib/supabase/server'
import FooterOnWhite from '@/components/layout/footer-on-white'

export default async function MypagePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage')

  /* 自分の情報。無ければ作る */
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('user_id', user.id).single()

  if (!profile) {
    await supabase.from('profiles').upsert({
      user_id: user.id,
      display_name: user.email?.split('@')[0] || '名無し',
      email: user.email || '',
      login_provider: 'email',
    })
  }

  /*
   * 作品・フォロー数・フォロー中の人。
   * 開いた瞬間に見えるものだけ。
   */
  const [novelRes, followerRes, followingRes, followingListRes, followerListRes] =
    await Promise.all([
      supabase
        .from('novels')
        .select('id, author_id, title, summary, genre, tags, is_serial, published, novel_type, created_at, updated_at, views')
        .eq('author_id', user.id).order('created_at', { ascending: false }),

      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),

      /*
       * 名簿は id だけ取り、profiles は後で引く。
       *
       * follows の繋ぎ先は profiles ではなく auth.users なので、
       * profiles!... と繋いで一度に読む書き方は通らない。
       * （通らないと空で返るだけなので、気づきにくい）
       */
      supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const novels = novelRes.data
  const novelIds = (novels || []).map((n: any) => n.id)

  /*
   * 集めた id から、名前とアイコンを引く。
   * 並び順は follows の順（新しい順）のまま保つ。
   * profiles の返る順に任せると、古い順に混ざる。
   */
  const followingIds = (followingListRes.data || []).map((f: any) => f.following_id)
  const followerIds  = (followerListRes.data  || []).map((f: any) => f.follower_id)
  const folkIds = Array.from(new Set([...followingIds, ...followerIds]))

  let folkMap: Record<string, any> = {}
  if (folkIds.length > 0) {
    const { data: folks } = await supabase
      .from('public_profiles')
      .select('user_id, display_name, icon_url')
      .in('user_id', folkIds)
    for (const row of folks || []) folkMap[row.user_id] = row
  }

  const followingAuthors = followingIds.map((id: string) => folkMap[id]).filter(Boolean)
  const followerAuthors  = followerIds.map((id: string) => folkMap[id]).filter(Boolean)

  /*
   * 作品ごとのいいね・コメント・閲覧・話数。
   * 作品の一覧に出るので、ここで読む。
   */
  const novelLikeMap: Record<string,number> = {}
  const novelCommentMap: Record<string,number> = {}
  const novelViewMap: Record<string,number> = {}
  const novelEpCountMap: Record<string,number> = {}

  /*
   * 作品ごとの字数。
   *
   * ★ ここで数える。
   *
   *   前は /api/mypage/extra だけが数えていたが、
   *   あちらが見ているのは「自分が読んだ作品」。
   *   自分が書いた作品は入っていないので、
   *   マイページの「最近の投稿作品」は 0 文字と出ていた。
   */
  const charCountMap: Record<string,number> = {}

  if (novelIds.length > 0) {
    const [likesData, commentsData, viewsData, epsData, charData] = await Promise.all([
      supabase.from('likes').select('novel_id').in('novel_id', novelIds),
      supabase.from('comments').select('novel_id').in('novel_id', novelIds),
      supabase.from('page_views').select('novel_id').eq('is_author', false).in('novel_id', novelIds),
      supabase.from('episodes').select('novel_id').in('novel_id', novelIds).eq('published', true),
      /*
       * 字数は下書きの話も足す。
       * 「この作品に何文字書いたか」であって、
       * 「読者が読める字数」ではない。
       */
      supabase.from('episodes').select('id, novel_id, char_count').in('novel_id', novelIds),
    ])

    likesData.data?.forEach((l:any) => { novelLikeMap[l.novel_id] = (novelLikeMap[l.novel_id]||0)+1 })
    commentsData.data?.forEach((c:any) => { novelCommentMap[c.novel_id] = (novelCommentMap[c.novel_id]||0)+1 })
    viewsData.data?.forEach((v:any) => { novelViewMap[v.novel_id] = (novelViewMap[v.novel_id]||0)+1 })
    epsData.data?.forEach((e:any) => { novelEpCountMap[e.novel_id] = (novelEpCountMap[e.novel_id]||0)+1 })
    charData.data?.forEach((e:any) => { charCountMap[e.novel_id] = (charCountMap[e.novel_id]||0) + (e.char_count||0) })

    /*
     * 話へのいいねも、作品のいいねに足す。
     *
     * ★ いいねの表は 2 つある。
     *
     *     likes           作品の頁の♡から入る
     *     episode_likes   本文の下の♡から入る
     *
     *   読者は読み終えた所の♡を押す。作品の頁まで
     *   戻って押す人は多くない。
     *   likes だけを数えていたので、
     *   読まれている作品でも 0 と出ていた。
     *
     * ★ 同じ人が作品にも各話にも押せる。数は重なる。
     *   「何回押されたか」であって「何人が押したか」ではない。
     */
    const epIdToNovel: Record<string,string> = {}
    charData.data?.forEach((e:any) => { epIdToNovel[e.id] = e.novel_id })

    const epIds = Object.keys(epIdToNovel)
    if (epIds.length > 0) {
      const { data: epLikes } = await supabase
        .from('episode_likes')
        .select('episode_id')
        .in('episode_id', epIds)

      epLikes?.forEach((row:any) => {
        const novelId = epIdToNovel[row.episode_id]
        if (novelId) novelLikeMap[novelId] = (novelLikeMap[novelId]||0) + 1
      })
    }
  }

  /* 受け取ったミッションの印。小さいのでここで読む */
  const { data: claimedMissions } = await supabase
    .from('user_missions').select('mission_id').eq('user_id', user.id)

  return (
    <>
    <MypageClient
      profile={profile}
      novels={novels || []}
      followingAuthors={followingAuthors}
      followerAuthors={followerAuthors}
      followerCount={followerRes.count || 0}
      followingCount={followingRes.count || 0}
      claimedMissionIds={(claimedMissions||[]).map((m:any) => m.mission_id)}
      novelLikeMap={novelLikeMap}
      novelCommentMap={novelCommentMap}
      novelViewMap={novelViewMap}
      novelEpCountMap={novelEpCountMap}
      charCountMap={charCountMap}
    />
      {/*
        * どのページからでも、決まりや問い合わせへ行けるようにする。
        */}
      {/*
        * フッターは詰めて置く。
        * 既定では上に 18rem（288px）の余白が入る。
        */}
      <FooterOnWhite tight />
    </>
  )
}
