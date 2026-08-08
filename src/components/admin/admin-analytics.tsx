'use client'
import { useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ===== 型定義 =====
interface Props {
  // 既存
  genreStats:      { genre: string; count: number; likes: number }[]
  hourlyAccess:    { hour: number; count: number }[]
  topNovels:       { id: string; title: string; views: number; likes: number; genre: string }[]
  contestStats:    { id: string; title: string; entryCount: number; deadline: string | null }[]
  missionStats:    { mission_id: string; count: number }[]
  speechStats:     { used: number; total: number }
  pageViewStats:   { path: string; count: number }[]
  totalPageViews:  number
}

const COLORS = ['var(--color-brand)','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:12,boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
      {label && <div style={{fontWeight:700,color:'#1e293b',marginBottom:4}}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{color:p.color||'#1e293b',display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:p.color}}/>
          {p.name}：<strong>{p.value?.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  )
}

const TAB_LABELS = [
  { id:'genre',    label:'ジャンル人気' },
  { id:'hourly',   label:'時間帯別アクセス' },
  { id:'novels',   label:'作品別ランキング' },
  { id:'contest',  label:'コンテスト応募' },
  { id:'mission',  label:'ミッション達成率' },
  { id:'speech',   label:'読み上げ利用率' },
  { id:'pages',    label:'ページ別アクセス' },
]

const MISSION_LABELS: Record<string,string> = {
  like_3:'いいね3',like_10:'いいね10',like_50:'いいね50',
  bookmark_5:'保存5',comment_1:'初コメント',comment_10:'コメント10',
  discover_1:'初拡散',discover_3:'拡散3',discover_10:'拡散10',
  novel_1:'デビュー',novel_3:'多作家',episode_5:'連載',episode_20:'長編',
  follow_1:'フォロー1',follow_5:'フォロー5',
  quest_june_2026:'6月クエスト',
}

export default function AdminAnalytics({
  genreStats, hourlyAccess, topNovels, contestStats,
  missionStats, speechStats, pageViewStats, totalPageViews,
}: Props) {
  const [tab, setTab] = useState('genre')

  const tabBtn = (id: string) => ({
    padding:'6px 12px', borderRadius:8, border:'1px solid',
    fontSize:12, fontWeight:600 as const, cursor:'pointer' as const,
    background: tab===id ? 'var(--color-brand)' : 'var(--base-color-1)',
    color: tab===id ? 'var(--base-color-1)' : '#64748b',
    borderColor: tab===id ? 'var(--color-brand)' : '#e2e8f0',
    whiteSpace:'nowrap' as const,
  })

  return (
    <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,padding:'20px',marginBottom:20}}>
      <div style={{fontSize:14,fontWeight:700,color:'#1e293b',marginBottom:14}}>詳細分析</div>

      {/* タブ */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:18,paddingBottom:14,borderBottom:'1px solid #f1f5f9'}}>
        {TAB_LABELS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={tabBtn(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ===== ジャンル人気 ===== */}
      {tab==='genre' && (
        <div>
          <div style={{fontSize:12,color:'#64748b',marginBottom:12}}>公開作品のジャンル分布（作品数・いいね数）</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',marginBottom:8}}>作品数</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={genreStats} dataKey="count" nameKey="genre" cx="50%" cy="50%" outerRadius={80} label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(0)}%`} labelLine={false}>
                    {genreStats.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v:any,n:any)=>[v,n]}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',marginBottom:8}}>ジャンル別いいね数</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...genreStats].sort((a,b)=>b.likes-a.likes)} layout="vertical" margin={{left:40,right:10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis type="number" tick={{fontSize:9,fill:'#94a3b8'}}/>
                  <YAxis type="category" dataKey="genre" tick={{fontSize:10,fill:'#1e293b'}} width={60}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="likes" name="いいね数" fill="var(--color-brand)" radius={[0,3,3,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* 一覧表 */}
          <table style={{width:'100%',borderCollapse:'collapse',marginTop:14,fontSize:12}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                {['ジャンル','作品数','いいね数','平均いいね'].map(h=>(
                  <th key={h} style={{padding:'7px 12px',textAlign:'left',color:'#64748b',fontWeight:600,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...genreStats].sort((a,b)=>b.count-a.count).map((g,i)=>(
                <tr key={g.genre} style={{borderBottom:'1px solid #f1f5f9',background:i%2===0?'var(--base-color-1)':'#fafafa'}}>
                  <td style={{padding:'7px 12px',fontWeight:600,color:'#1e293b'}}>{g.genre}</td>
                  <td style={{padding:'7px 12px',color:'#3b82f6',fontWeight:700}}>{g.count}</td>
                  <td style={{padding:'7px 12px',color:'var(--color-brand)',fontWeight:700}}>{g.likes.toLocaleString()}</td>
                  <td style={{padding:'7px 12px',color:'#64748b'}}>{g.count>0?(g.likes/g.count).toFixed(1):0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== 時間帯別アクセス ===== */}
      {tab==='hourly' && (
        <div>
          <div style={{fontSize:12,color:'#64748b',marginBottom:12}}>過去30日間の時間帯別ページビュー（話ページ）</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyAccess} margin={{top:10,right:10,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="hour" tick={{fontSize:10,fill:'#94a3b8'}} tickFormatter={h=>`${h}時`}/>
              <YAxis tick={{fontSize:9,fill:'#94a3b8'}} allowDecimals={false}/>
              <Tooltip content={<CustomTooltip/>} labelFormatter={h=>`${h}時台`}/>
              <Bar dataKey="count" name="PV数" fill="#3b82f6" radius={[3,3,0,0]}>
                {hourlyAccess.map((d,i)=>{
                  const peak = Math.max(...hourlyAccess.map(h=>h.count))
                  return <Cell key={i} fill={d.count===peak?'var(--color-brand)':d.count>peak*0.7?'#f59e0b':'#3b82f6'}/>
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* ピーク時間帯 */}
          {(() => {
            const peak = hourlyAccess.reduce((a,b)=>a.count>b.count?a:b,{hour:0,count:0})
            const total = hourlyAccess.reduce((s,d)=>s+d.count,0)
            return (
              <div style={{display:'flex',gap:16,marginTop:12,padding:'12px 16px',background:'#f8fafc',borderRadius:8,fontSize:12}}>
                <div><span style={{color:'#64748b'}}>ピーク時間：</span><strong style={{color:'var(--color-brand)'}}>{peak.hour}時台</strong>（{peak.count.toLocaleString()} PV）</div>
                <div><span style={{color:'#64748b'}}>合計PV：</span><strong style={{color:'#3b82f6'}}>{total.toLocaleString()}</strong></div>
                <div><span style={{color:'#64748b'}}>深夜帯(0〜5時)：</span><strong>{hourlyAccess.filter(h=>h.hour<6).reduce((s,h)=>s+h.count,0).toLocaleString()} PV</strong></div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ===== 作品別ランキング ===== */}
      {tab==='novels' && (
        <div>
          <div style={{fontSize:12,color:'#64748b',marginBottom:12}}>閲覧数・いいね数 TOP20作品</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:16}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',marginBottom:8}}>閲覧数TOP10</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...topNovels].sort((a,b)=>b.views-a.views).slice(0,10)} layout="vertical" margin={{left:0,right:20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis type="number" tick={{fontSize:9,fill:'#94a3b8'}}/>
                  <YAxis type="category" dataKey="title" tick={{fontSize:9,fill:'#1e293b'}} width={80} tickFormatter={t=>t.length>10?t.slice(0,10)+'…':t}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="views" name="閲覧数" fill="#3b82f6" radius={[0,3,3,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',marginBottom:8}}>いいね数TOP10</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...topNovels].sort((a,b)=>b.likes-a.likes).slice(0,10)} layout="vertical" margin={{left:0,right:20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis type="number" tick={{fontSize:9,fill:'#94a3b8'}}/>
                  <YAxis type="category" dataKey="title" tick={{fontSize:9,fill:'#1e293b'}} width={80} tickFormatter={t=>t.length>10?t.slice(0,10)+'…':t}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="likes" name="いいね数" fill="var(--color-brand)" radius={[0,3,3,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                {['#','タイトル','ジャンル','閲覧数','いいね数'].map(h=>(
                  <th key={h} style={{padding:'7px 12px',textAlign:'left',color:'#64748b',fontWeight:600,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...topNovels].sort((a,b)=>b.views-a.views).map((n,i)=>(
                <tr key={n.id} style={{borderBottom:'1px solid #f1f5f9',background:i%2===0?'var(--base-color-1)':'#fafafa'}}>
                  <td style={{padding:'7px 12px',color:'#94a3b8',fontWeight:700}}>{i+1}</td>
                  <td style={{padding:'7px 12px',color:'#1e293b',fontWeight:600,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.title}</td>
                  <td style={{padding:'7px 12px'}}><span style={{fontSize:10,background:'var(--color-brand-light)',color:'var(--color-brand)',padding:'1px 6px',borderRadius:3}}>{n.genre}</span></td>
                  <td style={{padding:'7px 12px',color:'#3b82f6',fontWeight:700}}>{n.views.toLocaleString()}</td>
                  <td style={{padding:'7px 12px',color:'var(--color-brand)',fontWeight:700}}>{n.likes.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== コンテスト応募状況 ===== */}
      {tab==='contest' && (
        <div>
          <div style={{fontSize:12,color:'#64748b',marginBottom:12}}>コンテストごとの応募数</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={contestStats} margin={{top:10,right:10,left:-20,bottom:40}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="title" tick={{fontSize:9,fill:'#94a3b8'}} angle={-20} textAnchor="end" interval={0} tickFormatter={t=>t.length>12?t.slice(0,12)+'…':t}/>
              <YAxis tick={{fontSize:9,fill:'#94a3b8'}} allowDecimals={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="entryCount" name="応募数" fill="#8b5cf6" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <table style={{width:'100%',borderCollapse:'collapse',marginTop:14,fontSize:12}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                {['コンテスト名','締切','応募数','状態'].map(h=>(
                  <th key={h} style={{padding:'7px 12px',textAlign:'left',color:'#64748b',fontWeight:600,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...contestStats].sort((a,b)=>b.entryCount-a.entryCount).map((c,i)=>{
                const now = new Date()
                const dl  = c.deadline ? new Date(c.deadline) : null
                const status = !dl ? '募集中' : dl > now ? '募集中' : '終了'
                return (
                  <tr key={c.id} style={{borderBottom:'1px solid #f1f5f9',background:i%2===0?'var(--base-color-1)':'#fafafa'}}>
                    <td style={{padding:'7px 12px',fontWeight:600,color:'#1e293b'}}>{c.title}</td>
                    <td style={{padding:'7px 12px',color:'#64748b'}}>{dl?dl.toLocaleDateString('ja-JP'):'未設定'}</td>
                    <td style={{padding:'7px 12px',color:'#8b5cf6',fontWeight:700}}>{c.entryCount}作品</td>
                    <td style={{padding:'7px 12px'}}>
                      <span style={{fontSize:10,background:status==='募集中'?'#f0fdf4':'#f1f5f9',color:status==='募集中'?'#15803d':'#94a3b8',padding:'2px 8px',borderRadius:6,fontWeight:600}}>
                        {status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== ミッション達成率 ===== */}
      {tab==='mission' && (
        <div>
          <div style={{fontSize:12,color:'#64748b',marginBottom:12}}>ミッション別クリアユーザー数（全登録ユーザー中）</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={missionStats.map(m=>({...m,label:MISSION_LABELS[m.mission_id]||m.mission_id}))}
              layout="vertical" margin={{left:70,right:30}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis type="number" tick={{fontSize:9,fill:'#94a3b8'}} allowDecimals={false}/>
              <YAxis type="category" dataKey="label" tick={{fontSize:10,fill:'#1e293b'}} width={68}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="count" name="クリア数" radius={[0,3,3,0]}>
                {missionStats.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{marginTop:14,display:'flex',flexWrap:'wrap',gap:8}}>
            {[...missionStats].sort((a,b)=>b.count-a.count).map(m=>(
              <div key={m.mission_id} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:11}}>
                <div style={{color:'#64748b',marginBottom:2}}>{MISSION_LABELS[m.mission_id]||m.mission_id}</div>
                <div style={{fontWeight:700,color:'var(--color-brand)',fontSize:16}}>{m.count}<span style={{fontSize:11,fontWeight:400,color:'#64748b'}}> 人</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 読み上げ利用率 ===== */}
      {tab==='speech' && (
        <div>
          <div style={{fontSize:12,color:'#64748b',marginBottom:16}}>「聴く β」機能の利用状況（読み上げ位置保存数ベース）</div>
          <div style={{display:'flex',gap:20,marginBottom:20}}>
            {/* 円グラフ */}
            <div style={{flex:1}}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      {name:'利用あり',value:speechStats.used},
                      {name:'未利用',value:Math.max(0,speechStats.total-speechStats.used)},
                    ]}
                    dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={50}
                    label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(0)}%`}
                  >
                    <Cell fill="var(--color-brand)"/>
                    <Cell fill="#e2e8f0"/>
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* 数値 */}
            <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',gap:12}}>
              {[
                {label:'総ユーザー数',value:speechStats.total,color:'#1e293b'},
                {label:'読み上げ利用者',value:speechStats.used,color:'var(--color-brand)'},
                {label:'利用率',value:`${speechStats.total>0?((speechStats.used/speechStats.total)*100).toFixed(1):0}%`,color:'#3b82f6'},
                {label:'未利用',value:Math.max(0,speechStats.total-speechStats.used),color:'#94a3b8'},
              ].map(item=>(
                <div key={item.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',background:'#f8fafc',borderRadius:8}}>
                  <span style={{fontSize:12,color:'#64748b'}}>{item.label}</span>
                  <span style={{fontSize:18,fontWeight:700,color:item.color}}>{typeof item.value==='number'?item.value.toLocaleString():item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{padding:'12px 16px',background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:8,fontSize:12,color:'#77706A',lineHeight:1.7}}>
            ※ 読み上げ位置の localStorage 保存回数をベースに集計しています。<br/>
            利用率が高ければ有料AI音声（OpenAI TTS等）への移行を検討してください。
          </div>
        </div>
      )}

      {/* ===== ページ別アクセス（離脱率） ===== */}
      {tab==='pages' && (
        <div>
          <div style={{fontSize:12,color:'#64748b',marginBottom:12}}>
            ページ別PV（総PV：{totalPageViews.toLocaleString()}）
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pageViewStats.slice(0,15)} layout="vertical" margin={{left:100,right:30}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis type="number" tick={{fontSize:9,fill:'#94a3b8'}}/>
              <YAxis type="category" dataKey="path" tick={{fontSize:9,fill:'#1e293b'}} width={98}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="count" name="PV数" fill="#10b981" radius={[0,3,3,0]}>
                {pageViewStats.slice(0,15).map((_,i)=><Cell key={i} fill={i===0?'var(--color-brand)':i<3?'#f59e0b':'#10b981'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <table style={{width:'100%',borderCollapse:'collapse',marginTop:14,fontSize:12}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                {['#','ページ','PV数','シェア'].map(h=>(
                  <th key={h} style={{padding:'7px 12px',textAlign:'left',color:'#64748b',fontWeight:600,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageViewStats.map((p,i)=>(
                <tr key={p.path} style={{borderBottom:'1px solid #f1f5f9',background:i%2===0?'var(--base-color-1)':'#fafafa'}}>
                  <td style={{padding:'7px 12px',color:'#94a3b8',fontWeight:700}}>{i+1}</td>
                  <td style={{padding:'7px 12px',color:'#1e293b',fontFamily:'monospace',fontSize:11}}>{p.path}</td>
                  <td style={{padding:'7px 12px',color:'#10b981',fontWeight:700}}>{p.count.toLocaleString()}</td>
                  <td style={{padding:'7px 12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{flex:1,height:4,background:'#f1f5f9',borderRadius:2,overflow:'hidden',minWidth:60}}>
                        <div style={{height:'100%',background:i===0?'var(--color-brand)':'#10b981',borderRadius:2,width:`${totalPageViews>0?(p.count/totalPageViews*100):0}%`}}/>
                      </div>
                      <span style={{fontSize:11,color:'#64748b',whiteSpace:'nowrap'}}>{totalPageViews>0?(p.count/totalPageViews*100).toFixed(1):0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
