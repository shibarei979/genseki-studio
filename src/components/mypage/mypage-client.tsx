'use client'
import SeriesManager from '@/components/series-manager'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Header from '@/components/layout/header'
import type { Profile, Novel } from '@/types'
import MissionClient from '@/components/mypage/mission-client'
import MypageDashboard from '@/components/mypage/mypage-dashboard'
import TweetSection from '@/components/tweet-section'
import ChapterEditModal from '@/components/mypage/chapter-edit-modal'

interface Contest { id: string; title: string; deadline: string | null; is_site_contest: boolean }
interface Entry { contest_id: string; novel_id: string }
interface MissionStats {
  readCount?: number
  hasBio?: boolean
  tweetCount?: number
  seriesCount?: number
  likeCount: number; discoverCount: number; commentCount: number
  bookmarkCount: number; novelCount: number; episodeCount: number; followCount: number
}

interface Props {
  profile: Profile & { birthdate?: string | null; notify_like?: boolean; notify_comment?: boolean; notify_follow?: boolean; notify_new_episode?: boolean; notify_new_work?: boolean; gender?: string | null; x_account?: string | null; allow_comments?: boolean; user_role?: string | null }
  novels: Novel[]
  bookmarkedNovels: any[]
  followingAuthors?: any[]
  followerCount?: number
  followingCount?: number
  contests?: Contest[]
  initialEntries?: Entry[]
  claimedMissionIds?: string[]
  unreadFeedback?: number
  unreadRanking?: number
  historyItems?: any[]
  firstEpMap?: Record<string,string>
  charCountMap?: Record<string,number>
  likeMap?: Record<string,number>
  missionStats?: MissionStats
  monthlySummary?: any
  recentTweet?: any
  novelLikeMap?: Record<string,number>
  postDates?: string[]
  novelCommentMap?: Record<string,number>
  novelViewMap?: Record<string,number>
  novelEpCountMap?: Record<string,number>
  bmAuthorMap?: Record<string,string>
}

const ALL_BADGES = [
  { id:'like_3',      name:'応援バッジ',              color:'var(--color-brand)' },
  { id:'like_10',     name:'読者バッジ Lv.1',          color:'var(--color-brand)' },
  { id:'like_50',     name:'読者バッジ Lv.2',          color:'var(--color-brand)' },
  { id:'bookmark_5',  name:'保存家バッジ',              color:'var(--color-brand)' },
  { id:'comment_1',   name:'コメンテーターバッジ Lv.1', color:'var(--color-brand)' },
  { id:'comment_10',  name:'コメンテーターバッジ Lv.2', color:'var(--color-brand)' },
  { id:'discover_1',  name:'拡散者バッジ Lv.1',        color:'#22c55e' },
  { id:'discover_3',  name:'拡散者バッジ Lv.2',        color:'#22c55e' },
  { id:'discover_10', name:'拡散者バッジ Lv.3',        color:'#22c55e' },
  { id:'novel_1',     name:'作家バッジ Lv.1',          color:'#3b82f6' },
  { id:'novel_3',     name:'作家バッジ Lv.2',          color:'#3b82f6' },
  { id:'episode_5',   name:'連載バッジ',               color:'#3b82f6' },
  { id:'episode_20',  name:'長編バッジ',               color:'#3b82f6' },
  { id:'follow_1',    name:'ファンバッジ Lv.1',         color:'#8b5cf6' },
  { id:'follow_5',    name:'ファンバッジ Lv.2',         color:'#8b5cf6' },
  { id:'quest_june_2026', name:'スタートダッシュバッジ', color:'#e11d48' },
  { id:'login_1',     name:'ログインバッジ Lv.1',       color:'#94a3b8' },
  { id:'login_3',     name:'ログインバッジ Lv.2',       color:'#94a3b8' },
  { id:'login_7',     name:'ログインバッジ Lv.3',       color:'#94a3b8' },
  { id:'login_30',    name:'ログインバッジ Lv.4',       color:'#94a3b8' },
  { id:'newbie',      name:'新人バッジ',               color:'#4a7fa5' },
  { id:'push_badge',  name:'推しバッジ',               color:'#4a7fa5' },
  { id:'_slot1',      name:'？？？',                  color:'#94a3b8' },
  { id:'_slot2',      name:'？？？',                  color:'#94a3b8' },
]

type Tab = 'mypage' | 'works' | 'bookmarks' | 'history' | 'tweet' | 'mission' | 'settings' | 'series'
const TAB_ICONS: Record<string, React.ReactNode> = {
  mypage:    <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  works:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  series:    <><path d="M12 2L2 7l10 5 10-5-10-5z"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  bookmarks: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>,
  history:   <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  tweet:     <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>,
  mission:   <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
}

const TABS: { id: Tab; label: string }[] = [
  { id:'mypage',    label:'マイページ' },
  { id:'works',     label:'作品管理' },
  { id:'series',    label:'シリーズ' },
  { id:'bookmarks', label:'保存済み' },
  { id:'history',   label:'閲覧履歴' },
  { id:'tweet',     label:'つぶやき' },
  { id:'mission',   label:'ミッション' },
  { id:'settings',  label:'設定' },
]

function FolderCreateModal({ onClose, onCreate, saving }: { onClose:()=>void; onCreate:(name:string)=>void; saving:boolean }) {
  const [name, setName] = React.useState('')
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:24,maxWidth:360,width:'100%'}}>
        <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:12}}>リストを作成</div>
        <input
          type="text"
          value={name}
          onChange={e=>setName(e.target.value)}
          placeholder="リスト名"
          style={{width:'100%',padding:'9px 12px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13,outline:'none',marginBottom:12,boxSizing:'border-box' as const,fontFamily:'inherit',background:'var(--color-bg-card)',color:'var(--color-text)'}}
        />
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose}
            style={{flex:1,padding:'9px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>
            キャンセル
          </button>
          <button onClick={()=>onCreate(name.trim())} disabled={saving||!name.trim()}
            style={{flex:1,padding:'9px',border:'none',borderRadius:8,background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,cursor:'pointer',opacity:saving||!name.trim()?0.5:1}}>
            {saving?'作成中...':'作成'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MypageClient({
  profile, novels: initialNovels, bookmarkedNovels,
  followingAuthors=[], followerCount=0, followingCount=0,
  contests=[], initialEntries=[], claimedMissionIds=[], unreadFeedback=0, unreadRanking=0,
  historyItems=[], firstEpMap={}, charCountMap={}, likeMap={},
  missionStats={ likeCount:0, discoverCount:0, commentCount:0, bookmarkCount:0, novelCount:0, episodeCount:0, followCount:0 },
  novelLikeMap={}, novelCommentMap={}, novelViewMap={}, novelEpCountMap={}, bmAuthorMap={},
  postDates=[], monthlySummary=null, recentTweet=null,
}: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as Tab
      const valid: Tab[] = ['mypage','works','bookmarks','history','tweet','mission','settings','series']
      if (valid.includes(hash)) return hash
    }
    return 'mypage'
  })

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      window.location.hash = tab
    }
  }

  // ハッシュ（/mypage#works など）の変化でタブを切り替える
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '') as Tab
      const valid: Tab[] = ['mypage','works','bookmarks','history','tweet','mission','settings','series']
      if (valid.includes(hash)) setActiveTab(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const [myNovels,       setMyNovels]       = useState(initialNovels)
  const [expandedWork,   setExpandedWork]   = useState<string | null>(null)
  const [worksFilter,    setWorksFilter]    = useState<'all'|'published'|'serial'|'completed'|'short'|'draft'>('all')
  const [histSort,       setHistSort]       = useState<'recent'|'title'>('recent')
  const [histGenre,      setHistGenre]      = useState('すべてのジャンル')
  const [histType,       setHistType]       = useState('すべての形式')
  const [workEpisodes,   setWorkEpisodes]   = useState<Record<string, any[]>>({})
  const [loadingEps,     setLoadingEps]     = useState<string | null>(null)
  const [editMenuOpen,   setEditMenuOpen]   = useState<string | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<{id:string;title:string;episodes:any[]}|null>(null)
  const [deleteMode,     setDeleteMode]     = useState<'novel'|'episode'|null>(null)
  const [deleteEpId,     setDeleteEpId]     = useState('')
  const [deleteLoading,  setDeleteLoading]  = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [iconUrl,        setIconUrl]        = useState(profile.icon_url || '')
  const [iconUploading,  setIconUploading]  = useState(false)
  const iconInputRef = React.useRef<HTMLInputElement>(null)
  const [editingName,    setEditingName]    = useState(false)
  const [nameInput,      setNameInput]      = useState(profile.display_name)
  const [nameSaving,     setNameSaving]     = useState(false)
  const [nameError,      setNameError]      = useState('')
  const [nameSaved,      setNameSaved]      = useState(false)
  const [toast,          setToast]          = useState('')
  const [showWithdraw,   setShowWithdraw]   = useState(false)
  const [withdrawPw,     setWithdrawPw]     = useState('')
  const [withdrawing,    setWithdrawing]    = useState(false)
  const [withdrawError,  setWithdrawError]  = useState('')
  const [showBdModal,    setShowBdModal]    = useState(false)
  const [bdYear,         setBdYear]         = useState('')
  const [bdMonth,        setBdMonth]        = useState('')
  const [bdDay,          setBdDay]          = useState('')
  const [bdError,        setBdError]        = useState('')
  const [bdSaving,       setBdSaving]       = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showPwModal,    setShowPwModal]    = useState(false)
  const [showBioModal,   setShowBioModal]   = useState(false)
  const [bioInput,       setBioInput]       = useState(profile.bio || '')
  const [bioSaving,      setBioSaving]      = useState(false)
  const [newEmail,       setNewEmail]       = useState('')
  const [emailPw,        setEmailPw]        = useState('')
  const [emailError,     setEmailError]     = useState('')
  const [emailSaving,    setEmailSaving]    = useState(false)
  const [currentPw,      setCurrentPw]      = useState('')
  const [newPw,          setNewPw]          = useState('')
  const [newPwConfirm,   setNewPwConfirm]   = useState('')
  const [pwError,        setPwError]        = useState('')
  const [pwSaving,       setPwSaving]       = useState(false)
  const [isMobile,       setIsMobile]       = useState(false)
  const [showBadgeBook,  setShowBadgeBook]  = useState(false)
  const [badgePage,      setBadgePage]      = useState(0)
  const [showBoard,      setShowBoard]      = useState(false)
  const [chapterTarget,  setChapterTarget]  = useState<{id:string;title:string}|null>(null)
  const [epManageTarget, setEpManageTarget] = useState<{id:string;title:string}|null>(null)
  const [epList,         setEpList]         = useState<any[]>([])
  const [epToggling,     setEpToggling]     = useState('')
  const [expandedNovels, setExpandedNovels] = useState<Set<string>>(new Set())
  const [notifyLike,       setNotifyLike]       = useState(profile.notify_like       !== false)
  const [notifyComment,    setNotifyComment]    = useState(profile.notify_comment    !== false)
  const [notifyFollow,     setNotifyFollow]     = useState(profile.notify_follow     !== false)
  const [notifyNewEpisode, setNotifyNewEpisode] = useState(profile.notify_new_episode !== false)
  const [notifyNewWork,    setNotifyNewWork]    = useState(profile.notify_new_work   !== false)
  const [notifySaving,     setNotifySaving]     = useState(false)
  const [blockList,        setBlockList]        = useState<any[]>([])
  const [folders,          setFolders]          = useState<any[]>([])
  const [activeFolderId,   setActiveFolderId]   = useState<string|null>(null)
  const [showFolderModal,  setShowFolderModal]  = useState(false)
  const [folderInput,      setFolderInput]      = useState('')
  const [folderSaving,     setFolderSaving]     = useState(false)
  const [movingBookmark,   setMovingBookmark]   = useState<string|null>(null)
  const [myBookmarks,      setMyBookmarks]      = useState<any[]>(bookmarkedNovels)
  const [foldersLoaded,    setFoldersLoaded]    = useState(false)
  const [muteList,         setMuteList]         = useState<any[]>([])
  const [blockMuteLoaded,  setBlockMuteLoaded]  = useState(false)
  const [gender,           setGender]           = useState<string>((profile as any).gender || '')
  const [xAccount,         setXAccount]         = useState<string>((profile as any).x_account || '')
  const [xSaving,          setXSaving]          = useState(false)
  const [allowComments,    setAllowComments]    = useState((profile as any).allow_comments !== false)
  const [showGenderModal,  setShowGenderModal]  = useState(false)
  const [showXModal,       setShowXModal]       = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const perPage    = isMobile ? 12 : 24
  const totalPages = Math.ceil(ALL_BADGES.length / perPage)
  const claimedSet = new Set(claimedMissionIds)
  // 全ミッション達成でミッションタブは卒業（非表示）：書き手15・読み手10
  /*
    いまは執筆向けだけを出しているので、
    誰でも書き手として扱う。

    読書向けを用意したら、user_role を見る形に戻す。
  */
  const isWriterRole = true
  const allMissionsDone = claimedMissionIds.length >= (isWriterRole ? 15 : 10)
  const visibleTabs = TABS.filter(t => t.id !== 'mission' || !allMissionsDone)
  const published  = myNovels.filter(n => n.published)
  const drafts     = myNovels.filter(n => !n.published)
  const initial    = profile.display_name.slice(0,1)
  const userNumber = (profile as any).user_number ? '#' + String((profile as any).user_number).padStart(4,'0') : null

  function fmtDate(s: string) {
    const d = new Date(s), now = new Date(), diff = now.getTime()-d.getTime()
    if (diff < 60*60*1000) return `${Math.floor(diff/60000)}分前`
    if (diff < 24*60*60*1000) return `${Math.floor(diff/3600000)}時間前`
    if (diff < 7*24*60*60*1000) return `${Math.floor(diff/86400000)}日前`
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`
  }
  function fmtNum(n:number) { return n>=10000?`${(n/10000).toFixed(1)}万`:n.toString() }
  function fmtChars(n:number) { return n>=10000?`${(n/10000).toFixed(1)}万文字`:`${n.toLocaleString()}文字` }
  function fmtDateTime(s?:string) { if(!s) return '—'; const d=new Date(s); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
  function fmtDateShort(s?:string) { if(!s) return '—'; const d=new Date(s); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` }

  async function handleSaveGender(val: string) {
    setGender(val)
    await supabase.from('profiles').update({ gender: val||null }).eq('user_id', profile.user_id)
    setShowGenderModal(false)
    setToast('性別を保存しました'); setTimeout(()=>setToast(''),2000)
  }

  async function handleSaveXAccount() {
    setXSaving(true)
    const cleaned = xAccount.replace(/^@/, '').trim()
    setXAccount(cleaned)
    await supabase.from('profiles').update({ x_account: cleaned||null }).eq('user_id', profile.user_id)
    setXSaving(false); setShowXModal(false)
    setToast('Xアカウントを保存しました'); setTimeout(()=>setToast(''),2000)
  }

  async function handleToggleAllowComments() {
    const next = !allowComments
    setAllowComments(next)
    await supabase.from('profiles').update({ allow_comments: next }).eq('user_id', profile.user_id)
    setToast(next?'コメントを許可しました':'コメントを不許可にしました'); setTimeout(()=>setToast(''),2000)
  }

  async function handleSaveNotify(key: string, value: boolean) {
    setNotifySaving(true)
    await supabase.from('profiles').update({ [key]: value }).eq('user_id', profile.user_id)
    setNotifySaving(false)
  }

  async function handleSaveBio() {
    setBioSaving(true)
    await supabase.from('profiles').update({ bio: bioInput.trim()||null }).eq('user_id', profile.user_id)
    setBioSaving(false); setShowBioModal(false)
    setToast('自己紹介を保存しました'); setTimeout(()=>setToast(''),2000)
  }
  async function handleIconUpload(file: File) {
    if (!file.type.startsWith('image/')) return
    setIconUploading(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${profile.user_id}.${ext}`
    const { error: upErr } = await supabase.storage.from('illustrations').upload(path, file, { upsert:true })
    if (!upErr) {
      const { data } = supabase.storage.from('illustrations').getPublicUrl(path)
      await supabase.from('profiles').update({ icon_url: data.publicUrl }).eq('user_id', profile.user_id)
      setIconUrl(data.publicUrl)
    }
    setIconUploading(false)
  }
  async function handleSaveName() {
    if (!nameInput.trim()) { setNameError('名前を入力してください'); return }
    if (nameInput.trim().length > 20) { setNameError('20文字以内'); return }
    setNameSaving(true); setNameError('')
    const { error } = await supabase.from('profiles').update({ display_name: nameInput.trim() }).eq('user_id', profile.user_id)
    setNameSaving(false)
    if (error) { setNameError('保存に失敗しました'); return }
    setEditingName(false); setNameSaved(true); setTimeout(()=>setNameSaved(false),2000)
  }
  async function handleSignOut() {
    setLoading(true); await supabase.auth.signOut(); window.location.href='/'
  }
  async function handleTogglePublish(novelId: string, current: boolean) {
    await supabase.from('novels').update({ published: !current }).eq('id', novelId)
    setMyNovels(prev => prev.map(n => n.id===novelId ? {...n,published:!current} : n))
    setToast(current?'非公開にしました':'公開しました'); setTimeout(()=>setToast(''),2000)
  }
  async function handleOpenEpManage(novel: Novel) {
    setEpManageTarget({ id:novel.id, title:novel.title })
    const { data:eps } = await supabase.from('episodes').select('id,title,ep_number,published').eq('novel_id',novel.id).order('ep_number',{ascending:true})
    setEpList(eps||[])
  }
  async function handleToggleEpPublish(epId: string, current: boolean) {
    setEpToggling(epId)
    await supabase.from('episodes').update({ published: !current }).eq('id', epId)
    setEpList(prev => prev.map(e => e.id===epId ? {...e,published:!current} : e))
    setToast(current?'話を非公開にしました':'話を公開しました'); setTimeout(()=>setToast(''),2000)
    setEpToggling('')
  }
  async function handleDeleteConfirm() {
    if (!deleteTarget||!deleteMode) return
    setDeleteLoading(true)
    if (deleteMode==='novel') {
      await supabase.from('novels').delete().eq('id', deleteTarget.id)
      setMyNovels(prev => prev.filter(n => n.id!==deleteTarget.id))
      setToast('作品を削除しました')
    } else if (deleteMode==='episode'&&deleteEpId) {
      await supabase.from('episodes').delete().eq('id', deleteEpId)
      setToast('話を削除しました')
    }
    setDeleteLoading(false); setDeleteTarget(null); setDeleteMode(null); setDeleteEpId('')
    setTimeout(()=>setToast(''),2000)
  }
  async function handleSaveBirthdate() {
    setBdError('')
    if (!bdYear||!bdMonth||!bdDay) { setBdError('生年月日を入力してください'); return }
    const age = (() => {
      const birth = new Date(Number(bdYear),Number(bdMonth)-1,Number(bdDay))
      const today = new Date(); let a = today.getFullYear()-birth.getFullYear()
      const m = today.getMonth()-birth.getMonth()
      if (m<0||(m===0&&today.getDate()<birth.getDate())) a--; return a
    })()
    if (age<0||age>120) { setBdError('正しい生年月日を入力してください'); return }
    if (age<13) { setBdError('13歳未満の方はご利用いただけません'); return }
    setBdSaving(true)
    const birthdate = `${bdYear}-${String(bdMonth).padStart(2,'0')}-${String(bdDay).padStart(2,'0')}`
    const { error:bdErr } = await supabase.from('profiles').update({ birthdate, age_verified:age>=18 }).eq('user_id', profile.user_id)
    setBdSaving(false)
    if (bdErr) { setToast('保存に失敗しました'); return }
    setShowBdModal(false)
    setToast(age>=18?'生年月日を設定しました。R18コンテンツが閲覧できます。':'生年月日を設定しました')
    setTimeout(()=>setToast(''),3000); window.location.href=window.location.pathname
  }
  async function handleEmailChange() {
    setEmailError('')
    if (!newEmail.includes('@')) { setEmailError('正しいメールアドレスを入力してください'); return }
    if (!emailPw) { setEmailError('現在のパスワードを入力してください'); return }
    setEmailSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user?.email) { setEmailError('ログイン情報が確認できません'); setEmailSaving(false); return }
    const { error:signInErr } = await supabase.auth.signInWithPassword({ email:user.email, password:emailPw })
    if (signInErr) { setEmailError('パスワードが正しくありません'); setEmailSaving(false); return }
    const { error } = await supabase.auth.updateUser({ email:newEmail })
    if (error) { setEmailError(error.message); setEmailSaving(false); return }
    await supabase.from('profiles').update({ email:newEmail }).eq('user_id', profile.user_id)
    setEmailSaving(false); setShowEmailModal(false); setNewEmail(''); setEmailPw('')
    setToast('確認メールを送信しました'); setTimeout(()=>setToast(''),4000)
  }
  async function handlePwChange() {
    setPwError('')
    if (newPw.length<6) { setPwError('6文字以上で入力してください'); return }
    if (newPw!==newPwConfirm) { setPwError('パスワードが一致しません'); return }
    if (!currentPw) { setPwError('現在のパスワードを入力してください'); return }
    setPwSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user?.email) { setPwError('ログイン情報が確認できません'); setPwSaving(false); return }
    const { error:signInErr } = await supabase.auth.signInWithPassword({ email:user.email, password:currentPw })
    if (signInErr) { setPwError('現在のパスワードが正しくありません'); setPwSaving(false); return }
    const { error } = await supabase.auth.updateUser({ password:newPw })
    if (error) { setPwError(error.message); setPwSaving(false); return }
    setPwSaving(false); setShowPwModal(false); setCurrentPw(''); setNewPw(''); setNewPwConfirm('')
    setToast('パスワードを変更しました'); setTimeout(()=>setToast(''),3000)
  }
  async function handleWithdraw() {
    setWithdrawError(''); setWithdrawing(true)
    try {
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) { setWithdrawError('ログイン情報が確認できません'); setWithdrawing(false); return }
      if (profile.login_provider!=='google') {
        if (!withdrawPw) { setWithdrawError('パスワードを入力してください'); setWithdrawing(false); return }
        if (!user.email) { setWithdrawError('ログイン情報が確認できません'); setWithdrawing(false); return }
        const { error:signInErr } = await supabase.auth.signInWithPassword({ email:user.email, password:withdrawPw })
        if (signInErr) { setWithdrawError('パスワードが正しくありません'); setWithdrawing(false); return }
      } else {
        if (withdrawPw!=='退会') { setWithdrawError('「退会」と入力してください'); setWithdrawing(false); return }
      }
      await supabase.from('profiles').update({ display_name:'退会済みユーザー',email:null,icon_url:null,bio:null }).eq('user_id', profile.user_id)
      await supabase.auth.signOut(); window.location.href='/'
    } catch { setToast('退会処理に失敗しました'); setWithdrawing(false) }
  }

  // ===== マイページタブ =====
  const MypageTab = () => (
    <div>
      {!profile.birthdate && (
        <div style={{background:'var(--color-brand-light)',border:'1px solid var(--color-tag-border)',borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <div style={{flex:1,fontSize:13,color:'var(--color-text)',lineHeight:1.6}}>生年月日が登録されていません。登録するとR18コンテンツが閲覧できます。</div>
          <button onClick={()=>setShowBdModal(true)} style={{padding:'6px 14px',background:'var(--color-brand)',color:'var(--color-text-inverse)',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',flexShrink:0}}>設定する</button>
        </div>
      )}
      <div style={{display:'flex',alignItems:'flex-start',gap:24,marginBottom:20,flexWrap:'wrap',background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:14,padding:'20px 22px'}}>
        <div style={{position:'relative',flexShrink:0,cursor:'pointer'}} onClick={()=>iconInputRef.current?.click()}>
          <input ref={iconInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f){handleIconUpload(f);e.target.value=''}}}/>
          {iconUrl
            ? <img src={iconUrl} alt={profile.display_name} style={{width:88,height:88,borderRadius:'50%',objectFit:'cover',border:'3px solid var(--color-brand)'}}/>
            : <div style={{width:88,height:88,borderRadius:'50%',background:'var(--color-brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,fontWeight:700,color:'var(--color-text-inverse)'}}>{initial}</div>
          }
          <div style={{position:'absolute',bottom:2,right:2,width:22,height:22,background:'var(--color-bg-card)',borderRadius:'50%',border:'2px solid var(--color-brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11}}>{iconUploading?'⟳':'📷'}</div>
        </div>
        <div style={{flex:'1 1 200px',minWidth:180}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
            {editingName ? (
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <input value={nameInput} onChange={e=>setNameInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')handleSaveName();if(e.key==='Escape')setEditingName(false)}}
                  style={{fontSize:18,fontWeight:700,border:'1.5px solid var(--color-brand)',borderRadius:6,padding:'3px 10px',outline:'none',width:160}} autoFocus/>
                <button onClick={handleSaveName} disabled={nameSaving} style={{fontSize:12,background:'var(--color-brand)',color:'var(--color-text-inverse)',border:'none',borderRadius:6,padding:'5px 12px',cursor:'pointer'}}>{nameSaving?'保存中':'保存'}</button>
                <button onClick={()=>{setEditingName(false);setNameInput(profile.display_name);setNameError('')}} style={{fontSize:12,background:'none',color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',borderRadius:6,padding:'5px 10px',cursor:'pointer'}}>×</button>
                {nameError && <span style={{fontSize:11,color:'var(--color-danger)'}}>{nameError}</span>}
              </div>
            ) : (
              <>
                <div style={{fontSize:22,fontWeight:700,color:'var(--color-text)'}}>{nameInput}</div>
                {nameSaved && <span style={{fontSize:11,color:'var(--color-success)'}}>✓</span>}
              </>
            )}
          </div>
          {userNumber && <div style={{fontSize:12,color:'var(--color-text-faint)',marginBottom:4}}>{userNumber}</div>}
          <div style={{fontSize:12.5,color:'var(--color-text-muted)',marginBottom:12}}>{profile.email}</div>
          <div style={{display:'flex',gap:28,flexWrap:'wrap',marginBottom:12}}>
            <div style={{textAlign:'center' as const}}>
              <div style={{fontSize:20,fontWeight:800,color:'var(--color-text)',lineHeight:1.2}}>{followerCount}</div>
              <div style={{fontSize:11,color:'var(--color-text-muted)'}}>フォロワー</div>
            </div>
            <div style={{textAlign:'center' as const}}>
              <div style={{fontSize:20,fontWeight:800,color:'var(--color-text)',lineHeight:1.2}}>{followingCount}</div>
              <div style={{fontSize:11,color:'var(--color-text-muted)'}}>フォロー中</div>
            </div>
            <div style={{textAlign:'center' as const}}>
              <div style={{fontSize:20,fontWeight:800,color:'var(--color-text)',lineHeight:1.2}}>{published.length}</div>
              <div style={{fontSize:11,color:'var(--color-text-muted)'}}>公開作品</div>
            </div>
          </div>
        </div>
        <div style={{flex:'1 1 240px',minWidth:220,display:'flex',flexDirection:'column',gap:12,alignItems:'flex-end'}}>
          {profile.bio && <div style={{fontSize:13,color:'var(--color-text)',lineHeight:1.8,paddingRight:60}}>{profile.bio}</div>}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginLeft:'auto',justifyContent:'flex-end',paddingRight:200,marginTop:10}}>
            <button onClick={()=>setEditingName(true)} style={{fontSize:12.5,border:'1px solid var(--color-brand-border)',padding:'8px 16px',borderRadius:8,background:'var(--color-bg-card)',color:'var(--color-text-muted)',cursor:'pointer'}}>名前を変更</button>
            <button onClick={()=>setShowBioModal(true)} style={{fontSize:12.5,border:'1px solid var(--color-brand-border)',padding:'8px 16px',borderRadius:8,background:'var(--color-bg-card)',color:'var(--color-text-muted)',cursor:'pointer'}}>自己紹介を編集</button>
            <Link href={`/author/${profile.user_id}`} style={{fontSize:12.5,padding:'8px 16px',borderRadius:8,background:'var(--color-brand)',color:'var(--color-text-inverse)',textDecoration:'none',fontWeight:700}}>公開ページを見る →</Link>
          </div>
        </div>
      </div>
      {(unreadFeedback > 0 || unreadRanking > 0) && (
        <div style={{marginBottom:20,border:'1px solid #fecaca',borderRadius:10,overflow:'hidden'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#dc2626',background:'#fef2f2',padding:'6px 14px'}}>新着通知</div>
          {unreadFeedback > 0 && (
            <Link href="/mypage/comments" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'11px 14px',textDecoration:'none',borderTop:'1px solid #fee2e2'}}>
              <span style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>新しい感想が届いています（{unreadFeedback}）</span>
              <span style={{fontSize:12,color:'#dc2626'}}>→</span>
            </Link>
          )}
          {unreadRanking > 0 && (
            <Link href="/mypage/ranking-history" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'11px 14px',textDecoration:'none',borderTop:'1px solid #fee2e2'}}>
              <span style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>ランクインしました！（{unreadRanking}）</span>
              <span style={{fontSize:12,color:'#dc2626'}}>→</span>
            </Link>
          )}
        </div>
      )}
      {followingAuthors.length > 0 && (
        <div style={{marginTop:16}}>
          <div style={{fontSize:12,fontWeight:700,color:'var(--color-text-muted)',marginBottom:8}}>フォロー中の作者（{followingAuthors.length}）</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {followingAuthors.map((a:any) => (
              <a key={a.user_id} href={`/author/${a.user_id}`} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:16,textDecoration:'none'}}>
                {a.icon_url ? <img src={a.icon_url} style={{width:18,height:18,borderRadius:'50%',objectFit:'cover'}} alt=""/> : <div style={{width:18,height:18,borderRadius:'50%',background:'var(--color-brand-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'var(--color-brand)',fontWeight:700}}>{a.display_name?.[0]}</div>}
                <span style={{fontSize:12,color:'var(--color-text)'}}>{a.display_name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{marginTop:20}}>
        <MypageDashboard
          novels={myNovels}
          historyItems={historyItems}
          bookmarkedNovels={myBookmarks}
          bmAuthorMap={bmAuthorMap}
          novelLikeMap={novelLikeMap}
          novelViewMap={novelViewMap}
          charCountMap={charCountMap}
          missionStats={missionStats}
          claimedMissionIds={claimedMissionIds}
          isWriter={isWriterRole}
          monthlySummary={monthlySummary || { novels:0,novelsPrev:0,chars:0,charsPrev:0,views:0,viewsPrev:0,likes:0,likesPrev:0 }}
          recentTweet={recentTweet}
          onEditName={()=>setEditingName(true)}
          onEditBio={()=>setShowBioModal(true)}
          onTabChange={(t:string)=>handleTabChange(t as Tab)}
        />
      </div>
    </div>
  )

  // ===== 作品管理タブ =====
  async function toggleWorkExpand(novelId: string) {
    if (expandedWork === novelId) {
      setExpandedWork(null)
      return
    }
    setExpandedWork(novelId)
    // まだ取得していなければ話＋統計を取得
    if (!workEpisodes[novelId]) {
      setLoadingEps(novelId)
      const { data: eps } = await supabase
        .from('episodes')
        .select('id, title, ep_number, body, published, created_at')
        .eq('novel_id', novelId)
        .order('ep_number', { ascending: true })

      const epIds = (eps || []).map((e: any) => e.id)
      const pvMap: Record<string, number> = {}
      const likeMap: Record<string, number> = {}
      const commentMap: Record<string, number> = {}

      if (epIds.length > 0) {
        const [{ data: pvs }, { data: els }, { data: cms }] = await Promise.all([
          supabase.from('page_views').select('episode_id').in('episode_id', epIds),
          supabase.from('episode_likes').select('episode_id').in('episode_id', epIds),
          supabase.from('comments').select('episode_id').in('episode_id', epIds),
        ])
        pvs?.forEach((p: any) => { pvMap[p.episode_id] = (pvMap[p.episode_id] || 0) + 1 })
        els?.forEach((l: any) => { likeMap[l.episode_id] = (likeMap[l.episode_id] || 0) + 1 })
        cms?.forEach((c: any) => { if (c.episode_id) commentMap[c.episode_id] = (commentMap[c.episode_id] || 0) + 1 })
      }

      const enriched = (eps || []).map((e: any) => ({
        ...e,
        charCount: (e.body || '').length,
        pv: pvMap[e.id] || 0,
        likes: likeMap[e.id] || 0,
        comments: commentMap[e.id] || 0,
      }))
      setWorkEpisodes(prev => ({ ...prev, [novelId]: enriched }))
      setLoadingEps(null)
    }
  }

  const WorksTab = () => (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:28,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',letterSpacing:'-0.01em',lineHeight:1.3}}>
            投稿作品 <span style={{fontSize:15,fontWeight:600,color:'var(--color-text-muted)'}}>{myNovels.length}作品</span>
          </h1>
          <p style={{fontSize:14,color:'var(--color-text-muted)',marginTop:10,lineHeight:1.7}}>公開中 {published.length}・下書き {drafts.length}</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <Link href="/mypage/report" style={{display:'inline-flex',alignItems:'center',gap:5,border:'1px solid var(--color-brand-border)',color:'var(--color-brand)',fontSize:12,fontWeight:600,padding:'7px 14px',borderRadius:16,textDecoration:'none'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            今月の振り返り
          </Link>
          <Link href="/mypage/analytics" style={{display:'inline-flex',alignItems:'center',gap:5,border:'1px solid var(--color-brand-border)',color:'var(--color-brand)',fontSize:12,fontWeight:600,padding:'7px 14px',borderRadius:16,textDecoration:'none'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            ダッシュボード
          </Link>
          <Link href="/post" style={{background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:12,fontWeight:700,padding:'7px 16px',borderRadius:16,textDecoration:'none'}}>＋ 新しく投稿する</Link>
        </div>
      </div>

      {/* フィルタ */}
      <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
        {([
          {v:'all',l:'すべて',c:myNovels.length},
          {v:'published',l:'公開中',c:published.length},
          {v:'serial',l:'連載中',c:myNovels.filter(n=>n.published&&(n as any).is_serial).length},
          {v:'completed',l:'完結',c:myNovels.filter(n=>n.published&&!(n as any).is_serial).length},
          {v:'short',l:'短編',c:myNovels.filter(n=>(n as any).novel_type==='短編').length},
          {v:'draft',l:'下書き',c:drafts.length},
        ] as const).map(({v,l,c})=>(
          <button key={v} onClick={()=>setWorksFilter(v as any)}
            style={{fontSize:12,fontWeight:worksFilter===v?700:500,padding:'6px 14px',borderRadius:16,cursor:'pointer',
              border:`1px solid ${worksFilter===v?'var(--color-brand)':'var(--color-brand-border)'}`,
              background:worksFilter===v?'var(--color-brand)':'var(--color-bg-card)',
              color:worksFilter===v?'var(--base-color-1)':'var(--color-text-muted)'}}>
            {l} {c}
          </button>
        ))}
      </div>
      {myNovels.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 0',color:'var(--color-text-muted)'}}>
          <div style={{fontSize:14,marginBottom:6}}>まだ投稿作品がありません</div>
          <Link href="/post" style={{background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,padding:'10px 24px',borderRadius:20,display:'inline-block',textDecoration:'none',marginTop:12}}>最初の作品を投稿する</Link>
        </div>
      ) : (
      <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden'}}>
      {myNovels.filter(n => {
        if (worksFilter==='all') return true
        if (worksFilter==='published') return n.published
        if (worksFilter==='serial') return n.published && (n as any).is_serial
        if (worksFilter==='completed') return n.published && !(n as any).is_serial
        if (worksFilter==='short') return (n as any).novel_type==='短編'
        if (worksFilter==='draft') return !n.published
        return true
      }).map((novel, i) => (
        <div key={novel.id} style={{borderTop:i>0?'1px solid var(--color-brand-light)':'none'}}>
          {/* 横長の作品行：作品情報 | 数値 | 操作 */}
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto 172px',gap:24,alignItems:'center',padding:'20px 24px'}}>
            {/* 左：作品情報 */}
            <div style={{minWidth:0,cursor:'pointer'}} onClick={()=>router.push(`/mypage/novel/${novel.id}`)}>
              <div style={{fontSize:17,fontWeight:700,color:'var(--color-text)',lineHeight:1.4,marginBottom:8,overflowWrap:'anywhere' as any}}>{novel.title}</div>
              <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:10,fontWeight:700,color:'var(--color-text-inverse)',background:novel.published?'var(--color-info)':'var(--color-text-faint)',padding:'2px 9px',borderRadius:4}}>{novel.published?'公開中':'下書き'}</span>
                <span style={{fontSize:10,fontWeight:700,color:(novel as any).is_serial?'var(--color-success)':'var(--color-text-muted)',background:(novel as any).is_serial?'#e8f5e9':'#f5f5f5',border:`1px solid ${(novel as any).is_serial?'#a5d6a7':'#e0e0e0'}`,padding:'2px 9px',borderRadius:4}}>{(novel as any).is_serial?'連載中':'完結'}</span>
                <span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',padding:'2px 9px',borderRadius:4}}>{novel.genre}</span>
                {(novel as any).novel_type && <span style={{fontSize:10,background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid var(--color-info-border)',padding:'2px 9px',borderRadius:4}}>{(novel as any).novel_type}</span>}
              </div>
              {(novel as any).summary && <div style={{fontSize:12.5,color:'var(--color-text-muted)',lineHeight:1.6,marginBottom:10,maxWidth:620,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,overflow:'hidden',overflowWrap:'anywhere' as any,wordBreak:'break-word'}}>{(novel as any).summary}</div>}
              <div style={{fontSize:12,color:'var(--color-text-faint)'}}>
                最終更新：{fmtDateTime((novel as any).updated_at)}
                {novel.published
                  ? `｜連載開始：${fmtDateShort((novel as any).created_at)}`
                  : `｜作成日：${fmtDateShort((novel as any).created_at)}`}
                <button onClick={(e)=>{e.stopPropagation();toggleWorkExpand(novel.id)}}
                  style={{marginLeft:10,fontSize:11,color:'var(--color-brand)',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>
                  話一覧 {expandedWork===novel.id?'▲':'▼'}
                </button>
              </div>
            </div>
            {/* 中央：数値（4項目・縦線区切り・アイコン付き） */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(64px, 1fr))'}}>
              {[
                {v:(charCountMap[novel.id]||0).toLocaleString(), l:'文字数', icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>},
                {v:novel.published?(novelViewMap[novel.id]||0).toLocaleString():'—', l:'閲覧数', icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>},
                {v:novel.published?(novelLikeMap[novel.id]||0):'—', l:'いいね', icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>},
                {v:novel.published?(novelCommentMap[novel.id]||0):'—', l:'コメント', icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>},
              ].map((s,idx)=>(
                <div key={s.l} style={{textAlign:'center',padding:'0 14px',borderLeft:idx>0?'1px solid var(--color-brand-light)':'none'}}>
                  <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)'}}>{s.v}</div>
                  <div style={{fontSize:11,color:'var(--color-text-muted)',marginTop:5,display:'inline-flex',alignItems:'center',gap:3}}><span style={{color:'var(--color-text-faint)'}}>{s.icon}</span>{s.l}</div>
                </div>
              ))}
            </div>
            {/* 右：操作ボタン（縦並び） */}
            <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'stretch'}}>
              <button onClick={()=>router.push(`/mypage/novel/${novel.id}`)}
                style={{fontSize:12,fontWeight:700,border:'none',padding:'9px 14px',borderRadius:8,color:'var(--color-text-inverse)',background:'var(--color-brand)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                作品を管理する
              </button>
              <Link href={`/novel/${novel.id}`}
                style={{fontSize:12,fontWeight:600,border:'1px solid var(--color-brand-border)',padding:'9px 14px',borderRadius:8,color:'var(--color-brand)',background:'var(--color-bg-card)',textDecoration:'none',textAlign:'center' as const}}>
                作品ページへ →
              </Link>
            </div>
          </div>

          {/* 話一覧（展開時） */}
          {expandedWork===novel.id && (
            <div style={{borderTop:'1px solid var(--color-brand-light)',background:'var(--color-bg)'}}>
              {loadingEps===novel.id ? (
                <div style={{padding:'20px',textAlign:'center',fontSize:12,color:'var(--color-text-muted)'}}>読み込み中...</div>
              ) : (workEpisodes[novel.id] || []).length === 0 ? (
                <div style={{padding:'20px',textAlign:'center',fontSize:12,color:'var(--color-text-faint)'}}>話がありません</div>
              ) : (
                <>
                  <div style={{display:'flex',padding:'8px 24px',borderBottom:'1px solid var(--color-brand-light)',fontSize:10,color:'var(--color-text-faint)',fontWeight:600}}>
                    <span style={{flex:1}}>エピソード</span>
                    <span style={{width:56,textAlign:'right'}}>文字数</span>
                    <span style={{width:40,textAlign:'right'}}>PV</span>
                    <span style={{width:36,textAlign:'right',display:'inline-flex',justifyContent:'flex-end',alignItems:'center'}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </span>
                    <span style={{width:36,textAlign:'right',display:'inline-flex',justifyContent:'flex-end',alignItems:'center'}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </span>
                  </div>
                  {(workEpisodes[novel.id] || []).map((ep: any) => (
                    <div key={ep.id} style={{display:'flex',alignItems:'center',padding:'10px 24px',borderBottom:'1px solid var(--color-brand-light)'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontSize:10,color:'var(--color-text-inverse)',background:ep.published===false?'var(--color-text-faint)':'var(--color-info)',padding:'1px 6px',borderRadius:3,flexShrink:0}}>{ep.published===false?'下書':'公開'}</span>
                          <span style={{fontSize:12,color:'var(--color-text-muted)',flexShrink:0}}>{ep.ep_number}話</span>
                          <span style={{fontSize:13,color:'var(--color-text)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ep.title}</span>
                        </div>
                      </div>
                      <span style={{width:56,textAlign:'right',fontSize:11,color:'var(--color-text-muted)'}}>{ep.charCount.toLocaleString()}</span>
                      <span style={{width:40,textAlign:'right',fontSize:12,fontWeight:700,color:'var(--color-text)'}}>{ep.pv}</span>
                      <span style={{width:36,textAlign:'right',fontSize:11,color:'var(--color-text-muted)'}}>{ep.likes}</span>
                      <span style={{width:36,textAlign:'right',fontSize:11,color:'var(--color-text-muted)'}}>{ep.comments}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      ))}
      </div>
      )}
    </div>
  )

  useEffect(() => {
    if (foldersLoaded) return
    supabase.from('bookmark_folders').select('id,name,order_num').eq('user_id', profile.user_id).order('order_num').then(({ data }) => {
      setFolders(data || [])
      setFoldersLoaded(true)
    })
  }, [foldersLoaded])

  async function handleCreateFolder() {
    if (!folderInput.trim()) return
    setFolderSaving(true)
    const { data } = await supabase.from('bookmark_folders').insert({ user_id: profile.user_id, name: folderInput.trim(), order_num: folders.length }).select().single()
    if (data) setFolders(prev => [...prev, data])
    setFolderInput('')
    setShowFolderModal(false)
    setFolderSaving(false)
  }

  async function handleDeleteFolder(folderId: string) {
    if (!confirm('リストを削除しますか？（中の作品は「未分類」に移動します）')) return
    await supabase.from('bookmark_folders').delete().eq('id', folderId)
    setFolders(prev => prev.filter(f => f.id !== folderId))
    if (activeFolderId === folderId) setActiveFolderId(null)
  }

  async function handleMoveBookmark(novelId: string, folderId: string | null) {
    await supabase.from('bookmarks').update({ folder_id: folderId }).eq('novel_id', novelId).eq('user_id', profile.user_id)
    setMyBookmarks(prev => prev.map((bm:any) => bm.novel_id === novelId ? {...bm, folder_id: folderId} : bm))
    setMovingBookmark(null)
  }

  // ===== 保存済みタブ =====
  const [selectedFolder, setSelectedFolder] = useState<string>('all')

  const BookmarksTab = () => {
    const listed = selectedFolder === 'all'
      ? myBookmarks
      : selectedFolder === 'unclassified'
        ? myBookmarks.filter((bm:any) => !bm.folder_id)
        : myBookmarks.filter((bm:any) => bm.folder_id === selectedFolder)
    const currentName = selectedFolder === 'all' ? 'すべての保存済み'
      : selectedFolder === 'unclassified' ? '未分類'
      : (folders.find((f:any)=>f.id===selectedFolder)?.name || 'リスト')

    return (
    <div>
      {/* 見出し */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:32,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',letterSpacing:'-0.01em',lineHeight:1.3}}>
            保存済み作品 <span style={{fontSize:15,fontWeight:600,color:'var(--color-text-muted)'}}>（{myBookmarks.length}）</span>
          </h1>
          <p style={{fontSize:14,color:'var(--color-text-muted)',marginTop:10,lineHeight:1.7}}>気になる作品をリストに保存して、あとでゆっくり読むことができます。</p>
        </div>
        <button onClick={()=>setShowFolderModal(true)}
          style={{height:44,display:'inline-flex',alignItems:'center',gap:6,padding:'0 20px',border:'1px solid var(--color-brand)',borderRadius:10,
            background:'var(--color-bg-card)',color:'var(--color-brand)',cursor:'pointer',fontWeight:600,fontSize:14}}>
          ＋ リスト作成
        </button>
      </div>

      <div style={{display:'flex',gap:24,alignItems:'flex-start',flexWrap:'wrap'}}>
        {/* 左：リストパネル */}
        <div style={{flex:'0 1 260px',minWidth:220,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'20px 8px',boxShadow:'0 1px 3px rgba(0,0,0,0.02)'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',padding:'0 14px',marginBottom:12}}>リスト</div>
          {[
            {id:'all', name:'すべての保存済み', count:myBookmarks.length, deletable:false},
            ...folders.map((f:any)=>({id:f.id, name:f.name, count:myBookmarks.filter((bm:any)=>bm.folder_id===f.id).length, deletable:true})),
            {id:'unclassified', name:'未分類', count:myBookmarks.filter((bm:any)=>!bm.folder_id).length, deletable:false},
          ].map(item => (
            <div key={item.id}
              onClick={()=>setSelectedFolder(item.id)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'11px 14px',cursor:'pointer',borderRadius:8,
                background:selectedFolder===item.id?'#eef2f5':'transparent',
                color:selectedFolder===item.id?'var(--color-brand)':'var(--color-text)',
                fontWeight:selectedFolder===item.id?700:500}}>
              <span style={{fontSize:13.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</span>
              <span style={{fontSize:12,color:selectedFolder===item.id?'var(--color-brand)':'var(--color-text-faint)',flexShrink:0}}>{item.count}</span>
            </div>
          ))}
          <div style={{borderTop:'1px solid #f4f5f3',marginTop:12,paddingTop:12}}>
            <button onClick={()=>setShowFolderModal(true)}
              style={{width:'100%',textAlign:'left' as const,padding:'8px 14px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--color-brand)',fontWeight:600}}>
              ＋ リストを作成
            </button>
            {selectedFolder!=='all' && selectedFolder!=='unclassified' && (
              <button onClick={()=>{ handleDeleteFolder(selectedFolder); setSelectedFolder('all') }}
                style={{width:'100%',textAlign:'left' as const,padding:'8px 14px',background:'none',border:'none',cursor:'pointer',fontSize:12.5,color:'var(--color-text-faint)'}}>
                このリストを削除
              </button>
            )}
          </div>
        </div>

        {/* 右：作品一覧 */}
        <div style={{flex:'1 1 520px',minWidth:300}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
            <span style={{fontSize:16,fontWeight:700,color:'var(--color-text)'}}>{currentName}</span>
            <span style={{fontSize:13,color:'var(--color-text-muted)'}}>（{listed.length}）</span>
          </div>

          {listed.length === 0 ? (
            <div style={{textAlign:'center',padding:'64px 24px',color:'var(--color-text-faint)',fontSize:14,
              background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:20}}>
              このリストに作品がありません
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {listed.map((bm:any) => {
                const n = bm.novels; if (!n) return null
                const authorName = bmAuthorMap[n.author_id] || ''
                return (
                  <div key={bm.novel_id}
                    style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:20,padding:'24px 28px',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.02)',display:'grid',gridTemplateColumns:'minmax(0,1fr) 180px',gap:28,alignItems:'center'}}>
                    <div style={{minWidth:0,cursor:'pointer'}} onClick={()=>router.push(`/novel/${n.id}`)}>
                      <div style={{fontSize:19,fontWeight:700,color:'var(--color-text)',lineHeight:1.4,marginBottom:6,overflowWrap:'anywhere' as any}}>{n.title}</div>
                      <div style={{fontSize:13,color:'var(--color-text-muted)',marginBottom:12}}>{authorName}</div>
                      {n.summary && (
                        <p style={{fontSize:13.5,color:'var(--color-text-muted)',lineHeight:1.8,marginBottom:14,maxWidth:600,
                          display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,overflow:'hidden',overflowWrap:'anywhere' as any}}>{n.summary}</p>
                      )}
                      <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
                        <span style={{fontSize:11.5,height:22,display:'inline-flex',alignItems:'center',background:'#eef2f5',color:'var(--color-brand)',padding:'0 10px',borderRadius:6,fontWeight:600}}>{n.genre}</span>
                        {n.novel_type && <span style={{fontSize:11.5,height:22,display:'inline-flex',alignItems:'center',background:'#EEF4FF',color:'#2563eb',padding:'0 10px',borderRadius:6,fontWeight:600}}>{n.novel_type}</span>}
                        {n.is_serial
                          ? <span style={{fontSize:11.5,height:22,display:'inline-flex',alignItems:'center',background:'#EAF8EF',color:'#35a45d',padding:'0 10px',borderRadius:6,fontWeight:600}}>連載中</span>
                          : <span style={{fontSize:11.5,height:22,display:'inline-flex',alignItems:'center',background:'#F4F4F5',color:'#71717a',padding:'0 10px',borderRadius:6,fontWeight:600}}>完結</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'stretch'}}>
                      <Link href={`/novel/${n.id}`}
                        style={{height:44,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'var(--color-brand)',color:'var(--color-text-inverse)',
                          borderRadius:10,fontSize:14,fontWeight:600,textDecoration:'none'}}>
                        続きを読む
                      </Link>
                      <select
                        value={bm.folder_id||''}
                        onChange={e=>handleMoveBookmark(bm.novel_id,e.target.value||null)}
                        style={{height:40,padding:'0 12px',border:'1px solid #dcdfda',borderRadius:10,background:'var(--color-bg-card)',color:'var(--color-text-muted)',cursor:'pointer',fontSize:12.5}}>
                        <option value=''>未分類</option>
                        {folders.map((f:any)=>(<option key={f.id} value={f.id}>{f.name}</option>))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showFolderModal && (
        <FolderCreateModal
          onClose={()=>setShowFolderModal(false)}
          onCreate={async(name:string)=>{
            setFolderSaving(true)
            const { data } = await supabase.from('bookmark_folders').insert({ user_id: profile.user_id, name, order_num: folders.length }).select().single()
            if (data) setFolders((prev:any[]) => [...prev, data])
            setShowFolderModal(false)
            setFolderSaving(false)
          }}
          saving={folderSaving}
        />
      )}
    </div>
    )
  }

  // ===== 閲覧履歴タブ =====
  const HistoryTab = () => {
    const bookmarkedIds = new Set(myBookmarks.map((b:any)=>b.novels?.id).filter(Boolean))
    return (
    <div>
      {/* ページ見出し：大きく、説明との間に呼吸を */}
      <div style={{marginBottom:32}}>
        <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',letterSpacing:'-0.01em',lineHeight:1.3}}>
          閲覧履歴 <span style={{fontSize:15,fontWeight:600,color:'var(--color-text-muted)'}}>（{historyItems.length}件）</span>
        </h1>
        <p style={{fontSize:14,color:'var(--color-text-muted)',marginTop:10,lineHeight:1.7}}>過去に閲覧した作品の履歴です。続きから読むことができます。</p>
      </div>

      {/* フィルターバー */}
      {historyItems.length > 0 && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',
          background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:14,padding:'14px 18px',marginBottom:24}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <select value={histSort} onChange={e=>setHistSort(e.target.value as any)}
              style={{height:42,padding:'0 34px 0 14px',border:'1px solid #dcdfda',borderRadius:10,fontSize:13.5,color:'var(--color-text)',background:'var(--color-bg-card)',cursor:'pointer',appearance:'none' as any,
                backgroundImage:"url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
                backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',backgroundSize:'14px'}}>
              <option value="recent">最近読んだ順</option>
              <option value="title">タイトル順</option>
            </select>
            <select value={histGenre} onChange={e=>setHistGenre(e.target.value)}
              style={{height:42,padding:'0 34px 0 14px',border:'1px solid #dcdfda',borderRadius:10,fontSize:13.5,color:'var(--color-text)',background:'var(--color-bg-card)',cursor:'pointer',appearance:'none' as any,
                backgroundImage:"url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
                backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',backgroundSize:'14px'}}>
              {['すべてのジャンル', ...Array.from(new Set(historyItems.map((h:any)=>h.genre).filter(Boolean)))].map((g:any)=>(
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select value={histType} onChange={e=>setHistType(e.target.value)}
              style={{height:42,padding:'0 34px 0 14px',border:'1px solid #dcdfda',borderRadius:10,fontSize:13.5,color:'var(--color-text)',background:'var(--color-bg-card)',cursor:'pointer',appearance:'none' as any,
                backgroundImage:"url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
                backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',backgroundSize:'14px'}}>
              {['すべての形式','長編','短編'].map(t=>(<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <button onClick={async()=>{
              if(!confirm('閲覧履歴をすべて削除しますか？')) return
              await supabase.from('page_views').delete().eq('user_id', profile.user_id)
              window.location.reload()
            }}
            style={{height:42,display:'inline-flex',alignItems:'center',padding:'0 16px',border:'1px solid #dcdfda',borderRadius:10,
              fontSize:13.5,color:'var(--color-text-muted)',background:'var(--color-bg-card)',cursor:'pointer'}}>
            履歴をクリア
          </button>
        </div>
      )}

      {historyItems.length === 0 ? (
        <div style={{textAlign:'center',padding:'72px 24px',color:'var(--color-text-faint)',fontSize:14,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:20}}>
          まだ閲覧履歴がありません
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {historyItems
          .filter((h:any)=> histGenre==='すべてのジャンル' || h.genre===histGenre)
          .filter((h:any)=> histType==='すべての形式' || h.novelType===histType)
          .sort((a:any,b:any)=> histSort==='title' ? String(a.novelTitle).localeCompare(String(b.novelTitle),'ja') : 0)
          .map((item:any) => {
          const totalEps = novelEpCountMap[item.novelId] || 0
          return (
          <div key={item.novelId}
            style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'18px 22px',
              boxShadow:'0 1px 3px rgba(0,0,0,0.03)',display:'grid',gridTemplateColumns:'minmax(0,1fr) 200px',gap:24,alignItems:'center'}}>

            {/* 左：作品情報（サイズと色で階層をつける） */}
            <div style={{minWidth:0}}>
              <a href={`/novel/${item.novelId}`} className="history-title" style={{textDecoration:'none',display:'block'}}>
                <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',lineHeight:1.4,marginBottom:4,overflowWrap:'anywhere' as any}}>{item.novelTitle}</div>
              </a>
              <div style={{fontSize:12,color:'var(--color-text-muted)',marginBottom:8}}>作者：{item.displayName}</div>
              {item.summary && (
                <p style={{fontSize:12.5,color:'var(--color-text-muted)',lineHeight:1.7,marginBottom:10,maxWidth:640,
                  display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,overflow:'hidden',overflowWrap:'anywhere' as any}}>{item.summary}</p>
              )}
              <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',background:'#eef2f5',color:'var(--color-brand)',padding:'0 10px',borderRadius:6,fontWeight:600}}>{item.genre}</span>
                {item.novelType && <span style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',background:'#EEF4FF',color:'#2563eb',padding:'0 10px',borderRadius:6,fontWeight:600}}>{item.novelType}</span>}
                {item.isSerial
                  ? <span style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',background:'#EAF8EF',color:'#35a45d',padding:'0 10px',borderRadius:6,fontWeight:600}}>連載中</span>
                  : <span style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',background:'#F4F4F5',color:'#71717a',padding:'0 10px',borderRadius:6,fontWeight:600}}>完結</span>}
                {item.tags.slice(0,3).map((t:string) => (
                  <span key={t} style={{fontSize:11.5,lineHeight:'22px',height:22,display:'inline-flex',alignItems:'center',color:'var(--color-text-faint)',padding:'0 8px',borderRadius:6}}>#{t}</span>
                ))}
              </div>
            </div>

            {/* 右：数値・ボタン（アイコン付き・ボタンは大きく） */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
              <div style={{textAlign:'right'}}>
                {charCountMap[item.novelId]>0 && (
                  <div style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:13.5,fontWeight:600,color:'var(--color-text)',marginBottom:4}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    {fmtChars(charCountMap[item.novelId])}
                  </div>
                )}
                <div style={{fontSize:12,color:'var(--color-text-faint)'}}>最終閲覧：{fmtDate(item.viewedAt)}</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {firstEpMap[item.novelId] && firstEpMap[item.novelId]!==item.epId && (
                  <Link href={`/novel/${item.novelId}/episode/${firstEpMap[item.novelId]}`}
                    style={{height:36,display:'inline-flex',alignItems:'center',padding:'0 12px',background:'var(--color-bg-card)',color:'var(--color-text-muted)',
                      border:'1px solid #dcdfda',borderRadius:8,fontSize:12.5,fontWeight:600,textDecoration:'none',whiteSpace:'nowrap'}}>
                    最初から
                  </Link>
                )}
                <Link href={`/novel/${item.novelId}/episode/${item.epId}`}
                  style={{height:36,display:'inline-flex',alignItems:'center',padding:'0 16px',background:'var(--color-brand)',color:'var(--color-text-inverse)',
                    borderRadius:8,fontSize:13,fontWeight:600,textDecoration:'none',whiteSpace:'nowrap'}}>
                  続きを読む
                </Link>
                {/* しおり（保存） */}
                <Link href={`/novel/${item.novelId}`}
                  title={bookmarkedIds.has(item.novelId)?'保存済み':'作品ページで保存する'}
                  style={{width:36,height:36,display:'inline-flex',alignItems:'center',justifyContent:'center',
                    border:'1px solid #dcdfda',borderRadius:8,background:'var(--color-bg-card)',cursor:'pointer',flexShrink:0}}>
                  <svg width="17" height="17" viewBox="0 0 24 24"
                    fill={bookmarkedIds.has(item.novelId)?'var(--color-brand)':'none'}
                    stroke={bookmarkedIds.has(item.novelId)?'var(--color-brand)':'var(--color-text-faint)'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                </Link>
              </div>
              {totalEps > 0 && (
                <div style={{fontSize:11.5,color:'var(--color-text-faint)'}}>全{totalEps}話</div>
              )}
            </div>
          </div>
          )
        })}
        </div>
      )}
    </div>
    )
  }

  // ===== つぶやきタブ =====
  const TweetTab = () => (
    <div>
      <div style={{marginBottom:32}}>
        <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',letterSpacing:'-0.01em',lineHeight:1.3}}>つぶやき</h1>
        <p style={{fontSize:14,color:'var(--color-text-muted)',marginTop:10,lineHeight:1.7}}>近況や作品の進捗を、気軽に共有しましょう。</p>
      </div>
      <div style={{display:'flex',gap:24,alignItems:'flex-start',flexWrap:'wrap'}}>
        {/* 左：つぶやき本体 */}
        <div style={{flex:'1 1 480px',minWidth:300}}>
          <TweetSection authorId={profile.user_id ?? ''} currentUserId={profile.user_id ?? ''} currentUserName={profile.display_name} currentUserIconUrl={profile.icon_url ?? null} isOwner={true}/>
        </div>
        {/* 右：サイドパネル */}
        <div style={{flex:'0 1 300px',minWidth:260,display:'flex',flexDirection:'column',gap:16}}>
          {/* よく絡む作者 */}
          {followingAuthors.length > 0 ? (
            <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'20px 22px',boxShadow:'0 1px 3px rgba(0,0,0,0.02)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <span style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>よく絡む作者</span>
                <a href={`/author/${profile.user_id}/following`} style={{fontSize:11.5,color:'var(--color-brand)',textDecoration:'none',fontWeight:600}}>すべて見る →</a>
              </div>
              {followingAuthors.slice(0,5).map((a:any)=>(
                <a key={a.user_id} href={`/author/${a.user_id}`} style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,textDecoration:'none'}}>
                  {a.icon_url
                    ? <img src={a.icon_url} style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0}} alt=""/>
                    : <div style={{width:36,height:36,borderRadius:'50%',background:'var(--color-brand-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'var(--color-brand)',fontWeight:700,flexShrink:0}}>{a.display_name?.[0]}</div>}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.display_name}</div>
                    <div style={{fontSize:11,color:'var(--color-brand)'}}>フォロー中</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'20px 22px',boxShadow:'0 1px 3px rgba(0,0,0,0.02)'}}>
              <div style={{fontSize:14,fontWeight:700,color:'var(--color-text)',marginBottom:8}}>よく絡む作者</div>
              <p style={{fontSize:12.5,color:'var(--color-text-muted)',lineHeight:1.8,marginBottom:14}}>
                作者をフォローすると、ここに表示されます。気になる作品の作者を見つけてみましょう。
              </p>
              <Link href="/search" style={{fontSize:13,color:'var(--color-brand)',textDecoration:'none',fontWeight:600}}>作品を探す →</Link>
            </div>
          )}
          {/* つぶやきのヒント */}
          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:16,padding:'20px 22px',boxShadow:'0 1px 3px rgba(0,0,0,0.02)'}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--color-text)',marginBottom:16}}>つぶやきのヒント</div>
            {[
              {t:'進捗を共有しよう',d:'書き終えた章や、これからの展開を気軽につぶやいてみましょう。'},
              {t:'他の作者と交流しよう',d:'感想や応援の言葉で、創作の輪を広げてみましょう。'},
              {t:'ハッシュタグを使おう',d:'#執筆ログ や #創作メモ などで見つけてもらいやすくなります。'},
            ].map((h,i,arr)=>(
              <div key={h.t} style={{marginBottom:i<arr.length-1?18:0}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:5}}>{h.t}</div>
                <div style={{fontSize:12,color:'var(--color-text-muted)',lineHeight:1.8}}>{h.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // ===== ミッションタブ =====
  const MissionTab = () => (
    <div>
      <MissionClient user={true} stats={missionStats} initialClaimedIds={claimedMissionIds} isWriter={isWriterRole}/>
    </div>
  )

  // ===== コンテストタブ =====

  // ===== ブロック・ミュートタブ =====
  const BlockMuteTab = () => {
    useEffect(() => {
      if (blockMuteLoaded) return
      Promise.all([
        supabase.from('user_blocks').select('blocked_id, profiles!user_blocks_blocked_id_fkey(display_name, icon_url)').eq('blocker_id', profile.user_id),
        supabase.from('user_mutes').select('muted_id, profiles!user_mutes_muted_id_fkey(display_name, icon_url)').eq('muter_id', profile.user_id),
      ]).then(([blocks, mutes]) => {
        setBlockList((blocks.data||[]).map((b:any) => ({ id: b.blocked_id, ...b.profiles })))
        setMuteList((mutes.data||[]).map((m:any) => ({ id: m.muted_id, ...m.profiles })))
        setBlockMuteLoaded(true)
      })
    }, [])

    async function handleUnblock(targetId: string) {
      await supabase.from('user_blocks').delete().eq('blocker_id', profile.user_id).eq('blocked_id', targetId)
      setBlockList(prev => prev.filter(u => u.id !== targetId))
    }
    async function handleUnmute(targetId: string) {
      await supabase.from('user_mutes').delete().eq('muter_id', profile.user_id).eq('muted_id', targetId)
      setMuteList(prev => prev.filter(u => u.id !== targetId))
    }

    const UserRow = ({ u, onRemove, label }: { u:any; onRemove:()=>void; label:string }) => (
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--color-brand-border)'}}>
        {u.icon_url
          ? <img src={u.icon_url} style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0}} alt=""/>
          : <div style={{width:36,height:36,borderRadius:'50%',background:'var(--color-brand-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'var(--color-brand)',fontWeight:700,flexShrink:0}}>{u.display_name?.[0]||'?'}</div>
        }
        <a href={`/author/${u.id}`} style={{flex:1,fontSize:13,color:'var(--color-text)',textDecoration:'none',fontWeight:600}}>{u.display_name}</a>
        <button onClick={onRemove}
          style={{fontSize:12,padding:'4px 12px',border:'1px solid var(--color-danger)',borderRadius:8,background:'none',color:'var(--color-danger)',cursor:'pointer'}}>
          {label}解除
        </button>
      </div>
    )

    return (
      <div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:6}}>ブロック・ミュート管理</div>
          <div style={{fontSize:12,color:'var(--color-text-muted)',lineHeight:1.7,padding:'10px 12px',background:'var(--color-bg)',borderRadius:8,border:'1px solid var(--color-brand-border)'}}>
            <div style={{marginBottom:4}}>🚫 <strong>ブロック</strong>：相手はあなたの作品にコメントできなくなります。</div>
            <div>🔇 <strong>ミュート</strong>：相手のコメントがあなたには表示されなくなります。相手には通知されません。</div>
          </div>
        </div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:8}}>ブロック中（{blockList.length}人）</div>
          <div style={{fontSize:11,color:'var(--color-text-muted)',marginBottom:10}}>ブロックしたユーザーはあなたの作品にコメントできません。</div>
          {blockList.length === 0
            ? <div style={{fontSize:12,color:'var(--color-text-faint)'}}>ブロック中のユーザーはいません</div>
            : blockList.map(u => <UserRow key={u.id} u={u} onRemove={()=>handleUnblock(u.id)} label="ブロック"/>)
          }
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:8}}>ミュート中（{muteList.length}人）</div>
          <div style={{fontSize:11,color:'var(--color-text-muted)',marginBottom:10}}>ミュートしたユーザーのコメントはあなたには表示されません。</div>
          {muteList.length === 0
            ? <div style={{fontSize:12,color:'var(--color-text-faint)'}}>ミュート中のユーザーはいません</div>
            : muteList.map(u => <UserRow key={u.id} u={u} onRemove={()=>handleUnmute(u.id)} label="ミュート"/>)
          }
        </div>
      </div>
    )
  }

  // ===== 設定タブ =====
  const SettingsTab = () => {
    const secCard: React.CSSProperties = { background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'18px 20px',marginBottom:16 }
    const secTitle: React.CSSProperties = { fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:14 }
    const rowBase: React.CSSProperties = { display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'12px 0' }
    const Toggle = ({on,onClick,disabled}:{on:boolean;onClick:()=>void;disabled?:boolean}) => (
      <button onClick={onClick} disabled={disabled}
        style={{width:44,height:24,borderRadius:12,border:'none',cursor:disabled?'default':'pointer',background:on?'var(--color-brand)':'#d1d5db',position:'relative',transition:'background .2s',flexShrink:0,opacity:disabled?0.6:1}}>
        <div style={{position:'absolute',top:3,left:on?23:3,width:18,height:18,borderRadius:'50%',background:'var(--color-bg-card)',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
      </button>
    )
    const Arrow = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>

    return (
    <div>
      <div style={{marginBottom:32}}>
        <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',letterSpacing:'-0.01em',lineHeight:1.3}}>設定</h1>
        <p style={{fontSize:14,color:'var(--color-text-muted)',marginTop:10,lineHeight:1.7}}>アカウントや通知、表示などの各種設定を行います。</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',gap:16,alignItems:'start'}}>
        {/* ===== 左カラム ===== */}
        <div>
          {/* 表示設定：読書/執筆セグメント */}
          <div style={secCard}>
            <div style={secTitle}>表示設定</div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--color-text)',marginBottom:4}}>ホーム初期表示</div>
            <div style={{fontSize:11.5,color:'var(--color-text-muted)',marginBottom:10}}>マイページを開いたときに表示する内容を選べます。</div>

            {/*
              読書向けはまだ用意していない。
              押せるようにしておくと、選んでも何も変わらず
              壊れていると受け取られる。
              いまは執筆向けだけを出し、もう一方は控えとして薄く見せる。
            */}
            <div style={{display:'inline-flex',border:'1px solid var(--color-brand-border)',borderRadius:8,overflow:'hidden'}}>
              <button
                style={{padding:'8px 22px',fontSize:13,fontWeight:700,border:'none',cursor:'default',
                  background:'var(--color-brand)',color:'var(--base-color-1)'}}>
                執筆向け
              </button>
              <span
                title="読書向けの画面は準備中です"
                style={{padding:'8px 22px',fontSize:13,fontWeight:500,
                  background:'var(--color-bg-card)',color:'var(--color-text-faint)'}}>
                読書向け（準備中）
              </span>
            </div>
          </div>

          {/* プロフィール設定 */}
          <div style={secCard}>
            <div style={secTitle}>プロフィール設定</div>
            {[
              {label:'アイコンを変更', sub:'', onClick:()=>iconInputRef.current?.click()},
              {label:'自己紹介を編集', sub:profile.bio?profile.bio.slice(0,24)+'…':'未設定', onClick:()=>setShowBioModal(true)},
              {label:'性別', sub:gender||'未設定', onClick:()=>setShowGenderModal(true)},
              {label:'Xアカウント', sub:xAccount?`@${xAccount}`:'未連携', onClick:()=>setShowXModal(true)},
              {label:'生年月日を設定', sub:profile.birthdate||(profile as any).birthdate||'未設定', onClick:()=>setShowBdModal(true)},
              {label:'ストーリーボード', sub:'アイデアや構想を管理', onClick:()=>setShowBoard(true)},
              {label:'バッジ図鑑', sub:`${claimedSet.size}/${ALL_BADGES.filter(b=>!b.id.startsWith('_')).length}獲得済み`, onClick:()=>{setShowBadgeBook(true);setBadgePage(0)}},
            ].map((item,i,arr) => (
              <button key={item.label} onClick={item.onClick}
                style={{...rowBase,width:'100%',background:'none',border:'none',borderBottom:i<arr.length-1?'1px solid var(--color-border-light, #eceef0)':'none',cursor:'pointer',textAlign:'left' as const}}>
                <div>
                  <div style={{fontSize:13,color:'var(--color-text)',fontWeight:500}}>{item.label}</div>
                  {item.sub && <div style={{fontSize:11,color:'var(--color-text-faint)',marginTop:2}}>{item.sub}</div>}
                </div>
                <Arrow/>
              </button>
            ))}
          </div>

          {/* アカウント設定 */}
          <div style={secCard}>
            <div style={secTitle}>アカウント設定</div>
            {(profile.login_provider!=='google' ? [
              {label:'メールアドレスを変更', sub:profile.email||'', onClick:()=>setShowEmailModal(true)},
              {label:'パスワードを変更', sub:'', onClick:()=>setShowPwModal(true)},
            ] : []).map((item,i)=>(
              <button key={item.label} onClick={item.onClick}
                style={{...rowBase,width:'100%',background:'none',border:'none',borderBottom:'1px solid var(--color-border-light, #eceef0)',cursor:'pointer',textAlign:'left' as const}}>
                <div>
                  <div style={{fontSize:13,color:'var(--color-text)',fontWeight:500}}>{item.label}</div>
                  {item.sub && <div style={{fontSize:11,color:'var(--color-text-faint)',marginTop:2}}>{item.sub}</div>}
                </div>
                <Arrow/>
              </button>
            ))}
            <button onClick={handleSignOut} disabled={loading}
              style={{...rowBase,width:'100%',background:'none',border:'none',borderBottom:'1px solid var(--color-border-light, #eceef0)',cursor:'pointer',fontSize:13,color:'var(--color-text)',textAlign:'left' as const}}>
              <span>{loading?'...':'ログアウト'}</span>
            </button>
            <div style={{marginTop:8,paddingTop:12,borderTop:'1px solid var(--color-brand-border)'}}>
              <button onClick={()=>setShowWithdraw(true)}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--color-danger)',padding:'4px 0',textAlign:'left' as const}}>
                退会する
              </button>
              <div style={{fontSize:11,color:'var(--color-text-faint)',marginTop:2}}>アカウントとすべてのデータを削除し、原石航路を退会します。</div>
            </div>
          </div>
        </div>

        {/* ===== 右カラム ===== */}
        <div>
          {/* 通知設定 */}
          <div style={secCard}>
            <div style={secTitle}>通知設定</div>
            {[
              {label:'いいねされたとき',           desc:'あなたの作品やコメントがいいねされたときに通知します。', key:'notify_like',        val:notifyLike,       set:setNotifyLike},
              {label:'コメントされたとき',          desc:'あなたの作品にコメントが投稿されたときに通知します。',   key:'notify_comment',     val:notifyComment,    set:setNotifyComment},
              {label:'フォローされたとき',          desc:'あなたをフォローしたユーザーがいるときに通知します。',   key:'notify_follow',      val:notifyFollow,     set:setNotifyFollow},
              {label:'フォロー中の作者が話を更新',   desc:'フォロー中の作者が作品を更新したときに通知します。',     key:'notify_new_episode', val:notifyNewEpisode, set:setNotifyNewEpisode},
              {label:'フォロー中の作者が新作を公開', desc:'フォロー中の作者が新しい作品を公開したときに通知します。', key:'notify_new_work',    val:notifyNewWork,    set:setNotifyNewWork},
            ].map((item, i, arr) => (
              <div key={item.key} style={{...rowBase,borderBottom:i<arr.length-1?'1px solid var(--color-border-light, #eceef0)':'none'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:'var(--color-text)',fontWeight:500}}>{item.label}</div>
                  <div style={{fontSize:11,color:'var(--color-text-faint)',marginTop:2}}>{item.desc}</div>
                </div>
                <Toggle on={item.val} disabled={notifySaving} onClick={async()=>{ const next=!item.val; item.set(next); await handleSaveNotify(item.key, next) }}/>
              </div>
            ))}
          </div>

          {/* コメント設定 */}
          <div style={secCard}>
            <div style={secTitle}>コメント設定</div>
            <div style={rowBase}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:'var(--color-text)',fontWeight:500}}>エピソードへのコメントを許可</div>
                <div style={{fontSize:11,color:'var(--color-text-faint)',marginTop:2}}>あなたの作品のエピソードにコメントを投稿できるようにします。</div>
              </div>
              <Toggle on={allowComments} onClick={handleToggleAllowComments}/>
            </div>
          </div>

          {/* ブロック・ミュート管理 */}
          <div style={secCard}>
            <div style={secTitle}>ブロック・ミュート管理</div>
            <BlockMuteTab/>
          </div>
        </div>
      </div>
    </div>
    )
  }

  const tabContent: Record<Tab, React.ReactNode> = {
    mypage:'', works:'', bookmarks:'', history:'', tweet:'', mission:'', settings:'', series:'',
  }

  return (
    <div style={{minHeight:'100vh',fontFamily:"'Noto Sans JP',sans-serif"}}>
      <Header />

      <div style={{width:'100%',padding:'0'}}>
        {isMobile ? (
          <>
            <div style={{background:'var(--color-bg-card)',borderBottom:'1px solid var(--color-brand-border)',overflowX:'auto',scrollbarWidth:'none' as any,position:'sticky',top:54,zIndex:10}}>
              <div style={{display:'flex',minWidth:'max-content'}}>
                {visibleTabs.map(tab => (
                  <button key={tab.id} onClick={()=>handleTabChange(tab.id as Tab)}
                    style={{padding:'10px 14px',fontSize:12,fontWeight:activeTab===tab.id?700:400,color:activeTab===tab.id?'var(--color-brand)':'var(--color-text-muted)',background:'none',border:'none',cursor:'pointer',borderBottom:activeTab===tab.id?'2px solid var(--color-brand)':'2px solid transparent',whiteSpace:'nowrap' as const}}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{padding:'16px 16px 80px'}}>
              {activeTab==='mypage' && <MypageTab/>}
              {activeTab==='works' && <WorksTab/>}
              {activeTab==='bookmarks' && <BookmarksTab/>}
              {activeTab==='history' && <HistoryTab/>}
              {activeTab==='tweet' && <TweetTab/>}
              {activeTab==='mission' && <MissionTab/>}
              {activeTab==='settings' && <SettingsTab/>}
              {activeTab==='series' && (
                <div>
                  <div style={{marginBottom:32}}>
                    <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',letterSpacing:'-0.01em',lineHeight:1.3}}>シリーズ</h1>
                    <p style={{fontSize:14,color:'var(--color-text-muted)',marginTop:10,lineHeight:1.7}}>関連する作品をまとめて、読者にわかりやすく紹介できます。</p>
                  </div>
                  <SeriesManager userId={profile.user_id ?? ""} myNovels={myNovels||[]} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{display:'flex',minHeight:'calc(100vh - 60px)'}}>
            {/* 左サイドナビ */}
            <div style={{width:232,flexShrink:0,borderRight:'1px solid var(--color-brand-border)',padding:'24px 12px',position:'sticky',top:60,height:'calc(100vh - 60px)',background:'var(--color-bg-card)',overflowY:'auto'}}>
              {visibleTabs.map(tab => {
                const on = activeTab===tab.id
                return (
                  <button key={tab.id} onClick={()=>handleTabChange(tab.id as Tab)}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'11px 14px',textAlign:'left' as const,
                      fontSize:14,fontWeight:on?700:500,
                      color:on?'var(--color-brand)':'#555',
                      background:on?'#eef2f5':'transparent',
                      border:'none',borderRadius:8,cursor:'pointer',marginBottom:2,transition:'all .12s',position:'relative'}}>
                    {on && <span style={{position:'absolute',left:0,top:8,bottom:8,width:3,borderRadius:2,background:'var(--color-brand)'}}/>}
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                      {TAB_ICONS[tab.id]}
                    </svg>
                    {tab.label}
                  </button>
                )
              })}

              {/* コンテスト開催中バナー */}
              <div style={{marginTop:28,background:'#eef5f9',border:'1px solid #cfe0ea',borderRadius:14,padding:'18px 16px',position:'relative',overflow:'hidden'}}>
                <div style={{fontSize:13.5,fontWeight:700,color:'var(--color-brand)',marginBottom:8}}>コンテスト開催中！</div>
                <div style={{fontSize:12,color:'var(--color-text-muted)',lineHeight:1.7,marginBottom:14}}>テーマに沿った作品を<br/>投稿してみませんか？</div>
                <Link href="/contests"
                  style={{display:'inline-block',padding:'8px 14px',border:'1px solid var(--color-brand)',borderRadius:8,
                    background:'var(--color-bg-card)',color:'var(--color-brand)',fontSize:12.5,fontWeight:600,textDecoration:'none'}}>
                  コンテスト一覧へ
                </Link>
                {/* 羽ペンの装飾 */}
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{position:'absolute',right:-4,bottom:-6,opacity:0.5}}>
                  <path d="M40 14c-8 2-16 9-19 17-2 5-3 10-2 15l-4 4a1.5 1.5 0 0 0 2 2l4-4c5 1 10 0 15-2 8-3 15-11 17-19 1-4 2-9 2-12 0-1-1-2-2-2-3 0-8 1-13 1z"
                    fill="#dce9f1" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            {/* 右コンテンツ */}
            <div style={{flex:1,minWidth:0,padding:'32px 48px',background:'var(--color-bg-card)'}}>
              {activeTab==='mypage' && <MypageTab/>}
              {activeTab==='works' && <WorksTab/>}
              {activeTab==='bookmarks' && <BookmarksTab/>}
              {activeTab==='history' && <HistoryTab/>}
              {activeTab==='tweet' && <TweetTab/>}
              {activeTab==='mission' && <MissionTab/>}
              {activeTab==='settings' && <SettingsTab/>}
              {activeTab==='series' && (
                <div>
                  <div style={{marginBottom:32}}>
                    <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',letterSpacing:'-0.01em',lineHeight:1.3}}>シリーズ</h1>
                    <p style={{fontSize:14,color:'var(--color-text-muted)',marginTop:10,lineHeight:1.7}}>関連する作品をまとめて、読者にわかりやすく紹介できます。</p>
                  </div>
                  <SeriesManager userId={profile.user_id ?? ""} myNovels={myNovels||[]} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 性別モーダル */}
      {showGenderModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:'28px',maxWidth:360,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',marginBottom:16}}>性別を設定</div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
              {['男性','女性','その他','未設定'].map(g => (
                <button key={g} onClick={()=>handleSaveGender(g==='未設定'?'':g)}
                  style={{padding:'12px 16px',borderRadius:8,border:`1.5px solid ${gender===g||(!gender&&g==='未設定')?'var(--color-brand)':'var(--color-brand-border)'}`,background:gender===g||(!gender&&g==='未設定')?'var(--color-brand-light)':'none',fontSize:13,color:'var(--color-text)',cursor:'pointer',textAlign:'left' as const,fontWeight:gender===g?700:400}}>
                  {g}
                </button>
              ))}
            </div>
            <button onClick={()=>setShowGenderModal(false)} style={{width:'100%',padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>キャンセル</button>
          </div>
        </div>
      )}

      {/* Xアカウントモーダル */}
      {showXModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:'28px',maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',marginBottom:16}}>Xアカウントを設定</div>
            <div style={{display:'flex',alignItems:'center',border:'1.5px solid var(--color-brand-border)',borderRadius:8,overflow:'hidden',marginBottom:16}}>
              <span style={{padding:'10px 12px',background:'var(--color-bg)',color:'var(--color-text-muted)',fontSize:13,borderRight:'1px solid var(--color-brand-border)',flexShrink:0}}>@</span>
              <input value={xAccount} onChange={e=>setXAccount(e.target.value.replace(/^@/,''))}
                placeholder="ユーザー名" style={{flex:1,padding:'10px 12px',border:'none',outline:'none',fontSize:13,background:'var(--color-bg-card)'}}/>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowXModal(false);setXAccount((profile as any).x_account||'')}} style={{flex:1,padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>キャンセル</button>
              <button onClick={handleSaveXAccount} disabled={xSaving} style={{flex:1,padding:'10px',border:'none',borderRadius:8,background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,cursor:'pointer',opacity:xSaving?0.6:1}}>{xSaving?'保存中...':'保存する'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 話の公開管理モーダル */}
      {epManageTarget && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,width:'100%',maxWidth:500,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid var(--color-brand-border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)'}}>話の公開管理</div>
                <div style={{fontSize:11,color:'var(--color-text-muted)',marginTop:2}}>{epManageTarget.title}</div>
              </div>
              <button onClick={()=>{setEpManageTarget(null);setEpList([])}} style={{width:28,height:28,border:'1px solid var(--color-brand-border)',borderRadius:'50%',background:'none',cursor:'pointer',fontSize:14,color:'var(--color-text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {epList.length===0 ? (
                <div style={{textAlign:'center',padding:'40px',color:'var(--color-text-faint)',fontSize:13}}>話がありません</div>
              ) : epList.map((ep:any,i:number) => (
                <div key={ep.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',borderBottom:i<epList.length-1?'1px solid var(--color-brand-light)':'none'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,color:'var(--color-text-faint)',marginBottom:1}}>第{ep.ep_number}話</div>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ep.title}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                    <span style={{fontSize:10,fontWeight:600,color:ep.published?'#15803d':'#757575',background:ep.published?'#f0fdf4':'#f5f5f5',border:`1px solid ${ep.published?'#86efac':'#e0e0e0'}`,padding:'2px 8px',borderRadius:8}}>{ep.published?'公開中':'非公開'}</span>
                    <button onClick={()=>handleToggleEpPublish(ep.id,ep.published)} disabled={epToggling===ep.id}
                      style={{fontSize:11,fontWeight:600,padding:'5px 12px',borderRadius:8,cursor:'pointer',border:`1px solid ${ep.published?'var(--color-brand-border)':'#86efac'}`,color:ep.published?'var(--color-text-muted)':'#15803d',background:'none',opacity:epToggling===ep.id?0.5:1,whiteSpace:'nowrap' as const}}>
                      {epToggling===ep.id?'...':ep.published?'非公開にする':'公開する'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 章管理モーダル */}
      {chapterTarget && <ChapterEditModal novelId={chapterTarget.id} novelTitle={chapterTarget.title} onClose={()=>setChapterTarget(null)}/>}

      {/* ストーリーボードモーダル */}
      {showBoard && (
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',padding:isMobile?0:20}}>
          <div style={{position:isMobile?'absolute':'relative',bottom:isMobile?0:undefined,width:isMobile?'100%':'95%',maxWidth:1200,height:isMobile?'92vh':'88vh',borderRadius:isMobile?'16px 16px 0 0':12,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'} as any}>
          </div>
        </div>
      )}

      {/* バッジ図鑑モーダル */}
      {showBadgeBook && (
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(5,3,12,0.92)',padding:isMobile?0:20}}>
          <div style={{position:'absolute',inset:0}} onClick={()=>setShowBadgeBook(false)}/>
          <div style={{position:isMobile?'absolute':'relative',bottom:isMobile?0:undefined,zIndex:1,width:isMobile?'100%':'94%',maxWidth:940,height:isMobile?'92vh':'86vh',display:'flex',borderRadius:isMobile?'18px 18px 0 0':10,overflow:'visible',filter:'drop-shadow(0 40px 60px rgba(0,0,0,0.9))'} as any}>
            <div style={{flex:1,display:'flex',flexDirection:'column',borderRadius:isMobile?'18px 18px 0 0':'0 10px 10px 0',overflow:'hidden',background:'#f5ede0'}}>
              <div style={{background:'linear-gradient(180deg, #2d1206 0%, #1a211d 100%)',padding:isMobile?'14px 16px 12px':'16px 24px 14px',borderBottom:'3px solid #7a3a18'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:isMobile?16:20,fontWeight:700,color:'#b9d4e4',fontFamily:"'Noto Serif JP',serif"}}>バッジ図鑑</div>
                    <div style={{fontSize:11,color:'rgba(255,200,100,0.6)',marginTop:1}}>{claimedSet.size}/{ALL_BADGES.filter(b=>!b.id.startsWith('_')).length} 獲得済み</div>
                  </div>
                  <button onClick={()=>setShowBadgeBook(false)} style={{width:28,height:28,border:'1px solid rgba(255,200,100,0.3)',borderRadius:'50%',background:'rgba(0,0,0,0.3)',color:'rgba(255,200,100,0.7)',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
                <div style={{marginTop:10,height:4,background:'rgba(0,0,0,0.3)',borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',background:'linear-gradient(90deg,#4a6b80,#b9d4e4,#4a6b80)',width:`${(claimedSet.size/ALL_BADGES.filter(b=>!b.id.startsWith('_')).length)*100}%`,transition:'width .4s'}}/>
                </div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:isMobile?'16px 12px':'20px 28px'}}>
                <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(4,1fr)':'repeat(6,1fr)',gap:isMobile?12:18}}>
                  {ALL_BADGES.slice(badgePage*perPage,(badgePage+1)*perPage).map(badge => {
                    const owned = claimedSet.has(badge.id)
                    const isSlot = badge.id.startsWith('_')
                    const sz = isMobile?58:72
                    return (
                      <div key={badge.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,opacity:isSlot?0.2:1}}>
                        <div style={{width:sz+10,height:sz+10,borderRadius:'50%',background:owned?`radial-gradient(circle at 40% 35%, color-mix(in srgb, var(--base-color-1) 90%, transparent), ${badge.color} 40%, ${badge.color}bb)`:'radial-gradient(circle at 40% 35%, #aaa 0%, #666 60%, #444)',border:owned?`3px solid ${badge.color}`:'3px solid #888',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:owned?`0 4px 14px ${badge.color}88`:'0 3px 8px rgba(0,0,0,0.25)',position:'relative',overflow:'hidden'}}>
                          {owned?<span style={{fontSize:isMobile?9:11,fontWeight:700,color:'var(--color-text-inverse)',textAlign:'center',lineHeight:1.25,padding:'0 4px',zIndex:1,textShadow:'0 1px 3px rgba(0,0,0,0.6)'}}>{badge.name.replace(' Lv.','\nLv.')}</span>
                            :<span style={{fontSize:isMobile?16:20,color:'color-mix(in srgb, var(--base-color-1) 15%, transparent)',fontWeight:700}}>{isSlot?'':'?'}</span>}
                        </div>
                        <div style={{fontSize:isMobile?9:10,color:owned?'#5a3010':'#8fa8b8',textAlign:'center',lineHeight:1.3,fontWeight:owned?600:400}}>
                          {isSlot?'':owned?badge.name:'未獲得'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {totalPages>1 && (
                <div style={{background:'linear-gradient(180deg,#ede0cc,#e0cdb0)',borderTop:'2px solid #c8a87a',padding:'10px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <button onClick={()=>setBadgePage(p=>Math.max(0,p-1))} disabled={badgePage===0} style={{padding:'6px 14px',border:'1px solid #4a6b80',borderRadius:16,background:badgePage===0?'transparent':'#1a211d',color:badgePage===0?'#8fa8b8':'#b9d4e4',cursor:badgePage===0?'not-allowed':'pointer',fontSize:12,fontWeight:600}}>‹ 前</button>
                  <span style={{fontSize:11,color:'#4a6b80'}}>{badgePage+1}/{totalPages}</span>
                  <button onClick={()=>setBadgePage(p=>Math.min(totalPages-1,p+1))} disabled={badgePage===totalPages-1} style={{padding:'6px 14px',border:'1px solid #4a6b80',borderRadius:16,background:badgePage===totalPages-1?'transparent':'#1a211d',color:badgePage===totalPages-1?'#8fa8b8':'#b9d4e4',cursor:badgePage===totalPages-1?'not-allowed':'pointer',fontSize:12,fontWeight:600}}>次 ›</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 各種モーダル */}
      {showEmailModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:'28px',maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',marginBottom:16}}>メールアドレスを変更</div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,display:'block',marginBottom:4}}>新しいメールアドレス</label><input type="email" value={newEmail} onChange={e=>{setNewEmail(e.target.value);setEmailError('')}} placeholder="new@example.com" style={{width:'100%',padding:'10px 14px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13,outline:'none'}}/></div>
            <div style={{marginBottom:16}}><label style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,display:'block',marginBottom:4}}>現在のパスワード</label><input type="password" value={emailPw} onChange={e=>{setEmailPw(e.target.value);setEmailError('')}} style={{width:'100%',padding:'10px 14px',border:`1.5px solid ${emailError?'var(--color-danger)':'var(--color-brand-border)'}`,borderRadius:8,fontSize:13,outline:'none'}}/></div>
            {emailError && <div style={{fontSize:11,color:'var(--color-danger)',marginBottom:12}}>{emailError}</div>}
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowEmailModal(false);setNewEmail('');setEmailPw('');setEmailError('')}} style={{flex:1,padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>キャンセル</button>
              <button onClick={handleEmailChange} disabled={emailSaving} style={{flex:1,padding:'10px',border:'none',borderRadius:8,background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,cursor:'pointer',opacity:emailSaving?0.6:1}}>{emailSaving?'送信中...':'変更する'}</button>
            </div>
          </div>
        </div>
      )}
      {showPwModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:'28px',maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',marginBottom:16}}>パスワードを変更</div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,display:'block',marginBottom:4}}>現在のパスワード</label><input type="password" value={currentPw} onChange={e=>{setCurrentPw(e.target.value);setPwError('')}} style={{width:'100%',padding:'10px 14px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13,outline:'none'}}/></div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,display:'block',marginBottom:4}}>新しいパスワード（6文字以上）</label><input type="password" value={newPw} onChange={e=>{setNewPw(e.target.value);setPwError('')}} style={{width:'100%',padding:'10px 14px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13,outline:'none'}}/></div>
            <div style={{marginBottom:16}}><label style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,display:'block',marginBottom:4}}>新しいパスワード（確認）</label><input type="password" value={newPwConfirm} onChange={e=>{setNewPwConfirm(e.target.value);setPwError('')}} style={{width:'100%',padding:'10px 14px',border:`1.5px solid ${pwError?'var(--color-danger)':'var(--color-brand-border)'}`,borderRadius:8,fontSize:13,outline:'none'}}/></div>
            {pwError && <div style={{fontSize:11,color:'var(--color-danger)',marginBottom:12}}>{pwError}</div>}
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowPwModal(false);setCurrentPw('');setNewPw('');setNewPwConfirm('');setPwError('')}} style={{flex:1,padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>キャンセル</button>
              <button onClick={handlePwChange} disabled={pwSaving} style={{flex:1,padding:'10px',border:'none',borderRadius:8,background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,cursor:'pointer',opacity:pwSaving?0.6:1}}>{pwSaving?'変更中...':'変更する'}</button>
            </div>
          </div>
        </div>
      )}
      {showBdModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:'28px',maxWidth:380,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',marginBottom:16}}>生年月日を設定</div>
            <p style={{fontSize:12,color:'var(--color-text-muted)',lineHeight:1.8,marginBottom:16}}>18歳以上の方はR18コンテンツを閲覧できます。13歳未満の方はご利用いただけません。</p>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <select value={bdYear} onChange={e=>setBdYear(e.target.value)} style={{flex:2,padding:'8px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13}}>
                <option value="">年</option>
                {Array.from({length:100},(_,i)=>new Date().getFullYear()-i-5).map(y=><option key={y} value={y}>{y}年</option>)}
              </select>
              <select value={bdMonth} onChange={e=>setBdMonth(e.target.value)} style={{flex:1,padding:'8px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13}}>
                <option value="">月</option>
                {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
              </select>
              <select value={bdDay} onChange={e=>setBdDay(e.target.value)} style={{flex:1,padding:'8px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13}}>
                <option value="">日</option>
                {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}日</option>)}
              </select>
            </div>
            {bdError && <div style={{fontSize:11,color:'var(--color-danger)',marginBottom:12}}>{bdError}</div>}
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowBdModal(false);setBdError('')}} style={{flex:1,padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>キャンセル</button>
              <button onClick={handleSaveBirthdate} disabled={bdSaving} style={{flex:1,padding:'10px',border:'none',borderRadius:8,background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,cursor:'pointer',opacity:bdSaving?0.6:1}}>{bdSaving?'保存中…':'設定する'}</button>
            </div>
          </div>
        </div>
      )}
      {showBioModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:'28px',maxWidth:480,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:700,color:'var(--color-text)',marginBottom:16}}>自己紹介を編集</div>
            <textarea value={bioInput} onChange={e=>setBioInput(e.target.value)} rows={6} maxLength={300} placeholder="自己紹介（300文字以内）" style={{width:'100%',padding:'10px 14px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:13,outline:'none',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box' as const,lineHeight:1.8}}/>
            <div style={{fontSize:11,color:'var(--color-text-faint)',textAlign:'right',marginBottom:16}}>{bioInput.length}/300</div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowBioModal(false);setBioInput(profile.bio||'')}} style={{flex:1,padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>キャンセル</button>
              <button onClick={handleSaveBio} disabled={bioSaving} style={{flex:1,padding:'10px',border:'none',borderRadius:8,background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,cursor:'pointer',opacity:bioSaving?0.6:1}}>{bioSaving?'保存中...':'保存する'}</button>
            </div>
          </div>
        </div>
      )}
      {showWithdraw && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:'32px',maxWidth:480,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:18,fontWeight:700,color:'var(--color-danger)',marginBottom:16}}>退会の確認</div>
            <div style={{fontSize:13,color:'var(--color-text)',lineHeight:1.8,marginBottom:16,background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,padding:'12px 16px'}}>
              投稿した作品は削除されません。退会前にご自身で削除してください。この操作は取り消せません。
            </div>
            <input type={profile.login_provider==='google'?'text':'password'} value={withdrawPw} onChange={e=>{setWithdrawPw(e.target.value);setWithdrawError('')}}
              placeholder={profile.login_provider==='google'?'「退会」と入力':'パスワード'}
              style={{width:'100%',padding:'10px 14px',border:`1.5px solid ${withdrawError?'var(--color-danger)':'var(--color-brand-border)'}`,borderRadius:8,fontSize:13,marginBottom:8,outline:'none'}}/>
            {withdrawError && <div style={{fontSize:11,color:'var(--color-danger)',marginBottom:12}}>{withdrawError}</div>}
            <div style={{display:'flex',gap:10,marginTop:8}}>
              <button onClick={()=>{setShowWithdraw(false);setWithdrawPw('');setWithdrawError('')}} style={{flex:1,padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>キャンセル</button>
              <button onClick={handleWithdraw} disabled={!withdrawPw||withdrawing} style={{flex:1,padding:'10px',border:'none',borderRadius:8,background:withdrawPw?'var(--color-danger)':'#f5f5f5',color:withdrawPw?'var(--base-color-1)':'var(--color-text-faint)',fontSize:13,fontWeight:700,cursor:withdrawPw?'pointer':'not-allowed'}}>{withdrawing?'処理中...':'退会する'}</button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--color-bg-card)',borderRadius:16,padding:'28px',maxWidth:460,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:700,color:'var(--color-danger)',marginBottom:16}}>削除の確認</div>
            {!deleteMode && (<>
              <p style={{fontSize:13,color:'var(--color-text)',marginBottom:16,lineHeight:1.8}}>「<strong>{deleteTarget.title}</strong>」の削除方法を選んでください</p>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
                <button onClick={()=>setDeleteMode('episode')} style={{padding:'14px 16px',border:'1.5px solid var(--color-brand-border)',borderRadius:10,background:'var(--color-bg)',cursor:'pointer',textAlign:'left' as const}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:2}}>特定の話を削除する</div>
                  <div style={{fontSize:11,color:'var(--color-text-muted)'}}>選んだ話だけ削除します。作品は残ります。</div>
                </button>
                <button onClick={()=>setDeleteMode('novel')} style={{padding:'14px 16px',border:'1.5px solid #fca5a5',borderRadius:10,background:'#fef2f2',cursor:'pointer',textAlign:'left' as const}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--color-danger)',marginBottom:2}}>作品全体を削除する</div>
                  <div style={{fontSize:11,color:'var(--color-text-faint)'}}>すべての話・コメント・いいねが削除されます。取り消せません。</div>
                </button>
              </div>
              <button onClick={()=>setDeleteTarget(null)} style={{width:'100%',padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>キャンセル</button>
            </>)}
            {deleteMode==='episode'&&!deleteEpId&&(<>
              <p style={{fontSize:13,color:'var(--color-text)',marginBottom:12}}>削除する話を選んでください</p>
              <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:240,overflowY:'auto',marginBottom:16}}>
                {deleteTarget.episodes.length===0
                  ?<div style={{fontSize:12,color:'var(--color-text-faint)',textAlign:'center',padding:16}}>話がありません</div>
                  :deleteTarget.episodes.map(ep=>(
                    <button key={ep.id} onClick={()=>setDeleteEpId(ep.id)} style={{padding:'10px 14px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',cursor:'pointer',textAlign:'left' as const,fontSize:13,color:'var(--color-text)'}}>{ep.title}</button>
                  ))}
              </div>
              <button onClick={()=>setDeleteMode(null)} style={{width:'100%',padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>戻る</button>
            </>)}
            {deleteMode==='episode'&&deleteEpId&&(<>
              <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:13,color:'var(--color-danger)',lineHeight:1.7}}>
                「<strong>{deleteTarget.episodes.find(e=>e.id===deleteEpId)?.title}</strong>」を削除します。この操作は取り消せません。
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setDeleteEpId('')} style={{flex:1,padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>戻る</button>
                <button onClick={handleDeleteConfirm} disabled={deleteLoading} style={{flex:1,padding:'10px',border:'none',borderRadius:8,background:'var(--color-danger)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,cursor:'pointer',opacity:deleteLoading?0.6:1}}>{deleteLoading?'削除中…':'削除する'}</button>
              </div>
            </>)}
            {deleteMode==='novel'&&(<>
              <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:13,color:'var(--color-danger)',lineHeight:1.7}}>
                「<strong>{deleteTarget.title}</strong>」を完全に削除します。この操作は取り消せません。
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setDeleteMode(null)} style={{flex:1,padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'none',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>戻る</button>
                <button onClick={handleDeleteConfirm} disabled={deleteLoading} style={{flex:1,padding:'10px',border:'none',borderRadius:8,background:'var(--color-danger)',color:'var(--color-text-inverse)',fontSize:13,fontWeight:700,cursor:'pointer',opacity:deleteLoading?0.6:1}}>{deleteLoading?'削除中…':'完全に削除する'}</button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {toast && (
        <div style={{position:'fixed',bottom:isMobile?80:24,right:24,background:'var(--color-brand)',color:'var(--color-text-inverse)',padding:'12px 20px',borderRadius:12,fontSize:13,fontWeight:600,zIndex:999,boxShadow:'0 4px 16px color-mix(in srgb, var(--color-brand) 35%, transparent)'}}>
          {toast}
        </div>
      )}
      <style>{`.history-title:hover,.history-title:hover div{color:var(--color-text)!important;opacity:1!important}`}</style>
    </div>
  )
}
