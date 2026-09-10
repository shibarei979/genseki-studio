'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

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
 * ★ 住所を直に叩いて来る、一枚の頁。
 *
 *   案内も、下の帯も出さない。上にロゴだけ。
 *   遊んでいる間は、原石航路の話をしない。
 *   終わってから、初めて誘う。
 *
 * ★ 濃い所と明るい所を、交互に出す。
 *
 *     入り口（海）→ 10 の出来事（紙）→ 鑑定（海）→ 結果（紙の札）
 *
 *   ずっと同じ明るさだと、10 問が長い。
 *   海に出て、日誌を書いて、港に着く。
 *
 * ★ 点は最後まで見せない。
 *   途中で見えると、答えではなく点を選び始める。
 * ============================================================
 */

/* 100 を振り分ける出来事を、5 番目に挟む */
const COIN_AT = 4

const COIN_KINDS: { key: string; label: string; add: Partial<Score> }[] = [
    { key: 'work', label: '作品づくり', add: { bunge: 1, light: 1 } },
    { key: 'art', label: 'イラスト・デザイン', add: { comic: 2 } },
    { key: 'research', label: '取材・資料', add: { bunge: 1, screen: 1 } },
    { key: 'ad', label: '宣伝', add: { web: 2 } },
]

const EMPTY: Score = { light: 0, comic: 0, bunge: 0, screen: 0, web: 0 }

const FLAT = { work: 25, art: 25, research: 25, ad: 25 }

const MARKS = ['A', 'B', 'C', 'D']

export default function WriterGame() {
    /* -1 入り口 ／ 0〜last 出来事 ／ last+1 鑑定中 ／ last+2 結果 */
    const [at, setAt] = useState(-1)

    const [picked, setPicked] = useState<Record<number, number>>({})
    const [coins, setCoins] = useState<Record<string, number>>({ ...FLAT })

    const last = STAGES.length

    /*
     * 鑑定の間。
     *
     * ★ すぐ出さない。
     *   10 個選んだ答えが一瞬で出ると、
     *   決めてもらった気がしない。
     *   1.6 秒だけ、石を見てもらう。
     */
    useEffect(() => {
        if (at !== last + 1) return
        const timer = window.setTimeout(() => setAt(last + 2), 1600)
        return () => window.clearTimeout(timer)
    }, [at, last])

    function stageAt(index: number): Stage | 'coin' | null {
        if (index < 0 || index > last) return null
        if (index === COIN_AT) return 'coin'
        return STAGES[index > COIN_AT ? index - 1 : index]
    }

    /** 点を、はじめから数え直す */
    function totalScore(): Score {
        const score: Score = { ...EMPTY }

        for (const [key, choiceAt] of Object.entries(picked)) {
            const stage = stageAt(Number(key))
            if (!stage || stage === 'coin') continue

            const choice = stage.choices[choiceAt]
            if (!choice) continue

            for (const axis of Object.keys(choice.add) as Axis[]) {
                score[axis] += choice.add[axis] ?? 0
            }
        }

        /*
         * 振り分けた 100 を、点に直す。
         * 25 を境に、多く置いたぶんだけ強く出る。
         */
        for (const kind of COIN_KINDS) {
            const weight = ((coins[kind.key] ?? 0) - 25) / 25

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

    function restart() {
        setPicked({})
        setCoins({ ...FLAT })
        setAt(-1)
    }

    const isSea = at === -1 || at > last

    return (
        <div className={`gm${isSea ? ' is_sea' : ''}`}>
            <header className="gm_head">
                <Link href="/" aria-label="原石航路">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.svg" alt="原石航路" />
                </Link>
            </header>

            <main className="gm_main">
                {at === -1 && <Open onStart={() => setAt(0)} />}

                {at >= 0 && at <= last && (
                    <>
                        <Dots at={at} last={last} />

                        {stageAt(at) === 'coin' ? (
                            <Coins
                                coins={coins}
                                setCoins={setCoins}
                                onNext={() => setAt(at + 1)}
                            />
                        ) : (
                            <StageView
                                key={at}
                                stage={stageAt(at) as Stage}
                                onChoose={choose}
                            />
                        )}

                        {at > 0 && (
                            <div style={{ textAlign: 'center' }}>
                                <button
                                    type="button"
                                    className="gm_quiet"
                                    onClick={() => setAt(at - 1)}
                                >
                                    ひとつ戻る
                                </button>
                            </div>
                        )}
                    </>
                )}

                {at === last + 1 && (
                    <div className="gm_wait">
                        <div className="gm_stone" />
                        <p>原石を鑑定しています</p>
                    </div>
                )}

                {at === last + 2 && (
                    <ResultView score={totalScore()} onRestart={restart} />
                )}
            </main>
        </div>
    )
}

/* ============================================================
 * 入り口
 * ============================================================ */

function Open({ onStart }: { onStart: () => void }) {
    return (
        <div className="gm_open">
            <p className="gm_open_lead">
                あなたは、まだ誰にも知られていない新人作家。
                <br />
                これから10個の選択によって、
                <br />
                あなたの&ldquo;作家人生&rdquo;が決まります。
            </p>

            <p className="gm_open_ask">あなたはどこへ辿り着く？</p>

            {/* 航路の印。線を 1 本だけ */}
            <svg className="gm_wave" width="120" height="10" viewBox="0 0 120 10" aria-hidden="true">
                <path
                    d="M0 5 Q 15 0, 30 5 T 60 5 T 90 5 T 120 5"
                    fill="none"
                    stroke="#e8d7b6"
                    strokeWidth="1.2"
                />
            </svg>

            <button type="button" className="gm_go" onClick={onStart}>
                航海に出る
            </button>
        </div>
    )
}

/* ============================================================
 * 進み具合
 * ============================================================ */

function Dots({ at, last }: { at: number; last: number }) {
    return (
        <div className="gm_dots" aria-label={`${at + 1} / ${last + 1}`}>
            {Array.from({ length: last + 1 }, (_, index) => (
                <span
                    key={index}
                    className={[
                        'gm_dot',
                        index < at ? 'is_done' : '',
                        index === at ? 'is_now' : '',
                    ].join(' ')}
                />
            ))}
        </div>
    )
}

/* ============================================================
 * 出来事
 * ============================================================ */

function StageView({
    stage,
    onChoose,
}: {
    stage: Stage
    onChoose: (index: number) => void
}) {
    return (
        <div className="gm_stage">
            <p className="gm_tag">{stage.tag}</p>
            <h2 className="gm_title">{stage.title}</h2>
            <div className="gm_rule" />

            <div className="gm_lines">
                {stage.lines.map((line) => (
                    <p key={line}>{line}</p>
                ))}
            </div>

            {stage.meter && <Meter to={stage.meter.to} unit={stage.meter.unit} sub={stage.meter.sub} />}

            {stage.ask && <p className="gm_ask">{stage.ask}</p>}

            {stage.look === 'book' ? (
                <>
                    <div className="gm_books">
                        {stage.choices.map((choice, index) => (
                            <button
                                key={choice.label}
                                type="button"
                                className="gm_book"
                                onClick={() => onChoose(index)}
                                style={{
                                    background: choice.cover?.base ?? '#f2ede2',
                                    color: choice.cover?.ink ?? '#4a4238',
                                }}
                            >
                                {choice.label}
                            </button>
                        ))}
                    </div>
                    <div className="gm_shelf" />
                </>
            ) : (
                <div className="gm_choices">
                    {stage.choices.map((choice, index) => (
                        <button
                            key={choice.label}
                            type="button"
                            onClick={() => onChoose(index)}
                            className={[
                                'gm_choice',
                                stage.look === 'note' ? 'is_note' : '',
                                stage.look === 'comment' ? 'is_comment' : '',
                            ].join(' ')}
                        >
                            <span className="gm_mark" aria-hidden="true">
                                {MARKS[index]}
                            </span>
                            <span>
                                {stage.look === 'comment' && (
                                    <span className="gm_who">読者さんより</span>
                                )}
                                {choice.label}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * 数字が伸びる所。
 *
 * ★ 出しておいてから問う。
 *   同じ問いでも「自分に起きたこと」になる。
 *
 * ★ 動きを減らす設定の人には、最後の数だけ出す。
 */
function Meter({ to, unit, sub }: { to: number; unit: string; sub?: string }) {
    const [now, setNow] = useState(0)
    const raf = useRef<number | null>(null)

    useEffect(() => {
        const quiet =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

        if (quiet) {
            setNow(to)
            return
        }

        const started = Date.now()
        const span = 900

        function tick() {
            const ratio = Math.min(1, (Date.now() - started) / span)
            /* 終わりに近づくほど、ゆっくり止まる */
            const eased = 1 - Math.pow(1 - ratio, 3)
            setNow(Math.round(to * eased))
            if (ratio < 1) raf.current = requestAnimationFrame(tick)
        }

        raf.current = requestAnimationFrame(tick)
        return () => {
            if (raf.current) cancelAnimationFrame(raf.current)
        }
    }, [to])

    return (
        <div className="gm_meter">
            <div className="gm_meter_num">{now.toLocaleString()}</div>
            <div className="gm_meter_unit">{unit}</div>
            {sub && <div className="gm_meter_sub">{sub}</div>}
        </div>
    )
}

/* ============================================================
 * 100 の振り分け
 * ============================================================ */

function Coins({
    coins,
    setCoins,
    onNext,
}: {
    coins: Record<string, number>
    setCoins: (next: Record<string, number>) => void
    onNext: () => void
}) {
    const put = COIN_KINDS.reduce((sum, one) => sum + (coins[one.key] ?? 0), 0)
    const rest = 100 - put

    return (
        <div className="gm_stage">
            <p className="gm_tag">STAGE 5</p>
            <h2 className="gm_title">突然、10万円が手に入った</h2>
            <div className="gm_rule" />

            <div className="gm_lines">
                <p>創作のために、自由に振り分けてください。</p>
            </div>

            <div className="gm_coin">
                {COIN_KINDS.map((kind) => (
                    <div key={kind.key} className="gm_coin_row">
                        <div className="gm_coin_top">
                            <span>{kind.label}</span>
                            <span className="gm_coin_val">{coins[kind.key] ?? 0}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={coins[kind.key] ?? 0}
                            aria-label={kind.label}
                            onChange={(e) =>
                                setCoins({ ...coins, [kind.key]: Number(e.target.value) })
                            }
                        />
                    </div>
                ))}
            </div>

            <p className={`gm_rest${rest === 0 ? ' is_ok' : ''}`}>
                {rest === 0
                    ? 'ちょうど100です'
                    : rest > 0
                      ? `あと ${rest}`
                      : `${-rest} 多すぎます`}
            </p>

            <div style={{ textAlign: 'center' }}>
                <button
                    type="button"
                    className="gm_go"
                    onClick={onNext}
                    disabled={rest !== 0}
                    style={{
                        opacity: rest === 0 ? 1 : 0.35,
                        cursor: rest === 0 ? 'pointer' : 'default',
                        boxShadow: rest === 0 ? undefined : 'none',
                    }}
                >
                    これでいく
                </button>
            </div>
        </div>
    )
}

/* ============================================================
 * 結果
 * ============================================================ */

function ResultView({
    score,
    onRestart,
}: {
    score: Score
    onRestart: () => void
}) {
    const result = judge(score)
    const top = Math.max(...(Object.values(score) as number[]), 1)

    const shareText = [
        `私は${result.emoji}「${result.name}」でした。`,
        '',
        '無名作家からスタートしたら、あなたは何になる？',
        '#原石航路作家ゲーム',
    ].join('\n')

    return (
        <div>
            {/* 鑑定書 */}
            <div className="gm_card">
                <div className="gm_card_in">
                    <div className="gm_seal">{result.emoji}</div>

                    <p className="gm_kind">鑑定結果</p>
                    <h2 className="gm_name">{result.name}</h2>

                    <div style={{ marginTop: 18 }}>
                        {result.lines.map((line) => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>

                    <div className="gm_axes">
                        {(Object.keys(AXIS_NAME) as Axis[]).map((axis) => (
                            <div key={axis} className="gm_axis">
                                <span className="gm_axis_name">{AXIS_NAME[axis]}</span>
                                <span className="gm_axis_bar">
                                    <span
                                        className="gm_axis_fill"
                                        style={{
                                            width: `${Math.round((score[axis] / top) * 100)}%`,
                                        }}
                                    />
                                </span>
                            </div>
                        ))}
                    </div>

                    <p className="gm_hint">{result.hint}</p>
                </div>
            </div>

            {/* ここから、はじめて原石航路の話をする */}
            <div className="gm_invite">
                <p className="gm_invite_ask">
                    あなたの中にある「原石」、
                    <br />
                    眠らせたままにしますか？
                </p>

                <p className="gm_invite_sub">
                    原石航路では、まだ知られていない作品を
                    <br />
                    投稿したり、見つけたりできます。
                </p>

                <div>
                    <Link href="/post" className="gm_go">
                        自分の物語を航海に出す
                    </Link>
                </div>

                <div>
                    <Link
                        href={`/search?genre=${encodeURIComponent(result.genre)}`}
                        className="gm_sub"
                    >
                        同じ手ざわりの作品を見てみる
                    </Link>
                </div>

                <div>
                    <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                            shareText,
                        )}&url=${encodeURIComponent('https://gensekikoro.com/game')}`}
                        target="_blank"
                        rel="noopener"
                        className="gm_sub"
                    >
                        結果を X に出す
                    </a>
                </div>

                <div>
                    <button type="button" className="gm_quiet" onClick={onRestart}>
                        もう一度やる
                    </button>
                </div>
            </div>
        </div>
    )
}
