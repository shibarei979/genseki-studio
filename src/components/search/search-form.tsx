'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/*
 * 検索のジャンル。
 *
 * ファンタジーを 3 つに分けた。
 * 昔の「ファンタジー」「異世界」で出している作品も
 * 拾えるようにしているので、ここには出さない。
 */
const GENRES_BASE = ['オールジャンル','ハイファンタジー','異世界ファンタジー','ローファンタジー','SF','恋愛','学園','ミステリー','ホラー','歴史・時代','日常','アクション','コメディ','その他']

const MOODS = [
  { emoji: '💘', label: '胸きゅんしたい',      tags: ['恋愛','ときめき','胸キュン','片思い','ラブコメ'] },
  { emoji: '😢', label: '切ない物語が読みたい',  tags: ['切ない','悲恋','別れ','涙','感動'] },
  { emoji: '😂', label: '笑いたい',            tags: ['ギャグ','コメディ','ほのぼの','笑える'] },
  { emoji: '😱', label: 'ぞくっとしたい',       tags: ['ホラー','ミステリー','謎解き','サスペンス','怖い'] },
  { emoji: '🔥', label: '熱い展開が読みたい',   tags: ['バトル','熱い','友情','成長','無双'] },
  { emoji: '🌿', label: '癒されたい',           tags: ['ほのぼの','スローライフ','日常','癒し','ふわふわ'] },
  { emoji: '🧠', label: '考察したい',           tags: ['謎解き','伏線','考察','ミステリー','哲学'] },
  { emoji: '🌙', label: '余韻に浸りたい',       tags: ['余韻','文学','詩的','感動','純文学'] },
  { emoji: '⏱️', label: '短時間で読みたい',     tags: ['短編','読み切り','1話完結'] },
  { emoji: '📖', label: '一気読みしたい',       tags: ['続きが気になる','完結','長編','怒涛'] },
  { emoji: '✨', label: '異世界に行きたい',     tags: ['異世界','転生','ファンタジー','冒険'] },
  { emoji: '💪', label: '主人公に憧れたい',     tags: ['最強','チート','成長','主人公'] },
  { emoji: '👑', label: '悪役令嬢が読みたい',   tags: ['悪役令嬢','転落','婚約破棄','ざまぁ','令嬢'] },
  { emoji: '⚔️', label: 'ダンジョン・冒険したい', tags: ['ダンジョン','冒険','探索','魔物','パーティ'] },
  { emoji: '🌸', label: '学園ものが読みたい',   tags: ['学園','青春','部活','恋愛','高校'] },
  { emoji: '🧙', label: '魔法世界に浸りたい',   tags: ['魔法','魔法使い','魔法学校','精霊','詠唱'] },
  { emoji: '💼', label: '内政・経営に燃えたい', tags: ['内政','経営','チート','無双','領主'] },
  { emoji: '🕵️', label: '謎を解きたい',        tags: ['ミステリー','謎解き','推理','サスペンス','犯人'] },
  { emoji: '😭', label: '号泣したい',           tags: ['感動','泣ける','切ない','死別','再会'] },
  { emoji: '🌊', label: 'どっぷり世界観に浸りたい', tags: ['世界観','設定','ファンタジー','SF','独自'] },
]

const KEYWORD_CATEGORIES = [
  { label: '作品傾向', items: ['ギャグ','シリアス','ほのぼの','ダーク','感動','スローライフ','復讐','ループ','群像劇','バトル','冒険','成長物語','友情','ヒューマンドラマ','謎解き','サスペンス'] },
  { label: '主人公',   items: ['チート','最強','天才','悪役令嬢','転落令嬢','影の実力者','暗殺者','追放','記憶喪失','勘当','冤罪','転生者','召喚された','孤独な主人公','女主人公','男主人公'] },
  { label: '職業・種族', items: ['魔法使い','ヒーラー','騎士','錬金術師','精霊使い','竜騎士','薬師','剣士','吸血鬼','獣人','エルフ','ドワーフ','竜','神','悪魔','魔族'] },
  { label: '舞台・世界観', items: ['異世界','学園','ダンジョン','王宮','魔法学校','近未来','宇宙','和風','中世ヨーロッパ','海洋','砂漠','地下世界','神話世界','現代日本','戦国'] },
  { label: '恋愛・人間関係', items: ['幼馴染','許嫁','政略結婚','契約結婚','初恋','片思い','三角関係','ハーレム','逆ハーレム','BL','百合','禁断の恋','年の差','身分差'] },
  { label: '要素', items: ['魔王討伐','内政','転生','転移','タイムトラベル','ゲーム世界','タイムリープ','獣耳','魔法少女','精霊','神様','鑑定スキル','無双','ざまぁ','婚約破棄'] },
]

// S4: 並び順の選択肢（セレクトボックス用）
const SORT_OPTIONS = [
  { v: 'new',          l: '新着' },
  { v: 'old',          l: '古い' },
  { v: 'like',         l: 'いいね（総合）' },
  { v: 'like_daily',   l: 'いいね（日間）' },
  { v: 'like_weekly',  l: 'いいね（週間）' },
  { v: 'like_monthly', l: 'いいね（月間）' },
  { v: 'bookmark',     l: 'ブックマーク' },
  { v: 'view',         l: '閲覧数' },
  { v: 'comment',      l: 'コメント' },
  { v: 'rising',       l: '急上昇' },
  { v: 'ep_count',     l: '話数' },
  { v: 'char_count',   l: '文字数' },
  { v: 'award',        l: '受賞・注目' },
]

interface Props {
  defaultQ?: string; defaultExclude?: string; defaultGenre?: string
  defaultType?: string; defaultSerial?: string; defaultTag?: string
  defaultSort?: string; ageVerified?: boolean; defaultDiscover?: boolean
  defaultAuthor?: string; defaultLikeMin?: string; defaultLikeMax?: string
  defaultCharMin?: string; defaultCharMax?: string; defaultPtMin?: string; defaultPtMax?: string
  defaultContest?: string
  contests?: { id: string; title: string }[]
}

export default function SearchForm({
  defaultQ='', defaultExclude='', defaultGenre='', defaultType='',
  defaultSerial='', defaultTag='', defaultSort='new', ageVerified=false, defaultDiscover=false,
  defaultAuthor='', defaultLikeMin='', defaultLikeMax='',
  defaultCharMin='', defaultCharMax='', defaultPtMin='', defaultPtMax='',
  defaultContest='', contests=[]
}: Props) {
  const router = useRouter()
  const GENRES = ageVerified ? [...GENRES_BASE, '官能'] : GENRES_BASE

  const [q,                  setQ]                  = useState(defaultQ)
  const [author,             setAuthor]             = useState(defaultAuthor)
  const [exclude,            setExclude]            = useState(defaultExclude)
  const [genre,              setGenre]              = useState(defaultGenre)
  const [type,               setType]               = useState(defaultType)
  const [serial,             setSerial]             = useState(defaultSerial)
  const [tags,               setTags]               = useState<string[]>(defaultTag ? defaultTag.split(',').filter(Boolean) : [])
  const [sort,               setSort]               = useState(defaultSort)
  const [discoverMode,       setDiscoverMode]       = useState(defaultDiscover)
  const [contestId,          setContestId]          = useState(defaultContest)
  const [charMin,            setCharMin]            = useState(defaultCharMin)
  const [charMax,            setCharMax]            = useState(defaultCharMax)
  const [ptMin,              setPtMin]              = useState(defaultPtMin)
  const [ptMax,              setPtMax]              = useState(defaultPtMax)
  const [showDetail,         setShowDetail]         = useState(!!(defaultGenre||defaultType||defaultSerial||defaultTag||defaultContest||defaultCharMin||defaultCharMax||defaultPtMin||defaultPtMax))
  const [showSearchExamples, setShowSearchExamples] = useState(false)
  const [showExcludeExamples,setShowExcludeExamples]= useState(false)
  const [history,            setHistory]            = useState<string[]>([])
  const [showHistory,        setShowHistory]        = useState(false)
  const [exHistory,          setExHistory]          = useState<string[]>([])
  const [showExHistory,      setShowExHistory]      = useState(false)
  const [showMoods,          setShowMoods]          = useState(false)
  const [activeMoods,        setActiveMoods]        = useState<string[]>([])
  const [isMobile,           setIsMobile]           = useState(false)
  const MAX_HISTORY = 10

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('search_history')
      if (saved) setHistory(JSON.parse(saved))
      const savedEx = localStorage.getItem('exclude_history')
      if (savedEx) setExHistory(JSON.parse(savedEx))
    } catch {}
  }, [])

  // 気分タグは裏でのみ使用（タグ欄には表示しない）
  const moodTags = activeMoods.flatMap(label => MOODS.find(m => m.label === label)?.tags.slice(0,3) || [])

  function handleMoodSelect(mood: typeof MOODS[0]) {
    if (activeMoods.includes(mood.label)) {
      setActiveMoods(activeMoods.filter(m => m !== mood.label))
    } else {
      setActiveMoods([...activeMoods, mood.label])
    }
  }

  function handleSearch() {
    const params = new URLSearchParams()
    if (q)               params.set('q',       q)
    if (author)          params.set('author',  author)
    if (exclude)         params.set('exclude', exclude)
    if (genre)           params.set('genre',   genre)
    if (type)            params.set('type',    type)
    if (serial)          params.set('serial',  serial)
    if (contestId)       params.set('contest', contestId)
    if (charMin)         params.set('charMin', charMin)
    if (charMax)         params.set('charMax', charMax)
    if (ptMin)           params.set('ptMin',   ptMin)
    if (ptMax)           params.set('ptMax',   ptMax)
    const allTags = Array.from(new Set([...tags, ...moodTags]))
    if (allTags.length > 0) params.set('tag', allTags.join(','))
    if (discoverMode)    params.set('sort',    'discover')
    else if (sort)       params.set('sort',    sort)
    if (q.trim()) {
      try {
        const nh = [q.trim(), ...history.filter(h => h !== q.trim())].slice(0, MAX_HISTORY)
        setHistory(nh)
        localStorage.setItem('search_history', JSON.stringify(nh))
      } catch {}
    }
    if (exclude.trim()) {
      try {
        const neh = [exclude.trim(), ...exHistory.filter(h => h !== exclude.trim())].slice(0, MAX_HISTORY)
        setExHistory(neh)
        localStorage.setItem('exclude_history', JSON.stringify(neh))
      } catch {}
    }
    router.push(`/search?${params.toString()}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  const pill = (active: boolean) => ({
    padding: '5px 14px', borderRadius: 16, fontSize: 12,
    fontWeight: 600 as const, cursor: 'pointer' as const,
    border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-brand-border)'}`,
    background: active ? 'var(--color-brand)' : 'var(--color-bg-card)',
    color: active ? 'var(--color-bg-card)' : 'var(--color-text-muted)',
    transition: 'all .15s',
  })
  const pillCls = (active: boolean) => active ? 'ranking-pill ranking-pill-active' : 'ranking-pill ranking-pill-inactive'

  const inp = {
    width: '100%', padding: '9px 14px', border: '1.5px solid var(--color-brand-border)',
    borderRadius: 8, fontSize: 13, color: 'var(--color-text)', outline: 'none', background: 'var(--color-bg-card)',
  } as const

  return (
    <>
    {/*
     * 見出しは枠の外。
     *
     * ランキングと同じ置き方にする。
     * 枠の中にあると絞り込みの一項目に見えて、
     * このページが何なのかが伝わりにくい。
     */}
    <h1 style={{fontSize:20,fontWeight:700,color:'var(--color-text)',marginBottom:12}}>
      作品を探す
    </h1>

    <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding: isMobile ? '16px' : '20px',marginBottom:16}}>

      {/* キーワード・除外 */}
      <div style={{display:'flex',flexDirection: isMobile ? 'column' : 'row',gap:10,marginBottom:12}}>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:4}}>キーワード</div>
          <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="作品名・あらすじで検索" style={inp}/>
          <div style={{marginTop:4}}>
            <button type="button" onClick={()=>setShowHistory(!showHistory)}
              style={{fontSize:10,color:'var(--color-text-muted)',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:3}}>
              検索履歴
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{transition:'transform .15s',transform:showHistory?'rotate(180deg)':'rotate(0deg)'}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showHistory && (
              <div style={{marginTop:4,padding:'8px',background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:10,color:'var(--color-text-faint)'}}>最近の検索</span>
                  <button type="button" onClick={()=>{setHistory([]);try{localStorage.removeItem('search_history')}catch{}}}
                    style={{fontSize:10,color:'var(--color-text-faint)',background:'none',border:'none',cursor:'pointer',padding:0}}>クリア</button>
                </div>
                {history.length === 0
                  ? <div style={{fontSize:11,color:'var(--color-text-faint)'}}>まだ検索履歴がありません</div>
                  : <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {history.map((h,i) => (
                      <button key={i} type="button" onClick={()=>setQ(h)}
                        style={{padding:'2px 9px',borderRadius:10,fontSize:11,cursor:'pointer',
                          background:q===h?'var(--color-brand)':'var(--color-bg-card)',color:q===h?'var(--color-bg-card)':'var(--color-text-muted)',
                          border:`1px solid ${q===h?'var(--color-brand)':'var(--color-brand-border)'}`}}>{h}</button>
                    ))}
                  </div>
                }
              </div>
            )}
          </div>
          <button type="button" onClick={()=>setShowSearchExamples(!showSearchExamples)}
            style={{marginTop:4,fontSize:10,color:'var(--color-brand)',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:3}}>
            検索ワード例
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{transition:'transform .15s',transform:showSearchExamples?'rotate(180deg)':'rotate(0deg)'}}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showSearchExamples && (
            <div style={{marginTop:6,padding:'12px',background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:8}}>
              {KEYWORD_CATEGORIES.map(cat => (
                <div key={cat.label} style={{display:'flex',gap:6,marginBottom:8,alignItems:'flex-start'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--color-text-muted)',minWidth:72,paddingTop:4,flexShrink:0}}>{cat.label}</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {cat.items.map(ex => (
                      <button key={ex} type="button" onClick={()=>setQ(q===ex?'':ex)}
                        style={{padding:'3px 10px',borderRadius:10,fontSize:11,cursor:'pointer',
                          background:q===ex?'var(--color-brand)':'var(--color-bg-card)',color:q===ex?'var(--color-bg-card)':'var(--color-text-muted)',
                          border:`1px solid ${q===ex?'var(--color-brand)':'var(--color-brand-border)'}`}}>{ex}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{flex:1}}>
          <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:4}}>除外キーワード</div>
          <input value={exclude} onChange={e=>setExclude(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="含まない言葉を入力" style={inp}/>
          <div style={{marginTop:4}}>
            <button type="button" onClick={()=>setShowExHistory(!showExHistory)}
              style={{fontSize:10,color:'var(--color-text-muted)',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:3}}>
              除外履歴
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{transition:'transform .15s',transform:showExHistory?'rotate(180deg)':'rotate(0deg)'}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showExHistory && (
              <div style={{marginTop:4,padding:'8px',background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:10,color:'var(--color-text-faint)'}}>最近の除外</span>
                  <button type="button" onClick={()=>{setExHistory([]);try{localStorage.removeItem('exclude_history')}catch{}}}
                    style={{fontSize:10,color:'var(--color-text-faint)',background:'none',border:'none',cursor:'pointer',padding:0}}>クリア</button>
                </div>
                {exHistory.length === 0
                  ? <div style={{fontSize:11,color:'var(--color-text-faint)'}}>まだ除外履歴がありません</div>
                  : <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {exHistory.map((h,i) => (
                      <button key={i} type="button" onClick={()=>setExclude(h)}
                        style={{padding:'2px 9px',borderRadius:10,fontSize:11,cursor:'pointer',
                          background:exclude===h?'var(--color-brand)':'var(--color-bg-card)',color:exclude===h?'var(--color-bg-card)':'var(--color-text-muted)',
                          border:`1px solid ${exclude===h?'var(--color-brand)':'var(--color-brand-border)'}`}}>{h}</button>
                    ))}
                  </div>
                }
              </div>
            )}
          </div>
          <button type="button" onClick={()=>setShowExcludeExamples(!showExcludeExamples)}
            style={{marginTop:4,fontSize:10,color:'var(--color-brand)',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:3}}>
            除外ワード例
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{transition:'transform .15s',transform:showExcludeExamples?'rotate(180deg)':'rotate(0deg)'}}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showExcludeExamples && (
            <div style={{marginTop:6,padding:'12px',background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:8}}>
              {KEYWORD_CATEGORIES.map(cat => (
                <div key={cat.label} style={{display:'flex',gap:6,marginBottom:8,alignItems:'flex-start'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--color-text-muted)',minWidth:72,paddingTop:4,flexShrink:0}}>{cat.label}</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {cat.items.map(ex => (
                      <button key={ex} type="button" onClick={()=>setExclude(exclude===ex?'':ex)}
                        style={{padding:'3px 10px',borderRadius:10,fontSize:11,cursor:'pointer',
                          background:exclude===ex?'var(--color-brand)':'var(--color-bg-card)',color:exclude===ex?'var(--color-bg-card)':'var(--color-text-muted)',
                          border:`1px solid ${exclude===ex?'var(--color-brand)':'var(--color-brand-border)'}`}}>{ex}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* S5: コンパクトなトグルボタン横並び */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <button type="button" onClick={()=>setShowMoods(!showMoods)}
          style={{
            display:'flex',alignItems:'center',gap:5,
            padding:'5px 12px',
            border:'1.5px solid var(--color-brand-border)',
            borderRadius:16,
            background:'var(--color-bg-card)',
            color:'var(--color-text-muted)',
            fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap' as const,
          }}>
          気分で探す
          <span style={{fontSize:14,lineHeight:1}}>{showMoods?'−':'＋'}</span>
        </button>
        <button type="button" onClick={()=>setShowDetail(!showDetail)}
          style={{
            display:'flex',alignItems:'center',gap:5,
            padding:'5px 12px',
            border:'1.5px solid var(--color-brand-border)',
            borderRadius:16,
            background:'var(--color-bg-card)',
            color:'var(--color-text-muted)',
            fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap' as const,
          }}>
          詳細条件
          <span style={{fontSize:14,lineHeight:1}}>{showDetail?'−':'＋'}</span>
        </button>
      </div>

      {showMoods && (
        <div style={{marginBottom:12,padding:'12px 14px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'var(--color-bg)',display:'flex',flexWrap:'wrap',gap:6}}>
          {MOODS.map(mood => (
            <button key={mood.label} type="button" onClick={()=>handleMoodSelect(mood)}
              style={{padding:'5px 12px',borderRadius:16,fontSize:12,cursor:'pointer',
                whiteSpace:'nowrap' as const,
                border:`1.5px solid ${activeMoods.includes(mood.label)?'var(--color-brand)':'var(--color-brand-border)'}`,
                background:activeMoods.includes(mood.label)?'var(--color-brand)':'var(--color-bg-card)',
                color:activeMoods.includes(mood.label)?'var(--color-bg-card)':'var(--color-text)',
                fontWeight:activeMoods.includes(mood.label)?700:400,
                transition:'all .15s'}}>
              {mood.label}
            </button>
          ))}
        </div>
      )}

      {showDetail && (
        <div style={{border:'1px solid var(--color-brand-border)',borderRadius:8,padding:'14px',marginBottom:12,marginTop:-4,background:'var(--color-bg)'}}>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>ジャンル</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>setGenre('')} className={pillCls(!genre)} style={pill(!genre)}>すべて</button>
              {GENRES.map(g => (
                <button key={g} onClick={()=>setGenre(genre===g?'':g)} className={pillCls(genre===g)} style={pill(genre===g)}>{g}</button>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',gap:12,marginBottom:12}}>
            <div>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>作品の長さ</div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>setType('')}    className={pillCls(!type)} style={pill(!type)}>すべて</button>
                <button onClick={()=>setType(type==='長編'?'':'長編')} className={pillCls(type==='長編')} style={pill(type==='長編')}>長編</button>
                <button onClick={()=>setType(type==='短編'?'':'短編')} className={pillCls(type==='短編')} style={pill(type==='短編')}>短編</button>
                <button onClick={()=>setType(type==='WEBTOON'?'':'WEBTOON')} className={pillCls(type==='WEBTOON')} style={pill(type==='WEBTOON')}>WEBTOON</button>
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>文字数</div>
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                <input type="number" min="0" value={charMin} onChange={e=>setCharMin(e.target.value)} placeholder="下限なし" style={{width:110,padding:'7px 10px',borderRadius:8,border:'1px solid var(--color-brand-border)',background:'var(--color-bg-card)',color:'var(--color-text)',fontSize:13,outline:'none'}}/>
                <span style={{fontSize:12,color:'var(--color-text-muted)'}}>〜</span>
                <input type="number" min="0" value={charMax} onChange={e=>setCharMax(e.target.value)} placeholder="上限なし" style={{width:110,padding:'7px 10px',borderRadius:8,border:'1px solid var(--color-brand-border)',background:'var(--color-bg-card)',color:'var(--color-text)',fontSize:13,outline:'none'}}/>
                <span style={{fontSize:11,color:'var(--color-text-faint)'}}>文字</span>
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>ポイント</div>
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                <input type="number" min="0" value={ptMin} onChange={e=>setPtMin(e.target.value)} placeholder="下限なし" style={{width:110,padding:'7px 10px',borderRadius:8,border:'1px solid var(--color-brand-border)',background:'var(--color-bg-card)',color:'var(--color-text)',fontSize:13,outline:'none'}}/>
                <span style={{fontSize:12,color:'var(--color-text-muted)'}}>〜</span>
                <input type="number" min="0" value={ptMax} onChange={e=>setPtMax(e.target.value)} placeholder="上限なし" style={{width:110,padding:'7px 10px',borderRadius:8,border:'1px solid var(--color-brand-border)',background:'var(--color-bg-card)',color:'var(--color-text)',fontSize:13,outline:'none'}}/>
                <span style={{fontSize:11,color:'var(--color-text-faint)'}}>pt</span>
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>連載状況</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <button onClick={()=>setSerial('')}                          className={pillCls(!serial)} style={pill(!serial)}>すべて</button>
                <button onClick={()=>setSerial(serial==='serial'?'':'serial')}     className={pillCls(serial==='serial')} style={pill(serial==='serial')}>連載中</button>
                <button onClick={()=>setSerial(serial==='complete'?'':'complete')} className={pillCls(serial==='complete')} style={pill(serial==='complete')}>完結</button>
              </div>
            </div>
          </div>
          {contests.length > 0 && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>コンテスト</div>
              <div style={{position:'relative',display:'inline-block',minWidth:240,maxWidth:'100%'}}>
                <select value={contestId} onChange={e=>setContestId(e.target.value)}
                  style={{width:'100%',appearance:'none',WebkitAppearance:'none',padding:'8px 36px 8px 12px',borderRadius:8,border:'1px solid var(--color-brand-border)',background:'var(--color-bg-card)',color:contestId?'var(--color-text)':'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>
                  <option value="">指定なし</option>
                  {contests.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <div style={{fontSize:10.5,color:'var(--color-text-faint)',marginTop:4}}>コンテスト参加作品だけを表示します</div>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>タグ</div>
            <div style={{display:'flex',gap:6,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}>
              <input
                onKeyDown={e=>{
                  if(e.key==='Enter'&&(e.target as HTMLInputElement).value.trim()){
                    const v=(e.target as HTMLInputElement).value.trim()
                    if(!tags.includes(v))setTags([...tags,v])
                    ;(e.target as HTMLInputElement).value=''
                  }
                }}
                placeholder="タグを入力してEnter" style={{...inp,width: isMobile ? '100%' : '40%'}}/>
              {tags.length > 0 && (
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {tags.map(t => (
                    <span key={t} style={{display:'inline-flex',alignItems:'center',gap:3,padding:'3px 8px',background:'var(--color-brand)',color:'var(--color-bg-card)',borderRadius:12,fontSize:11,fontWeight:600}}>
                      #{t}
                      <button onClick={()=>setTags(tags.filter(x=>x!==t))} style={{background:'none',border:'none',color:'color-mix(in srgb, var(--base-color-1) 80%, transparent)',cursor:'pointer',padding:'0 2px',fontSize:13,lineHeight:1}}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {KEYWORD_CATEGORIES.map(cat => cat.items).flat().slice(0,25).map(t => (
                <button key={t} type="button" onClick={()=>setTags(tags.includes(t)?tags.filter(x=>x!==t):[...tags,t])}
                  style={{padding:'3px 10px',borderRadius:12,fontSize:11,cursor:'pointer',transition:'all .15s',
                    border:`1px solid ${tags.includes(t)?'var(--color-brand)':'var(--color-brand-border)'}`,
                    background:tags.includes(t)?'var(--color-brand)':'var(--color-bg)',
                    color:tags.includes(t)?'var(--color-bg-card)':'var(--color-text-muted)'}}>
                  #{t}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,marginBottom:6}}>作者名で検索</div>
            <input value={author} onChange={e=>setAuthor(e.target.value)}
              placeholder="作者名を入力..."
              style={{width:'100%',padding:'7px 10px',border:'1.5px solid var(--color-brand-border)',borderRadius:8,fontSize:12,outline:'none'}}/>
          </div>
        </div>
      )}

      {/* S4: 並び順（豊富に） */}
      <div style={{
        display:'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 10 : 0,
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: isMobile ? 'flex-start' : 'space-between',
        marginTop:12,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:600,whiteSpace:'nowrap'}}>並び順</span>
          <select
            value={discoverMode ? 'discover' : sort}
            onChange={e=>{
              if(e.target.value==='discover'){setDiscoverMode(true);setSort('new')}
              else{setDiscoverMode(false);setSort(e.target.value)}
            }}
            style={{
              padding:'6px 32px 6px 12px',
              border:'1.5px solid var(--color-brand-border)',
              borderRadius:8, fontSize:13,
              color:'var(--color-text)',
              background:'var(--color-bg-card)',
              cursor:'pointer', outline:'none',
              fontWeight:500,
              appearance:'auto',
            }}>
            {SORT_OPTIONS.map(({v,l})=>(
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',justifyContent: isMobile ? 'space-between' : 'flex-end'}}>
          {(q||exclude||genre||type||serial||tags.length>0||author) && (
            <button onClick={()=>{setQ('');setExclude('');setGenre('');setType('');setSerial('');setTags([]);setSort('new');setDiscoverMode(false);setAuthor('');router.push('/search')}}
              style={{fontSize:12,color:'var(--color-text-faint)',background:'none',border:'none',cursor:'pointer'}}>
              条件クリア ×
            </button>
          )}
          <button onClick={handleSearch}
            style={{
              padding:'10px 32px',
              background:'var(--color-brand)',color:'var(--color-bg-card)',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer',
              ...(isMobile ? {flex:1} : {}),
            }}>
            この条件で検索する
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
