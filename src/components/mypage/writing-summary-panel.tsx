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
    if (key.length === 10) {
        const start = shiftDay(key, -(DAY_SPAN - 1))
        return `${md(start)}〜${md(key)}`
    }
    return `${key.slice(0, 4)}年${Number(key.slice(5))}月`
}

/*
 * ============================================================
 * 日ごと（ここ 30 日）
 *
 * ★ 月の升目だと、月の頭では数日しか並ばない。
 *   「ここ 30 日」をいつでも同じ長さで見られるようにする。
 * ★ 送りの矢印は 30 日ずつ。鍵は窓の最後の日 "YYYY-MM-DD"。
 * ============================================================
 */
const DAY_SPAN = 30

/** 日本時間の今日 "YYYY-MM-DD" */
function jstToday() {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** "YYYY-MM-DD" を diff 日ずらす（日付だけで計算し、時差に左右されない） */
function shiftDay(key: string, diff: number) {
    const at = new Date(`${key}T00:00:00Z`)
    at.setUTCDate(at.getUTCDate() + diff)
    return at.toISOString().slice(0, 10)
}

/** "M月D日" */
function md(key: string) {
    return `${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日`
}

interface DayPeriod {
    /** 古い順に 30 日 */
    dates: string[]
    bars: number[]
    chars: number
    days: number
    bestIndex: number
    bestChars: number
    works: WorkRow[]
}

/** end を最後の日とする 30 日ぶん */
function buildDays(end: string, logs: Log[], titles: Map<string, string>): DayPeriod {
    const dates = Array.from({ length: DAY_SPAN }, (_, index) => shiftDay(end, index - (DAY_SPAN - 1)))
    const at = new Map(dates.map((date, index) => [date, index]))
    const bars = dates.map(() => 0)
    const perWork = new Map<string, number>()

    for (const log of logs) {
        if (log.delta <= 0) continue
        const index = at.get(log.log_date)
        if (index === undefined) continue
        bars[index] += log.delta
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
        dates,
        bars,
        chars: bars.reduce((sum, one) => sum + one, 0),
        days: bars.filter((one) => one > 0).length,
        bestIndex,
        bestChars,
        works: Array.from(perWork.entries())
            .map(([id, chars]) => ({ id, title: titles.get(id) || '名前のない作品', chars }))
            .sort((a, b) => b.chars - a.chars)
            .slice(0, 4),
    }
}

export default function WritingSummaryPanel() {
    const [logs, setLogs] = useState<Log[] | null>(null)
    const [titles, setTitles] = useState<Map<string, string>>(new Map())

    /* いま見ている所。"YYYY-MM" か "YYYY" */
    const [at, setAt] = useState(() => monthKeyOf(new Date()))
    const [span, setSpan] = useState<'day' | 'month' | 'year'>('month')

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

    const isDay = span === 'day'
    const now = useMemo(
        () => (logs && !isDay ? build(at, logs, titles) : null),
        [logs, at, titles, isDay],
    )
    const before = useMemo(
        () => (logs && !isDay ? build(stepKey(at, -1), logs, titles) : null),
        [logs, at, titles, isDay],
    )
    /* 日ごと：いまの 30 日と、その前の 30 日 */
    const dayNow = useMemo(() => (logs && isDay ? buildDays(at, logs, titles) : null), [logs, at, titles, isDay])
    const dayBefore = useMemo(
        () => (logs && isDay ? buildDays(shiftDay(at, -DAY_SPAN), logs, titles) : null),
        [logs, at, titles, isDay],
    )
    /* 日ごとの棒で、押して選んだ日（無ければ窓の最後の日） */
    const [pick, setPick] = useState<number | null>(null)

    if (!logs || (!now && !dayNow)) return null

    const thisMonth = monthKeyOf(new Date())
    const today = jstToday()
    const isNow = isDay ? at === today : span === 'year' ? at === thisMonth.slice(0, 4) : at === thisMonth
    const canBack = isDay
        ? shiftDay(at, -(DAY_SPAN - 1)) > `${oldest}-01`
        : span === 'year'
          ? at > oldest.slice(0, 4)
          : at > oldest

    /* 日・月・年を行き来する。いま見ている所を引き継ぐ */
    function changeSpan(next: 'day' | 'month' | 'year') {
        if (next === span) return
        setPick(null)
        if (next === 'day') {
            setAt(today)
        } else if (next === 'year') {
            setAt(at.slice(0, 4))
        } else if (span === 'day') {
            setAt(at.slice(0, 7))
        } else {
            /* その年の今月。違う年なら 12 月から */
            setAt(at === thisMonth.slice(0, 4) ? thisMonth : `${at}-12`)
        }
        setSpan(next)
    }

    /* 送り。日ごとは 30 日ずつ */
    function move(diff: number) {
        setPick(null)
        if (isDay) {
            const next = shiftDay(at, diff * DAY_SPAN)
            setAt(next > today ? today : next)
        } else {
            setAt(stepKey(at, diff))
        }
    }

    const sheets = Math.round((now?.chars ?? dayNow?.chars ?? 0) / 400)
    /*
     * ★ 今日書いた文字数（すべての作品の合計、日本時間の今日）。
     *   「今日はよく書いた」を確かめたい、という声から。
     */
    const todayKeyJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const todayChars = (logs ?? [])
        .filter((log) => log.log_date === todayKeyJst && log.delta > 0)
        .reduce((sum, log) => sum + log.delta, 0)
    const diff = (now?.chars ?? 0) - (before?.chars ?? 0)

    /*
     * ★ 日ごとの比べ方
     *   今日：その前の 30 日（昨日まで）の 1 日あたりの平均と比べる
     *   30 日：その前の 30 日と比べる
     */
    const prev30 = logs
        ? buildDays(shiftDay(today, -1), logs, titles)
        : null
    const avgPrev = prev30 ? Math.round(prev30.chars / DAY_SPAN) : 0
    const todayVsAvg = todayChars - avgPrev
    const dayDiff = (dayNow?.chars ?? 0) - (dayBefore?.chars ?? 0)
    const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString()}`

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
                        {(['day', 'month', 'year'] as const).map((key) => (
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
                                {key === 'day' ? '日ごと' : key === 'month' ? '月ごと' : '年ごと'}
                            </button>
                        ))}
                    </span>

                    <button
                        type="button"
                        onClick={() => move(-1)}
                        disabled={!canBack}
                        aria-label={isDay ? '前の30日' : span === 'year' ? '前の年' : '前の月'}
                        style={{ ...arrow, opacity: canBack ? 1 : 0.35, cursor: canBack ? 'pointer' : 'default' }}
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        onClick={() => move(1)}
                        disabled={isNow}
                        aria-label={isDay ? '次の30日' : span === 'year' ? '次の年' : '次の月'}
                        style={{ ...arrow, opacity: isNow ? 0.35 : 1, cursor: isNow ? 'default' : 'pointer' }}
                    >
                        ›
                    </button>
                </span>
            </div>

            {isDay && dayNow ? (
                <DayView
                    period={dayNow}
                    isNow={isNow}
                    todayChars={todayChars}
                    todayNote={avgPrev > 0 ? `ここ30日の平均より ${signed(todayVsAvg)}` : undefined}
                    diffNote={dayBefore && dayBefore.chars > 0 ? `その前の30日より ${signed(dayDiff)} 文字` : undefined}
                    pick={pick}
                    onPick={setPick}
                />
            ) : !now ? null : now.chars === 0 ? (
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
                            {isNow && span === 'month' && (
                                <Figure label="今日書いた文字数" value={todayChars.toLocaleString()} unit="文字" />
                            )}
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

/**
 * 日ごと（ここ 30 日）の中身。
 *
 *   今日・30 日の合計・書いた日・いちばん書いた日 の札と、30 本の棒。
 *   棒を押すと、その日の文字数を下に出す（携帯は指を置いて見る手段が無いため）。
 */
function DayView({
    period,
    isNow,
    todayChars,
    todayNote,
    diffNote,
    pick,
    onPick,
}: {
    period: DayPeriod
    isNow: boolean
    todayChars: number
    todayNote?: string
    diffNote?: string
    pick: number | null
    onPick: (index: number | null) => void
}) {
    const last = period.dates.length - 1
    const shown = pick ?? last
    const sheets = Math.round(period.chars / 400)

    return (
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
                    {isNow && (
                        <Figure label="今日書いた文字数" value={todayChars.toLocaleString()} unit="文字" note={todayNote} />
                    )}
                    <Figure
                        label="30日で書いた文字数"
                        value={period.chars.toLocaleString()}
                        unit="文字"
                        note={diffNote ?? (sheets >= 1 ? `原稿用紙 約${sheets.toLocaleString()} 枚` : undefined)}
                        strong
                    />
                    <Figure
                        label="書いた日"
                        value={`${period.days}`}
                        unit={`日 / ${DAY_SPAN}日`}
                        note={period.days > 0 ? `書いた日は平均 ${Math.round(period.chars / period.days).toLocaleString()}字` : undefined}
                    />
                    <Figure
                        label="いちばん書いた日"
                        value={period.bestIndex < 0 ? '—' : md(period.dates[period.bestIndex])}
                        unit=""
                        note={period.bestChars > 0 ? `${period.bestChars.toLocaleString()} 文字` : undefined}
                    />
                </div>

                <div
                    style={{
                        flex: '1 1 300px',
                        minWidth: 0,
                        background: 'var(--color-brand-light, #eef4f8)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <DayBars period={period} shown={shown} onPick={onPick} />
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted, #71818c)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{md(period.dates[shown])}{shown === last && isNow ? '（今日）' : ''}</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-brand, #1f4e6b)' }}>
                            {period.bars[shown].toLocaleString()} 文字
                        </span>
                    </div>
                </div>
            </div>

            {period.works.length > 0 && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--color-line, #e8eef2)', paddingTop: 10 }}>
                    {period.works.map((work) => (
                        <div
                            key={work.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--color-text, #26343d)', padding: '4px 0' }}
                        >
                            <span style={{ width: 170, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {work.title}
                            </span>
                            <span style={{ flex: 1, minWidth: 60, height: 7, borderRadius: 999, background: 'var(--color-brand-light, #eaf0f4)' }}>
                                <span
                                    style={{
                                        display: 'block',
                                        height: '100%',
                                        borderRadius: 999,
                                        width: `${Math.max(5, (work.chars / (period.works[0].chars || 1)) * 100)}%`,
                                        background: 'var(--color-brand, #1f4e6b)',
                                    }}
                                />
                            </span>
                            <span style={{ width: 84, textAlign: 'right', flex: 'none', color: 'var(--color-text-muted, #71818c)' }}>
                                {work.chars.toLocaleString()} 文字
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}

/** 30 本の棒。押した日を濃くする */
function DayBars({ period, shown, onPick }: { period: DayPeriod; shown: number; onPick: (index: number) => void }) {
    const best = period.bestChars || 1
    const last = period.dates.length - 1
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 84 }}>
                {period.bars.map((one, index) => (
                    <button
                        key={period.dates[index]}
                        type="button"
                        onClick={() => onPick(index)}
                        aria-label={`${md(period.dates[index])} ${one.toLocaleString()} 文字`}
                        title={`${md(period.dates[index])}　${one.toLocaleString()} 文字`}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            height: '100%',
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-end',
                        }}
                    >
                        <span
                            style={{
                                display: 'block',
                                width: '100%',
                                height: one > 0 ? `${Math.max(6, (one / best) * 100)}%` : 3,
                                borderRadius: '3px 3px 0 0',
                                background:
                                    index === shown
                                        ? 'var(--color-brand, #1f4e6b)'
                                        : one > 0
                                          ? 'rgba(31, 78, 107, .45)'
                                          : 'rgba(31, 78, 107, .12)',
                            }}
                        />
                    </button>
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9.5, color: '#8a9aa5' }}>
                <span>{md(period.dates[0])}</span>
                <span>{md(period.dates[Math.floor(last / 2)])}</span>
                <span>{md(period.dates[last])}</span>
            </div>
        </div>
    )
}
