'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

/**
 * ============================================================
 * 原石航路 Studio
 * WritingSummaryPanel — 執筆の記録を、いつでも見られる場所
 *
 * 月が変わって最初に出る「先月の執筆」は、その月に一度きり。
 * こちらは、作品管理のいちばん上に置いて、いつ開いても見られる。
 *
 * ★ 飾らない。
 *   月初のまとめは、ねぎらうための絵入りの窓。
 *   こちらは毎日見るところなので、数と升目だけにする。
 *   同じ見た目のものが二つあると、どちらも軽くなる。
 *
 * ★ 今月と先月を、その場で切り替えられる。
 *   「今月まだ書けていない」を確かめるのも、ここでできる。
 *
 * ★ 数えるのは「その日に増えた文字数」。
 *   設定で執筆の記録を切っている作品は入らない。
 * ============================================================
 */

interface WorkRow {
    id: string
    title: string
    chars: number
}

interface Month {
    key: string
    label: string
    chars: number
    days: number
    monthDays: number
    firstWeekday: number
    daily: number[]
    bestDay: number
    bestChars: number
    works: WorkRow[]
}

/** 日本時間での "YYYY-MM" */
function monthKeyOf(date: Date) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7)
}

function build(key: string, logs: { novel_id: string; log_date: string; delta: number }[], titles: Map<string, string>): Month {
    const [year, month] = key.split('-').map(Number)
    const monthDays = new Date(year, month, 0).getDate()
    const daily = Array.from({ length: monthDays }, () => 0)
    const perWork = new Map<string, number>()

    for (const log of logs) {
        if (log.delta <= 0 || log.log_date.slice(0, 7) !== key) continue
        const day = Number(log.log_date.slice(8, 10))
        if (!day) continue
        daily[day - 1] += log.delta
        perWork.set(log.novel_id, (perWork.get(log.novel_id) ?? 0) + log.delta)
    }

    let bestDay = 0
    let bestChars = 0
    daily.forEach((one, index) => {
        if (one > bestChars) {
            bestChars = one
            bestDay = index + 1
        }
    })

    return {
        key,
        label: `${year}年${month}月`,
        chars: daily.reduce((sum, one) => sum + one, 0),
        days: daily.filter((one) => one > 0).length,
        monthDays,
        firstWeekday: new Date(year, month - 1, 1).getDay(),
        daily,
        bestDay,
        bestChars,
        works: Array.from(perWork.entries())
            .map(([id, chars]) => ({ id, title: titles.get(id) || '名前のない作品', chars }))
            .sort((a, b) => b.chars - a.chars)
            .slice(0, 3),
    }
}

export default function WritingSummaryPanel() {
    const [months, setMonths] = useState<Month[] | null>(null)
    const [which, setWhich] = useState(0)

    useEffect(() => {
        let alive = true

        void (async () => {
            const supabase = createClient()

            const { data: auth } = await supabase.auth.getUser()
            const userId = auth?.user?.id
            if (!userId) return

            const { data: novels } = await supabase
                .from('novels')
                .select('id, title')
                .eq('author_id', userId)
                .is('deleted_at', null)

            const rows = (novels ?? []) as { id: string; title: string }[]
            if (rows.length === 0) {
                if (alive) setMonths([])
                return
            }

            const titles = new Map(rows.map((row) => [row.id, row.title]))
            const now = new Date()
            const thisKey = monthKeyOf(now)
            const lastKey = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1))

            /*
             * ★ 二か月ぶんだけ読む。
             *   全部読むと、何年も書いている人ほど重くなる。
             */
            const { data: logs } = await supabase
                .from('writing_logs')
                .select('novel_id, log_date, delta')
                .in(
                    'novel_id',
                    rows.map((row) => row.id),
                )
                .gte('log_date', `${lastKey}-01`)

            const list = (logs ?? []) as { novel_id: string; log_date: string; delta: number }[]
            if (!alive) return
            setMonths([build(thisKey, list, titles), build(lastKey, list, titles)])
        })()

        return () => {
            alive = false
        }
    }, [])

    /* 読めていないうちは、場所だけ取らない */
    if (!months || months.length === 0) return null

    const month = months[which]
    const sheets = Math.round(month.chars / 400)

    return (
        <section
            aria-label="執筆の記録"
            style={{
                border: '1px solid var(--color-brand-border, #dfe8ee)',
                borderRadius: 12,
                background: 'var(--color-bg-card, #fff)',
                padding: '16px 18px',
                marginBottom: 14,
            }}
        >
            {/* 見出しと、月の切り替え */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text, #17222b)' }}>執筆の記録</span>
                <span style={{ fontSize: 12.5, color: 'var(--color-text-muted, #71818c)' }}>{month.label}</span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {['今月', '先月'].map((label, index) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => setWhich(index)}
                            style={{
                                fontSize: 12.5,
                                padding: '5px 12px',
                                borderRadius: 7,
                                cursor: 'pointer',
                                border: '1px solid',
                                borderColor: which === index ? 'var(--color-brand, #1f4e6b)' : 'var(--color-line, #e1e9ee)',
                                background: which === index ? 'var(--color-brand, #1f4e6b)' : 'transparent',
                                color: which === index ? '#fff' : 'var(--color-text-muted, #71818c)',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {month.chars === 0 ? (
                <p style={{ margin: '4px 0 6px', fontSize: 13.5, color: 'var(--color-text-muted, #71818c)' }}>
                    {which === 0
                        ? 'まだこの月の記録はありません。一文字でも書けば、ここに残ります。'
                        : 'この月の記録はありません。'}
                </p>
            ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                    {/* 数 */}
                    <div style={{ minWidth: 168 }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted, #71818c)' }}>書いた文字数</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span
                                style={{
                                    fontFamily: '"Hiragino Mincho ProN", garamond, serif',
                                    fontSize: 32,
                                    fontWeight: 700,
                                    color: 'var(--color-brand, #1f4e6b)',
                                    lineHeight: 1.2,
                                }}
                            >
                                {month.chars.toLocaleString()}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--color-text-muted, #71818c)' }}>文字</span>
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.8, color: 'var(--color-text-muted, #71818c)', marginTop: 3 }}>
                            原稿用紙 約{sheets.toLocaleString()} 枚　／　書いた日 {month.days} 日
                            {month.bestDay > 0 && (
                                <>
                                    <br />
                                    いちばん書いた日　{Number(month.key.slice(5))}月{month.bestDay}日（
                                    {month.bestChars.toLocaleString()} 文字）
                                </>
                            )}
                        </div>
                    </div>

                    {/* 升目 */}
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 14px)', gap: 3.5, marginBottom: 4 }}>
                            {['日', '月', '火', '水', '木', '金', '土'].map((one) => (
                                <span key={one} style={{ fontSize: 9, color: '#a4b1ba', textAlign: 'center', lineHeight: 1 }}>
                                    {one}
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 14px)', gap: 3.5 }}>
                            {Array.from({ length: month.firstWeekday }, (_, index) => (
                                <span key={`blank-${index}`} style={{ width: 14, height: 14 }} />
                            ))}
                            {month.daily.map((one, index) => (
                                <span
                                    key={index}
                                    title={`${index + 1}日　${one.toLocaleString()} 文字`}
                                    style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: 3.5,
                                        background:
                                            one > 0
                                                ? `rgba(31, 78, 107, ${0.28 + (one / (month.bestChars || 1)) * 0.72})`
                                                : '#e4ebf0',
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 作品ごと */}
                    {month.works.length > 0 && (
                        <div style={{ flex: 1, minWidth: 230, maxWidth: 420 }}>
                            {month.works.map((work) => (
                                <div
                                    key={work.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        fontSize: 13,
                                        color: 'var(--color-text, #26343d)',
                                        padding: '3px 0',
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 118,
                                            flex: 'none',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {work.title}
                                    </span>
                                    <span style={{ flex: 1, minWidth: 60, height: 6, borderRadius: 999, background: '#eaf0f4' }}>
                                        <span
                                            style={{
                                                display: 'block',
                                                height: '100%',
                                                borderRadius: 999,
                                                width: `${Math.max(6, (work.chars / (month.works[0].chars || 1)) * 100)}%`,
                                                background: 'var(--color-brand, #1f4e6b)',
                                            }}
                                        />
                                    </span>
                                    <span style={{ width: 70, textAlign: 'right', color: 'var(--color-text-muted, #71818c)', flex: 'none' }}>
                                        {work.chars.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}
