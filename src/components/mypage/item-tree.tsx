'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * ItemTree — アイテムツリー
 *
 * ★ 段ごとに並べる。
 *
 *   Lv.1 から Lv.5 へ、下りながら集める。
 *   何があるか分かると、貯める気になる。
 *
 * ★ 中身が決まっていないものは「？」で出す。
 *
 *   絵も名前もこれから作る。
 *   空欄で並べると壊れて見えるので、
 *   「まだ用意していない」と分かる形にする。
 *
 * ★ 伏せたものは、買うまで中身を見せない。
 *
 *   何があるか分からないほうが、集める気になる。
 *
 * ★ 買えるかどうかを、色で分ける。
 *
 *     持っている    印が付く
 *     買える        はっきり
 *     足りない      薄く
 *     前のが要る    薄く、鍵の印
 * ============================================================
 */

interface Item {
    id: string
    kind: string
    name: string
    description: string
    asset_url: string | null
    free_price: number | null
    tier: number
    position: number
    requires_item_id: string | null
    is_secret: boolean
    is_active: boolean
}

const TIER_LABEL: Record<number, { title: string; note: string }> = {
    1: { title: 'Lv.1', note: 'はじめの一歩' },
    2: { title: 'Lv.2', note: '自分らしさを表現しよう' },
    3: { title: 'Lv.3', note: 'もっと楽しく、もっとつながる' },
    4: { title: 'Lv.4', note: '特別なアイテムでさらに先へ' },
    5: { title: 'Lv.5', note: 'まだ見ぬ景色へ' },
}

const KIND_LABEL: Record<string, string> = {
    stamp: 'スタンプ',
    frame: 'フレーム',
    background: '背景',
    badge: '称号',
    name_style: 'プロフィール装飾',
    bookmark: '栞',
    cover: 'ブックカバー',
    shelf: '本棚背景',
}

/*
 * 種類ごとの印。
 *
 * ★ 全部を同じ「？」で出すと、何の品物か分からない。
 *
 *   絵がまだ無くても、種類だけは伝わるようにする。
 *   何段目にどんなものが来るかが見えると、
 *   貯める目当てになる。
 *
 * ★ 伏せたものは、これも出さない。
 *   何があるか分からないほうが、集める気になる。
 */
const KIND_MARK: Record<string, string> = {
    stamp: '☺',
    frame: '◻',
    background: '▨',
    badge: '★',
    name_style: 'Aa',
    bookmark: '❧',
    cover: '▤',
    shelf: '▦',
}

export default function ItemTree() {
    const [items, setItems] = useState<Item[]>([])
    const [owned, setOwned] = useState<string[]>([])
    const [points, setPoints] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    const [picked, setPicked] = useState<Item | null>(null)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')

    const reload = useCallback(async () => {
        try {
            const response = await fetch('/api/points/items')
            if (!response.ok) return

            const data = (await response.json()) as {
                items?: Item[]
                owned?: string[]
                free?: number
            }

            setItems(data.items ?? [])
            setOwned(data.owned ?? [])
            setPoints(data.free ?? 0)
        } catch {
            /* 読めなくても、ほかの画面は動く */
        }

        setIsLoading(false)
    }, [])

    useEffect(() => {
        void reload()
    }, [reload])

    async function exchange(item: Item) {
        setBusy(true)
        setMessage('')

        try {
            const response = await fetch('/api/points/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id }),
            })

            const data = (await response.json()) as {
                ok?: boolean
                error?: string
            }

            if (!response.ok || data.error) {
                setMessage(data.error ?? 'うまくいきませんでした。')
            } else {
                setMessage(`${item.name} を交換しました。`)
                await reload()
            }
        } catch {
            setMessage('繋がりませんでした。')
        }

        setBusy(false)
    }

    if (isLoading) return null

    /* 段ごとにまとめる */
    const tiers = new Map<number, Item[]>()

    for (const item of items) {
        if (!tiers.has(item.tier)) tiers.set(item.tier, [])
        tiers.get(item.tier)!.push(item)
    }

    for (const list of tiers.values()) {
        list.sort((a, b) => a.position - b.position)
    }

    const sortedTiers = Array.from(tiers.entries()).sort((a, b) => a[0] - b[0])

    /** その品物が、いまどういう状態か */
    function stateOf(item: Item) {
        if (owned.includes(item.id)) return 'owned' as const
        if (!item.is_active) return 'coming' as const

        if (item.requires_item_id && !owned.includes(item.requires_item_id)) {
            return 'locked' as const
        }

        if ((item.free_price ?? 0) > points) return 'poor' as const
        return 'ready' as const
    }

    return (
        <div
            /*
             * ★ 地に、薄い色を敷く。
             *
             *   白いままだと、札との境が分からず
             *   全体がのっぺりする。
             *   絵では薄い水色の紙の上に並んでいた。
             */
            style={{
                background:
                    'linear-gradient(180deg, var(--color-brand-light) 0%, var(--color-bg-card) 40%)',
                border: '1px solid var(--color-brand-border)',
                borderRadius: 14,
                padding: '18px 20px',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 4,
                }}
            >
                <h2
                    style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                    }}
                >
                    アイテムツリー
                </h2>

                <span
                    style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
                >
                    {owned.length} / {items.length}
                </span>

                <span
                    style={{
                        marginLeft: 'auto',
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                    }}
                >
                    無料{' '}
                    <b
                        style={{
                            fontSize: 15,
                            color: 'var(--color-brand)',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {points.toLocaleString()}
                    </b>{' '}
                    pt
                </span>
            </div>

            <p
                style={{
                    fontSize: 11.5,
                    lineHeight: 1.8,
                    color: 'var(--color-text-faint)',
                    marginBottom: 10,
                }}
            >
                集めたポイントで、スタンプやプロフィールの飾りと交換できます。
                中身はこれから増やしていきます。
            </p>

            {/*
              * ★ 進み具合を、帯で出す。
              *
              *   0 / 20 という数字だけだと、
              *   どのくらい進んだのかが目で分からない。
              *   帯があると、あと少しだと分かる。
              */}
            <div
                style={{
                    height: 5,
                    borderRadius: 999,
                    /* ★ 地は、うんと薄く。同じ色だと満タンに見える */
                    background: 'rgba(0,0,0,.06)',
                    overflow: 'hidden',
                    marginBottom: 16,
                }}
            >
                <div
                    style={{
                        width: `${items.length > 0 ? Math.round((owned.length / items.length) * 100) : 0}%`,
                        height: '100%',
                        background: 'var(--color-brand)',
                        transition: 'width .3s ease',
                    }}
                />
            </div>

            {/*
              * ★ 見出しを左に、縦に並べる。
              *
              *   絵では Lv と説明が左にあり、
              *   その右に品物が並んでいる。
              *   横線で区切るより、段が一本の道に見える。
              */}
            {sortedTiers.map(([tier, list]) => (
                <section
                    key={tier}
                    style={{
                        display: 'flex',
                        gap: 14,
                        marginBottom: 12,
                        alignItems: 'flex-start',
                    }}
                >
                    <div
                        style={{
                            width: 96,
                            flexShrink: 0,
                            paddingTop: 12,
                            borderLeft: '2px solid var(--color-brand-border)',
                            paddingLeft: 10,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: 'var(--color-brand)',
                                lineHeight: 1.2,
                            }}
                        >
                            {TIER_LABEL[tier]?.title ?? `Lv.${tier}`}
                        </div>

                        <div
                            style={{
                                marginTop: 3,
                                fontSize: 10.5,
                                lineHeight: 1.6,
                                color: 'var(--color-text-faint)',
                            }}
                        >
                            {TIER_LABEL[tier]?.note ?? ''}
                        </div>
                    </div>

                    {/*
                      * ★ 繋がりの線を、札の後ろに引く。
                      *
                      *   絵では品物どうしが枝で繋がっている。
                      *   並んでいるだけだと、
                      *   集める道筋に見えない。
                      *
                      *   札の高さの真ん中に、横一本。
                      *   札がその上に乗るので、線は隙間だけ見える。
                      */}
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            position: 'relative',
                            display: 'grid',
                            /*
                             * ★ 札を狭く、たくさん並べる。
                             *
                             *   5 等分だと 1 つが大きくなりすぎて、
                             *   絵とは別物に見える。
                             *   絵では小さな丸が並んでいる。
                             *
                             *   幅を決めて左から詰める。
                             *   段によって数が違っても、大きさは揃う。
                             */
                            gridTemplateColumns: 'repeat(auto-fill, 104px)',
                            gap: 12,
                        }}
                    >
                        {list.map((item) => {
                            const state = stateOf(item)

                            /* 伏せたものと、まだ用意していないもの */
                            /*
                             * ★ 絵を隠すのは、伏せたものだけ。
                             *
                             *   まだ用意していないものは、
                             *   種類だけ見せる。
                             *   何が来るか分かるほうが、貯める目当てになる。
                             */
                            const hidden = item.is_secret && state !== 'owned'

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    disabled={state === 'coming'}
                                    onClick={() => {
                                        setPicked(item)
                                        setMessage('')
                                    }}
                                    /*
                                     * ★ 絵に寄せる。
                                     *
                                     *   横に長い箱だと、絵が小さく見えて
                                     *   余白ばかりが目に入る。
                                     *   正方形に近づけて、絵を大きく。
                                     *
                                     * ★ 薄くしすぎない。
                                     *   全部が灰色だと、生きている感じがしない。
                                     *   買えないものも、形は見える濃さに。
                                     */
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        /*
                                         * ★ 札の枠をやめる。
                                         *
                                         *   絵では丸が主役で、
                                         *   その下に小さな帯が付いているだけ。
                                         *   四角い箱で囲うと、
                                         *   丸が箱の中の飾りに見えてしまう。
                                         */
                                        gap: 5,
                                        padding: 0,
                                        border: 'none',
                                        background: 'none',
                                        boxShadow: 'none',
                                        /* 前へ伸びる線を、外にはみ出させる */
                                        position: 'relative',
                                        overflow: 'visible',
                                        zIndex: 1,
                                        cursor:
                                            state === 'coming'
                                                ? 'default'
                                                : 'pointer',
                                        opacity:
                                            state === 'ready' ||
                                            state === 'owned'
                                                ? 1
                                                : 0.72,
                                    }}
                                >
                                    {/*
                                      * ★ 前の品物へ伸びる線。
                                      *
                                      *   どれを取ったら次が買えるかを、
                                      *   目で辿れるようにする。
                                      *   並んでいるだけでは、木にならない。
                                      *
                                      * ★ 前が同じ段なら、左へ。
                                      *   違う段なら、上へ。
                                      *
                                      * ★ 前の品物を持っていれば、線を濃くする。
                                      *   どこまで進んだかが、道として見える。
                                      */}
                                    {item.requires_item_id && (() => {
                                        const from = items.find(
                                            (one) =>
                                                one.id === item.requires_item_id,
                                        )

                                        if (!from) return null

                                        const done = owned.includes(from.id)
                                        const color = done
                                            ? 'var(--color-brand)'
                                            : 'var(--color-brand-border)'

                                        /* 同じ段なら左へ、違う段なら上へ */
                                        return from.tier === item.tier ? (
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    position: 'absolute',
                                                    right: '100%',
                                                    top: 32,
                                                    width: 12,
                                                    height: 2,
                                                    background: color,
                                                }}
                                            />
                                        ) : (
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '100%',
                                                    left: '50%',
                                                    width: 2,
                                                    height: 12,
                                                    marginLeft: -1,
                                                    background: color,
                                                }}
                                            />
                                        )
                                    })()}

                                    {/* 絵。まだ無ければ印だけ */}
                                    <span
                                        style={{
                                            /*
                                             * ★ 丸くする。
                                             *   絵では円で並んでいる。
                                             *   四角より、集めている感じが出る。
                                             */
                                            /*
                                             * ★ 丸を主役にする。
                                             *   絵では、これがいちばん大きい。
                                             */
                                            width: 62,
                                            height: 62,
                                            borderRadius: '50%',
                                            background:
                                                state === 'owned'
                                                    ? 'var(--color-bg-card)'
                                                    : 'var(--color-bg-card)',
                                            border:
                                                state === 'owned'
                                                    ? '2.5px solid var(--color-brand)'
                                                    : '1px solid var(--color-brand-border)',
                                            boxShadow:
                                                state === 'owned'
                                                    ? '0 2px 10px rgba(40,90,130,.2)'
                                                    : '0 1px 4px rgba(40,35,25,.08)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 20,
                                            color: 'var(--color-text-faint)',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {!hidden && item.asset_url ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={item.asset_url}
                                                alt=""
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        ) : hidden ? (
                                            '?'
                                        ) : (
                                            /* 絵がまだ無くても、種類は伝える */
                                            (KIND_MARK[item.kind] ?? '?')
                                        )}
                                    </span>

                                    {/*
                                      * ★ 名前と値段を、白い帯にまとめる。
                                      *
                                      *   絵では丸の下に小さな札が付いている。
                                      *   文字がそのまま置いてあると、
                                      *   地に溶けて読みにくい。
                                      */}
                                    <span
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 1,
                                            padding: '4px 8px 5px',
                                            borderRadius: 7,
                                            background: 'var(--color-bg-card)',
                                            border:
                                                '1px solid var(--color-brand-border)',
                                            boxShadow:
                                                '0 1px 3px rgba(40,35,25,.06)',
                                            minWidth: 74,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 9.5,
                                                color: 'var(--color-text-muted)',
                                                textAlign: 'center',
                                                lineHeight: 1.3,
                                            }}
                                        >
                                            {item.is_secret && state !== 'owned'
                                                ? 'シークレット'
                                                : KIND_LABEL[item.kind] ?? item.kind}
                                        </span>

                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color:
                                                    state === 'owned'
                                                        ? 'var(--color-brand)'
                                                        : 'var(--color-text)',
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {state === 'owned'
                                                ? '交換済み'
                                                : `${(item.free_price ?? 0).toLocaleString()} pt`}
                                        </span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </section>
            ))}

            {/* 選んだ品物 */}
            {picked && (
                <div
                    style={{
                        marginTop: 4,
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: '1px solid var(--color-brand)',
                        background: 'var(--color-brand-light)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 10,
                            flexWrap: 'wrap',
                        }}
                    >
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: 'var(--color-text)',
                            }}
                        >
                            {picked.is_secret && !owned.includes(picked.id)
                                ? 'シークレット'
                                : picked.name}
                        </span>

                        <span
                            style={{
                                fontSize: 11,
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            {KIND_LABEL[picked.kind] ?? picked.kind}
                        </span>

                        <button
                            type="button"
                            onClick={() => setPicked(null)}
                            style={{
                                marginLeft: 'auto',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                fontSize: 11,
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                            }}
                        >
                            閉じる
                        </button>
                    </div>

                    <p
                        style={{
                            marginTop: 6,
                            fontSize: 11.5,
                            lineHeight: 1.8,
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        {picked.is_secret && !owned.includes(picked.id)
                            ? '交換するまで、中身は分かりません。'
                            : picked.description ||
                              'この品物の説明は、これから用意します。'}
                    </p>

                    {(() => {
                        const state = stateOf(picked)

                        if (state === 'owned') {
                            return (
                                <p
                                    style={{
                                        marginTop: 8,
                                        fontSize: 12,
                                        color: 'var(--color-brand)',
                                        fontWeight: 700,
                                    }}
                                >
                                    交換済みです。
                                </p>
                            )
                        }

                        if (state === 'locked') {
                            return (
                                <p
                                    style={{
                                        marginTop: 8,
                                        fontSize: 12,
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                    前の品物を交換すると、選べるようになります。
                                </p>
                            )
                        }

                        return (
                            <button
                                type="button"
                                disabled={busy || state === 'poor'}
                                onClick={() => void exchange(picked)}
                                style={{
                                    marginTop: 10,
                                    padding: '8px 20px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background:
                                        state === 'poor'
                                            ? 'var(--color-brand-border)'
                                            : 'var(--color-brand)',
                                    color:
                                        state === 'poor'
                                            ? 'var(--color-text-muted)'
                                            : 'var(--color-text-inverse)',
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    cursor:
                                        state === 'poor'
                                            ? 'not-allowed'
                                            : 'pointer',
                                }}
                            >
                                {state === 'poor'
                                    ? `あと ${((picked.free_price ?? 0) - points).toLocaleString()} pt`
                                    : `${(picked.free_price ?? 0).toLocaleString()} pt で交換する`}
                            </button>
                        )
                    })()}

                    {message && (
                        <p
                            style={{
                                marginTop: 8,
                                fontSize: 11.5,
                                color: 'var(--color-text)',
                            }}
                        >
                            {message}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
