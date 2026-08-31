'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { hasSupabase } from '@/config/env.client'
import { createClient } from '@/lib/supabase/client'
import { useLoginRequired } from '@/hooks/use-login-required'
import { loadBlockedIds, loadMutedIds } from '@/lib/social/blocks'
import ReportButton from '@/components/common/report-button'

interface Tweet {
  id: string
  user_id: string
  body: string
  image_url: string | null
  created_at: string
  /** 直したときに入る。入っていれば「修正済み」と出す */
  edited_at?: string | null
  display_name: string
  icon_url: string | null
  like_count: number
  comment_count: number
  liked: boolean
  topic: string | null
  bookmarked: boolean
  /** アンケート。無ければ空 */
  poll: PollOption[]
  /** 自分が入れた選択肢。入れていなければ null */
  myVote: string | null
  comments: TweetComment[]
  showComments: boolean
  showCount: number
}

interface PollOption {
  id: string
  label: string
  votes: number
}

interface TweetComment {
  id: string
  user_id: string
  body: string
  created_at: string
  display_name: string
  icon_url: string | null
  /**
   * どの返信への返信か。
   *
   * null なら、つぶやきそのものへの返信。
   * 深さは 1 段まで。返信の返信の返信は、元をたどれなくなる。
   */
  parent_id: string | null
}

interface Props {
  /**
   * 誰のつぶやきを出すか。
   *
   * null なら全員ぶん。コミュニティーで使う。
   * 作者ページやマイページでは、その人の id を渡す。
   */
  authorId: string | null
  /**
   * 何を出すか。
   *
   *   all        … みんなのつぶやき
   *   following  … フォローしている人のものだけ
   *   bookmarks  … 自分が控えたものだけ
   *
   * authorId を渡したときは、そちらが優先される。
   */
  scope?: 'all' | 'following' | 'bookmarks'
  /** テーマで絞る。null なら絞らない */
  topic?: string | null
  currentUserId: string | null
  currentUserName: string | null
  currentUserIconUrl: string | null
  isOwner: boolean
}

/** テーマの名前を引く。消されたテーマなら何も出さない */
function topicLabel(key: string, list: { key: string; label: string }[]) {
  return list.find(t => t.key === key)?.label ?? ''
}

function fmtDate(s: string) {
  const d = new Date(s), now = new Date(), diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'たった今'
  if (diff < 3600000) return `${Math.floor(diff/60000)}分前`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}時間前`
  if (diff < 604800000) return `${Math.floor(diff/86400000)}日前`
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`
}

/**
 * テーマの控え。
 *
 * tweet_topics がまだ無いときに使う。
 * key は SQL と同じにしてある。
 * 後から表を作っても、付けたテーマがそのまま生きる。
 */
const FALLBACK_TOPICS = [
  { key: 'chat',      label: '雑談',           is_official: false },
  { key: 'trouble',   label: '創作の悩み',     is_official: false },
  { key: 'plot',      label: 'プロット・設定', is_official: false },
  { key: 'technique', label: '執筆テクニック', is_official: false },
  { key: 'favorite',  label: '推し・感想',     is_official: false },
  { key: 'recruit',   label: '企画・募集',     is_official: false },
  { key: 'other',     label: 'その他',         is_official: false },
  { key: 'notice',    label: 'お知らせ',       is_official: true  },
]

function IconPoll() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 20V10M12 20V4M18 20v-7"/>
    </svg>
  )
}

function IconBookmark({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z"/>
    </svg>
  )
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

export default function TweetSection({ authorId, scope = 'all', topic = null, currentUserId, currentUserName, currentUserIconUrl, isOwner }: Props) {
  /*
   * ログインが要る操作。
   *
   * 読むのは誰でもできる。
   * つぶやく・いいね・控えるときにログインを求める。
   */
  const { guard, prompt, isLoggedIn } = useLoginRequired(currentUserId)

  const supabase = createClient()
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)

  /* いま直しているつぶやき。開いている間だけ id が入る */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [commentBody, setCommentBody] = useState<Record<string, string>>({})
  const [commentPosting, setCommentPosting] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  /* 書くときに選ぶテーマ。左で絞っていないときに使う */
  const [postTopic, setPostTopic] = useState<string | null>(null)
  /* 投稿に失敗したときの理由 */
  const [postError, setPostError] = useState('')
  /* いまどの返信に返そうとしているか。つぶやきごとに 1 つ */
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({})

  /*
   * アンケート。
   *
   * 書くときだけ使う。null なら付けない。
   * 選択肢は 2 つから 4 つまで。
   * 増やせるようにすると、読む側が全部を読まずに選ぶ。
   */
  const [pollOptions, setPollOptions] = useState<string[] | null>(null)
  /*
   * 並べ替え。
   *
   *   new     新しい順
   *   liked   いいねの多い順
   *
   * ★ いいね順は、読んだあとに並べ替える。
   *   いいねの数は別の表にあり、
   *   つぶやきを読む問い合わせだけでは数えられない。
   */
  const [sortBy, setSortBy] = useState<'new' | 'liked'>('new')

  const [topicList, setTopicList] = useState<
    { key: string; label: string; is_official?: boolean }[]
  >([])

  /* テーマの一覧。運営が増やせるので、表から読む */
  useEffect(() => {
    /* 繋いでいなければ表が無い。読みにいかない */
    if (!hasSupabase()) return

    void (async () => {
      /*
       * 一覧は全部読む。札を出すのに名前が要るため。
       * 選ばせるのは、運営専用でないものだけ。
       */
      const { data } = await supabase
        .from('tweet_topics')
        .select('key, label, sort_order, is_official')
        .order('sort_order')

      /*
       * 表がまだ無ければ、決め打ちの一覧を使う。
       *
       * 表を作れば運営が増やせるが、
       * それまでテーマが 1 つも選べないのは困る。
       * 名前は SQL と揃えてあるので、後から流しても食い違わない。
       */
      setTopicList(data && data.length > 0 ? data : FALLBACK_TOPICS)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
   * つぶやきを読む。
   *
   * currentUserId も見張ること。
   *
   * 自分が誰かは、ページを開いた少しあとに決まる。
   * それを見ずに一度だけ読むと、読んだ時点では
   * 「誰でもない人」として自分のいいねを探すので、
   * 押したはずのいいねが 1 つも見つからず、
   * リロードのたびに色が消える。
   *
   * 話ページのいいねが消えないのは、あちらが
   * サーバー側で誰かを確かめてから渡しているため。
   */
  useEffect(() => {
    loadTweets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId, scope, topic, sortBy, currentUserId])

  async function loadTweets() {
    setLoading(true)

    /*
     * 何を読むか。
     *
     *   authorId あり  … その人のものだけ
     *   following      … 追っている人のもの
     *   bookmarks      … 控えたもの
     *   それ以外        … 全員ぶん
     */
    let query = supabase
      .from('tweets')
      .select('id, user_id, body, image_url, created_at, edited_at, topic')
      .order('created_at', { ascending: false })
      .limit(authorId ? 20 : 50)

    if (authorId) {
      query = query.eq('user_id', authorId)
    } else if (scope === 'following' && currentUserId) {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)

      /*
       * 自分は入れない。
       *
       * 「友達のつぶやき」は、追っている人の様子を見る場所。
       * 自分の書き込みが混ざると、
       * 誰の言葉を読んでいるのか分からなくなる。
       */
      const ids = (follows || [])
        .map((f: any) => f.following_id)
        .filter((id: string) => Boolean(id) && id !== currentUserId)

      if (ids.length === 0) { setTweets([]); setLoading(false); return }

      /*
       * 追っている人だけに絞り、そのうえで自分を外す。
       *
       * 自分をフォローしている行が残っていることがあるので、
       * id を選ぶときと、引くときの両方で外す。
       */
      query = query.in('user_id', ids).neq('user_id', currentUserId)
    } else if (scope === 'bookmarks' && currentUserId) {
      const { data: marks } = await supabase
        .from('tweet_bookmarks')
        .select('tweet_id')
        .eq('user_id', currentUserId)

      const ids = (marks || []).map((m: any) => m.tweet_id).filter(Boolean)
      if (ids.length === 0) { setTweets([]); setLoading(false); return }
      query = query.in('id', ids)
    }

    if (topic) query = query.eq('topic', topic)

    let { data: tweetsData, error: listError } = await query

    /*
     * topic の列がまだ無い環境では、上の読み込みが失敗する。
     * その場合は列を外して読み直す。
     */
    if (listError) {
      let plain = supabase
        .from('tweets')
        .select('id, user_id, body, image_url, created_at')
        .order('created_at', { ascending: false })
        .limit(authorId ? 20 : 50)

      if (authorId) plain = plain.eq('user_id', authorId)

      const retry = await plain
      tweetsData = (retry.data ?? []).map((row: any) => ({ ...row, topic: null, edited_at: null }))
    }

    /*
     * ミュートとブロックした相手のつぶやきを落とす。
     *
     * 読み終えてから落とす。
     * 問い合わせの側で外そうとすると、相手が多いときに
     * URL が長くなりすぎて通らないことがある。
     *
     * 落とすだけで、「隠しました」とは出さない。
     * 出すと、そこに誰かが居たことが分かってしまう。
     */
    if (currentUserId && tweetsData) {
      const [muted, blocked] = await Promise.all([
        loadMutedIds(supabase, currentUserId),
        loadBlockedIds(supabase, currentUserId),
      ])
      if (muted.size > 0 || blocked.size > 0) {
        tweetsData = tweetsData.filter(
          (row: any) => !muted.has(row.user_id) && !blocked.has(row.user_id),
        )
      }
    }

    if (!tweetsData || tweetsData.length === 0) { setTweets([]); setLoading(false); return }

    /*
     * 書いた人の名前と絵。
     * 全員ぶんを出すので、出てきた投稿者をまとめて引く。
     */
    const authorIds = Array.from(new Set(tweetsData.map((t: any) => t.user_id)))
    const { data: authorProfiles } = await supabase
      .from('public_profiles')
      .select('user_id, display_name, icon_url')
      .in('user_id', authorIds)

    const authorMap: Record<string, any> = {}
    authorProfiles?.forEach((p: any) => { authorMap[p.user_id] = p })

    /*
     * アンケート。
     *
     * 選択肢と票をまとめて読む。
     * つぶやきごとに問い合わせると、50 件で 100 回になる。
     */
    const pollByTweet: Record<string, PollOption[]> = {}
    const myVoteBy: Record<string, string> = {}

    const { data: options } = await supabase
      .from('tweet_poll_options')
      .select('id, tweet_id, label, sort_order')
      .in('tweet_id', tweetsData.map((t: any) => t.id))
      .order('sort_order')

    if (options && options.length > 0) {
      const { data: votes } = await supabase
        .from('tweet_poll_votes')
        .select('tweet_id, option_id, user_id')
        .in('tweet_id', tweetsData.map((t: any) => t.id))

      const countBy: Record<string, number> = {}
      votes?.forEach((v: any) => {
        countBy[v.option_id] = (countBy[v.option_id] ?? 0) + 1
        if (v.user_id === currentUserId) myVoteBy[v.tweet_id] = v.option_id
      })

      options.forEach((o: any) => {
        if (!pollByTweet[o.tweet_id]) pollByTweet[o.tweet_id] = []
        pollByTweet[o.tweet_id].push({
          id: o.id,
          label: o.label,
          votes: countBy[o.id] ?? 0,
        })
      })
    }

    /* 自分が控えたもの */
    const markedSet = new Set<string>()
    if (currentUserId) {
      const { data: marks } = await supabase
        .from('tweet_bookmarks')
        .select('tweet_id')
        .eq('user_id', currentUserId)
        .in('tweet_id', tweetsData.map((t: any) => t.id))
      marks?.forEach((m: any) => markedSet.add(m.tweet_id))
    }

    const tweetIds = tweetsData.map(t => t.id)
    const { data: likesData, error: likesError } = await supabase
      .from('tweet_likes')
      .select('tweet_id, user_id')
      .in('tweet_id', tweetIds)

    /*
     * 読めなかったら黙らない。
     *
     * ここが空で返ると、押したはずのいいねが
     * 「押していない」ことになって色が消える。
     * 弾かれているのか、本当に無いのかを見分けたい。
     */
    if (likesError) console.error('[tweet-likes-read]', likesError)

    const { data: commentsData } = await supabase
      .from('tweet_comments')
      .select('id, tweet_id, user_id, body, created_at, parent_id')
      .in('tweet_id', tweetIds)
      .order('created_at', { ascending: true })

    const commentUserIds = Array.from(new Set((commentsData||[]).map(c => c.user_id)))
    const commentProfileMap: Record<string, any> = {}
    if (commentUserIds.length > 0) {
      const { data: cProfiles } = await supabase
        .from('public_profiles')
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

    /*
     * parent_id の列がまだ無い環境では、上の読み込みが失敗する。
     * その場合は列を外して読み直す。
     */
    let comments = commentsData
    if (!comments) {
      const retry = await supabase
        .from('tweet_comments')
        .select('id, tweet_id, user_id, body, created_at')
        .in('tweet_id', tweetIds)
        .order('created_at', { ascending: true })
      comments = (retry.data ?? []).map((row: any) => ({ ...row, parent_id: null }))
    }

    const commentMap: Record<string, TweetComment[]> = {}
    comments?.forEach((c: any) => {
      if (!commentMap[c.tweet_id]) commentMap[c.tweet_id] = []
      commentMap[c.tweet_id].push({
        id: c.id, user_id: c.user_id, body: c.body, created_at: c.created_at,
        parent_id: c.parent_id ?? null,
        display_name: commentProfileMap[c.user_id]?.display_name || '不明',
        icon_url: commentProfileMap[c.user_id]?.icon_url || null,
      })
    })

    const built = tweetsData.map(t => ({
      ...t,
      display_name: authorMap[t.user_id]?.display_name || '名前のない書き手',
      icon_url: authorMap[t.user_id]?.icon_url || null,
      like_count: likeMap[t.id] || 0,
      comment_count: (commentMap[t.id] || []).length,
      liked: likedSet.has(t.id),
      bookmarked: markedSet.has(t.id),
      poll: pollByTweet[t.id] ?? [],
      myVote: myVoteBy[t.id] ?? null,
      comments: commentMap[t.id] || [],
      showComments: false,
      showCount: 5,
    }))

    /*
     * 並べ替え。
     *
     * ★ 読んだあとに並べ替える。
     *   いいねの数は別の表にあり、
     *   つぶやきを読む問い合わせだけでは数えられない。
     *
     * ★ いいねが同じときは、新しい順。
     *   そうしないと、並びが毎回入れ替わって落ち着かない。
     */
    if (sortBy === 'liked') {
      built.sort((a, b) =>
        (b.like_count || 0) - (a.like_count || 0)
        || (a.created_at < b.created_at ? 1 : -1),
      )
    }

    setTweets(built)
    setLoading(false)
  }

  async function handlePost() {
    if (!currentUserId) return guard('つぶやく', () => {})()
    if (!body.trim()) return
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

    /*
     * テーマ。
     *
     * 左で絞り込んでいる最中に書いたら、そのテーマを付ける。
     * 「雑談」を見ながら書いたものは雑談のはず。
     * 選び直させるより、そのまま付けたほうが手数が減る。
     */
    const chosen = topic ?? postTopic ?? null

    /*
     * topic の列がまだ無い環境でも書けるようにする。
     *
     * コミュニティー.sql を流していないと、
     * この列を送った時点で丸ごと失敗する。
     * 一度試して駄目なら、列を外してもう一度送る。
     */
    let { data, error } = await supabase
      .from('tweets')
      .insert({ user_id: currentUserId, body: body.trim(), image_url: imageUrl, topic: chosen })
      .select('id, user_id, body, image_url, created_at, edited_at, topic')
      .single()

    if (error) {
      const retry = await supabase
        .from('tweets')
        .insert({ user_id: currentUserId, body: body.trim(), image_url: imageUrl })
        .select('id, user_id, body, image_url, created_at')
        .single()

      if (!retry.error && retry.data) {
        /*
         * topic の列が無い環境。
         *
         * 保存はできないが、いま画面に出すぶんには
         * 選んだテーマを覚えておく。
         * null にすると、投稿した直後だけ札が消えて、
         * 選んだことが無かったように見える。
         */
        data = { ...retry.data, topic: chosen }
        error = null
      }
    }

    setPosting(false)

    /*
     * 失敗を握りつぶさない。
     *
     * 以前はここで黙って戻っていた。
     * 押しても何も起きないので、押せていないのか
     * 書けていないのかが分からなかった。
     *
     * よくある原因は 2 つ。
     *   topic の列がまだ無い（コミュニティー.sql が未実行）
     *   tweets に書き込む許可が無い
     */
    if (error || !data) {
      setPostError(
        error?.message ?? 'つぶやきを保存できませんでした',
      )
      return
    }
    setPostError('')

    const newTweet: Tweet = {
      ...data,
      display_name: currentUserName || '',
      icon_url: currentUserIconUrl || null,
      like_count: 0, comment_count: 0,
      liked: false, bookmarked: false, poll: [], myVote: null,
      comments: [], showComments: false, showCount: 5,
    }
    /*
     * アンケートの選択肢。
     *
     * つぶやきを書いたあとに足す。
     * 先に作れないので、id が要る。
     */
    const filled = (pollOptions ?? []).map(o => o.trim()).filter(Boolean)

    if (pollOptions && filled.length < 2) {
      /*
       * 選択肢が足りない。
       *
       * 黙って捨てると、書いたはずのアンケートが消える。
       * つぶやきは残っているので、そのことも伝える。
       */
      setPostError('アンケートは選択肢が2つ以上必要です。つぶやきだけ投稿しました。')
    }

    if (filled.length >= 2) {
      const { data: saved, error: pollError } = await supabase
        .from('tweet_poll_options')
        .insert(filled.map((label, index) => ({
          tweet_id: data.id,
          label,
          sort_order: index,
        })))
        .select('id, label')

      if (pollError) {
        /*
         * 表がまだ無いか、書き込みの許可が無い。
         * つぶやき自体は保存できているので、そのことを伝える。
         */
        setPostError(`アンケートを保存できませんでした：${pollError.message}`)
      }

      newTweet.poll = (saved ?? []).map((o: any) => ({
        id: o.id, label: o.label, votes: 0,
      }))
    }
    setPollOptions(null)

    setTweets(prev => [newTweet, ...prev])
    setBody('')
    setImageFile(null)
    setImagePreview(null)
  }

  /**
   * 控える／外す。
   *
   * 押した瞬間に画面を変え、そのあと保存する。
   * 往復を待たせると、押したのに変わらない一瞬ができて
   * もう一度押されてしまう。
   */
  async function toggleBookmark(tweetId: string) {
    if (!currentUserId) return guard('控える', () => {})()

    const now = tweets.find(t => t.id === tweetId)?.bookmarked ?? false
    setTweets(prev => prev.map(t =>
      t.id === tweetId ? { ...t, bookmarked: !now } : t
    ))

    if (now) {
      await supabase.from('tweet_bookmarks').delete()
        .eq('user_id', currentUserId).eq('tweet_id', tweetId)
    } else {
      await supabase.from('tweet_bookmarks')
        .insert({ user_id: currentUserId, tweet_id: tweetId })
    }
  }

  /**
   * アンケートに入れる。
   *
   * 入れ直しもできる。1 人 1 票なので、書き換える。
   * 締め切ったあとは押せないようにしてある。
   */
  async function vote(tweetId: string, optionId: string) {
    if (!currentUserId) return guard('投票する', () => {})()

    const before = tweets.find(t => t.id === tweetId)?.myVote ?? null
    if (before === optionId) return

    /* 押した瞬間に画面を変える。往復を待たせない */
    setTweets(prev => prev.map(t => {
      if (t.id !== tweetId) return t
      return {
        ...t,
        myVote: optionId,
        poll: t.poll.map(o => ({
          ...o,
          votes: o.votes
            + (o.id === optionId ? 1 : 0)
            - (o.id === before ? 1 : 0),
        })),
      }
    }))

    await supabase.from('tweet_poll_votes').upsert(
      { tweet_id: tweetId, user_id: currentUserId, option_id: optionId },
      { onConflict: 'tweet_id,user_id' },
    )
  }

  async function handleLike(tweetId: string, liked: boolean) {
    if (!currentUserId) return guard('いいねする', () => {})()

    /*
     * 先に画面を変え、失敗したら戻す。
     *
     * 押した手応えは即座に返したいが、
     * 保存できていないのに付いたままだと、
     * 開き直したときに外れていて驚く。
     * 以前は結果を見ずに画面だけ変えていた。
     */
    setTweets(prev => prev.map(t => t.id === tweetId
      ? { ...t, liked: !liked, like_count: liked ? t.like_count-1 : t.like_count+1 }
      : t
    ))

    /*
     * 入れるときは upsert。
     *
     * 同じ組み合わせが既にあると、insert は
     * 「重複している」と言って落ちる。
     * 二度押しや、画面と表がずれていたときに起きる。
     * 結果として欲しいのは「入っている状態」なので、
     * 既にあるなら何もしないでよい。
     */
    const { error } = liked
      ? await supabase.from('tweet_likes')
          .delete().eq('user_id', currentUserId).eq('tweet_id', tweetId)
      : await supabase.from('tweet_likes')
          .upsert(
            { user_id: currentUserId, tweet_id: tweetId },
            { onConflict: 'user_id,tweet_id', ignoreDuplicates: true },
          )

    if (error) {
      console.error('[tweet-like]', error)
      /* 元に戻す */
      setTweets(prev => prev.map(t => t.id === tweetId
        ? { ...t, liked, like_count: liked ? t.like_count+1 : t.like_count-1 }
        : t
      ))
      window.alert(`いいねを保存できませんでした：${error.message}`)
    }
  }

  /**
   * 返信を書く。
   *
   * parentId を渡すと、その返信への返信になる。
   * 渡さなければ、つぶやきそのものへの返信。
   */
  async function handleComment(tweetId: string, parentId: string | null = null) {
    const key = parentId ?? tweetId
    if (!currentUserId) return guard('返信する', () => {})()
    if (!commentBody[key]?.trim()) return

    setCommentPosting(prev => ({...prev, [key]: true}))

    /*
     * parent_id の列がまだ無い環境でも書けるようにする。
     *
     * つぶやき拡張.sql を流していないと、
     * この列を送った時点で丸ごと失敗する。
     * 一度試して駄目なら、列を外してもう一度送る。
     */
    let { data, error } = await supabase
      .from('tweet_comments')
      .insert({
        user_id: currentUserId,
        tweet_id: tweetId,
        body: commentBody[key].trim(),
        parent_id: parentId,
      })
      .select('id, user_id, body, created_at, parent_id')
      .single()

    if (error) {
      const retry = await supabase
        .from('tweet_comments')
        .insert({
          user_id: currentUserId,
          tweet_id: tweetId,
          body: commentBody[key].trim(),
        })
        .select('id, user_id, body, created_at')
        .single()

      if (!retry.error && retry.data) {
        data = { ...retry.data, parent_id: null }
        error = null
      }
    }

    setCommentPosting(prev => ({...prev, [key]: false}))

    if (error || !data) {
      setPostError(error?.message ?? 'コメントを保存できませんでした')
      return
    }
    setPostError('')

    setReplyTo(prev => ({...prev, [tweetId]: null}))

    const newComment: TweetComment = {
      ...data,
      parent_id: data.parent_id ?? null,
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
    /* 書いた本人か、押す前に確かめる */
    const target = tweets.find(t => t.id === tweetId)
    if (!currentUserId || !target || target.user_id !== currentUserId) return

    if (!confirm('このつぶやきを削除しますか？')) return

    const { error } = await supabase
      .from('tweets').delete().eq('id', tweetId).eq('user_id', currentUserId)

    /*
     * 消えなかったら、消えたことにしない。
     * 画面から先に消すと、開き直したときに戻ってきて驚く。
     */
    if (error) {
      window.alert(`削除できませんでした：${error.message}`)
      return
    }
    setTweets(prev => prev.filter(t => t.id !== tweetId))
  }

  /**
   * つぶやきを直す。
   *
   * 直せるのは書いた本人だけ。表の決まりでも縛ってある。
   *
   * 直した事実は edited_at に残す。
   * 中身は変えてよいが、変えたことは隠さない。
   * 返信やいいねが付いたあとに黙って書き換えられると、
   * 読んだ人の記憶と食い違う。
   */
  async function handleEditSave(tweetId: string) {
    const next = editBody.trim()
    if (!next || savingEdit) return

    const target = tweets.find(t => t.id === tweetId)
    if (!target || target.body === next) { setEditingId(null); return }

    setSavingEdit(true)
    const now = new Date().toISOString()

    const { error } = await createClient()
      .from('tweets')
      .update({ body: next, edited_at: now })
      .eq('id', tweetId)
      .eq('user_id', currentUserId)

    setSavingEdit(false)

    /*
     * 直せなかったら、直ったことにしない。
     * 画面だけ変えると、開き直したときに戻って驚く。
     */
    if (error) {
      window.alert(`修正できませんでした：${error.message}`)
      return
    }

    setTweets(prev => prev.map(t =>
      t.id === tweetId ? { ...t, body: next, edited_at: now } : t
    ))
    setEditingId(null)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  /*
   * 何も出さない場合。
   *
   * 作者ページで、その人がまだ何も書いていないとき。
   * 空の見出しだけが残ると、頁に穴が空いて見える。
   *
   * コミュニティー（authorId が null）では消さない。
   * そこは「つぶやき」を見に来た場所なので、
   * 何も無いなら、無いと書いたほうがよい。
   */
  /*
   * 何も出さない場合。
   *
   * 他の人の作者ページで、その人がまだ何も書いていないとき。
   * 空の見出しだけが残ると、頁に穴が空いて見える。
   *
   * 自分のつぶやきを見ているときは消さない。
   * 「まだ無い」と分かるほうがよい。
   */
  if (authorId && authorId !== currentUserId && !isOwner && tweets.length === 0 && !loading) {
    return null
  }

  return (
    <div>
      {!isOwner && authorId && <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:12}}>つぶやき</div>}

      {/* ログインしていない人へ */}
      {!isOwner && !authorId && (
        <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'18px 20px',marginBottom:20,fontSize:12.5,lineHeight:1.9,color:'var(--color-text-muted)'}}>
          つぶやくにはログインが要ります。読むだけなら、そのままどうぞ。
        </div>
      )}
      {isOwner && (
        <div id="compose" className="tw-compose" style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'20px',marginBottom:20,boxShadow:'0 1px 3px rgba(0,0,0,0.02)'}}>
          <div style={{display:'flex',gap:12}}>
            <Avatar name={currentUserName||''} iconUrl={currentUserIconUrl} size={40}/>
            <div style={{flex:1}}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="今なにしてる？　みんなにシェアしよう！"
                style={{width:'100%',padding:'12px 14px',border:'1px solid #dcdfda',borderRadius:10,fontSize:14,resize:'none',outline:'none',fontFamily:'inherit',boxSizing:'border-box',lineHeight:1.7}}
              />
              {imagePreview && (
                <div style={{position:'relative',display:'inline-block',marginTop:10}}>
                  <img src={imagePreview} style={{maxHeight:120,maxWidth:240,borderRadius:10,display:'block',objectFit:'cover'}} alt="preview"/>
                  <button onClick={()=>{setImageFile(null);setImagePreview(null)}}
                    style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'var(--color-bg-card)',border:'none',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12,flexWrap:'wrap',gap:10}}>
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',minWidth:0}}>
                  <button onClick={()=>fileInputRef.current?.click()}
                    style={{display:'inline-flex',alignItems:'center',gap:6,height:36,padding:'0 14px',border:'1px solid #dcdfda',borderRadius:10,fontSize:13,color:'var(--color-text-muted)',background:'var(--color-bg-card)',cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
                    <IconImage/>
                    画像
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageSelect}/>

                  {/*
                   * アンケート。
                   *
                   * 押すと選択肢の欄が出る。
                   * 初めから出しておくと、使わない人にも
                   * 「埋めなければいけない欄」に見える。
                   */}
                  <button
                    type="button"
                    onClick={()=>setPollOptions(prev => prev ? null : ['', ''])}
                    aria-pressed={pollOptions !== null}
                    style={{display:'inline-flex',alignItems:'center',gap:6,height:36,padding:'0 12px',borderRadius:10,fontSize:13,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',
                      border:'1px solid', background: pollOptions ? '#eef2f5' : 'var(--color-bg-card)',
                      borderColor: pollOptions ? 'var(--color-brand)' : '#dcdfda',
                      color: pollOptions ? 'var(--color-brand)' : 'var(--color-text-muted)'}}>
                    <IconPoll/>
                    アンケート
                  </button>

                  {/*
                   * テーマ。
                   *
                   * 左で絞り込んでいるときは出さない。
                   * そのテーマが自動で付くので、選ばせると
                   * 「どちらが効くのか」を考えさせることになる。
                   */}
                  {!topic && topicList.length > 0 && (
                    <select
                      value={postTopic ?? ''}
                      onChange={(e)=>setPostTopic(e.target.value || null)}
                      aria-label="テーマ"
                      style={{height:36,padding:'0 10px',border:'1px solid #dcdfda',borderRadius:10,fontSize:13,color:'var(--color-text-muted)',background:'var(--color-bg-card)',cursor:'pointer',fontFamily:'inherit',maxWidth:140,flexShrink:0}}
                    >
                      <option value="">テーマなし</option>
                      {topicList.filter(t => !t.is_official).map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </select>
                  )}

                  <span style={{fontSize:12,color:'var(--color-text-faint)'}}>{body.length}/500</span>
                </div>
                <button onClick={handlePost} disabled={posting||!body.trim()}
                  style={{height:40,padding:'0 24px',background:'var(--color-brand)',color:'var(--color-text-inverse)',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',opacity:posting||!body.trim()?0.5:1,flexShrink:0,whiteSpace:'nowrap',marginLeft:'auto'}}>
                  {posting ? '投稿中...' : '投稿'}
                </button>
              </div>

              {/* アンケートの選択肢 */}
              {pollOptions && (
                <div style={{marginTop:12,padding:'12px 14px',border:'1px solid #dcdfda',borderRadius:10}}>
                  <div style={{fontSize:11.5,color:'var(--color-text-muted)',marginBottom:8}}>
                    選択肢（2つ以上・最大4つ）
                  </div>

                  {pollOptions.map((value, index) => (
                    <div key={index} style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
                      <input
                        value={value}
                        onChange={e=>setPollOptions(prev =>
                          (prev ?? []).map((v, i) => i === index ? e.target.value : v)
                        )}
                        placeholder={`選択肢 ${index + 1}`}
                        maxLength={40}
                        style={{flex:1,height:36,padding:'0 12px',border:'1px solid #dcdfda',borderRadius:8,fontSize:13,outline:'none'}}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={()=>setPollOptions(prev => (prev ?? []).filter((_, i) => i !== index))}
                          aria-label="この選択肢を消す"
                          style={{border:'none',background:'none',cursor:'pointer',color:'var(--color-text-faint)',fontSize:16,padding:'0 4px'}}>
                          ×
                        </button>
                      )}
                    </div>
                  ))}

                  {pollOptions.length < 4 && (
                    <button
                      onClick={()=>setPollOptions(prev => [...(prev ?? []), ''])}
                      style={{fontSize:12,color:'var(--color-brand)',background:'none',border:'none',padding:0,cursor:'pointer'}}>
                      ＋ 選択肢を足す
                    </button>
                  )}
                </div>
              )}

              {/* 保存できなかった理由 */}
              {postError && (
                <div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:'#fdecea',color:'#b3372c',fontSize:12,lineHeight:1.8}}>
                  {postError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:'32px',color:'var(--color-text-faint)',fontSize:14}}>読み込み中...</div>
      ) : tweets.length === 0 ? (
        /*
         * まだ 1 件も無いとき。
         *
         * コミュニティーでは、書き込みの見本を出す。
         * まっさらな画面だけを見せると、
         * 何を書く場所なのか分からず、最初の 1 人が出てこない。
         *
         * 本物と紛れないよう、薄く出して「例」と添える。
         * 押しても何も起きない。
         */
        !authorId ? <SampleTweets /> : (
          isOwner || authorId === currentUserId ? (
            <div style={{textAlign:'center',padding:'56px 24px',color:'var(--color-text-faint)',fontSize:14,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16}}>
              {isOwner
                ? 'まだつぶやきがありません。上の入力欄から投稿できます。'
                : 'まだつぶやきがありません。'}
            </div>
          ) : null
        )
      ) : (
        <>
          {/*
            * 並べ替え。
            *
            * ★ つぶやきの一覧の上に置く。
            *   タイムラインのときだけ出す。
            *   誰か 1 人のつぶやきを見ているときは、
            *   件数が少なく、並べ替える意味がない。
            */}
          {!authorId && tweets.length > 1 && (
            <div className="tw-sort">
              <button
                type="button"
                onClick={() => setSortBy('new')}
                className={sortBy === 'new' ? 'is-on' : ''}
              >
                新着順
              </button>
              <button
                type="button"
                onClick={() => setSortBy('liked')}
                className={sortBy === 'liked' ? 'is-on' : ''}
              >
                人気順
              </button>
            </div>
          )}

          {tweets.map(tweet => (
        <div key={tweet.id} style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,marginBottom:16,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.02)'}}>
          <div style={{padding:'20px 22px'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              {/*
               * 書いた人の顔と名前から、その人の作者ページへ。
               *
               * つぶやきで見かけた人の作品を読みに行く道が、
               * ここに無いと途切れる。
               */}
              <Link href={`/author/${tweet.user_id}`} style={{flexShrink:0,display:'block'}}>
                <Avatar name={tweet.display_name} iconUrl={tweet.icon_url} size={40}/>
              </Link>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                  <Link
                    href={`/author/${tweet.user_id}`}
                    style={{fontSize:14,fontWeight:700,color:'var(--color-text)',textDecoration:'none'}}
                  >
                    {tweet.display_name}
                  </Link>
                  <span style={{fontSize:12,color:'var(--color-text-faint)'}}>{fmtDate(tweet.created_at)}</span>
                </div>
              </div>

              {/*
               * テーマの札。
               *
               * 右上に置く。名前の隣に並べると、
               * 名前の一部のように読めてしまう。
               */}
              {tweet.topic && topicLabel(tweet.topic, topicList) && (
                <span style={{flexShrink:0,padding:'3px 10px',borderRadius:999,background:'#eef2f5',color:'var(--color-brand)',fontSize:11}}>
                  {topicLabel(tweet.topic, topicList)}
                </span>
              )}
              {/*
               * 削除は書いた本人にだけ。
               *
               * 以前は isOwner（＝ログインしているか）で出していたので、
               * 誰の投稿にも押し具が付いていた。
               * 押しても消えはしなかったが、消せるように見えるのがよくない。
               * その投稿の user_id と突き合わせる。
               */}
              {/* 通報。自分のものには出ない（部品の側で判断） */}
              <ReportButton
                target="tweet"
                targetId={tweet.id}
                accusedId={tweet.user_id}
                accusedName={tweet.display_name}
                quotedBody={tweet.body}
                userId={currentUserId}
              />

              {currentUserId && tweet.user_id === currentUserId && (
                <>
                  <button onClick={()=>{ setEditingId(tweet.id); setEditBody(tweet.body) }}
                    style={{fontSize:12,color:'var(--color-text-faint)',background:'none',border:'none',cursor:'pointer',padding:'4px 8px'}}>
                    修正
                  </button>
                  <button onClick={()=>handleDelete(tweet.id)}
                    style={{fontSize:12,color:'var(--color-text-faint)',background:'none',border:'none',cursor:'pointer',padding:'4px 8px'}}>
                    削除
                  </button>
                </>
              )}
            </div>

            {editingId === tweet.id ? (
              <div style={{marginBottom:14}}>
                <textarea
                  autoFocus
                  value={editBody}
                  onChange={e=>setEditBody(e.target.value)}
                  rows={4}
                  style={{width:'100%',padding:'10px 12px',fontSize:14.5,lineHeight:1.85,color:'var(--color-text)',background:'var(--color-bg)',border:'1px solid var(--color-brand)',borderRadius:8,resize:'vertical',fontFamily:'inherit'}}
                />
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button
                    onClick={()=>handleEditSave(tweet.id)}
                    disabled={savingEdit || !editBody.trim()}
                    style={{padding:'6px 16px',fontSize:13,color:'#fff',background:'var(--color-brand)',border:'none',borderRadius:6,cursor:'pointer',opacity:(savingEdit||!editBody.trim())?.4:1}}>
                    {savingEdit ? '保存しています…' : '保存する'}
                  </button>
                  <button
                    onClick={()=>setEditingId(null)}
                    style={{padding:'6px 16px',fontSize:13,color:'var(--color-text-muted)',background:'none',border:'1px solid var(--color-brand-border)',borderRadius:6,cursor:'pointer'}}>
                    やめる
                  </button>
                </div>
                <p style={{fontSize:11,color:'var(--color-text-faint)',marginTop:8}}>
                  保存すると「修正済み」と表示されます。
                </p>
              </div>
            ) : (
            <div className="tw-more">
              {/*
                * 3 行を超えるつぶやきを、押して開く。
                *
                * ★ 印（checkbox）と札（label）だけで作る。
                *   つぶやきは何十件も並ぶので、
                *   1 件ずつに状態を持たせると重くなる。
                *
                * ★ id はつぶやきごとに変える。
                *   同じ id が並ぶと、どれを開いても
                *   いちばん上の 1 件しか反応しない。
                */}
              <input
                type="checkbox"
                id={`tw-more-${tweet.id}`}
                className="tw-more-check"
              />

              <div className="tw-body" style={{fontSize:14.5,color:'var(--color-text)',lineHeight:1.85,whiteSpace:'pre-wrap',marginBottom:tweet.image_url?12:14}}>
              {tweet.body}
              {/*
                * 直した印。
                *
                * 本文のすぐ後ろに、小さく添える。
                * 名前の隣に置くと、読む前に目に入って
                * 中身より先に「直された」が伝わってしまう。
                */}
              {tweet.edited_at && (
                <span style={{marginLeft:8,fontSize:11,color:'var(--color-text-faint)'}}>
                  （修正済み）
                </span>
              )}
            </div>

              {/* 3 行に収まっているときは、CSS 側で出さない */}
              <label htmlFor={`tw-more-${tweet.id}`} className="tw-more-label">
                <span className="tw-more-open">続きを読む</span>
                <span className="tw-more-close">とじる</span>
              </label>
            </div>
            )}

            {tweet.image_url && (
              <img src={tweet.image_url} style={{maxWidth:'100%',maxHeight:280,objectFit:'contain',borderRadius:10,display:'block',marginBottom:14}} alt=""/>
            )}

            {/*
             * アンケート。
             *
             * 入れる前でも結果を出す。
             * 隠すと、答えを見るためだけに押す人が出て、
             * その票が本当の意見ではなくなる。
             */}
            {tweet.poll.length > 0 && (
              <div style={{marginBottom:14}}>
                {tweet.poll.map(option => {
                  const total = tweet.poll.reduce((sum, o) => sum + o.votes, 0)
                  const share = total === 0 ? 0 : Math.round(option.votes / total * 100)
                  const isMine = tweet.myVote === option.id

                  return (
                    <button
                      key={option.id}
                      onClick={()=>void vote(tweet.id, option.id)}
                      disabled={!currentUserId}
                      style={{position:'relative',display:'block',width:'100%',marginBottom:8,padding:'10px 14px',
                        border:'1px solid', borderRadius:10, overflow:'hidden', textAlign:'left',
                        background:'var(--color-bg-card)',
                        borderColor: isMine ? 'var(--color-brand)' : '#dcdfda',
                        cursor: currentUserId ? 'pointer' : 'default'}}>

                      {/* 割合の帯。文字の下に敷く */}
                      <span style={{position:'absolute',inset:0,width:`${share}%`,
                        background: isMine ? '#e3ecf3' : '#f2f4f2', transition:'width 0.3s'}} aria-hidden="true"/>

                      <span style={{position:'relative',display:'flex',alignItems:'center',gap:8}}>
                        <span style={{flex:1,minWidth:0,fontSize:13,color:'var(--color-text)'}}>
                          {option.label}
                        </span>
                        {isMine && (
                          <span style={{flexShrink:0,fontSize:11,color:'var(--color-brand)'}}>選択中</span>
                        )}
                        <span style={{flexShrink:0,fontSize:12,color:'var(--color-text-muted)',fontVariantNumeric:'tabular-nums'}}>
                          {share}％
                        </span>
                      </span>
                    </button>
                  )
                })}

                <div style={{fontSize:11.5,color:'var(--color-text-faint)'}}>
                  {tweet.poll.reduce((sum, o) => sum + o.votes, 0)} 票
                  {!currentUserId && '（入れるにはログインが要ります）'}
                </div>
              </div>
            )}

            <div className="tw-actions" style={{display:'flex',alignItems:'center',gap:10,paddingTop:12,borderTop:'1px solid #f4f5f3'}}>
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

              {/*
               * 控える。
               *
               * ログインしていなければ出さない。
               * 押せるのに保存されないと、控えたつもりが消える。
               */}
              {currentUserId && (
                <button
                  onClick={()=>void toggleBookmark(tweet.id)}
                  aria-pressed={tweet.bookmarked}
                  title={tweet.bookmarked ? 'ブックマークを外す' : 'ブックマークする'}
                  style={{display:'inline-flex',alignItems:'center',gap:6,height:34,padding:'0 14px',borderRadius:10,border:'1px solid',fontSize:13,cursor:'pointer',
                    background:tweet.bookmarked?'#eef2f5':'var(--color-bg-card)',
                    borderColor:tweet.bookmarked?'var(--color-brand)':'#dcdfda',
                    color:tweet.bookmarked?'var(--color-brand)':'var(--color-text-muted)'}}>
                  <IconBookmark filled={tweet.bookmarked}/>
                </button>
              )}
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
              {/*
               * 返信。
               *
               * 親（つぶやきへの返信）だけを並べ、
               * その下に、その返信への返信を差し込む。
               * 全部を平らに並べると、誰に向けた言葉か分からなくなる。
               */}
              {tweet.comments
                .filter(c => !c.parent_id)
                .slice(0, tweet.showCount||5)
                .map(parent => (
                <div key={parent.id} style={{borderBottom:'1px solid #f4f5f3'}}>
                  {/*
                   * 親の返信。
                   *
                   * 子がいるときは、絵の下から縦線を伸ばす。
                   * 線で繋がっていないと、下に並んだ返信が
                   * 誰に向けたものか分からない。
                   */}
                  <div style={{display:'flex',gap:10,padding:'14px 22px',position:'relative'}}>
                    <div style={{position:'relative',flexShrink:0}}>
                      <Avatar name={parent.display_name} iconUrl={parent.icon_url} size={28}/>
                      {tweet.comments.some(c => c.parent_id === parent.id) && (
                        <span
                          aria-hidden="true"
                          style={{position:'absolute',left:13,top:32,bottom:-14,width:2,background:'#e3e6e2',borderRadius:1}}
                        />
                      )}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <Link href={`/author/${parent.user_id}`} style={{fontSize:13,fontWeight:600,color:'var(--color-text)',marginRight:8,textDecoration:'none'}}>{parent.display_name}</Link>
                      <span style={{fontSize:11.5,color:'var(--color-text-faint)'}}>{fmtDate(parent.created_at)}</span>
                      <div style={{fontSize:13,color:'var(--color-text)',marginTop:4,lineHeight:1.7}}>{parent.body}</div>

                      {currentUserId && (
                        <button
                          onClick={()=>setReplyTo(prev=>({
                            ...prev,
                            [tweet.id]: prev[tweet.id] === parent.id ? null : parent.id,
                          }))}
                          style={{marginTop:6,fontSize:11.5,color:'var(--color-text-muted)',background:'none',border:'none',padding:0,cursor:'pointer'}}>
                          {replyTo[tweet.id] === parent.id ? 'やめる' : '返信する'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/*
                   * この返信への返信。
                   *
                   * 左に縦線を引いて、親から続いていることを示す。
                   * 最後の 1 件だけ線を途中で止める。
                   * そこで話が終わっていることが分かる。
                   */}
                  {tweet.comments.filter(c => c.parent_id === parent.id).map((child, index, all) => (
                    <div key={child.id} style={{display:'flex',gap:10,padding:'0 22px 0 35px',position:'relative'}}>
                      <div style={{position:'relative',flexShrink:0,width:2}}>
                        <span
                          aria-hidden="true"
                          style={{position:'absolute',left:0,top:0,
                            bottom: index === all.length - 1 ? 'auto' : 0,
                            height: index === all.length - 1 ? 22 : 'auto',
                            width:2,background:'#e3e6e2',borderRadius:1}}
                        />
                        {/* 親から枝分かれする横線 */}
                        <span
                          aria-hidden="true"
                          style={{position:'absolute',left:0,top:20,width:12,height:2,background:'#e3e6e2',borderRadius:1}}
                        />
                      </div>

                      <div style={{display:'flex',gap:10,padding:'12px 0 12px 12px',flex:1,minWidth:0}}>
                        <Avatar name={child.display_name} iconUrl={child.icon_url} size={24}/>
                        <div style={{flex:1,minWidth:0}}>
                          <Link href={`/author/${child.user_id}`} style={{fontSize:12.5,fontWeight:600,color:'var(--color-text)',marginRight:8,textDecoration:'none'}}>{child.display_name}</Link>
                          <span style={{fontSize:11,color:'var(--color-text-faint)'}}>{fmtDate(child.created_at)}</span>
                          <div style={{fontSize:12.5,color:'var(--color-text)',marginTop:4,lineHeight:1.7}}>{child.body}</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 返信を書く欄。押したときだけ出す */}
                  {replyTo[tweet.id] === parent.id && currentUserId && (
                    <div style={{display:'flex',gap:10,padding:'12px 22px 14px 56px',alignItems:'center',background:'var(--color-bg)'}}>
                      <input
                        value={commentBody[parent.id]||''}
                        onChange={e=>setCommentBody(prev=>({...prev,[parent.id]:e.target.value}))}
                        onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleComment(tweet.id, parent.id)}}}
                        placeholder={`${parent.display_name} さんへ返信`}
                        maxLength={200}
                        autoFocus
                        style={{flex:1,height:34,padding:'0 12px',border:'1px solid #dcdfda',borderRadius:10,fontSize:12.5,outline:'none'}}
                      />
                      <button onClick={()=>handleComment(tweet.id, parent.id)}
                        disabled={commentPosting[parent.id]||!commentBody[parent.id]?.trim()}
                        style={{height:34,padding:'0 14px',background:'var(--color-brand)',color:'var(--color-text-inverse)',border:'none',borderRadius:10,fontSize:12.5,fontWeight:600,cursor:'pointer',opacity:commentPosting[parent.id]||!commentBody[parent.id]?.trim()?0.5:1}}>
                        送信
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {tweet.comments.filter(c=>!c.parent_id).length > (tweet.showCount||5) && (
                <div style={{padding:'12px 22px',textAlign:'center'}}>
                  <button
                    onClick={()=>setTweets(prev=>prev.map(t=>t.id===tweet.id?{...t,showCount:(t.showCount||5)+5}:t))}
                    style={{fontSize:13,color:'var(--color-brand)',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>
                    もっと表示する（残り{tweet.comments.filter(c=>!c.parent_id).length-(tweet.showCount||5)}件）
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
          ))}
        </>
      )}
    </div>
  )
}

/**
 * ============================================================
 * 書き込みの見本
 *
 * まだ誰も書いていないときだけ出す。
 *
 * 空の画面には、最初の 1 人が出てこない。
 * 何を書けばいい場所なのかが分からないまま、
 * 入力欄だけを見て閉じることになる。
 *
 * ------------------------------------------------------------
 * 本物と紛れないようにする
 *
 * 薄く出し、上に「例」と添え、押せないようにする。
 * 本物のように見えると、返信しようとして
 * 押しても何も起きない、という体験になる。
 * ============================================================
 */
function SampleTweets() {
  const samples = [
    {
      name: '海月',
      topic: '創作の悩み',
      body: '長編を書きたいのですが、途中で失速してしまいます…。\nみなさんのモチベーション維持の方法が知りたいです！',
      like: 8, comment: 3,
    },
    {
      name: '灯火',
      topic: 'プロット・設定',
      body: 'ファンタジー作品の世界観設定について相談です。\n魔法のルールって、どこまで細かく決めていますか？',
      like: 6, comment: 4,
    },
    {
      name: '紫苑',
      topic: '推し・感想',
      body: '最近読んだ小説のこのシーン、鳥肌が立ちました…！\nおすすめの、シーンが印象的な作品をぜひ教えてください！',
      like: 9, comment: 2,
    },
  ]

  return (
    <>
    <div>
      <p style={{fontSize:12.5,lineHeight:1.9,color:'var(--color-text-muted)',marginBottom:14}}>
        まだ誰も書いていません。こんなふうに使えます。
      </p>

      <div aria-hidden="true" style={{opacity:0.55, pointerEvents:'none'}}>
        {samples.map((s, i) => (
          <div
            key={i}
            style={{background:'var(--color-bg-card)',border:'1px dashed var(--color-brand-border)',borderRadius:16,marginBottom:16,padding:'20px 22px'}}
          >
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:'var(--color-brand-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:'var(--color-brand)',flexShrink:0}}>
                {s.name[0]}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                  <span style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>{s.name}</span>
                  <span style={{fontSize:11,color:'var(--color-text-faint)'}}>例</span>
                </div>
              </div>
              <span style={{flexShrink:0,padding:'3px 10px',borderRadius:999,background:'#eef2f5',color:'var(--color-brand)',fontSize:11}}>
                {s.topic}
              </span>
            </div>

            <div style={{fontSize:14,lineHeight:1.9,color:'var(--color-text)',whiteSpace:'pre-wrap'}}>
              {s.body}
            </div>

            <div style={{display:'flex',gap:8,marginTop:14}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:6,height:34,padding:'0 14px',borderRadius:10,border:'1px solid #dcdfda',fontSize:13,color:'var(--color-text-muted)'}}>
                <IconHeart filled={false}/>
                {s.like}
              </span>
              <span style={{display:'inline-flex',alignItems:'center',gap:6,height:34,padding:'0 14px',borderRadius:10,border:'1px solid #dcdfda',fontSize:13,color:'var(--color-text-muted)'}}>
                <IconComment/>
                {s.comment}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
    {prompt}
    </>
  )
}
