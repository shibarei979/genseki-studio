'use client'

import { useEffect, useState } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * ReadingSummary — その月に読んだ量
 *
 * ★ 閲覧履歴の上に置く。
 *
 *   履歴は「何を読んだか」、これは「どれだけ読んだか」。
 *   同じものの 2 つの見方なので、同じ場所にある。
 *
 * ★ 1 話につき 1 回だけ数えている（入口の側で）。
 *   読み返しても文字数は増えない。
 *
 * ★ 輪の図は、線だけで描く。
 *   塗りつぶした円を並べると、頁の中で強く出すぎる。
 *   このサイトは本の色で組んであるので、細い輪にする。
 * ============================================================
 */

export interface Slice {
    name: string
    chars: number
    episodes: number
}

interface Month {
    chars: number
    works: number
    episodes: number
    genres: Slice[]
    authors: Slice[]
}

/** 並べる元。字数か、話数か */
export type SortKey = 'chars' | 'episodes'

/** 畳んでいるとき、いくつまで出すか */
const TOP_N = 3

/*
 * 輪の色。
 *
 * ★ 数を決め打ちにしない。
 *
 *   前は 4 色を順に回していた。「すべて見る」で
 *   39 件並ぶと、同じ色が 10 回ずつ出て見分けが付かない。
 *
 *   色は数だけ作る。角度を少しずつずらして取る。
 *
 * ★ ずらす角は 137.5 度。
 *
 *   一周（360）と割り切れない角なので、
 *   何度回しても前の色と重ならない。
 *   葉や花びらが重ならずに付く角と同じ。
 *
 * ★ 濃さは落とす。
 *
 *   色味だけを回すと、黄や緑のあたりで
 *   目に刺さる色が出る。39 個も並ぶと、
 *   画面全体がちらついて読めない。
 *
 *   このサイトは本の色で組んである。
 *   濃さを 26% まで落として、くすませる。
 *   紙に刷った色に近くなる。
 *
 * ★ 明るさは、ひとつ置きに変える。
 *
 *   濃さを落とすと、隣の色と見分けが付きにくい。
 *   明るいものと暗いものを交互にすると、
 *   色味が近くても濃淡で分かれる。
 *
 * ★ 「その他」だけは、いつも灰。
 *   まとめたものだと、色で分かるようにする。
 */
const TONE_START = 205;
const TONE_STEP = 137.508;
const TONE_SAT = 26;
const TONE_LIGHT = [44, 58];
const TONE_GREY = "#c5c2b8";

function toneOf(index: number, name: string) {
    if (name === "その他") return TONE_GREY;

    const hue = Math.round((TONE_START + index * TONE_STEP) % 360);
    const light = TONE_LIGHT[index % TONE_LIGHT.length];
    return `hsl(${hue} ${TONE_SAT}% ${light}%)`;
}

export const BOOK_CHARS = 100000

/** 原稿用紙 1 枚ぶんの字数 */
export const SHEET_CHARS = 400

function monthKey(date: Date) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7)
}

function monthLabel(key: string) {
    const [year, month] = key.split('-')
    return `${year}年${Number(month)}月`
}

export default function ReadingSummary() {
    const [months, setMonths] = useState<Record<string, Month> | null>(null)
    const [at, setAt] = useState(() => monthKey(new Date()))

    /*
     * 月で見るか、年で見るか。
     *
     * ★ 入口は月ごとに返してくる。
     *   年はその 12 か月を足して作る。
     *   入口を変えずに済むので、
     *   数え方が二重にならない。
     *
     * ★ ジャンルと作者の内訳も足し合わせる。
     *   月ごとに上位が入れ替わるので、
     *   年で見ると「一年で何を読んだか」が出る。
     */
    const [span, setSpan] = useState<'month' | 'year'>('month')

    useEffect(() => {
        let alive = true
        void (async () => {
            try {
                const res = await fetch('/api/mypage/reading')
                const data = await res.json()
                if (alive) setMonths(data.months ?? {})
            } catch {
                if (alive) setMonths({})
            }
        })()
        return () => {
            alive = false
        }
    }, [])

    /* 送る。記録の無いところも出す。0 と分かるほうがよい */
    function step(direction: -1 | 1) {
        if (span === 'year') {
            setAt(String(Number(at.slice(0, 4)) + direction))
            return
        }

        const [year, month] = at.split('-').map(Number)
        const next = new Date(year, month - 1 + direction, 1)
        setAt(
            `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
        )
    }

    /* 月と年を切り替える。いま見ている所の年を引き継ぐ */
    function changeSpan(next: 'month' | 'year') {
        if (next === span) return

        if (next === 'year') {
            setAt(at.slice(0, 4))
        } else {
            const thisMonth = monthKey(new Date())
            /* その年の今月。違う年なら 1 月から */
            setAt(
                at === thisMonth.slice(0, 4) ? thisMonth : `${at.slice(0, 4)}-01`,
            )
        }

        setSpan(next)
    }

    if (!months) return null

    /*
     * その年ぶんを足し合わせる。
     * 作品数だけは足せない（同じ作品を別の月に読むと二重になる）ので、
     * 足したうえで「のべ」として出す。
     */
    function sumYear(year: string): Month | undefined {
        const keys = Object.keys(months ?? {}).filter((key) =>
            key.startsWith(`${year}-`),
        )
        if (keys.length === 0) return undefined

        const genres: Record<string, Slice> = {}
        const authors: Record<string, Slice> = {}
        let chars = 0
        let works = 0
        let episodes = 0

        for (const key of keys) {
            const one = months?.[key]
            if (!one) continue

            chars += one.chars
            works += one.works
            episodes += one.episodes

            for (const row of one.genres ?? []) {
                if (!genres[row.name]) {
                    genres[row.name] = { name: row.name, chars: 0, episodes: 0 }
                }
                genres[row.name].chars += row.chars
                genres[row.name].episodes += row.episodes
            }

            for (const row of one.authors ?? []) {
                if (!authors[row.name]) {
                    authors[row.name] = { name: row.name, chars: 0, episodes: 0 }
                }
                authors[row.name].chars += row.chars
                authors[row.name].episodes += row.episodes
            }
        }

        return {
            chars,
            works,
            episodes,
            genres: Object.values(genres),
            authors: Object.values(authors),
        }
    }

    const now = span === 'year' ? sumYear(at) : months[at]

    const isNow =
        span === 'year'
            ? at >= String(new Date().getFullYear())
            : at >= monthKey(new Date())

    /*
     * ひとつ前の文字数。
     *
     * 増えたか減ったかが分かると、続ける手応えになる。
     * 前の記録が無ければ出さない。
     */
    let before: number | null = null

    if (span === 'year') {
        before = sumYear(String(Number(at) - 1))?.chars ?? null
    } else {
        const [year, month] = at.split('-').map(Number)
        const back = new Date(year, month - 2, 1)
        const beforeKey = `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, '0')}`
        before = months[beforeKey]?.chars ?? null
    }

    return (
        <div
            style={{
                border: '1px solid var(--color-brand-border)',
                borderRadius: 14,
                background: 'var(--color-bg-card)',
                padding: '18px 20px',
                marginBottom: 20,
            }}
        >
            {/* 月と、送り */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                }}
            >
                <span
                    style={{
                        fontSize: 19,
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        color: 'var(--color-text)',
                        fontFamily: 'garamond, "Hiragino Mincho ProN", serif',
                    }}
                >
                    {span === 'year' ? `${at}年` : monthLabel(at)}の読書
                </span>

                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/*
                      * 月で見るか、年で見るか。
                      * 押し具にせず、字の切り替えにする。
                      * 送りの矢印より前に出るものではない。
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
                                    fontSize: 11.5,
                                    color:
                                        span === key
                                            ? 'var(--color-brand)'
                                            : 'var(--color-text-faint)',
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
                        onClick={() => step(-1)}
                        aria-label="前の月"
                        style={arrowStyle}
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        onClick={() => step(1)}
                        aria-label="次の月"
                        disabled={isNow}
                        style={{
                            ...arrowStyle,
                            opacity: isNow ? 0.35 : 1,
                            cursor: isNow ? 'default' : 'pointer',
                        }}
                    >
                        ›
                    </button>
                </span>
            </div>

            {!now ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-faint)', lineHeight: 1.8 }}>
                    {span === 'year' ? 'この年' : 'この月'}は、まだ読んだ記録がありません。
                </p>
            ) : (
                <>
                    {/*
                      * 数と内訳を、横一列に並べる。
                      *
                      * ★ 幅を余らせない。
                      *   前は数字が左に固まり、右が空いていた。
                      *   3 つの塊で埋める。
                      *
                      * ★ 狭い画面では、順に下へ落ちる。
                      */}
                    <div
                        style={{
                            display: 'grid',
                            gap: '22px 28px',
                            gridTemplateColumns:
                                'repeat(auto-fit, minmax(250px, 1fr))',
                            alignItems: 'start',
                        }}
                    >
                        {/* 読んだ量 */}
                        <div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: 'var(--color-text-muted)',
                                    marginBottom: 4,
                                }}
                            >
                                読んだ文字数
                            </div>

                            <div
                                style={{
                                    fontSize: 34,
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                    color: 'var(--color-brand)',
                                    letterSpacing: '.01em',
                                }}
                            >
                                {now.chars.toLocaleString()}
                            </div>

                            {/*
                              * ★ 冊数に直す。
                              *   17 万字と言われても手応えにならない。
                              *   本の数にすると、読んだ量として感じられる。
                              */}
                            <div
                                style={{
                                    marginTop: 8,
                                    fontSize: 13,
                                    color: 'var(--color-text)',
                                    lineHeight: 1.8,
                                }}
                            >
                                文庫本にすると{' '}
                                <b style={{ fontSize: 17, color: 'var(--color-forest)' }}>
                                    約{(now.chars / BOOK_CHARS).toFixed(1)}
                                </b>{' '}
                                冊ぶん
                                <br />
                                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                    原稿用紙 {Math.round(now.chars / SHEET_CHARS).toLocaleString()} 枚
                                </span>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    gap: 22,
                                    marginTop: 14,
                                    paddingTop: 12,
                                    borderTop: '1px solid var(--color-brand-light)',
                                }}
                            >
                                <Figure
                                    label={span === 'year' ? '作品数（のべ）' : '作品数'}
                                    value={String(now.works)}
                                />
                                <Figure label="話数" value={String(now.episodes)} />
                                {before !== null && (
                                    <Figure
                                        label={span === 'year' ? '前の年とくらべて' : '先月とくらべて'}
                                        value={
                                            (now.chars >= before ? '+' : '−') +
                                            Math.abs(now.chars - before).toLocaleString()
                                        }
                                    />
                                )}
                            </div>
                        </div>

                        <Ring title="ジャンルの内訳" rows={now.genres} />
                        <Ring title="作者別の文字数" rows={now.authors} />
                    </div>

                    <p
                        style={{
                            fontSize: 10.5,
                            color: 'var(--color-text-faint)',
                            lineHeight: 1.8,
                            marginTop: 16,
                        }}
                    >
                        同じ話を読み返しても、文字数は増えません。1話につき1回だけ数えています。
                        {span === 'year' && (
                            <>
                                <br />
                                年ごとの作品数は、月ごとの数を足したものです。
                                同じ作品を別の月に読むと、2 回数えます。
                            </>
                        )}
                        <br />
                        入っていない状態で読んだぶんは、記録に残りません。
                    </p>
                </>
            )}
        </div>
    )
}

const arrowStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '1px solid var(--color-brand-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-brand)',
    fontSize: 16,
    lineHeight: 1,
    cursor: 'pointer',
}

function Figure({
    label,
    value,
    big = false,
}: {
    label: string
    value: string
    big?: boolean
}) {
    return (
        <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>
                {label}
            </div>
            <div
                style={{
                    fontSize: big ? 28 : 20,
                    fontWeight: 700,
                    color: big ? 'var(--color-brand)' : 'var(--color-text)',
                    letterSpacing: '.02em',
                }}
            >
                {value}
            </div>
        </div>
    )
}

/**
 * 輪の図。
 *
 * ★ 塗らずに、太い線で描く。
 *   円を塗ると頁の中で強く出すぎる。
 *   本の色で組んだ画面に、色の円が浮く。
 *
 * ★ 真ん中は空ける。合計を置く場所にもなる。
 */
export function Ring({
    title,
    rows,
}: {
    title: string
    rows: Slice[]
}) {
    /*
     * ★ 届いた形が古くても落ちない。
     *
     *   入口は［名前, 字数］の組を返していた時期がある。
     *   画面だけ新しくして入口が古いままだと、
     *   name も chars も無い値を触って落ちる。
     *   その場合は、組から作り直す。
     */
    const safe: Slice[] = Array.isArray(rows)
        ? rows.map((one) =>
              Array.isArray(one)
                  ? { name: String(one[0]), chars: Number(one[1]) || 0, episodes: 0 }
                  : {
                        name: String((one as Slice)?.name ?? ''),
                        chars: Number((one as Slice)?.chars) || 0,
                        episodes: Number((one as Slice)?.episodes) || 0,
                    },
          )
        : []
    /*
     * 並べる元。
     *
     * ★ 字数だけだと、長い作品を 1 つ読んだ人が
     *   そのジャンルばかり読んでいるように見える。
     *   話数でも並べられるようにする。
     */
    const [by, setBy] = useState<SortKey>('chars')

    /* 全部出すか、上位だけにするか */
    const [isOpen, setIsOpen] = useState(false)

    const sorted = [...safe].sort((a, b) => b[by] - a[by])
    const total = sorted.reduce((sum, one) => sum + one[by], 0)
    if (total === 0) return null

    /*
     * 畳んでいるときは、上位だけ出して残りをまとめる。
     * まとめる所は、こちら側で決める。
     * 入口は全部返してくるので、開けばすべて見える。
     */
    const shown: Slice[] = isOpen
        ? sorted
        : (() => {
              const head = sorted.slice(0, TOP_N)
              const rest = sorted.slice(TOP_N)
              if (rest.length === 0) return head
              return [
                  ...head,
                  {
                      name: 'その他',
                      chars: rest.reduce((sum, one) => sum + one.chars, 0),
                      episodes: rest.reduce((sum, one) => sum + one.episodes, 0),
                  },
              ]
          })()

    const R = 36
    const WIDTH = 22
    const C = 2 * Math.PI * R

    let offset = 0

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    marginBottom: 10,
                    flexWrap: 'wrap',
                }}
            >
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                    {title}
                </span>

                {/*
                  * 並べる元。
                  * 押し具にせず、字の切り替えにする。
                  * 内訳の見出しの横で、押し具が主役になるのは重い。
                  */}
                {(['chars', 'episodes'] as SortKey[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setBy(key)}
                        aria-pressed={by === key}
                        style={{
                            border: 'none',
                            background: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            fontSize: 11,
                            color:
                                by === key
                                    ? 'var(--color-brand)'
                                    : 'var(--color-text-faint)',
                            fontWeight: by === key ? 700 : 400,
                            textDecoration: by === key ? 'none' : 'underline',
                        }}
                    >
                        {key === 'chars' ? '文字数順' : '話数順'}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <svg
                    width="104"
                    height="104"
                    viewBox="0 0 104 104"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                >
                    {shown.map((one, index) => {
                        const length = (one[by] / total) * C
                        const dash = `${length} ${C - length}`
                        const start = -offset
                        offset += length

                        return (
                            <circle
                                key={one.name}
                                cx="52"
                                cy="52"
                                r={R}
                                fill="none"
                                stroke={toneOf(index, one.name)}
                                strokeWidth={WIDTH}
                                strokeDasharray={dash}
                                strokeDashoffset={start}
                                transform="rotate(-90 52 52)"
                            />
                        )
                    })}
                </svg>

                <div style={{ minWidth: 0 }}>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {shown.map((one, index) => (
                            <li
                                key={one.name}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    fontSize: 12,
                                    color: 'var(--color-text-muted)',
                                    lineHeight: 2,
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: 9,
                                        height: 9,
                                        borderRadius: 2,
                                        flexShrink: 0,
                                        background: toneOf(index, one.name),
                                    }}
                                />
                                <span
                                    style={{
                                        maxWidth: 150,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {one.name}
                                </span>
                                <span
                                    style={{
                                        flexShrink: 0,
                                        color: 'var(--color-text)',
                                        fontWeight: 600,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {Math.round((one[by] / total) * 100)}%
                                </span>
                            </li>
                        ))}
                    </ul>

                    {sorted.length > TOP_N && (
                        <button
                            type="button"
                            onClick={() => setIsOpen((open) => !open)}
                            aria-expanded={isOpen}
                            style={{
                                marginTop: 4,
                                border: 'none',
                                background: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontSize: 11,
                                color: 'var(--color-forest)',
                                textDecoration: 'underline',
                            }}
                        >
                            {isOpen
                                ? '上位だけにする'
                                : `すべて見る（${sorted.length}）`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
