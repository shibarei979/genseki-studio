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

    /**
     * 舞台と芯の票を、はじめから数え直す。
     *
     * ★ 6 つの角とは別に数える。
     *   角は「どう書く人か」、票は「何が書けるか」。
     *   混ぜると、どちらも曖昧になる。
     */
    function votes() {
        const place: Record<string, number> = {}
        const core: Record<string, number> = {}

        for (const [key, choiceAt] of Object.entries(picked)) {
            const stage = stageAt(Number(key))
            if (!stage || stage === 'coin') continue

            const choice = stage.choices[choiceAt]
            if (!choice) continue

            if (choice.place) place[choice.place] = (place[choice.place] ?? 0) + 1
            if (choice.core) core[choice.core] = (core[choice.core] ?? 0) + 1
        }

        return { place, core }
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
                    <ResultView
                        score={totalScore()}
                        votes={votes()}
                        onRestart={restart}
                    />
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
            <p className="gm_open_over">10の選択・1分・登録なし</p>

            <h1 className="gm_open_ask">
                無名作家から、
                <br />
                はじまる10の選択。
            </h1>

            <p className="gm_open_lead">
                最後に、あなたが本当に書ける一作が出ます。
            </p>

            {/*
              * ★ 結果の形を、先に見せておく。
              *
              *   何が出るか分からないものは、始めにくい。
              *   「異世界 × 冒険」という形だけ見せると、
              *   自分は何が出るのだろう、と思ってもらえる。
              *
              * ★ 中身は伏せる。組だけ。
              */}
            <div className="gm_open_sample">
                {[
                    ['異世界', '冒険'],
                    ['現代', '喪失'],
                    ['学園', '発見'],
                    ['歴史', '対立'],
                ].map(([a, b]) => (
                    <span key={a} className="gm_open_chip">
                        {a} <i>×</i> {b}
                    </span>
                ))}
                <span className="gm_open_chip is_more">ほか96通り</span>
            </div>

            <button type="button" className="gm_go" onClick={onStart}>
                航海に出る
            </button>
        </div>
    )
}

/**
 * 石。
 *
 * ★ 進み具合の石と、結果の6角形は、同じもの。
 *
 *   答えるたびに、6つの角が伸びていく。
 *   その形が、そのまま最後の結果になる。
 *
 *   別々に描いていたときは、石が育っても
 *   何が育っているのか分からなかった。
 *   同じものにすれば、育つのが目に見える。
 *
 * ★ 角の名前は、遊んでいる間は出さない。
 *   形だけ見せる。名前まで出すと点取りになる。
 */
function Gem({
    score,
    size = 46,
    showNames = false,
}: {
    score: Score
    size?: number
    showNames?: boolean
}) {
    const pad = showNames ? size * 0.24 : size * 0.1
    const half = size / 2
    const r = half - pad

    const top = Math.max(...AXIS_ORDER.map((axis) => score[axis]), 1)

    /* まだ何も答えていないときも、形が見えるように下駄をはかせる */
    const grown = AXIS_ORDER.reduce((sum, axis) => sum + score[axis], 0)
    const base = grown === 0 ? 0.3 : 0.16

    function point(index: number, ratio: number) {
        const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2
        return {
            x: half + Math.cos(angle) * r * ratio,
            y: half + Math.sin(angle) * r * ratio,
        }
    }

    function ring(ratio: number) {
        return AXIS_ORDER.map((_, index) => {
            const p = point(index, ratio)
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
        }).join(' ')
    }

    const shape = AXIS_ORDER.map((axis, index) => {
        const p = point(index, base + (score[axis] / top) * (1 - base))
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    }).join(' ')

    /* いちばん高い角 */
    let bestAt = 0
    AXIS_ORDER.forEach((axis, index) => {
        if (score[axis] > score[AXIS_ORDER[bestAt]]) bestAt = index
    })

    return (
        <svg
            className="gm_gem"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            aria-hidden="true"
        >
            <polygon points={ring(1)} fill="none" stroke="#ded4c1" strokeWidth="1" />
            {showNames && (
                <polygon points={ring(0.55)} fill="none" stroke="#ebe3d4" strokeWidth="1" />
            )}

            {AXIS_ORDER.map((axis, index) => {
                const p = point(index, 1)
                return (
                    <line
                        key={axis}
                        x1={half}
                        y1={half}
                        x2={p.x}
                        y2={p.y}
                        stroke="#ebe3d4"
                        strokeWidth="1"
                    />
                )
            })}

            {/* その人の形。答えるたびに伸びる */}
            <polygon
                className="gm_gem_shape"
                points={shape}
                fill="rgba(200, 148, 74, .3)"
                stroke="#c8944a"
                strokeWidth={showNames ? 1.8 : 1.5}
                strokeLinejoin="round"
            />

            {showNames && grown > 0 && (
                <>
                    {(() => {
                        const p = point(
                            bestAt,
                            base + (score[AXIS_ORDER[bestAt]] / top) * (1 - base),
                        )
                        return <circle cx={p.x} cy={p.y} r="3.6" fill="#c8944a" />
                    })()}

                    {AXIS_ORDER.map((axis, index) => {
                        const p = point(index, 1.26)
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
                </>
            )}
        </svg>
    )
}

/* ============================================================
 * 進み具合
 * ============================================================ */

function Dots({ at, last }: { at: number; last: number }) {
    const all = last + 1
    const left = all - at

    return (
        <div className="gm_route">
            {/*
              * 航路。
              *
              * ★ 石をやめた。
              *
              *   遊んでいる最中に 6 角形を出すと、
              *   点を見ながら答えることになる。
              *   進み具合は、進み具合だけを出せばよい。
              *
              * ★ 線と印。名前どおりの形にする。
              *   どこまで来たか、あと何回かが、一目で分かる。
              */}
            <svg
                className="gm_route_line"
                viewBox="0 0 300 22"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                {/* 通ってきた道 */}
                <line x1="6" y1="11" x2="294" y2="11" stroke="#e2d9c8" strokeWidth="1.5" />
                <line
                    x1="6"
                    y1="11"
                    x2={6 + (288 * at) / all}
                    y2="11"
                    stroke="#c8944a"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                />

                {/* 節目 */}
                {Array.from({ length: all }, (_, index) => (
                    <circle
                        key={index}
                        cx={6 + (288 * index) / all}
                        cy="11"
                        r={index === at ? 4 : 2}
                        fill={index <= at ? '#c8944a' : '#e2d9c8'}
                    />
                ))}

                {/* 港 */}
                <circle cx="294" cy="11" r="3" fill="none" stroke="#c8944a" strokeWidth="1.4" />
            </svg>

            <p className="gm_route_text">
                <span className="gm_route_now">{at + 1}</span>
                <span className="gm_route_all"> / {all}</span>
                <span className="gm_route_left">
                    {left <= 1 ? '最後の選択' : `港まで、あと${left}つ`}
                </span>
            </p>
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
    votes,
    onRestart,
}: {
    score: Score
    votes: { place: Record<string, number>; core: Record<string, number> }
    onRestart: () => void
}) {
    const v = judge(score, votes.place, votes.core)

    const shareText = [
        `私が書けるのは「${v.place} × ${v.core}」でした。`,
        v.work.title,
        '',
        '無名作家からスタート。あなたは何を書ける？',
        '#原石航路',
    ].join('\n')

    return (
        <div className="gm_result">
            <p className="gm_answer_tag">あなたが書けるのは</p>

            {/* 舞台 × 芯。ここがいちばん大きい */}
            <h2 className="gm_pair">
                <span className="gm_pair_word">{v.place}</span>
                <span className="gm_pair_cross">×</span>
                <span className="gm_pair_word">{v.core}</span>
            </h2>

            {/*
              * ★ 6角形と、一作を横に並べる。
              *
              *   縦に積むと、形を見たあと、もう一度
              *   下へ目を移すことになる。
              *   横に並べれば、形と題名が一度に目に入る。
              *
              * ★ 狭い画面では、縦に落ちる。
              */}
            <div className="gm_pane">
                <div className="gm_pane_left">
                    <Gem score={score} size={210} showNames />
                    <p className="gm_pane_cap">あなたの書き方</p>
                </div>

                <div className="gm_pane_right">
                    <p className="gm_work_tag">あなたが書ける一作</p>
                    <p className="gm_work_title">{v.work.title}</p>
                    <p className="gm_work_note">{v.work.note}</p>

                    <p className="gm_work_best">
                        いちばん強いのは <b>{AXIS_NAME[v.best]}</b>
                    </p>
                </div>
            </div>

            {/*
              * 名前を出すところ。
              *
              * ★ 上の結果を、下で受け直す。
              *
              *   前は上下がまったく別の話に見えた。
              *   下でもう一度、同じ題名を呼ぶ。
              *   そうすると、切れずに続きとして読める。
              */}
            <div className="gm_reveal">
                <svg className="gm_wave" viewBox="0 0 120 10" aria-hidden="true">
                    <path
                        d="M0 5 Q 15 0, 30 5 T 60 5 T 90 5 T 120 5"
                        fill="none"
                        stroke="#c8944a"
                        strokeWidth="1.2"
                    />
                </svg>

                <p className="gm_reveal_title">{v.work.title}</p>
                <p className="gm_reveal_tag">この一作を、書いてみませんか</p>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="gm_reveal_logo" src="/logo.svg" alt="原石航路" />

                <p className="gm_reveal_lead">
                    まだ知られていない作品が、
                    <br />
                    見つけてもらえる場所です。
                </p>

                <div>
                    <Link
                        href={`/post?title=${encodeURIComponent(
                            v.work.title.replace(/[『』]/g, ''),
                        )}`}
                        className="gm_go"
                    >
                        この題名で書き始める
                    </Link>
                </div>

                <p className="gm_reveal_small">題名は、あとから変えられます</p>

                <div>
                    <Link
                        href={`/search?genre=${encodeURIComponent(v.genre)}`}
                        className="gm_sub"
                    >
                        {v.place}の作品を読んでみる
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
