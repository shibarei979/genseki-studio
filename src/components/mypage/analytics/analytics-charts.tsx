'use client'
import { useState } from 'react'

interface EpisodeRow {
  ep_number: number
  title: string
  views: number
  likes: number
  comments: number
  created_at: string
}
interface NovelStat {
  id: string
  title: string
  genre: string
  published: boolean
  views: number
  viewsToday: number
  viewsYesterday: number
  viewsWeek: number
  viewsMonth: number
  likes: number
  bookmarks: number
  comments: number
  uniqueCount: number
  hourlyToday: number[]
  hourlyYesterday: number[]
  daily7: { date: string; views: number; m?: number; d?: number; a?: number }[]
  /** 1か月。30日ぶんを1日ずつ */
  daily30?: { date: string; views: number; m?: number; d?: number; a?: number }[]
  /** 1年。1年を30に分けたもの */
  yearly30?: { date: string; views: number; m?: number; d?: number; a?: number }[]
  /** 総合。1年ずつ */
  allYears?: { date: string; views: number; m?: number; d?: number; a?: number }[]
  dailyTop: { date: string; views: number; m?: number; d?: number; a?: number }[]
  monthlyTop: { month: string; views: number; m?: number; d?: number; a?: number }[]
  episodeRows: EpisodeRow[]
  commentList: { body: string; author: string; created_at: string; episode_title: string; rating?: number | null }[]
}

/**
 * 昨日との差。
 *
 * どちらも 0 のときに「0%」と出すと、
 * 減ったのか動きが無いのか分からないので「—」にする。
 */
function diffLabel(today: number, yesterday: number): string {
  if (yesterday === 0) return today === 0 ? '—' : '+100%'
  const ratio = Math.round(((today - yesterday) / yesterday) * 100)
  return ratio > 0 ? `+${ratio}%` : `${ratio}%`
}

const RANGES: { key: 'month'|'year'|'all'; label: string }[] = [
  { key:'month', label:'1か月' },
  { key:'year',  label:'1年' },
  { key:'all',   label:'総合' },
]

export default function AnalyticsCharts({
  novels,
  deviceStats,
}: {
  novels: NovelStat[]
  /** 端末ごとの数。右の柱の末尾に添える */
  deviceStats?: { desktopPv: number; mobilePv: number; desktopUsers: number; mobileUsers: number }
}) {
  const [selectedId, setSelectedId] = useState(novels[0]?.id || '')
  const [range, setRange] = useState<'month'|'year'|'all'>('month')
  const selected = novels.find(n => n.id === selectedId) || novels[0]
  if (!selected) return null

  /* 選んだ期間の並びと合計 */
  const rangeData =
    range === 'month' ? (selected.daily30 ?? selected.daily7)
    : range === 'year' ? (selected.yearly30 ?? [])
    : (selected.allYears ?? [])

  const rangeTotal = rangeData.reduce((sum, row) => sum + row.views, 0)

  return (
    <div>
      {/* 作品選択（ドロップダウン） */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,color:'var(--color-text-muted)',fontWeight:600,marginBottom:8}}>作品を選択</div>
        <div style={{position:'relative',display:'inline-block',minWidth:260,maxWidth:'100%'}}>
          <select value={selectedId} onChange={e=>setSelectedId(e.target.value)}
            style={{
              width:'100%',appearance:'none',WebkitAppearance:'none',
              padding:'10px 40px 10px 16px',borderRadius:10,
              border:'1.5px solid var(--color-brand-border)',
              background:'var(--color-bg-card)',color:'var(--color-text)',
              fontSize:14,fontWeight:600,cursor:'pointer',
            }}>
            {novels.map(n => (
              <option key={n.id} value={n.id}>
                {n.title}{n.published===false ? '（非公開）' : ''}
              </option>
            ))}
          </select>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:16,alignItems:'start'}} className="ana-layout">
        {/* 左カラム：グラフ群 */}
        <div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
          {/* 本日の時間帯別 */}
          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'18px'}}>
            {/*
             * 数字を大きく、見出しの下に置く。
             *
             * 「合計 0 PV」と右端に小さく出すより、
             * まず数が目に入るほうが分かりやすい。
             * 右上には昨日との差を添える。
             */}
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>本日のページビュー</div>
                <div style={{display:'flex',alignItems:'baseline',gap:5,marginTop:6}}>
                  <span style={{fontSize:30,fontWeight:700,color:'var(--color-text)',lineHeight:1.1}}>{selected.viewsToday}</span>
                  <span style={{fontSize:12,color:'var(--color-text-muted)'}}>PV</span>
                </div>
              </div>
              <span style={{fontSize:11,color:'var(--color-text-muted)',border:'1px solid var(--color-brand-border)',borderRadius:8,padding:'5px 10px'}}>
                昨日比 {diffLabel(selected.viewsToday, selected.viewsYesterday)}
              </span>
            </div>
            <HourlyChart data={selected.hourlyToday}/>
          </div>

          {/* 昨日の時間帯別 */}
          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'18px'}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>昨日のページビュー</div>
                <div style={{display:'flex',alignItems:'baseline',gap:5,marginTop:6}}>
                  <span style={{fontSize:30,fontWeight:700,color:'var(--color-text)',lineHeight:1.1}}>{selected.viewsYesterday}</span>
                  <span style={{fontSize:12,color:'var(--color-text-muted)'}}>PV</span>
                </div>
              </div>
            </div>
            <HourlyChart data={selected.hourlyYesterday}/>
          </div>

          {/* 直近7日 */}
          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'18px'}}>
            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:6}}>
              <span style={{fontSize:14,fontWeight:700,color:'var(--color-text)'}}>ページビュー</span>
              <span style={{fontSize:13,color:'var(--color-text-muted)'}}>合計 <strong style={{fontSize:18,color:'var(--color-brand)'}}>{rangeTotal}</strong> PV</span>
            </div>

            {/*
             * 期間の切り替え。
             *   1か月  30日ぶんを1日ずつ
             *   1年    1年を30に分けて（1本あたり約12日）
             *   総合   1年ずつ
             * どれも本数を30前後に揃える。365本並べても読めない。
             */}
            <div style={{display:'inline-flex',border:'1px solid var(--color-brand-border)',borderRadius:8,overflow:'hidden',marginBottom:14}}>
              {RANGES.map(r => (
                <button
                  key={r.key}
                  onClick={()=>setRange(r.key)}
                  style={{padding:'6px 14px',fontSize:12,cursor:'pointer',border:'none',
                    fontWeight:range===r.key?700:500,
                    background:range===r.key?'var(--color-brand)':'var(--color-bg-card)',
                    color:range===r.key?'var(--base-color-1)':'var(--color-text-muted)'}}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <DayChart data={rangeData}/>
          </div>
        </div>

        {/* 右カラム：サマリー・上位 */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* 全期間 */}
          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'18px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:14}}>全期間</div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:'var(--color-text-muted)',marginBottom:2}}>累計ページビュー</div>
              <div style={{fontSize:26,fontWeight:700,color:'var(--color-brand)'}}>{selected.views.toLocaleString()} <span style={{fontSize:13,color:'var(--color-text-muted)',fontWeight:400}}>PV</span></div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:'var(--color-text-muted)',marginBottom:2}}>累計ユニークアクセス</div>
              <div style={{fontSize:22,fontWeight:700,color:'var(--color-text)'}}>{selected.uniqueCount.toLocaleString()} <span style={{fontSize:12,color:'var(--color-text-muted)',fontWeight:400}}>人</span></div>
            </div>
            <div style={{borderTop:'1px solid var(--color-brand-light)',paddingTop:12,display:'flex',flexDirection:'column',gap:10}}>
              {[['いいね',selected.likes,'var(--color-danger)'],['保存',selected.bookmarks,'var(--color-brand)'],['コメント',selected.comments,'var(--color-info)']].map(([l,v,c])=>(
                <div key={l as string} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,color:'var(--color-text-muted)'}}>{l as string}</span>
                  <span style={{fontSize:18,fontWeight:700,color:c as string}}>{(v as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 日別上位 */}
          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'18px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:12}}>日別ページビュー上位</div>
            {selected.dailyTop.length === 0 ? (
              <div style={{fontSize:12,color:'var(--color-text-faint)'}}>データがありません</div>
            ) : selected.dailyTop.map((d, i) => (
              <div key={d.date} style={{padding:'6px 0',borderBottom:i<selected.dailyTop.length-1?'1px solid var(--color-brand-light)':'none'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:12,color:'var(--color-text-muted)'}}>{i+1}. {d.date}</span>
                  <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>{d.views} PV</span>
                </div>
                {(d.m||d.d||d.a) ? (
                  <div style={{display:'flex',height:5,borderRadius:3,overflow:'hidden',background:'var(--color-bg)'}}>
                    {(d.m||0)>0 && <div style={{flex:d.m,background:'var(--color-brand)'}}/>}
                    {(d.d||0)>0 && <div style={{flex:d.d,background:'var(--color-info)'}}/>}
                    {(d.a||0)>0 && <div style={{flex:d.a,background:'#cbd5e1'}}/>}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* 月別上位 */}
          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'18px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:12}}>月別ページビュー上位</div>
            {selected.monthlyTop.length === 0 ? (
              <div style={{fontSize:12,color:'var(--color-text-faint)'}}>データがありません</div>
            ) : selected.monthlyTop.map((m, i) => (
              <div key={m.month} style={{padding:'6px 0',borderBottom:i<selected.monthlyTop.length-1?'1px solid var(--color-brand-light)':'none'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:12,color:'var(--color-text-muted)'}}>{i+1}. {m.month}</span>
                  <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>{m.views} PV</span>
                </div>
                {(m.m||m.d||m.a) ? (
                  <div style={{display:'flex',height:5,borderRadius:3,overflow:'hidden',background:'var(--color-bg)'}}>
                    {(m.m||0)>0 && <div style={{flex:m.m,background:'var(--color-brand)'}}/>}
                    {(m.d||0)>0 && <div style={{flex:m.d,background:'var(--color-info)'}}/>}
                    {(m.a||0)>0 && <div style={{flex:m.a,background:'#cbd5e1'}}/>}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        {/* 端末ごとの割合 */}
        {deviceStats && (deviceStats.desktopUsers + deviceStats.mobileUsers) > 0 && (
          <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'18px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:14}}>デバイス別</div>
            <DeviceDonut desktopUsers={deviceStats.desktopUsers} mobileUsers={deviceStats.mobileUsers}/>
          </div>
        )}
        </div>
      </div>

      {/* 話別データ（全幅） */}
      <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden',marginTop:16}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)'}}>
          <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>エピソード別</span>
        </div>

        {selected.episodeRows.length === 0 ? (
          <div style={{padding:'30px',textAlign:'center',color:'var(--color-text-faint)',fontSize:12}}>公開中の話がありません</div>
        ) : (
          <div>
            {/* 見出し。数字だけ並ぶと、何の数か分からない */}
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 18px',borderBottom:'1px solid var(--color-brand-light)',fontSize:11,color:'var(--color-text-muted)'}}>
              <span style={{minWidth:44,flexShrink:0}}>話数</span>
              <span style={{flex:1,minWidth:120}}>エピソードタイトル</span>
              <span style={{minWidth:44,textAlign:'right'}}>いいね</span>
              <span style={{minWidth:44,textAlign:'right'}}>コメント</span>
              <span style={{minWidth:60,textAlign:'right'}}>閲覧</span>
            </div>

            {selected.episodeRows.map((ep, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',borderBottom:i<selected.episodeRows.length-1?'1px solid var(--color-brand-light)':'none',flexWrap:'wrap'}}>
                <span style={{fontSize:11,color:'var(--color-text-muted)',minWidth:44,flexShrink:0}}>{ep.ep_number}話</span>
                <span style={{fontSize:13,fontWeight:600,color:'var(--color-text)',flex:1,minWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ep.title}</span>
                <span style={{fontSize:12,color:'var(--color-text-muted)',whiteSpace:'nowrap',minWidth:44,textAlign:'right'}}>{ep.likes}</span>
                <span style={{fontSize:12,color:'var(--color-text-muted)',whiteSpace:'nowrap',minWidth:44,textAlign:'right'}}>{ep.comments}</span>
                <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)',whiteSpace:'nowrap',minWidth:60,textAlign:'right'}}>{ep.views.toLocaleString()} PV</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* コメント一覧（全幅） */}
      <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden',marginTop:16}}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)',fontSize:13,fontWeight:700,color:'var(--color-text)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span>寄せられたコメント</span>
          <span style={{fontSize:12,color:'var(--color-text-muted)',fontWeight:400}}>{selected.comments}件</span>
        </div>
        {selected.commentList.length === 0 ? (
          /* 何も無いときこそ、そっけなくしない */
          <div style={{padding:'34px 20px',display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div>
              <div style={{fontSize:13,color:'var(--color-text-muted)'}}>まだコメントがありません</div>
              <div style={{fontSize:11,color:'var(--color-text-faint)',marginTop:3}}>最初の感想をお待ちしています。</div>
            </div>
          </div>
        ) : (
          selected.commentList.map((c, i) => (
            <div key={i} style={{padding:'14px 18px',borderBottom:i<selected.commentList.length-1?'1px solid var(--color-brand-light)':'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>{c.author}</span>
                {c.rating && c.rating >= 1 && (
                  <span style={{display:'inline-flex',gap:1}}>
                    {[1,2,3].map(i => <span key={i} style={{fontSize:11,color:i<=(c.rating||0)?'#f5a623':'#ddd'}}>★</span>)}
                  </span>
                )}
                <span style={{fontSize:11,color:'var(--color-brand)',background:'var(--color-brand-light)',padding:'1px 8px',borderRadius:10}}>{c.episode_title}</span>
                <span style={{fontSize:11,color:'var(--color-text-faint)',marginLeft:'auto'}}>{fmtDateShort(c.created_at)}</span>
              </div>
              <div style={{fontSize:13,color:'var(--color-text)',lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{c.body}</div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ana-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function fmtDateShort(s: string) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// 時間帯別（0-23時）
function HourlyChart({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-end',gap:1,height:120,borderBottom:'1px solid var(--color-brand-border)'}}>
        {data.map((v, h) => (
          <div key={h} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%'}} title={`${h}時: ${v}PV`}>
            <div style={{width:'100%',height:`${(v/max)*100}%`,minHeight:v>0?2:0,background:'var(--color-brand)',borderRadius:'2px 2px 0 0'}}/>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:9,color:'var(--color-text-faint)'}}>
        <span>0時</span><span>6時</span><span>12時</span><span>18時</span><span>23時</span>
      </div>
    </div>
  )
}

// 日別
function DayChart({ data }: { data: { date: string; views: number; m?: number; d?: number; a?: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.views))

  /*
   * 目盛りの数。
   *
   * 0 と上限のあいだを 3 つに割る。
   * 棒の高さだけでは「4 なのか 40 なのか」が読めない。
   */
  const ticks = [0, 1, 2, 3].map(i => Math.round((max / 3) * i))
  const uniqueTicks = Array.from(new Set(ticks)).sort((a, b) => b - a)

  /*
   * 日付の間引き。
   *
   * 30 本あると全部は出せない。5 本ごとに出す。
   * 本数が少ないときは全部出す。
   */
  const labelStep = data.length > 14 ? Math.ceil(data.length / 8) : 1

  return (
    <div>
      <div style={{display:'flex',gap:12,marginBottom:10,fontSize:10.5,color:'var(--color-text-muted)',flexWrap:'wrap'}}>
        <span><span style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'var(--color-brand)',marginRight:4}}/>スマホ</span>
        <span><span style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'var(--color-info)',marginRight:4}}/>PC</span>
        <span><span style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#cbd5e1',marginRight:4}}/>未ログイン</span>
      </div>

      <div style={{display:'flex',gap:8}}>
        {/* 目盛りの数字 */}
        <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',height:140,fontSize:10,color:'var(--color-text-faint)',textAlign:'right',minWidth:16}}>
          {uniqueTicks.map(t => <span key={t}>{t}</span>)}
        </div>

        <div style={{flex:1,minWidth:0}}>
          {/* 目盛りの横線。棒の後ろに敷く */}
          <div style={{position:'relative',height:140}}>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
              {uniqueTicks.map(t => (
                <div key={t} style={{borderTop:'1px solid var(--color-brand-light)'}}/>
              ))}
            </div>

            <div style={{position:'relative',display:'flex',alignItems:'flex-end',gap:data.length > 14 ? 3 : 8,height:'100%'}}>
              {data.map((d, i) => {
                const mm = d.m || 0, dd = d.d || 0, aa = d.a || 0
                const legacy = Math.max(0, d.views - mm - dd - aa)
                return (
                  <div
                    key={i}
                    style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%'}}
                    title={`${d.date}: ${d.views}PV（スマホ${mm}・PC${dd}・未ログイン${aa}${legacy>0?`・不明${legacy}`:''}）`}
                  >
                    <div style={{width:'100%',maxWidth:data.length > 14 ? 18 : 40,height:`${(d.views/max)*100}%`,minHeight:d.views>0?3:0,display:'flex',flexDirection:'column',borderRadius:'3px 3px 0 0',overflow:'hidden',margin:'0 auto'}}>
                      {mm>0 && <div style={{flex:mm,background:'var(--color-brand)'}}/>}
                      {dd>0 && <div style={{flex:dd,background:'var(--color-info)'}}/>}
                      {aa>0 && <div style={{flex:aa,background:'#cbd5e1'}}/>}
                      {legacy>0 && <div style={{flex:legacy,background:'#ffd9bd'}}/>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{display:'flex',gap:data.length > 14 ? 3 : 8,marginTop:6}}>
            {data.map((d, i) => (
              <div key={i} style={{flex:1,textAlign:'center',fontSize:9,color:'var(--color-text-faint)',whiteSpace:'nowrap',overflow:'hidden'}}>
                {i % labelStep === 0 ? d.date : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 端末ごとの割合。
 *
 * 表で数字を並べるより、輪のほうが割合が一目で分かる。
 * 中央に合計を置くのは、輪の中の空きを使うため。
 */
export function DeviceDonut({
  desktopUsers, mobileUsers,
}: { desktopUsers: number; mobileUsers: number }) {
  const total = desktopUsers + mobileUsers
  if (total === 0) return null

  const pcRatio = desktopUsers / total
  /* 円の太さと大きさ。conic-gradient で塗り分ける */
  const pcDeg = Math.round(pcRatio * 360)

  const rows = [
    { label:'PC',   count:desktopUsers, color:'var(--color-info)' },
    { label:'スマホ', count:mobileUsers,  color:'var(--color-brand)' },
  ]

  return (
    /* 輪は中央に。左に寄っていると、右の余白が空いて見える */
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
      <div style={{position:'relative',width:104,height:104,flexShrink:0}}>
        <div style={{width:'100%',height:'100%',borderRadius:'50%',
          background:`conic-gradient(var(--color-info) 0deg ${pcDeg}deg, var(--color-brand) ${pcDeg}deg 360deg)`}}/>
        {/* 真ん中を抜いて輪にする */}
        <div style={{position:'absolute',inset:18,borderRadius:'50%',background:'var(--color-bg-card)',
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:10,color:'var(--color-text-muted)'}}>合計</span>
          <span style={{fontSize:14,fontWeight:700,color:'var(--color-text)',lineHeight:1.2}}>{total}人</span>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%'}}>
        {rows.map(row => (
          <div key={row.label} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
            <span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:row.color,flexShrink:0}}/>
            <span style={{color:'var(--color-text-muted)',minWidth:40}}>{row.label}</span>
            <span style={{fontWeight:700,color:'var(--color-text)',marginLeft:'auto'}}>{row.count}人</span>
            <span style={{color:'var(--color-text-faint)',minWidth:46,textAlign:'right'}}>
              （{total > 0 ? Math.round((row.count / total) * 100) : 0}%）
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
