/**
 * ============================================================
 * 原石航路 Studio
 * AdminSideCards — 図の横に置く2枚
 *
 *   ユーザー属性    執筆向け／読者向けの割合
 *   人気ジャンル    作品数の多い順に5つ
 *
 * 図と並べて置く。数字だけでは、全体の中で
 * どれくらいの割合なのかが分からない。
 *
 * ★ 絵の部品は入れていない。
 *   SVG を直に書いている。図のためだけに
 *   新しい仕組みを増やしたくない。
 * ============================================================
 */

/** 輪の色。意味のある2色だけに絞る */
const DONUT_COLORS = ['var(--admin-stat-blue)', 'var(--admin-stat-amber)']

export function UserDonut({
    authorCount,
    readerCount,
}: {
    authorCount: number
    readerCount: number
}) {
    const total = authorCount + readerCount
    const parts = [
        { label: '執筆向け', value: authorCount },
        { label: '読者向け', value: readerCount },
    ]

    /*
     * 輪は太さのある円で描く。
     *
     * 円周の長さを 100 として、各色に割り当てる。
     * stroke-dasharray に「出す長さ, 隠す長さ」を渡すと、
     * その割合だけ線が出る。
     */
    const radius = 50
    const circumference = 2 * Math.PI * radius

    let offset = 0

    return (
        <div style={{
            background:'var(--admin-bg-card)',
            border:'1px solid var(--admin-border)',
            borderRadius:12,
            padding:'18px 20px',
            height:'100%',
        }}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--admin-text)',marginBottom:14}}>
                ユーザー属性
            </div>

            {total === 0 ? (
                <p style={{fontSize:12,color:'var(--admin-text-faint)'}}>まだ利用者がいません</p>
            ) : (
                <div style={{display:'flex',alignItems:'center',gap:18,flexWrap:'wrap'}}>
                    <div style={{position:'relative',width:138,height:138,flexShrink:0}}>
                        <svg width="138" height="138" viewBox="0 0 138 138">
                            {parts.map((part, i) => {
                                const ratio = part.value / total
                                const dash = circumference * ratio
                                const el = (
                                    <circle
                                        key={part.label}
                                        cx="69" cy="69" r={radius}
                                        fill="none"
                                        stroke={DONUT_COLORS[i]}
                                        strokeWidth="17"
                                        strokeDasharray={`${dash} ${circumference - dash}`}
                                        strokeDashoffset={-offset}
                                        /* 12時の位置から時計回りに始める */
                                        transform="rotate(-90 69 69)"
                                    />
                                )
                                offset += dash
                                return el
                            })}
                        </svg>

                        {/* 真ん中に総数。輪だけでは実数が分からない */}
                        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
                            alignItems:'center',justifyContent:'center'}}>
                            <div style={{fontSize:10.5,color:'var(--admin-text-faint)'}}>総ユーザー</div>
                            <div style={{fontSize:22,fontWeight:800,color:'var(--admin-text)'}}>
                                {total.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:0}}>
                        {parts.map((part, i) => (
                            <div key={part.label} style={{display:'flex',alignItems:'center',gap:8}}>
                                <span style={{width:10,height:10,borderRadius:3,background:DONUT_COLORS[i],flexShrink:0}} />
                                {/* 名前の幅をそろえる。数字の桁が縦に並ぶ */}
                                <span style={{fontSize:12,color:'var(--admin-text-muted)',width:56,flexShrink:0}}>
                                    {part.label}
                                </span>
                                <span style={{fontSize:13,fontWeight:700,color:'var(--admin-text)',minWidth:52,textAlign:'right'}}>
                                    {part.value.toLocaleString()}人
                                </span>
                                <span style={{fontSize:11.5,color:'var(--admin-text-faint)',minWidth:34,textAlign:'right'}}>
                                    {Math.round((part.value / total) * 100)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export function GenreRanking({
    items,
}: {
    items: { genre: string; count: number }[]
}) {
    return (
        <div style={{
            background:'var(--admin-bg-card)',
            border:'1px solid var(--admin-border)',
            borderRadius:12,
            padding:'18px 20px',
            height:'100%',
        }}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--admin-text)',marginBottom:14}}>
                人気ジャンル TOP5
            </div>

            {items.length === 0 ? (
                <p style={{fontSize:12,color:'var(--admin-text-faint)'}}>まだ作品がありません</p>
            ) : (
                <div style={{display:'flex',flexDirection:'column',gap:11}}>
                    {items.map((item, i) => (
                        <div key={item.genre} style={{display:'flex',alignItems:'center',gap:10}}>
                            {/*
                              * 順位。1位だけ濃くする。
                              * 全部同じ濃さだと、順位が目に入らない。
                              */}
                            <span style={{
                                width:22,height:22,borderRadius:'50%',flexShrink:0,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                fontSize:11,fontWeight:700,
                                background: i === 0 ? 'var(--admin-stat-blue)' : 'var(--admin-bg)',
                                color: i === 0 ? '#fff' : 'var(--admin-text-muted)',
                            }}>
                                {i + 1}
                            </span>
                            <span style={{fontSize:12.5,color:'var(--admin-text)',flex:1,
                                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                {item.genre}
                            </span>
                            <span style={{fontSize:12.5,fontWeight:700,color:'var(--admin-text)',flexShrink:0}}>
                                {item.count.toLocaleString()}件
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
