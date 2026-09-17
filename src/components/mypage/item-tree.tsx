'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * ItemTree — アイテムツリー
 *
 * ★ 格子に置くのをやめ、繋がりから位置を出す。
 *
 *   前は「何段目の何番目」を表に持ち、
 *   そこへ並べて線を引き足していた。
 *   だから「段ごとの一覧表」にしか見えなかった。
 *
 *   親子の繋がりを先に読み、
 *   子の数だけ幅を取って置き直す。
 *   枝分かれと合流が、そのまま形になる。
 *
 * ★ 線は SVG で引く。
 *
 *   四角い箱の縁に線を足すやり方だと、
 *   札を貫いたり、途中で切れたりする。
 *   丸の縁から縁へ、曲げて繋ぐ。
 *
 * ★ 品物が増えても、置き直しは要らない。
 *   親を決めれば、位置は勝手に決まる。
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

/** 置き場所が決まった品物 */
interface Placed extends Item {
    x: number
    y: number
    state: 'owned' | 'ready' | 'poor' | 'locked' | 'coming'
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

const KIND_COLOR: Record<string, string> = {
    stamp: '#e8a33d',
    frame: '#5b8fc9',
    background: '#5fa88a',
    badge: '#c98b4b',
    name_style: '#9a7bc8',
    bookmark: '#d4776a',
    cover: '#6a8fa8',
    shelf: '#7a9a6a',
}

/* 置き方の寸法 */
/*
 * 置き方の寸法。
 *
 * ★ 目指す絵の比率に合わせる。
 *
 *   絵では、丸どうしの間が丸 1.5 個ぶんほど。
 *   段の間は丸 2 個ぶん。
 *   詰まっていることで、集まりに見える。
 *
 * ★ 縦に長くなってよい。
 *   送って見られる。横に潰すほうが読みにくい。
 */
const NODE = 76
const GAP_X = 112
const GAP_Y = 146
const PAD_X = 190 /* 左の見出しに、札が重ならないだけ空ける */
const PAD_TOP = 126 /* START のぶん。上に離す */

/*
 * 丸の下に付く札の高さ。
 *
 * ★ 線を引くときに要る。
 *   丸の下端から出すと、札を貫いてしまう。
 */
const LABEL_H = 38

export default function ItemTree() {
    const [items, setItems] = useState<Item[]>([])
    const [owned, setOwned] = useState<string[]>([])
    const [points, setPoints] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    /*
     * ★ 選んだものは、id で覚える。
     *
     *   品物そのものを覚えると、交換したあとも
     *   古い中身のまま残り、「交換済み」に変わらない。
     *   id なら、読み直すたびに今の様子が付いてくる。
     */
    const [pickedId, setPickedId] = useState<string | null>(null)


    /*
     * 種類で絞る。
     *
     * ★ 品物が増えると、木が横に伸びて探しにくい。
     *   欲しい種類だけ見られるようにする。
     *
     * ★ 絞っても、木の形は崩さない。
     *   外れたものは薄くして、繋がりは残す。
     */
    const [filter, setFilter] = useState<string>('all')
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
                setMessage('交換しました。')
                await reload()
            }
        } catch {
            setMessage('繋がりませんでした。')
        }

        setBusy(false)
    }

    /*
     * ★ 繋がりから、置き場所を出す。
     *
     *   親を持たないものが START の子。
     *   子を先に置き、親はその真ん中へ寄せる。
     *   同じ段で場所がぶつからないよう、左から詰める。
     */
    const { placed, width, height } = useMemo(() => {
        if (items.length === 0) {
            return { placed: [] as Placed[], width: 600, height: 240 }
        }

        const stateOf = (item: Item): Placed['state'] => {
            if (owned.includes(item.id)) return 'owned'
            if (!item.is_active) return 'coming'

            if (item.requires_item_id && !owned.includes(item.requires_item_id)) {
                return 'locked'
            }

            if ((item.free_price ?? 0) > points) return 'poor'
            return 'ready'
        }

        const childrenOf = new Map<string, Item[]>()

        for (const item of items) {
            const key = item.requires_item_id ?? 'root'
            if (!childrenOf.has(key)) childrenOf.set(key, [])
            childrenOf.get(key)!.push(item)
        }

        for (const list of childrenOf.values()) {
            list.sort((a, b) => a.position - b.position)
        }

        const slot = new Map<number, number>()
        const spot = new Map<string, { x: number; y: number }>()

        const walk = (item: Item): number => {
            const kids = childrenOf.get(item.id) ?? []
            const y = PAD_TOP + (item.tier - 1) * GAP_Y

            if (kids.length === 0) {
                const at = slot.get(item.tier) ?? 0
                slot.set(item.tier, at + 1)

                const x = PAD_X + at * GAP_X
                spot.set(item.id, { x, y })
                return x
            }

            const xs = kids.map((kid) => walk(kid))
            const mid = (Math.min(...xs) + Math.max(...xs)) / 2

            const at = slot.get(item.tier) ?? 0
            const least = PAD_X + at * GAP_X
            const x = Math.max(mid, least)

            slot.set(
                item.tier,
                Math.max(at + 1, Math.round((x - PAD_X) / GAP_X) + 1),
            )

            spot.set(item.id, { x, y })
            return x
        }

        for (const root of childrenOf.get('root') ?? []) walk(root)

        /* 置き損ねたものを拾う */
        for (const item of items) {
            if (spot.has(item.id)) continue

            const at = slot.get(item.tier) ?? 0
            slot.set(item.tier, at + 1)

            spot.set(item.id, {
                x: PAD_X + at * GAP_X,
                y: PAD_TOP + (item.tier - 1) * GAP_Y,
            })
        }

        const list: Placed[] = items.map((item) => ({
            ...item,
            ...spot.get(item.id)!,
            state: stateOf(item),
        }))

        return {
            placed: list,
            width: Math.max(...list.map((one) => one.x)) + PAD_X,
            height: Math.max(...list.map((one) => one.y)) + 100,
        }
    }, [items, owned, points])

    if (isLoading) return null

    const byId = new Map(placed.map((one) => [one.id, one]))
    const picked = placed.find((one) => one.id === pickedId) ?? null
    const roots = placed.filter((one) => !one.requires_item_id)

    const startX =
        roots.length > 0
            ? (Math.min(...roots.map((r) => r.x)) +
                  Math.max(...roots.map((r) => r.x))) /
              2
            : width / 2

    return (
        <div
            style={{
                /*
                 * ★ 紙の地を作る。
                 *
                 *   白い板に丸が置いてあるだけだと、
                 *   管理画面にしか見えない。
                 *
                 *   淡い水色の紙に、上から光が差す。
                 *   細かい格子を敷いて、紙の目を出す。
                 */
                position: 'relative',
                background: `
                    radial-gradient(900px 300px at 50% -60px, rgba(255,255,255,.9), transparent 70%),
                    linear-gradient(180deg, #eaf2f7 0%, #f4f9fb 38%, #fbfdfe 100%)
                `,
                backgroundImage: `
                    radial-gradient(900px 300px at 50% -60px, rgba(255,255,255,.9), transparent 70%),
                    linear-gradient(rgba(90,140,170,.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(90,140,170,.05) 1px, transparent 1px),
                    linear-gradient(180deg, #eaf2f7 0%, #f4f9fb 38%, #fbfdfe 100%)
                `,
                backgroundSize: '100% 100%, 28px 28px, 28px 28px, 100% 100%',
                border: '1px solid rgba(120,160,185,.28)',
                borderRadius: 16,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7)',
                padding: '18px 20px 26px',
                overflow: 'hidden',
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

                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
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
              * ★ 種類で絞る。
              *
              *   品物が増えると、木が横に伸びて探しにくい。
              *   外れたものは薄くするだけで、繋がりは残す。
              */}
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 10,
                }}
            >
                {([
                    ['all', 'すべて'],
                    ['stamp', 'スタンプ'],
                    ['frame', 'フレーム'],
                    ['background', '背景'],
                    ['other', 'その他'],
                ] as const).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        style={{
                            padding: '4px 14px',
                            borderRadius: 999,
                            border:
                                filter === key
                                    ? '1px solid var(--color-brand)'
                                    : '1px solid var(--color-brand-border)',
                            background:
                                filter === key
                                    ? 'var(--color-brand)'
                                    : 'var(--color-bg-card)',
                            color:
                                filter === key
                                    ? 'var(--color-text-inverse)'
                                    : 'var(--color-text-muted)',
                            fontSize: 11.5,
                            fontWeight: filter === key ? 700 : 400,
                            cursor: 'pointer',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div
                style={{
                    height: 7,
                    borderRadius: 999,
                    background: 'rgba(0,0,0,.06)',
                    overflow: 'hidden',
                    marginBottom: 6,
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
              * ★ 木そのもの。
              *
              *   線は SVG で下に敷き、丸はその上に置く。
              *   線が札を貫かない。
              */}
            {/*
              * ★ 木を、枠の幅に合わせて広げる。
              *
              *   置き場所は 128px 間隔で決めているので、
              *   広い画面では右が大きく空く。
              *   枠に合わせて引き伸ばせば、真ん中に収まる。
              *
              * ★ 狭い画面では、送って見る。
              *   縮めすぎると、札の字が読めなくなる。
              */}
            {/*
              * ★ 木と、詳しい欄を横に並べる。
              *
              *   下に出すと、押すたびに画面が伸び縮みして
              *   木のどこを見ていたか分からなくなる。
              *   横に置けば、木を見ながら中身を確かめられる。
              *
              * ★ 狭い画面では、下に回り込む。
              */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ overflowX: 'auto', paddingBottom: 8, flex: '1 1 460px', minWidth: 0 }}>
                <div
                    style={{
                        position: 'relative',
                        width,
                        height,
                        margin: '0 auto',
                        minWidth: width,
                    }}
                >
                    {Object.entries(TIER_LABEL).map(([tier, label]) => {
                        const level = Number(tier)
                        if (!placed.some((one) => one.tier === level)) return null

                        return (
                            <div
                                key={tier}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: PAD_TOP + (level - 1) * GAP_Y - 18,
                                    width: 110,
                                    paddingLeft: 12,
                                    /*
                                     * ★ 縦の道を引く。
                                     *
                                     *   Lv が説明文ではなく、
                                     *   上から下へ進む道に見える。
                                     */
                                    borderLeft: '2px solid rgba(120,160,185,.35)',
                                    pointerEvents: 'none',
                                }}
                            >
                                {/*
                                  * ★ 菱形の印。
                                  *
                                  *   縦線の上に置くと、
                                  *   道の途中にある関所に見える。
                                  *   ただの見出しではなく、
                                  *   進行の段だと分かる。
                                  */}
                                <span
                                    style={{
                                        position: 'absolute',
                                        left: -7,
                                        top: 4,
                                        width: 11,
                                        height: 11,
                                        background: '#fff',
                                        border: '2px solid var(--color-brand)',
                                        transform: 'rotate(45deg)',
                                    }}
                                />

                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: 'var(--color-brand)',
                                        letterSpacing: '.02em',
                                    }}
                                >
                                    {label.title}
                                </div>
                                <div
                                    style={{
                                        marginTop: 2,
                                        fontSize: 9.5,
                                        lineHeight: 1.5,
                                        color: 'var(--color-text-faint)',
                                    }}
                                >
                                    {label.note}
                                </div>
                            </div>
                        )
                    })}

                    <svg
                        width={width}
                        height={height}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            pointerEvents: 'none',
                        }}
                        aria-hidden="true"
                    >
                        {roots.map((root) => (
                            <path
                                key={`start-${root.id}`}
                                d={elbow(
                                    startX,
                                    PAD_TOP - 84,
                                    root.x,
                                    root.y - NODE / 2 - 9,
                                )}
                                fill="none"
                                stroke={
                                    root.state === 'owned'
                                        ? 'var(--color-brand)'
                                        : 'var(--color-brand-border)'
                                }
                                strokeWidth={root.state === 'owned' ? 2.5 : 2}
                            />
                        ))}

                        {placed.map((item) => {
                            if (!item.requires_item_id) return null

                            const from = byId.get(item.requires_item_id)
                            if (!from) return null

                            const done = owned.includes(from.id)

                            return (
                                <path
                                    key={`link-${item.id}`}
                                    /*
                                     * ★ 線は、札の下から出す。
                                     *
                                     *   丸の下端から出すと、
                                     *   その下にある札を貫いてしまう。
                                     *   札の高さ（約 46）ぶん下げる。
                                     */
                                    d={elbow(
                                        from.x,
                                        from.y + NODE / 2 + LABEL_H,
                                        item.x,
                                        /*
                                         * ★ 輪のぶん、手前で止める。
                                         *
                                         *   丸の縁ちょうどで止めると、
                                         *   外に巻いた輪を線が貫いて見える。
                                         */
                                        item.y - NODE / 2 - 9,
                                    )}
                                    fill="none"
                                    /*
                                     * ★ 道の様子で、線の色を変える。
                                     *
                                     *   取った道   緑。歩いた跡
                                     *   次の道     青。ここから進める
                                     *   まだの道   薄い灰
                                     *
                                     *   攻略の道筋が、色で見える。
                                     */
                                    stroke={
                                        done
                                            ? '#5fa88a'
                                            : item.state === 'ready'
                                              ? '#5b8fc9'
                                              : 'rgba(0,0,0,.1)'
                                    }
                                    /*
                                     * ★ 線は細く。
                                     *   太いと骨組みが主役になり、
                                     *   丸が飾りに見える。
                                     */
                                    strokeWidth={
                                        done ? 2.5 : item.state === 'ready' ? 2.5 : 1.5
                                    }
                                    strokeLinecap="round"
                                    opacity={done || item.state === 'ready' ? 1 : 0.8}
                                />
                            )
                        })}
                    </svg>

                    <div
                        style={{
                            position: 'absolute',
                            left: startX,
                            top: PAD_TOP - 84,
                            transform: 'translate(-50%, -50%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 54,
                            height: 54,
                            borderRadius: '50%',
                            background: 'var(--color-brand)',
                            color: 'var(--color-text-inverse)',
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: '.1em',
                            boxShadow: '0 3px 12px rgba(40,90,130,.28)',
                        }}
                    >
                        START
                    </div>

                    {placed.map((item) => {
                        /*
                         * ★ 絞りから外れたものは、薄くする。
                         *
                         *   消すと木が崩れて、
                         *   どこが繋がっていたか分からなくなる。
                         */
                        const inFilter =
                            filter === 'all' ||
                            item.kind === filter ||
                            (filter === 'other' &&
                                !['stamp', 'frame', 'background'].includes(
                                    item.kind,
                                ))

                        return (
                            <Node
                                key={item.id}
                                item={item}
                                dim={!inFilter}
                                chosen={item.id === pickedId}
                                onPick={() => {
                                    setPickedId(item.id)
                                    setMessage('')
                                }}
                            />
                        )
                    })}
                </div>
            </div>

            {/*
              * ★ 右の欄は、送っても付いてくる。
              *
              *   木は縦に長い。下のほうの丸を押したとき、
              *   欄が上に置いたままだと見えない。
              */}
            <div
                style={{
                    flex: '0 0 274px',
                    minWidth: 250,
                    position: 'sticky',
                    top: 8,
                    alignSelf: 'flex-start',
                }}
            >
                {picked ? (
                    <Detail
                        item={picked}
                        all={placed}
                        ownedIds={owned}
                        points={points}
                        busy={busy}
                        message={message}
                        onClose={() => setPickedId(null)}
                        onJump={(id) => {
                            setPickedId(id)
                            setMessage('')
                        }}
                        onExchange={() => void exchange(picked)}
                    />
                ) : (
                    /*
                     * ★ 何も選んでいないときも、場所を空けておく。
                     *
                     *   選ぶたびに木が横へずれると、
                     *   見ていた所を見失う。
                     *
                     * ★ 空でも、同じ形の額を出しておく。
                     *   点線の箱だけだと、作りかけに見える。
                     */
                    <div
                        style={{
                            padding: '30px 18px 34px',
                            borderRadius: 14,
                            border: '1px solid rgba(120,160,185,.3)',
                            background:
                                'linear-gradient(180deg, #ffffff 0%, #f7fbfd 100%)',
                            boxShadow: '0 2px 10px rgba(40,70,95,.06)',
                            textAlign: 'center',
                        }}
                    >
                        <span
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 92,
                                height: 92,
                                margin: '0 auto 14px',
                                borderRadius: '50%',
                                background: '#fff',
                                boxShadow: [
                                    '0 0 0 1px rgba(255,255,255,.9)',
                                    '0 0 0 3px rgba(120,160,185,.28)',
                                    '0 0 0 7px rgba(120,160,185,.08)',
                                ].join(', '),
                                fontSize: 26,
                                color: 'var(--color-text-faint)',
                            }}
                        >
                            ？
                        </span>

                        <p
                            style={{
                                fontSize: 11.5,
                                lineHeight: 1.9,
                                color: 'var(--color-text-faint)',
                            }}
                        >
                            気になるアイテムを押すと、
                            <br />
                            ここに詳しく出ます。
                        </p>
                    </div>
                )}
            </div>
            </div>
        </div>
    )
}

/**
 * 親から子へ引く線。
 *
 * ★ 斜めではなく、縦・横で曲げる。
 *
 *   斜めの線が交差すると、
 *   どれがどれに繋がっているか分からなくなる。
 *   縦に降りて、横へ寄って、また縦に降りる。
 */
function elbow(x1: number, y1: number, x2: number, y2: number): string {
    if (Math.abs(x1 - x2) < 1) return `M${x1} ${y1} L${x2} ${y2}`

    const mid = y1 + (y2 - y1) / 2
    const r = 12
    const dir = x2 > x1 ? 1 : -1

    return [
        `M${x1} ${y1}`,
        `L${x1} ${mid - r}`,
        `Q${x1} ${mid} ${x1 + r * dir} ${mid}`,
        `L${x2 - r * dir} ${mid}`,
        `Q${x2} ${mid} ${x2} ${mid + r}`,
        `L${x2} ${y2}`,
    ].join(' ')
}

/** 品物ひとつ */
function Node({
    item,
    dim,
    chosen,
    onPick,
}: {
    item: Placed
    /** 絞りから外れているか。薄くするだけで、消さない */
    dim?: boolean
    /** いま右の欄に出ているか */
    chosen?: boolean
    onPick: () => void
}) {
    const hidden = item.is_secret && item.state !== 'owned'
    const color = KIND_COLOR[item.kind] ?? '#999'

    /* いちばん奥の品物は、大きく */
    const isGoal = item.tier >= 5
    const size = isGoal ? 80 : NODE

    return (
        <button
            type="button"
            disabled={item.state === 'coming'}
            onClick={onPick}
            style={{
                position: 'absolute',
                left: item.x,
                top: item.y,
                /*
                 * ★ 選んでいるものは、少し大きく。
                 *   右の欄とどれが繋がっているか、ひと目で分かる。
                 */
                transform: chosen
                    ? 'translate(-50%, -50%) scale(1.08)'
                    : 'translate(-50%, -50%)',
                transition: 'transform .16s ease',
                zIndex: chosen ? 3 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: item.state === 'coming' ? 'default' : 'pointer',
                opacity: dim
                    ? 0.2
                    : item.state === 'ready' || item.state === 'owned'
                      ? 1
                      : 0.62,
            }}
        >
            <span
                style={{
                    position: 'relative',
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    /*
                     * ★ 中は白一色。
                     *
                     *   色を敷くと、絵が入ったときに濁る。
                     *   ここは額の中。色は外の装飾で出す。
                     */
                    background: '#fff',
                    /*
                     * ★ 取れるものは、金色で光らせる。
                     *
                     *   「あと少しで取れそう」が、
                     *   目に飛び込むようにする。
                     */
                    /*
                     * ★ 器を作る。
                     *
                     *   絵を入れる場所なので、
                     *   中は白く、外に二重の縁を巻く。
                     *
                     *     内側  細い白。絵を額から浮かせる
                     *     外側  状態の色。太く
                     *     その外 光。買えるものだけ強く
                     *
                     *   絵が無いいまは、器だけが見える。
                     *   絵が入れば、そのまま額になる。
                     */
                    /*
                     * ★ 白い丸のまわりに、輪を重ねる。
                     *
                     *   縁の線 1 本だけだと、平たい円に見える。
                     *   内側に細い輪、外に太い輪、
                     *   さらに外に淡い光。三重にすると、
                     *   絵が額に収まっているように見える。
                     *
                     * ★ 状態は、外の輪の色で表す。
                     *   中を塗ると、絵が入ったとき濁る。
                     */
                    border: 'none',
                    boxShadow:
                        item.state === 'owned'
                            ? [
                                  '0 0 0 1px rgba(255,255,255,.9)',
                                  '0 0 0 4px #5fa88a',
                                  '0 0 0 8px rgba(95,168,138,.16)',
                                  '0 6px 18px rgba(60,120,100,.28)',
                              ].join(', ')
                            : item.state === 'ready'
                              ? [
                                    '0 0 0 1px rgba(255,255,255,.9)',
                                    '0 0 0 4px #d9a441',
                                    '0 0 0 9px rgba(217,164,65,.2)',
                                    '0 0 0 14px rgba(217,164,65,.08)',
                                    '0 6px 20px rgba(190,140,50,.3)',
                                ].join(', ')
                              : hidden
                                ? [
                                      '0 0 0 1px rgba(255,255,255,.9)',
                                      '0 0 0 2px rgba(120,160,185,.34)',
                                      '0 3px 10px rgba(40,60,80,.09)',
                                  ].join(', ')
                                : [
                                      '0 0 0 1px rgba(255,255,255,.9)',
                                      `0 0 0 3px ${color}66`,
                                      `0 0 0 7px ${color}14`,
                                      '0 3px 12px rgba(40,60,80,.11)',
                                  ].join(', '),
                    outline: chosen ? '2px dashed var(--color-brand)' : 'none',
                    outlineOffset: 9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isGoal ? 28 : 22,
                    color: hidden ? 'var(--color-text-faint)' : color,
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
                    isGoal ? '🔒' : '?'
                ) : (
                    (KIND_MARK[item.kind] ?? '?')
                )}

                {item.state === 'owned' && (
                    <span
                        style={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: 'var(--color-brand)',
                            color: '#fff',
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        ✓
                    </span>
                )}
            </span>

            <span
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    marginTop: -8,
                    padding: '4px 9px 5px',
                    borderRadius: 7,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-brand-border)',
                    boxShadow: '0 1px 3px rgba(40,35,25,.07)',
                    minWidth: 72,
                }}
            >
                <span
                    style={{
                        fontSize: 9.5,
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {hidden ? 'シークレット' : KIND_LABEL[item.kind] ?? item.kind}
                </span>

                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color:
                            item.state === 'owned'
                                ? 'var(--color-brand)'
                                : 'var(--color-text)',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {item.state === 'owned'
                        ? '交換済み'
                        : `${(item.free_price ?? 0).toLocaleString()} pt`}
                </span>
            </span>
        </button>
    )
}

/**
 * 選んだ品物の中身。
 *
 * ★ 目指す絵と同じ、右に立てる額にする。
 *
 *   前は「名前・説明・ボタン」だけの札だった。
 *   絵が主役の画面なのに、右が字ばかりでは釣り合わない。
 *
 *   上に大きな額、下に使い道と仲間。
 *   絵が入る場所を先に作っておけば、
 *   描き上がったものを入れるだけで形になる。
 */
function Detail({
    item,
    all,
    ownedIds,
    points,
    busy,
    message,
    onClose,
    onJump,
    onExchange,
}: {
    item: Placed
    /** 木に並んでいる全部。仲間と、前提を引くのに要る */
    all: Placed[]
    ownedIds: string[]
    points: number
    busy: boolean
    message: string
    onClose: () => void
    /** 仲間を押したとき、そちらへ移る */
    onJump: (id: string) => void
    onExchange: () => void
}) {
    const owned = ownedIds.includes(item.id)
    const hidden = item.is_secret && !owned
    const price = item.free_price ?? 0
    const color = KIND_COLOR[item.kind] ?? '#7a93a8'

    /* 先に取っておく必要のあるもの */
    const needs = item.requires_item_id
        ? (all.find((one) => one.id === item.requires_item_id) ?? null)
        : null
    const needsDone = needs ? ownedIds.includes(needs.id) : true

    /*
     * 同じ種類の仲間。
     *
     * ★ ひとつ見ると、似たものも見たくなる。
     *   木の中から探し直さずに済む。
     */
    const kin = all
        .filter((one) => one.kind === item.kind && one.id !== item.id)
        .sort((a, b) => a.tier - b.tier || a.position - b.position)
        .slice(0, 4)

    return (
        <div
            style={{
                borderRadius: 14,
                border: '1px solid rgba(120,160,185,.32)',
                background: '#fff',
                boxShadow: '0 4px 16px rgba(40,70,95,.1)',
                overflow: 'hidden',
            }}
        >
            {/*
              * ★ 上の帯。
              *
              *   種類の色をここだけに敷く。
              *   額の中まで塗ると、絵が入ったとき濁る。
              */}
            <div
                style={{
                    position: 'relative',
                    padding: '16px 16px 18px',
                    background: `linear-gradient(180deg, ${color}1f 0%, ${color}08 60%, rgba(255,255,255,0) 100%)`,
                    borderBottom: '1px solid rgba(120,160,185,.16)',
                    textAlign: 'center',
                }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="閉じる"
                    style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        border: '1px solid rgba(120,160,185,.3)',
                        background: 'rgba(255,255,255,.8)',
                        fontSize: 12,
                        lineHeight: 1,
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                    }}
                >
                    ✕
                </button>

                {/*
                  * ★ 大きな額。
                  *
                  *   木の丸と同じ作りを、そのまま大きくする。
                  *   押したものが、そのまま右に来たと分かる。
                  */}
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 104,
                        height: 104,
                        margin: '2px auto 12px',
                        borderRadius: '50%',
                        background: '#fff',
                        overflow: 'hidden',
                        fontSize: 38,
                        color: hidden ? 'var(--color-text-faint)' : color,
                        boxShadow: owned
                            ? [
                                  '0 0 0 1px rgba(255,255,255,.9)',
                                  '0 0 0 5px #5fa88a',
                                  '0 0 0 10px rgba(95,168,138,.16)',
                                  '0 8px 22px rgba(60,120,100,.24)',
                              ].join(', ')
                            : item.state === 'ready'
                              ? [
                                    '0 0 0 1px rgba(255,255,255,.9)',
                                    '0 0 0 5px #d9a441',
                                    '0 0 0 11px rgba(217,164,65,.2)',
                                    '0 8px 22px rgba(190,140,50,.26)',
                                ].join(', ')
                              : [
                                    '0 0 0 1px rgba(255,255,255,.9)',
                                    `0 0 0 4px ${color}66`,
                                    `0 0 0 9px ${color}14`,
                                    '0 6px 18px rgba(40,60,80,.1)',
                                ].join(', '),
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
                        '🔒'
                    ) : (
                        (KIND_MARK[item.kind] ?? '?')
                    )}
                </span>

                <div
                    style={{
                        fontSize: 15,
                        fontWeight: 700,
                        lineHeight: 1.5,
                        color: 'var(--color-text)',
                    }}
                >
                    {hidden ? 'シークレット' : item.name}
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 5,
                        marginTop: 7,
                        flexWrap: 'wrap',
                    }}
                >
                    <span
                        style={{
                            padding: '2px 10px',
                            borderRadius: 999,
                            background: `${color}1f`,
                            color: '#4a5a66',
                            fontSize: 10.5,
                            fontWeight: 700,
                        }}
                    >
                        {KIND_LABEL[item.kind] ?? item.kind}
                    </span>

                    <span
                        style={{
                            padding: '2px 10px',
                            borderRadius: 999,
                            background: 'rgba(120,160,185,.14)',
                            color: '#4a5a66',
                            fontSize: 10.5,
                            fontWeight: 700,
                        }}
                    >
                        {TIER_LABEL[item.tier]?.title ?? `Lv.${item.tier}`}
                    </span>

                    {owned && (
                        <span
                            style={{
                                padding: '2px 10px',
                                borderRadius: 999,
                                background: 'rgba(95,168,138,.18)',
                                color: '#3d7a63',
                                fontSize: 10.5,
                                fontWeight: 700,
                            }}
                        >
                            交換済み
                        </span>
                    )}
                </div>
            </div>

            <div style={{ padding: '14px 16px 16px' }}>
                <p
                    style={{
                        fontSize: 11.5,
                        lineHeight: 1.9,
                        color: 'var(--color-text-muted)',
                    }}
                >
                    {hidden
                        ? '交換するまで、中身は分かりません。'
                        : item.description ||
                          'この品物の説明は、これから用意します。'}
                </p>

                {/*
                  * ★ 値段は、行に分けて置く。
                  *
                  *   ボタンの字だけだと、
                  *   手持ちと見比べられない。
                  */}
                {!owned && item.is_active && (
                    <div
                        style={{
                            marginTop: 12,
                            padding: '9px 12px',
                            borderRadius: 9,
                            background: 'rgba(120,160,185,.08)',
                            fontSize: 11.5,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            <span>必要なポイント</span>
                            <b
                                style={{
                                    color: 'var(--color-text)',
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {price.toLocaleString()} pt
                            </b>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: 4,
                                color: 'var(--color-text-faint)',
                            }}
                        >
                            <span>手持ち</span>
                            <span
                                style={{
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {points.toLocaleString()} pt
                            </span>
                        </div>
                    </div>
                )}

                {/*
                  * ★ 先に取っておくものを出す。
                  *
                  *   押せない理由が分からないと、
                  *   壊れていると思われる。
                  */}
                {needs && !needsDone && (
                    <button
                        type="button"
                        onClick={() => onJump(needs.id)}
                        style={{
                            display: 'block',
                            width: '100%',
                            marginTop: 10,
                            padding: '8px 12px',
                            borderRadius: 9,
                            border: '1px solid rgba(217,164,65,.45)',
                            background: 'rgba(217,164,65,.1)',
                            fontSize: 11,
                            lineHeight: 1.7,
                            color: '#8a6a25',
                            textAlign: 'left',
                            cursor: 'pointer',
                        }}
                    >
                        先に「
                        {needs.is_secret && !ownedIds.includes(needs.id)
                            ? 'シークレット'
                            : needs.name}
                        」が要ります
                    </button>
                )}

                {owned ? (
                    <p
                        style={{
                            marginTop: 12,
                            padding: '9px 12px',
                            borderRadius: 9,
                            background: 'rgba(95,168,138,.12)',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#3d7a63',
                            textAlign: 'center',
                        }}
                    >
                        交換済みです
                    </p>
                ) : !item.is_active ? (
                    <p
                        style={{
                            marginTop: 12,
                            padding: '9px 12px',
                            borderRadius: 9,
                            background: 'rgba(120,160,185,.1)',
                            fontSize: 11.5,
                            color: 'var(--color-text-muted)',
                            textAlign: 'center',
                        }}
                    >
                        この品物は、まだ用意していません。
                    </p>
                ) : (
                    <button
                        type="button"
                        disabled={busy || price > points || !needsDone}
                        onClick={onExchange}
                        style={{
                            display: 'block',
                            width: '100%',
                            marginTop: 12,
                            padding: '10px 16px',
                            borderRadius: 9,
                            border: 'none',
                            background:
                                price > points || !needsDone
                                    ? 'rgba(120,160,185,.22)'
                                    : 'var(--color-brand)',
                            color:
                                price > points || !needsDone
                                    ? 'var(--color-text-muted)'
                                    : 'var(--color-text-inverse)',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor:
                                price > points || !needsDone
                                    ? 'not-allowed'
                                    : 'pointer',
                        }}
                    >
                        {!needsDone
                            ? 'まだ交換できません'
                            : price > points
                              ? `あと ${(price - points).toLocaleString()} pt`
                              : `${price.toLocaleString()} pt で交換する`}
                    </button>
                )}

                {message && (
                    <p
                        style={{
                            marginTop: 8,
                            fontSize: 11.5,
                            textAlign: 'center',
                            color: 'var(--color-text)',
                        }}
                    >
                        {message}
                    </p>
                )}

                {/*
                  * ★ 使い道を見せる。
                  *
                  *   名前と値段だけでは、
                  *   取ったあと何が変わるのか分からない。
                  *   出る場所を、形で示す。
                  */}
                {!hidden && (
                    <>
                        <Line label="使い道" />
                        <Usage kind={item.kind} color={color} item={item} />
                    </>
                )}

                {kin.length > 0 && (
                    <>
                        <Line label="同じ種類" />

                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                            }}
                        >
                            {kin.map((one) => {
                                const veil =
                                    one.is_secret && !ownedIds.includes(one.id)

                                return (
                                    <button
                                        key={one.id}
                                        type="button"
                                        onClick={() => onJump(one.id)}
                                        title={veil ? 'シークレット' : one.name}
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: '50%',
                                            border: 'none',
                                            background: '#fff',
                                            boxShadow: ownedIds.includes(one.id)
                                                ? '0 0 0 1px #fff, 0 0 0 3px #5fa88a'
                                                : `0 0 0 1px #fff, 0 0 0 2px ${color}55`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 17,
                                            color: veil
                                                ? 'var(--color-text-faint)'
                                                : color,
                                            cursor: 'pointer',
                                            overflow: 'hidden',
                                            padding: 0,
                                        }}
                                    >
                                        {!veil && one.asset_url ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={one.asset_url}
                                                alt=""
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        ) : veil ? (
                                            '?'
                                        ) : (
                                            (KIND_MARK[one.kind] ?? '?')
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

/** 小さな見出しの線 */
function Line({ label }: { label: string }) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                margin: '16px 0 9px',
            }}
        >
            <span
                style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '.06em',
                    color: 'var(--color-text-faint)',
                    whiteSpace: 'nowrap',
                }}
            >
                {label}
            </span>
            <span
                style={{
                    flex: 1,
                    height: 1,
                    background: 'rgba(120,160,185,.22)',
                }}
            />
        </div>
    )
}

/**
 * 使い道の見本。
 *
 * ★ 絵が無くても、出る場所は見せられる。
 *
 *   スタンプなら、感想の吹き出しの中。
 *   フレームなら、丸い顔の周り。
 *   背景なら、部屋の地。
 *
 *   器だけ先に作っておけば、
 *   絵ができたとき、そのまま収まる。
 */
function Usage({
    kind,
    color,
    item,
}: {
    kind: string
    color: string
    item: Placed
}) {
    const mark = KIND_MARK[kind] ?? '?'

    const box: React.CSSProperties = {
        padding: 12,
        borderRadius: 10,
        background:
            'linear-gradient(180deg, rgba(120,160,185,.07) 0%, rgba(120,160,185,.03) 100%)',
        border: '1px solid rgba(120,160,185,.16)',
    }

    const note: React.CSSProperties = {
        marginTop: 7,
        fontSize: 10.5,
        lineHeight: 1.7,
        color: 'var(--color-text-faint)',
    }

    const art = (size: number) =>
        item.asset_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
                src={item.asset_url}
                alt=""
                style={{ width: size, height: size, objectFit: 'contain' }}
            />
        ) : (
            <span style={{ fontSize: size * 0.62, color }}>{mark}</span>
        )

    if (kind === 'stamp') {
        return (
            <div style={box}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <span
                        style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: 'rgba(120,160,185,.22)',
                            flex: '0 0 auto',
                        }}
                    />

                    <span
                        style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '2px 10px 10px 10px',
                            background: '#fff',
                            border: '1px solid rgba(120,160,185,.2)',
                        }}
                    >
                        <span
                            style={{
                                display: 'block',
                                height: 6,
                                width: '76%',
                                borderRadius: 3,
                                background: 'rgba(120,160,185,.2)',
                            }}
                        />
                        <span
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 46,
                                height: 46,
                                marginTop: 8,
                                borderRadius: 8,
                                background: `${color}12`,
                                border: `1px dashed ${color}66`,
                            }}
                        >
                            {art(30)}
                        </span>
                    </span>
                </div>

                <p style={note}>感想やコメントに、貼って送れます。</p>
            </div>
        )
    }

    if (kind === 'frame' || kind === 'name_style') {
        return (
            <div style={box}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                    }}
                >
                    <span
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: 'rgba(120,160,185,.22)',
                            boxShadow:
                                kind === 'frame'
                                    ? `0 0 0 2px #fff, 0 0 0 5px ${color}`
                                    : 'none',
                            flex: '0 0 auto',
                        }}
                    />

                    <span style={{ flex: 1 }}>
                        <span
                            style={{
                                display: 'block',
                                height: 8,
                                width: '62%',
                                borderRadius: 4,
                                background:
                                    kind === 'name_style'
                                        ? `linear-gradient(90deg, ${color}, ${color}44)`
                                        : 'rgba(120,160,185,.3)',
                            }}
                        />
                        <span
                            style={{
                                display: 'block',
                                height: 6,
                                width: '40%',
                                marginTop: 6,
                                borderRadius: 3,
                                background: 'rgba(120,160,185,.16)',
                            }}
                        />
                    </span>
                </div>

                <p style={note}>
                    {kind === 'frame'
                        ? 'プロフィールの顔まわりに付きます。'
                        : 'プロフィールの名前を飾ります。'}
                </p>
            </div>
        )
    }

    if (kind === 'background' || kind === 'shelf') {
        return (
            <div style={box}>
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 74,
                        borderRadius: 8,
                        background: item.asset_url
                            ? `center / cover no-repeat url(${item.asset_url})`
                            : `repeating-linear-gradient(45deg, ${color}14 0 10px, ${color}08 10px 20px)`,
                        border: '1px solid rgba(120,160,185,.2)',
                    }}
                >
                    {!item.asset_url && (
                        <span
                            style={{
                                fontSize: 11,
                                color: 'var(--color-text-faint)',
                            }}
                        >
                            {kind === 'shelf' ? '本棚の地' : '部屋の地'}
                        </span>
                    )}
                </span>

                <p style={note}>
                    {kind === 'shelf'
                        ? '本棚の後ろに敷かれます。'
                        : 'ページの後ろに敷かれます。'}
                </p>
            </div>
        )
    }

    if (kind === 'badge') {
        return (
            <div style={box}>
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 12px',
                        borderRadius: 999,
                        background: '#fff',
                        border: `1px solid ${color}77`,
                        fontSize: 11,
                        color: '#4a5a66',
                    }}
                >
                    {art(14)}
                    {item.name}
                </span>

                <p style={note}>名前のとなりに出ます。</p>
            </div>
        )
    }

    return (
        <div style={box}>
            <span
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 58,
                    height: 76,
                    borderRadius: '3px 7px 7px 3px',
                    background: '#fff',
                    border: '1px solid rgba(120,160,185,.22)',
                    borderLeft: `5px solid ${color}`,
                }}
            >
                {art(26)}
            </span>

            <p style={note}>本の見た目に使えます。</p>
        </div>
    )
}
