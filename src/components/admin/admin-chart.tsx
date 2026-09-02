'use client'
import { useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

/*
 * 1日ぶんの数。
 *
 * 前は users（登録者ぜんぶ）と novels（投稿）の2本だった。
 * 登録した人が読み手なのか書き手なのかが分からず、
 * 「誰が増えているのか」が読み取れなかった。
 *
 * マイページの設定（home_mode）で分けて数える。
 */
interface DayData { date: string; readers: number; authors: number; novels: number }
interface Props {
  data30: DayData[]; data180: DayData[]
  data365: DayData[]; data1825: DayData[]
  /** 上の期間の選び方に合わせて、最初に開く範囲を決める */
  initialPeriod?: Period
}

type Period    = '30' | '180' | '365' | '1825'
type ChartType = 'bar' | 'line'
type DataMode  = 'daily' | 'cumulative'

const PERIODS: { value: Period; label: string }[] = [
  { value: '30',   label: '1ヶ月' },
  { value: '180',  label: '半年' },
  { value: '365',  label: '1年' },
  { value: '1825', label: '5年' },
]

function toCumulative(data: DayData[]): DayData[] {
  let cr = 0, ca = 0, cn = 0
  return data.map(d => {
    cr += d.readers; ca += d.authors; cn += d.novels
    return { date: d.date, readers: cr, authors: ca, novels: cn }
  })
}

// 期間ごとにデータを集約（n日ごとにまとめる）
function aggregate(data: DayData[], step: number): DayData[] {
  const result: DayData[] = []
  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step)
    result.push({
      date: chunk[0].date,
      readers: chunk.reduce((s, d) => s + d.readers, 0),
      authors: chunk.reduce((s, d) => s + d.authors, 0),
      novels:  chunk.reduce((s, d) => s + d.novels,  0),
    })
  }
  return result
}

// 期間ごとの集約ステップ
const AGG_STEPS: Record<Period, number> = {
  '30': 1, '180': 7, '365': 14, '1825': 30
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:12,boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
      <div style={{fontWeight:700,color:'#1e293b',marginBottom:4}}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{color:p.color,display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:p.color}}/>
          {p.name}：<strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function AdminChart({ data30, data180, data365, data1825, initialPeriod }: Props) {
  const [period,    setPeriod]    = useState<Period>(initialPeriod ?? '30')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [dataMode,  setDataMode]  = useState<DataMode>('daily')

  const rawMap: Record<Period, DayData[]> = { '30': data30, '180': data180, '365': data365, '1825': data1825 }
  const raw        = rawMap[period]
  const aggregated = aggregate(raw, AGG_STEPS[period])
  const data       = dataMode === 'cumulative' ? toCumulative(aggregated) : aggregated

  const totalUsers  = raw.reduce((s, d) => s + d.readers + d.authors, 0)
  const totalNovels = raw.reduce((s, d) => s + d.novels, 0)

  const tabStyle = (active: boolean) => ({
    padding:'4px 10px', borderRadius:6, border:'none', fontSize:11, fontWeight:600 as const, cursor:'pointer' as const,
    background: active ? 'var(--base-color-1)' : 'transparent',
    color: active ? 'var(--color-brand)' : '#64748b',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  })

  const ChartComp = chartType === 'bar' ? BarChart : LineChart

  return (
    <div style={{background:'var(--color-bg-card)',border:'1px solid #e2e8f0',borderRadius:12,padding:'20px',marginBottom:20}}>
      {/* ヘッダー */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
        <div style={{fontSize:14,fontWeight:700,color:'#1e293b'}}>登録者数・投稿数の推移</div>
        {/*
            * 押し具は 3 つの群に分ける。
            * 群の間を広く、群の中を詰める。
            * 同じ間隔で 8 個並ぶと、どこで意味が変わるか分からない。
            */}
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          {/* 新規/累計 */}
          <div style={{display:'flex',gap:2,background:'var(--admin-bg)',borderRadius:9,padding:3}}>
            <button style={tabStyle(dataMode==='daily')}    onClick={()=>setDataMode('daily')}>新規</button>
            <button style={tabStyle(dataMode==='cumulative')} onClick={()=>setDataMode('cumulative')}>累計</button>
          </div>
          {/* 期間 */}
          <div style={{display:'flex',gap:2,background:'var(--admin-bg)',borderRadius:9,padding:3}}>
            {PERIODS.map(p => (
              <button key={p.value} style={tabStyle(period===p.value)} onClick={()=>setPeriod(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          {/* グラフ種別 */}
          <div style={{display:'flex',gap:2,background:'var(--admin-bg)',borderRadius:9,padding:3}}>
            <button style={tabStyle(chartType==='bar')}  onClick={()=>setChartType('bar')}>棒</button>
            <button style={tabStyle(chartType==='line')} onClick={()=>setChartType('line')}>折れ線</button>
          </div>
        </div>
      </div>

      {/* グラフ */}
      <ResponsiveContainer width="100%" height={200}>
        <ChartComp data={data} margin={{top:10,right:10,left:-20,bottom:20}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
          <XAxis
            dataKey="date"
            tick={{fontSize:9,fill:'#94a3b8'}}
            interval="preserveStartEnd"
          />
          <YAxis tick={{fontSize:9,fill:'#94a3b8'}} allowDecimals={false}/>
          <Tooltip content={<CustomTooltip/>}/>
          <Legend
            formatter={(value) =>
              value === 'readers' ? '読者登録'
              : value === 'authors' ? '作者登録'
              : '新規投稿'}
            wrapperStyle={{fontSize:11}}
          />
          {chartType === 'bar' ? (
            <>
              {/*
                * 読者と作者は積み上げる。
                * 並べると「登録がいくつあったか」を
                * 2 本足して読むことになる。
                */}
              <Bar dataKey="readers" name="readers" stackId="join" fill="#2563eb" radius={[0,0,0,0]}/>
              <Bar dataKey="authors" name="authors" stackId="join" fill="#d97706" radius={[2,2,0,0]}/>
              <Bar dataKey="novels"  name="novels"  fill="#10b981" radius={[2,2,0,0]}/>
            </>
          ) : (
            <>
              <Line dataKey="readers" name="readers" stroke="#2563eb" strokeWidth={2} dot={false}/>
              <Line dataKey="authors" name="authors" stroke="#d97706" strokeWidth={2} dot={false}/>
              <Line dataKey="novels"  name="novels"  stroke="#10b981" strokeWidth={2} dot={false}/>
            </>
          )}
        </ChartComp>
      </ResponsiveContainer>

      {/* 合計 */}
      <div style={{display:'flex',gap:16,marginTop:8,paddingTop:12,borderTop:'1px solid #f1f5f9',fontSize:12,color:'#64748b'}}>
        期間合計：
        <strong style={{color:'#3b82f6'}}>{totalUsers}人登録</strong>
        <strong style={{color:'#10b981'}}>{totalNovels}作品投稿</strong>
      </div>
    </div>
  )
}
