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

      supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(user_id, display_name, icon_url)')
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false })
        /* 名簿としても使うので、20 では足りない */
        .limit(100),

      /*
       * フォロワーの名簿。
       * 数を押したときに誰が並ぶかを見せるため、
       * 人数だけでなく顔ぶれも読む。
       */
      supabase
        .from('follows')
        .select('follower_id, profiles!follows_follower_id_fkey(user_id, display_name, icon_url)')
        .eq('following_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const novels = novelRes.data
  const novelIds = (novels || []).map((n: any) => n.id)

  const followingAuthors = (followingListRes.data || [])
    .map((f: any) => f.profiles).filter(Boolean)

  const followerAuthors = (followerListRes.data || [])
    .map((f: any) => f.profiles).filter(Boolean)

  /*
   * 作品ごとのいいね・コメント・閲覧・話数。
   * 作品の一覧に出るので、ここで読む。
   */
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

  /* 受け取ったミッションの印。小さいのでここで読む */
  const { data: claimedMissions } = await supabase
    .from('user_missions').select('mission_id').eq('user_id', user.id)

  return (
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
    />
  )
}
