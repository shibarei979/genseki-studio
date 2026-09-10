'use client'

import Link from 'next/link'
import { useState } from 'react'

import {
    AXIS_NAME,
    STAGES,
    judge,
    type Axis,
    type Score,
    type Stage,
} from '@/lib/game/writer-game'

/**
 * ============================================================
 * 原石航路
 * 作家人生ゲーム
 *
 * ★ 住所を直に叩いて来る一枚の頁。
 *
 *   案内も、下の帯も出さない。上にロゴだけ。
 *   遊んでいる間は、原石航路の話をしない。
 *   終わってから、初めて誘う。
 *
 * ★ 点は最後まで見せない。
 *
 *   途中で見えると、答えではなく点を選び始める。
 *
 * ★ 戻れるようにする。
 *
 *   押し間違えたまま最後まで行くのは、後味が悪い。
 *   ただし、点は選び直したぶんだけ計算し直す。
 * ============================================================
 */

/* STAGE 5 は札ではなく、100 を振り分ける。ここに割り込ませる */
const COIN_AT = 4

const COIN_KINDS: { key: string; label: string; add: Partial<Score> }[] = [
    { key: 'work', label: '作品づくり', add: { bunge: 1, light: 1 } },
    { key: 'art', label: 'イラスト・デザイン', add: { comic: 2 } },
    { key: 'research', label: '取材・資料', add: { bunge: 1, screen: 1 } },
    { key: 'ad', label: '宣伝', add: { web: 2 } },
]

const EMPTY: Score = { light: 0, comic: 0, bunge: 0, screen: 0, web: 0 }

export default function WriterGame() {
    /* -1 は入り口。STAGES.length + 1 まで進むと結果 */
    const [at, setAt] = useState(-1)

    /* 選んだ札。戻ったときに計算し直すため、番号で覚える */
    const [picked, setPicked] = useState<Record<number, number>>({})

    /* 振り分けた 100 */
    const [coins, setCoins] = useState<Record<string, number>>({
        work: 25,
        art: 25,
        research: 25,
        ad: 25,
    })

    /* 出来事の総数。札の 9 つ ＋ 振り分けの 1 つ */
    const last = STAGES.length

    /** いま出す出来事。COIN_AT の位置だけ、振り分けを挟む */
    function stageAt(index: number): Stage | 'coin' | null {
        if (index < 0 || index > last) return null
        if (index === COIN_AT) return 'coin'
        return STAGES[index > COIN_AT ? index - 1 : index]
    }

    /** 点を、はじめから数え直す */
    function totalScore(): Score {
        const score: Score = { ...EMPTY }

        for (const [key, choiceAt] of Object.entries(picked)) {
            const index = Number(key)
            const stage = stageAt(index)
            if (!stage || stage === 'coin') continue

            const choice = stage.choices[choiceAt]
            if (!choice) continue

            for (const axis of Object.keys(choice.add) as Axis[]) {
                score[axis] += choice.add[axis] ?? 0
            }
        }

        /*
         * 振り分けた 100 を点に直す。
         *
         * ★ 25 を境にする。多く置いたぶんだけ足す。
         *   全部を均せば、どの軸にも少しずつ乗る。
         *   偏らせた人は、その軸だけ強く出る。
         */
        for (const kind of COIN_KINDS) {
            const put = coins[kind.key] ?? 0
            const weight = (put - 25) / 25

            for (const axis of Object.keys(kind.add) as Axis[]) {
                const value = kind.add[axis] ?? 0
                score[axis] += Math.round(value * (2 + weight * 3))
            }
        }

        return score
    }

    function choose(choiceAt: number) {
        setPicked((now) => ({ ...now, [at]: choiceAt }))
        setAt(at + 1)
    }

    /* ---------- 入り口 ---------- */
    if (at === -1) {
        return (
            <Shell>
                <div style={{ textAlign: 'center', padding: '40px 0 20px' }}>
                    <p style={S.lead}>
                        あなたは、まだ誰にも知られていない新人作家。
                    </p>
                    <p style={S.lead}>
                        これから10個の選択によって、
                        <br />
                        あなたの&ldquo;作家人生&rdquo;が決まります。
                    </p>

                    <p
                        style={{
                            ...S.big,
                            margin: '36px 0 32px',
                        }}
                    >
                        あなたはどこへ辿り着く？
                    </p>

                    <button type="button" onClick={() => setAt(0)} style={S.primary}>
                        始める
                    </button>
                </div>
            </Shell>
        )
    }

    /* ---------- 結果 ---------- */
    if (at > last) {
        const score = totalScore()
        const result = judge(score)

        const shareText = [
            `私は${result.emoji}「${result.name}」でした。`,
            '',
            '無名作家からスタートしたら、あなたは何になる？',
            '#原石航路作家ゲーム',
        ].join('\n')

        const shareUrl = 'https://gensekikoro.com/game'

        return (
            <Shell>
                <div style={{ textAlign: 'center', paddingTop: 24 }}>
                    <p style={S.small}>原石を鑑定しました</p>

                    <p style={{ fontSize: 52, lineHeight: 1.2, margin: '10px 0 4px' }}>
                        {result.emoji}
                    </p>

                    <h2 style={S.resultName}>{result.name}</h2>

                    <div style={{ margin: '22px auto 0', maxWidth: 460 }}>
                        {result.lines.map((line) => (
                            <p key={line} style={S.body}>
                                {line}
                            </p>
                        ))}
                    </div>

                    {/* 内訳。ここで初めて点を見せる */}
                    <div style={{ margin: '26px auto 0', maxWidth: 380, textAlign: 'left' }}>
                        {(Object.keys(AXIS_NAME) as Axis[]).map((axis) => {
                            const value = score[axis]
                            const top = Math.max(...(Object.values(score) as number[]), 1)
                            return (
                                <div key={axis} style={{ marginBottom: 8 }}>
                                    <div style={S.axisRow}>
                                        <span>{AXIS_NAME[axis]}</span>
                                    </div>
                                    <div style={S.barBack}>
                                        <div
                                            style={{
                                                ...S.barFill,
                                                width: `${Math.round((value / top) * 100)}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <p style={{ ...S.body, marginTop: 22, fontWeight: 600 }}>
                        {result.hint}
                    </p>

                    {/* ここから、はじめて原石航路の話をする */}
                    <div style={S.invite}>
                        <p style={{ ...S.big, marginBottom: 10 }}>
                            あなたの中にある「原石」、
                            <br />
                            眠らせたままにしますか？
                        </p>

                        <p style={{ ...S.small, marginBottom: 20, lineHeight: 2 }}>
                            原石航路では、まだ知られていない作品を
                            <br />
                            投稿したり、見つけたりできます。
                        </p>

                        <Link href="/post" style={S.primary}>
                            自分の物語を航海に出す
                        </Link>

                        <Link
                            href={`/search?genre=${encodeURIComponent(result.genre)}`}
                            style={S.ghost}
                        >
                            同じ手ざわりの作品を見てみる
                        </Link>
                    </div>

                    <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                            shareText,
                        )}&url=${encodeURIComponent(shareUrl)}`}
                        target="_blank"
                        rel="noopener"
                        style={{ ...S.ghost, marginTop: 26 }}
                    >
                        結果を X に出す
                    </a>

                    <button
                        type="button"
                        onClick={() => {
                            setPicked({})
                            setCoins({ work: 25, art: 25, research: 25, ad: 25 })
                            setAt(-1)
                        }}
                        style={S.quiet}
                    >
                        もう一度やる
                    </button>
                </div>
            </Shell>
        )
    }

    /* ---------- 100 の振り分け ---------- */
    const stage = stageAt(at)

    if (stage === 'coin') {
        const put = COIN_KINDS.reduce((sum, one) => sum + (coins[one.key] ?? 0), 0)
        const rest = 100 - put

        return (
            <Shell>
                <Progress at={at} last={last} />

                <p style={S.tag}>STAGE 5</p>
                <h2 style={S.title}>突然、10万円が手に入った</h2>

                <p style={S.body}>創作のために、自由に振り分けてください。</p>

                <div style={{ margin: '24px 0 8px' }}>
                    {COIN_KINDS.map((kind) => (
                        <div key={kind.key} style={{ marginBottom: 18 }}>
                            <div style={S.axisRow}>
                                <span>{kind.label}</span>
                                <span style={{ fontWeight: 700 }}>{coins[kind.key] ?? 0}</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={coins[kind.key] ?? 0}
                                onChange={(e) =>
                                    setCoins((now) => ({
                                        ...now,
                                        [kind.key]: Number(e.target.value),
                                    }))
                                }
                                style={{ width: '100%' }}
                            />
                        </div>
                    ))}
                </div>

                <p
                    style={{
                        ...S.small,
                        textAlign: 'center',
                        color: rest === 0 ? 'var(--color-forest)' : 'var(--color-text-faint)',
                    }}
                >
                    {rest === 0
                        ? 'ちょうど100です'
                        : rest > 0
                          ? `あと ${rest} 残っています`
                          : `${-rest} 多すぎます`}
                </p>

                <div style={{ textAlign: 'center', marginTop: 18 }}>
                    <button
                        type="button"
                        onClick={() => setAt(at + 1)}
                        disabled={rest !== 0}
                        style={{
                            ...S.primary,
                            opacity: rest === 0 ? 1 : 0.4,
                            cursor: rest === 0 ? 'pointer' : 'default',
                        }}
                    >
                        決めた
                    </button>
                </div>

                <Back at={at} setAt={setAt} />
            </Shell>
        )
    }

    if (!stage) return null

    /* ---------- ふつうの出来事 ---------- */
    return (
        <Shell>
            <Progress at={at} last={last} />

            <p style={S.tag}>{stage.tag}</p>
            <h2 style={S.title}>{stage.title}</h2>

            <div style={{ margin: '14px 0 22px' }}>
                {stage.lines.map((line) => (
                    <p key={line} style={S.body}>
                        {line}
                    </p>
                ))}
                {stage.ask && (
                    <p style={{ ...S.body, fontWeight: 700, marginTop: 12 }}>{stage.ask}</p>
                )}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
                {stage.choices.map((choice, index) => (
                    <button
                        key={choice.label}
                        type="button"
                        onClick={() => choose(index)}
                        style={{
                            ...S.card,
                            ...(stage.look === 'book' ? S.cardBook : null),
                            ...(stage.look === 'comment' ? S.cardComment : null),
                            ...(stage.look === 'note' ? S.cardNote : null),
                        }}
                    >
                        {stage.look === 'comment' && (
                            <span style={S.cardHead}>読者さんより</span>
                        )}
                        {choice.label}
                    </button>
                ))}
            </div>

            <Back at={at} setAt={setAt} />
        </Shell>
    )
}

/* ============================================================
 * 器と、小さな部品
 * ============================================================ */

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div style={S.page}>
            {/*
              * ★ ロゴだけ。案内は置かない。
              *   遊んでいる最中に、サイトの話をしない。
              */}
            <header style={S.header}>
                <Link href="/" aria-label="原石航路">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.svg" alt="原石航路" style={{ height: 44, width: 'auto' }} />
                </Link>
            </header>

            <main style={S.main}>{children}</main>
        </div>
    )
}

function Progress({ at, last }: { at: number; last: number }) {
    return (
        <div style={S.progressBack}>
            <div
                style={{
                    ...S.progressFill,
                    width: `${Math.round((at / (last + 1)) * 100)}%`,
                }}
            />
        </div>
    )
}

function Back({ at, setAt }: { at: number; setAt: (n: number) => void }) {
    if (at <= 0) return null
    return (
        <div style={{ textAlign: 'center' }}>
            <button type="button" onClick={() => setAt(at - 1)} style={S.quiet}>
                ひとつ戻る
            </button>
        </div>
    )
}

/* ============================================================
 * 見た目
 *
 * ★ サイトの色をそのまま使う。
 *   別の作りに見せると、戻ってきたときに繋がらない。
 * ============================================================ */

const S: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        justifyContent: 'center',
        padding: '18px 0 6px',
    },
    main: {
        width: '100%',
        maxWidth: 560,
        margin: '0 auto',
        padding: '10px 20px 60px',
        flex: 1,
    },

    progressBack: {
        height: 3,
        background: 'var(--color-brand-light)',
        borderRadius: 3,
        margin: '10px 0 26px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: 'var(--color-brand)',
        transition: 'width .3s ease',
    },

    tag: {
        fontSize: 11,
        letterSpacing: '.16em',
        color: 'var(--color-text-faint)',
        marginBottom: 4,
    },
    title: {
        fontSize: 21,
        fontWeight: 700,
        letterSpacing: '.04em',
        color: 'var(--color-text)',
        fontFamily: 'garamond, "Hiragino Mincho ProN", serif',
    },

    lead: {
        fontSize: 14.5,
        lineHeight: 2.1,
        color: 'var(--color-text-muted)',
    },
    body: {
        fontSize: 14,
        lineHeight: 2,
        color: 'var(--color-text)',
    },
    small: {
        fontSize: 12,
        color: 'var(--color-text-muted)',
        lineHeight: 1.9,
    },
    big: {
        fontSize: 19,
        fontWeight: 700,
        letterSpacing: '.05em',
        color: 'var(--color-text)',
        lineHeight: 1.8,
        fontFamily: 'garamond, "Hiragino Mincho ProN", serif',
    },

    card: {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '15px 17px',
        borderRadius: 12,
        border: '1px solid var(--color-brand-border)',
        background: 'var(--color-bg-card)',
        color: 'var(--color-text)',
        fontSize: 14,
        lineHeight: 1.8,
        cursor: 'pointer',
    },
    cardNote: {
        /* 机の上のメモ。少し傾ける */
        borderRadius: 4,
        background: '#fffdf4',
        boxShadow: '2px 2px 0 rgba(40,35,25,.06)',
    },
    cardBook: {
        /* 本の背。左に色の帯 */
        borderLeft: '6px solid var(--color-brand)',
        borderRadius: '4px 12px 12px 4px',
    },
    cardComment: {
        /* 届いた感想。吹き出しに寄せる */
        borderRadius: '12px 12px 12px 3px',
    },
    cardHead: {
        display: 'block',
        fontSize: 10.5,
        color: 'var(--color-text-faint)',
        marginBottom: 3,
    },

    primary: {
        display: 'inline-block',
        padding: '13px 34px',
        borderRadius: 24,
        border: 'none',
        background: 'var(--color-brand)',
        color: 'var(--color-text-inverse)',
        fontSize: 14.5,
        fontWeight: 700,
        cursor: 'pointer',
        textDecoration: 'none',
    },
    ghost: {
        display: 'inline-block',
        marginTop: 12,
        padding: '11px 26px',
        borderRadius: 24,
        border: '1px solid var(--color-brand-border)',
        background: 'transparent',
        color: 'var(--color-brand)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        textDecoration: 'none',
    },
    quiet: {
        display: 'inline-block',
        marginTop: 22,
        border: 'none',
        background: 'none',
        color: 'var(--color-text-faint)',
        fontSize: 12,
        cursor: 'pointer',
        textDecoration: 'underline',
    },

    resultName: {
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '.04em',
        color: 'var(--color-text)',
        fontFamily: 'garamond, "Hiragino Mincho ProN", serif',
    },

    axisRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        color: 'var(--color-text-muted)',
        marginBottom: 4,
    },
    barBack: {
        height: 6,
        borderRadius: 6,
        background: 'var(--color-brand-light)',
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        background: 'var(--color-brand)',
    },

    invite: {
        marginTop: 40,
        paddingTop: 30,
        borderTop: '1px solid var(--color-brand-border)',
    },
}
