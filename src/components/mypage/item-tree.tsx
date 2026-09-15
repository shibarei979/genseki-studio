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
const NODE = 82
const GAP_X = 124
const GAP_Y = 168
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

    const [picked, setPicked] = useState<Item | null>(null)


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
                                    root.y - NODE / 2,
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
                                        item.y - NODE / 2,
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
                                    strokeWidth={
                                        done ? 3.5 : item.state === 'ready' ? 3 : 2.5
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
                                onPick={() => {
                                    setPicked(item)
                                    setMessage('')
                                }}
                            />
                        )
                    })}
                </div>
            </div>

            <div style={{ flex: '0 0 250px', minWidth: 230 }}>
                {picked ? (
                    <Detail
                        item={picked}
                        owned={owned.includes(picked.id)}
                        points={points}
                        busy={busy}
                        message={message}
                        onClose={() => setPicked(null)}
                        onExchange={() => void exchange(picked)}
                    />
                ) : (
                    /*
                     * ★ 何も選んでいないときも、場所を空けておく。
                     *
                     *   選ぶたびに木が横へずれると、
                     *   見ていた所を見失う。
                     */
                    <div
                        style={{
                            padding: '20px 16px',
                            borderRadius: 12,
                            border: '1px dashed var(--color-brand-border)',
                            fontSize: 11.5,
                            lineHeight: 1.9,
                            color: 'var(--color-text-faint)',
                            textAlign: 'center',
                        }}
                    >
                        アイテムを押すと、
                        <br />
                        ここに詳しく出ます。
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
    onPick,
}: {
    item: Placed
    /** 絞りから外れているか。薄くするだけで、消さない */
    dim?: boolean
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
                transform: 'translate(-50%, -50%)',
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
                    /* 中は白。絵が入ったとき、色が濁らない */
                    background: hidden
                        ? 'linear-gradient(180deg,#f2f5f7,#e8edf1)'
                        : `linear-gradient(180deg,#fff, ${color}14)`,
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
                    border: '3px solid #fff',
                    boxShadow:
                        item.state === 'owned'
                            ? '0 0 0 3px #5fa88a, 0 4px 16px rgba(95,168,138,.34)'
                            : item.state === 'ready'
                              ? '0 0 0 3px #d9a441, 0 0 0 9px rgba(217,164,65,.18), 0 4px 18px rgba(217,164,65,.34)'
                              : hidden
                                ? '0 0 0 1.5px rgba(120,160,185,.4), 0 2px 8px rgba(40,60,80,.08)'
                                : `0 0 0 2px ${color}55, 0 2px 10px rgba(40,60,80,.1)`,
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

/** 選んだ品物の中身 */
function Detail({
    item,
    owned,
    points,
    busy,
    message,
    onClose,
    onExchange,
}: {
    item: Item
    owned: boolean
    points: number
    busy: boolean
    message: string
    onClose: () => void
    onExchange: () => void
}) {
    const hidden = item.is_secret && !owned
    const price = item.free_price ?? 0

    return (
        <div
            style={{
                marginTop: 8,
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
                    {hidden ? 'シークレット' : item.name}
                </span>

                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {KIND_LABEL[item.kind] ?? item.kind}
                </span>

                <button
                    type="button"
                    onClick={onClose}
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
                {hidden
                    ? '交換するまで、中身は分かりません。'
                    : item.description ||
                      'この品物の説明は、これから用意します。'}
            </p>

            {owned ? (
                <p
                    style={{
                        marginTop: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--color-brand)',
                    }}
                >
                    交換済みです。
                </p>
            ) : !item.is_active ? (
                <p
                    style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                    }}
                >
                    この品物は、まだ用意していません。
                </p>
            ) : (
                <button
                    type="button"
                    disabled={busy || price > points}
                    onClick={onExchange}
                    style={{
                        marginTop: 10,
                        padding: '8px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background:
                            price > points
                                ? 'var(--color-brand-border)'
                                : 'var(--color-brand)',
                        color:
                            price > points
                                ? 'var(--color-text-muted)'
                                : 'var(--color-text-inverse)',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: price > points ? 'not-allowed' : 'pointer',
                    }}
                >
                    {price > points
                        ? `あと ${(price - points).toLocaleString()} pt`
                        : `${price.toLocaleString()} pt で交換する`}
                </button>
            )}

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
    )
}
