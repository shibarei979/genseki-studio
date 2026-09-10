'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import {
    AXIS_NAME,
    AXIS_ORDER,
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

/*
 * 100 の振り分け先。
 *
 * ★ 何に置いたかで、どの角が伸びるかが変わる。
 *
 *     作品づくり  文章と熱量。手を動かすこと
 *     イラスト    世界観。見せる形にすること
 *     取材・資料  世界観と物語。中身を集めること
 *     宣伝        発信力。届けること
 *
 * ★ キャラクターには振らない。
 *   人は金で作るものではない、という筋を通す。
 */
const COIN_KINDS: { key: string; label: string; add: Partial<Score> }[] = [
    { key: 'work', label: '作品づくり', add: { text: 1, heat: 1 } },
    { key: 'art', label: 'イラスト・デザイン', add: { world: 2 } },
    { key: 'research', label: '取材・資料', add: { world: 1, story: 1 } },
    { key: 'ad', label: '宣伝', add: { reach: 2 } },
]

const EMPTY: Score = {
    chara: 0,
    world: 0,
    text: 0,
    story: 0,
    reach: 0,
    heat: 0,
}

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

    /*
     * 海の色にするのは、入り口と鑑定中だけ。
     *
     * ★ 結果は紙に置く。
     *   濃い地に細い字を並べると、読みづらい。
     *   読ませるところは明るく、
     *   名前を出すところだけ濃くする。
     */
    const isSea = at === -1 || at === last + 1

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
            {/*
              * 磨かれる前の石。
              *
              * ★ 遊びの主役を、最初に一度見せておく。
              *   最後に「あなたの原石は」と言われたとき、
              *   この石のことだと分かる。
              *
              * ★ まだ濁っている。
              *   10 問かけて澄んでいく。
              */}
            <Gem grown={0} big />

            <p className="gm_open_lead">
                あなたは、まだ誰にも知られていない新人作家。
            </p>

            <h1 className="gm_open_ask">
                その手の中に、
                <br />
                どんな原石がありますか。
            </h1>

            <p className="gm_open_note">10の選択でわかります・1分</p>

            <button type="button" className="gm_go" onClick={onStart}>
                航海に出る
            </button>
        </div>
    )
}

/**
 * 石。
 *
 * ★ 答えるほど、澄んでいく。
 *
 *   進み具合を帯や点で出すより、
 *   自分の石が形になっていくほうが、手が止まらない。
 *   遊びの主役と、進み具合が同じものになる。
 *
 * ★ 面の数は変えない。明るさと、内側の光だけ変える。
 *   形が変わると、別の石に見える。
 */
function Gem({ grown, big = false }: { grown: number; big?: boolean }) {
    /* 0 から 1。10 問で 1 になる */
    const level = Math.max(0, Math.min(1, grown))

    const size = big ? 108 : 46
    const half = size / 2
    const r = half - (big ? 8 : 4)

    /* 六角。上が尖る向き */
    const points = Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2
        return `${(half + Math.cos(angle) * r).toFixed(1)},${(half + Math.sin(angle) * r).toFixed(1)}`
    }).join(' ')

    /* 内側の面。少し小さい六角 */
    const inner = Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2
        return `${(half + Math.cos(angle) * r * 0.52).toFixed(1)},${(half + Math.sin(angle) * r * 0.52).toFixed(1)}`
    }).join(' ')

    return (
        <svg
            className={`gm_gem${big ? ' is_big' : ''}`}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            aria-hidden="true"
        >
            {/* 外側 */}
            <polygon
                points={points}
                fill={`rgba(200, 148, 74, ${0.08 + level * 0.26})`}
                stroke="#c8944a"
                strokeWidth={big ? 1.6 : 1.2}
                strokeOpacity={0.35 + level * 0.65}
                strokeLinejoin="round"
            />

            {/* 面の線 */}
            {Array.from({ length: 6 }, (_, index) => {
                const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2
                return (
                    <line
                        key={index}
                        x1={half}
                        y1={half}
                        x2={half + Math.cos(angle) * r}
                        y2={half + Math.sin(angle) * r}
                        stroke="#c8944a"
                        strokeWidth="1"
                        strokeOpacity={0.12 + level * 0.4}
                    />
                )
            })}

            {/* 内側。澄むほど明るい */}
            <polygon
                points={inner}
                fill={`rgba(240, 220, 180, ${0.05 + level * 0.5})`}
                stroke="none"
            />
        </svg>
    )
}

/* ============================================================
 * 進み具合
 * ============================================================ */

function Dots({ at, last }: { at: number; last: number }) {
    const left = last + 1 - at

    return (
        <div className="gm_progress">
            <Gem grown={at / (last + 1)} />

            <div className="gm_progress_text">
                <span className="gm_progress_now">{at + 1}</span>
                <span className="gm_progress_all"> / {last + 1}</span>
                <span className="gm_progress_left">
                    {left <= 1 ? '最後の選択' : `あと${left}つ`}
                </span>
            </div>
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
    const v = judge(score)

    /* 石の名前。ふたつ持ちなら「余韻 と 世界」 */
    const stoneName = v.second
        ? `${v.stone.name} と ${v.second.name}`
        : v.stone.name

    /*
     * つぶやく文。
     *
     * ★ 石の名前だけで伝わるようにする。
     *   「私の原石は余韻でした」。それだけで、
     *   読んだ人は自分の石を知りたくなる。
     */
    const shareText = [
        `私が持っている原石は「${stoneName}」でした。`,
        v.work.title,
        '',
        '無名作家からスタート。あなたの原石は？',
        '#原石航路',
    ].join('\n')

    return (
        <div className="gm_result">
            <p className="gm_answer_tag">あなたが持っている原石は</p>

            {/* 石の名前。ここがいちばん大きい */}
            <h2 className={`gm_stone_name${v.second ? ' is_twin' : ''}`}>
                {v.second ? (
                    <>
                        {v.stone.name}
                        <span className="gm_and">と</span>
                        {v.second.name}
                    </>
                ) : (
                    v.stone.name
                )}
            </h2>

            <div className="gm_answer_lines">
                <p>{v.stone.what}</p>
                {v.second && <p>{v.second.what}</p>}
                <p className="gm_rare">
                    {v.isMany
                        ? '三つ以上を同じ強さで持っている人は、ほとんどいません。'
                        : v.second
                          ? 'ふたつ持っている人は、多くありません。'
                          : v.stone.rare}
                </p>
            </div>

            <Hexagon score={score} />

            {/* この石で書ける一作 */}
            <div className="gm_work">
                <p className="gm_work_tag">この原石で、あなたが書ける一作</p>
                <p className="gm_work_title">{v.work.title}</p>
                <div className="gm_work_note">
                    {v.work.note.map((line) => (
                        <p key={line}>{line}</p>
                    ))}
                </div>
            </div>

            {/* 名前を出すところ */}
            <div className="gm_reveal">
                <p className="gm_reveal_tag">原石を、航海に出す場所</p>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="gm_reveal_logo" src="/logo.svg" alt="原石航路" />

                <p className="gm_reveal_lead">
                    まだ知られていない作品を、
                    <br />
                    投稿したり、見つけたりできます。
                </p>

                <div>
                    <Link href="/post" className="gm_go">
                        この一作を書きに行く
                    </Link>
                </div>

                <div>
                    <Link
                        href={`/search?genre=${encodeURIComponent(v.genre)}`}
                        className="gm_sub"
                    >
                        同じ原石の作品を読んでみる
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
                        Xにつぶやく
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

/* ============================================================
 * 6角形
 *
 * ★ 頂点が、そのまま 6 つの結果に当たる。
 *
 *   どこが尖っているかを見れば、
 *   なぜその結果になったのかが分かる。
 *   数字は出さない。出すと点取りに戻る。
 *
 * ★ 目盛りは 2 本だけ。
 *   細かく引くと図面になり、余韻が消える。
 *
 * ★ いちばん高い角には、印を置く。
 *   自分の形が、一目で残るように。
 * ============================================================ */

function Hexagon({ score }: { score: Score }) {
    const SIZE = 210
    const CENTER = SIZE / 2
    const R = 66

    const top = Math.max(...AXIS_ORDER.map((axis) => score[axis]), 1)

    /** 何番目の角が、どこに来るか */
    function point(index: number, ratio: number) {
        const angle = (Math.PI * 2 * index) / AXIS_ORDER.length - Math.PI / 2
        return {
            x: CENTER + Math.cos(angle) * R * ratio,
            y: CENTER + Math.sin(angle) * R * ratio,
        }
    }

    function ring(ratio: number) {
        return AXIS_ORDER.map((_, index) => {
            const p = point(index, ratio)
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
        }).join(' ')
    }

    const shape = AXIS_ORDER.map((axis, index) => {
        /* 0 でも点として見えるよう、少しだけ下駄をはかせる */
        const ratio = 0.14 + (score[axis] / top) * 0.86
        const p = point(index, ratio)
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    }).join(' ')

    /* いちばん高い角 */
    let bestAt = 0
    AXIS_ORDER.forEach((axis, index) => {
        if (score[axis] > score[AXIS_ORDER[bestAt]]) bestAt = index
    })

    return (
        <div className="gm_hex">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
                {/* 目盛り。2 本だけ */}
                <polygon points={ring(1)} fill="none" stroke="#ded4c1" strokeWidth="1" />
                <polygon points={ring(0.55)} fill="none" stroke="#ebe3d4" strokeWidth="1" />

                {/* 中心から各角への線 */}
                {AXIS_ORDER.map((axis, index) => {
                    const p = point(index, 1)
                    return (
                        <line
                            key={axis}
                            x1={CENTER}
                            y1={CENTER}
                            x2={p.x}
                            y2={p.y}
                            stroke="#ebe3d4"
                            strokeWidth="1"
                        />
                    )
                })}

                {/* その人の形 */}
                <polygon
                    points={shape}
                    fill="rgba(200, 148, 74, .26)"
                    stroke="#c8944a"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                />

                {/* いちばん高い角に、印 */}
                {(() => {
                    const ratio =
                        0.14 + (score[AXIS_ORDER[bestAt]] / top) * 0.86
                    const p = point(bestAt, ratio)
                    return <circle cx={p.x} cy={p.y} r="3.6" fill="#c8944a" />
                })()}

                {/* 角の名前 */}
                {AXIS_ORDER.map((axis, index) => {
                    const p = point(index, 1.3)
                    return (
                        <text
                            key={axis}
                            x={p.x}
                            y={p.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="10"
                            fill={index === bestAt ? '#c8944a' : '#8b8377'}
                            fontWeight={index === bestAt ? 700 : 400}
                        >
                            {AXIS_NAME[axis]}
                        </text>
                    )
                })}
            </svg>
        </div>
    )
}
