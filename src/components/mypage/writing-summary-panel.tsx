'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

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
 * ★ 月で見るか、年で見るか。
 *   読書のまとめと同じ並べ方にする。
 *   月で見ると「今月は書けているか」、
 *   年で見ると「一年でどれだけ書いたか」が分かる。
 *
 * ★ さかのぼれるのは、一昨年の 1 月まで。
 *   それ以上読むと、長く書いている人ほど開くのが遅くなる。
 *
 * ★ 数えるのは「その日に増えた文字数」。
 *   設定で執筆の記録を切っている作品は入らない。
 * ============================================================
 */

interface Log {
    novel_id: string
    log_date: string
    delta: number
}

interface WorkRow {
    id: string
    title: string
    chars: number
}

interface Period {
    chars: number
    /** 書いた日数 */
    days: number
    /** 月で見るとき＝その月の日数 */
    monthDays: number
    /** 月で見るとき。1 日が何曜日か */
    firstWeekday: number
    /** 月で見るとき＝日ごと、年で見るとき＝月ごと */
    bars: number[]
    /** いちばん書いた日（月のとき）／月（年のとき）。無ければ -1 */
    bestIndex: number
    bestChars: number
    works: WorkRow[]
}

/** 日本時間での "YYYY-MM" */
function monthKeyOf(date: Date) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7)
}

/** その期間ぶんを数える。key は "YYYY-MM" か "YYYY" */
function build(key: string, logs: Log[], titles: Map<string, string>): Period {
    const isYear = key.length === 4
    const year = Number(key.slice(0, 4))
    const month = isYear ? 0 : Number(key.slice(5))
    const monthDays = isYear ? 0 : new Date(year, month, 0).getDate()

    const bars = Array.from({ length: isYear ? 12 : monthDays }, () => 0)
    const perWork = new Map<string, number>()
    const days = new Set<string>()

    for (const log of logs) {
        if (log.delta <= 0) continue
        if (!log.log_date.startsWith(key)) continue

        const index = isYear
            ? Number(log.log_date.slice(5, 7)) - 1
            : Number(log.log_date.slice(8, 10)) - 1
        if (index < 0 || index >= bars.length) continue

        bars[index] += log.delta
        days.add(log.log_date)
        perWork.set(log.novel_id, (perWork.get(log.novel_id) ?? 0) + log.delta)
    }

    let bestIndex = -1
    let bestChars = 0
    bars.forEach((one, index) => {
        if (one > bestChars) {
            bestChars = one
            bestIndex = index
        }
    })

    return {
        chars: bars.reduce((sum, one) => sum + one, 0),
        days: days.size,
        monthDays,
        firstWeekday: isYear ? 0 : new Date(year, month - 1, 1).getDay(),
        bars,
        bestIndex,
        bestChars,
        works: Array.from(perWork.entries())
            .map(([id, chars]) => ({ id, title: titles.get(id) || '名前のない作品', chars }))
            .sort((a, b) => b.chars - a.chars)
            .slice(0, 4),
    }
}

/** 前後の期間の鍵 */
function stepKey(key: string, diff: number) {
    if (key.length === 4) return String(Number(key) + diff)

    const year = Number(key.slice(0, 4))
    const month = Number(key.slice(5))
    const moved = new Date(year, month - 1 + diff, 1)
    return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`
}

function labelOf(key: string) {
    if (key.length === 4) return `${key}年`
    return `${key.slice(0, 4)}年${Number(key.slice(5))}月`
}

export default function WritingSummaryPanel() {
    const [logs, setLogs] = useState<Log[] | null>(null)
    const [titles, setTitles] = useState<Map<string, string>>(new Map())

    /* いま見ている所。"YYYY-MM" か "YYYY" */
    const [at, setAt] = useState(() => monthKeyOf(new Date()))
    const [span, setSpan] = useState<'month' | 'year'>('month')

    /* さかのぼれる下限 */
    const [oldest, setOldest] = useState('')

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
                if (alive) setLogs([])
                return
            }

            const now = new Date()
            const from = `${now.getFullYear() - 2}-01-01`

            const { data } = await supabase
                .from('writing_logs')
                .select('novel_id, log_date, delta')
                .in(
                    'novel_id',
                    rows.map((row) => row.id),
                )
                .gte('log_date', from)

            if (!alive) return
            setTitles(new Map(rows.map((row) => [row.id, row.title])))
            setLogs((data ?? []) as Log[])
            setOldest(from.slice(0, 7))
        })()

        return () => {
            alive = false
        }
    }, [])

    const now = useMemo(() => (logs ? build(at, logs, titles) : null), [logs, at, titles])
    const before = useMemo(
        () => (logs ? build(stepKey(at, -1), logs, titles) : null),
        [logs, at, titles],
    )

    if (!logs || !now) return null

    const thisMonth = monthKeyOf(new Date())
    const isNow = span === 'year' ? at === thisMonth.slice(0, 4) : at === thisMonth
    const canBack = span === 'year' ? at > oldest.slice(0, 4) : at > oldest

    /* 月と年を行き来する。いま見ている所の年を引き継ぐ */
    function changeSpan(next: 'month' | 'year') {
        if (next === span) return
        if (next === 'year') {
            setAt(at.slice(0, 4))
        } else {
            /* その年の今月。違う年なら 12 月から */
            setAt(at === thisMonth.slice(0, 4) ? thisMonth : `${at}-12`)
        }
        setSpan(next)
    }

    const sheets = Math.round(now.chars / 400)
    const diff = now.chars - (before?.chars ?? 0)

    const arrow: CSSProperties = {
        border: '1px solid var(--color-line, #e1e9ee)',
        background: 'none',
        borderRadius: 8,
        width: 28,
        height: 28,
        lineHeight: 1,
        fontSize: 15,
        color: 'var(--color-brand, #1f4e6b)',
        cursor: 'pointer',
    }

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
            {/* 見出しと、送り */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text, #17222b)' }}>執筆の記録</span>
                <span style={{ fontSize: 12.5, color: 'var(--color-text-muted, #71818c)' }}>{labelOf(at)}</span>

                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/*
                     * 月で見るか、年で見るか。
                     * 押し具にせず、字の切り替えにする。送りの矢印より目立たせない。
                     */}
                    <span style={{ display: 'flex', gap: 8 }}>
                        {(['month', 'year'] as const).map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => changeSpan(key)}
                                aria-pressed={span === key}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    color:
                                        span === key
                                            ? 'var(--color-brand, #1f4e6b)'
                                            : 'var(--color-text-faint, #9aa6ae)',
                                    fontWeight: span === key ? 700 : 400,
                                    textDecoration: span === key ? 'none' : 'underline',
                                }}
                            >
                                {key === 'month' ? '月ごと' : '年ごと'}
                            </button>
                        ))}
                    </span>

                    <button
                        type="button"
                        onClick={() => setAt(stepKey(at, -1))}
                        disabled={!canBack}
                        aria-label={span === 'year' ? '前の年' : '前の月'}
                        style={{ ...arrow, opacity: canBack ? 1 : 0.35, cursor: canBack ? 'pointer' : 'default' }}
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        onClick={() => setAt(stepKey(at, 1))}
                        disabled={isNow}
                        aria-label={span === 'year' ? '次の年' : '次の月'}
                        style={{ ...arrow, opacity: isNow ? 0.35 : 1, cursor: isNow ? 'default' : 'pointer' }}
                    >
                        ›
                    </button>
                </span>
            </div>

            {now.chars === 0 ? (
                <p style={{ margin: '4px 0 6px', fontSize: 13.5, color: 'var(--color-text-muted, #71818c)' }}>
                    {isNow
                        ? `まだ${span === 'year' ? 'この年' : 'この月'}の記録はありません。一文字でも書けば、ここに残ります。`
                        : `${span === 'year' ? 'この年' : 'この月'}の記録はありません。`}
                </p>
            ) : (
                <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
                        <div
                            style={{
                                flex: '1 1 380px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: 10,
                            }}
                        >
                            <Figure
                                label="書いた文字数"
                                value={now.chars.toLocaleString()}
                                unit="文字"
                                note={
                                    sheets >= 1
                                        ? `原稿用紙 約${sheets.toLocaleString()} 枚`
                                        : `原稿用紙 1 枚まで あと ${(400 - (now.chars % 400)).toLocaleString()} 文字`
                                }
                                strong
                            />
                            <Figure
                                label="書いた日"
                                value={`${now.days}`}
                                unit={span === 'year' ? '日' : `日 / ${now.monthDays}日`}
                                note={
                                    before && before.chars > 0
                                        ? `${span === 'year' ? '前の年' : '前の月'}より ${diff >= 0 ? '+' : '−'}${Math.abs(diff).toLocaleString()} 文字`
                                        : undefined
                                }
                            />
                            <Figure
                                label={span === 'year' ? 'いちばん書いた月' : 'いちばん書いた日'}
                                value={
                                    now.bestIndex < 0
                                        ? '—'
                                        : span === 'year'
                                          ? `${now.bestIndex + 1}月`
                                          : `${Number(at.slice(5))}月${now.bestIndex + 1}日`
                                }
                                unit=""
                                note={now.bestChars > 0 ? `${now.bestChars.toLocaleString()} 文字` : undefined}
                            />
                        </div>

                        {/* 月は升目、年は十二の棒 */}
                        <div
                            style={{
                                flex: 'none',
                                background: 'var(--color-brand-light, #eef4f8)',
                                borderRadius: 10,
                                padding: '10px 12px',
                            }}
                        >
                            {span === 'year' ? <YearBars bars={now.bars} best={now.bestChars} /> : <MonthCells period={now} />}
                        </div>
                    </div>

                    {/* 作品ごと */}
                    {now.works.length > 0 && (
                        <div style={{ marginTop: 12, borderTop: '1px solid var(--color-line, #e8eef2)', paddingTop: 10 }}>
                            {now.works.map((work) => (
                                <div
                                    key={work.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        fontSize: 13,
                                        color: 'var(--color-text, #26343d)',
                                        padding: '4px 0',
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 170,
                                            flex: 'none',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {work.title}
                                    </span>
                                    <span
                                        style={{
                                            flex: 1,
                                            minWidth: 60,
                                            height: 7,
                                            borderRadius: 999,
                                            background: 'var(--color-brand-light, #eaf0f4)',
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: 'block',
                                                height: '100%',
                                                borderRadius: 999,
                                                width: `${Math.max(5, (work.chars / (now.works[0].chars || 1)) * 100)}%`,
                                                background: 'var(--color-brand, #1f4e6b)',
                                            }}
                                        />
                                    </span>
                                    <span
                                        style={{
                                            width: 84,
                                            textAlign: 'right',
                                            flex: 'none',
                                            color: 'var(--color-text-muted, #71818c)',
                                        }}
                                    >
                                        {work.chars.toLocaleString()} 文字
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </section>
    )
}

/** ひと月の升目。曜日にそろえる */
function MonthCells({ period }: { period: Period }) {
    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 14px)', gap: 3.5, marginBottom: 4 }}>
                {['日', '月', '火', '水', '木', '金', '土'].map((one) => (
                    <span key={one} style={{ fontSize: 9, color: '#9aa9b3', textAlign: 'center', lineHeight: 1 }}>
                        {one}
                    </span>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 14px)', gap: 3.5 }}>
                {Array.from({ length: period.firstWeekday }, (_, index) => (
                    <span key={`blank-${index}`} style={{ width: 14, height: 14 }} />
                ))}
                {period.bars.map((one, index) => (
                    <span
                        key={index}
                        title={`${index + 1}日　${one.toLocaleString()} 文字`}
                        style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3.5,
                            background:
                                one > 0
                                    ? `rgba(31, 78, 107, ${0.3 + (one / (period.bestChars || 1)) * 0.7})`
                                    : 'rgba(31, 78, 107, .08)',
                        }}
                    />
                ))}
            </div>
        </div>
    )
}

/** 一年の十二か月。棒で見せる */
function YearBars({ bars, best }: { bars: number[]; best: number }) {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 74 }}>
                {bars.map((one, index) => (
                    <span
                        key={index}
                        title={`${index + 1}月　${one.toLocaleString()} 文字`}
                        style={{
                            width: 14,
                            height: one > 0 ? `${Math.max(6, (one / (best || 1)) * 100)}%` : 3,
                            borderRadius: '3px 3px 0 0',
                            background: one > 0 ? 'rgba(31, 78, 107, .78)' : 'rgba(31, 78, 107, .12)',
                        }}
                    />
                ))}
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                {bars.map((_, index) => (
                    <span
                        key={index}
                        style={{ width: 14, fontSize: 8.5, color: '#9aa9b3', textAlign: 'center', lineHeight: 1 }}
                    >
                        {index + 1}
                    </span>
                ))}
            </div>
        </div>
    )
}

/**
 * 数の札。
 *
 * ★ 添え書きは、あるときだけ出す。
 *   「原稿用紙 約0枚」のように、意味のない数を出さない。
 */
function Figure({
    label,
    value,
    unit,
    note,
    strong = false,
}: {
    label: string
    value: string
    unit: string
    note?: string
    strong?: boolean
}) {
    return (
        <div style={{ background: 'var(--color-brand-light, #eef4f8)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted, #71818c)' }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 1 }}>
                <span
                    style={{
                        fontFamily: '"Hiragino Mincho ProN", garamond, serif',
                        fontSize: strong ? 28 : 22,
                        fontWeight: 700,
                        lineHeight: 1.25,
                        color: strong ? 'var(--color-brand, #1f4e6b)' : 'var(--color-text, #17222b)',
                    }}
                >
                    {value}
                </span>
                {unit && <span style={{ fontSize: 12, color: 'var(--color-text-muted, #71818c)' }}>{unit}</span>}
            </div>
            {note && <div style={{ fontSize: 11.5, color: 'var(--color-text-muted, #71818c)', marginTop: 2 }}>{note}</div>}
        </div>
    )
}
