'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { GoalPlate } from './goal-plate'

/**
 * ============================================================
 * 原石航路 Studio
 * ItemTree — アイテムツリー
 *
 * ★ 額は、絵で作る。
 *
 *   丸に影を重ねて額に見せようとしていたが、
 *   どう積んでも「白い円」にしかならなかった。
 *   描いた額を敷き、その上に品物の絵を載せる。
 *
 *   六つの額は、どれも同じ大きさに揃えてある。
 *   中の白い面の真ん中が、絵の中心。
 *   どの額に入れ替えても、絵はずれない。
 *
 * ★ 地も、絵で作る。
 *
 *   薄い水色を塗るだけでは、紙に見えなかった。
 *   空と海を敷く。上に薄い白を重ねて、字を読ませる。
 *
 * ★ 繋がりから位置を出すのは、前のまま。
 *   親を決めれば、置き場所は勝手に決まる。
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
    /*
     * 出る条件。
     *
     * ★ シークレットに「？」しか出ないと、諦められる。
     *   「感想を10回送ると現れる」と書いてあれば、取りに行く。
     *
     * ★ 古い作りから来た返事には無いことがある。
     */
    hint?: string | null
}

/** 置き場所が決まった品物 */
interface Placed extends Item {
    x: number
    y: number
    state: 'owned' | 'ready' | 'poor' | 'locked' | 'coming'
}

const TIER_LABEL: Record<number, { title: string; note: string }> = {
    1: { title: 'Lv.1', note: 'はじめの一歩' },
    2: { title: 'Lv.2', note: '自分らしく飾る' },
    3: { title: 'Lv.3', note: 'もっとつながる' },
    4: { title: 'Lv.4', note: '特別な品へ' },
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

const KIND_COLOR: Record<string, string> = {
    stamp: '#d99a3c',
    frame: '#4f86c0',
    background: '#4f9c82',
    badge: '#bf8244',
    name_style: '#8e72bd',
    bookmark: '#c96f63',
    cover: '#5f849c',
    shelf: '#719161',
}

/*
 * 額の絵。
 *
 * ★ 六つとも、同じ大きさに揃えてある。
 *   中の白い面の真ん中が、絵の中心に来る。
 */
const RING: Record<string, string> = {
    owned: '/items/ring-owned.webp',
    ready: '/items/ring-ready.webp',
    poor: '/items/ring-normal.webp',
    coming: '/items/ring-normal.webp',
    locked: '/items/ring-locked.webp',
    secret: '/items/ring-secret.webp',
    goal: '/items/ring-goal.webp',
}

/*
 * 品物の絵が無いあいだ、代わりに出す絵。
 *
 * ★ 空の額ばかりだと、出来上がりの見当がつかない。
 *   絵が付いた品物から、順に差し替わる。
 */
const STAND_IN = '/items/stamp-saikou.webp'

/*
 * いちばん奥の札の幅。
 *
 * ★ 枠は絵、数字だけ goal-plate.tsx で重ねている。
 *   絵には光の張り出しぶんの余白が入っているので、
 *   板そのものは、この三分の二ほどの幅で出る。
 */
const GOAL_W = 340

/*
 * 置き方の寸法。
 *
 * ★ 額が絵になったぶん、大きくする。
 *   小さいと、中の絵が潰れて何か分からない。
 */
const NODE = 104
const GAP_X = 150
const GAP_Y = 190
const PAD_X = 150 /* 左の見出しに、額が重ならないだけ空ける */

/*
 * START のぶん、上に空ける。
 *
 * ★ START の丸・幹・横木・枝の四つが
 *   収まるだけの高さが要る。
 */
const PAD_TOP = 186

/** START の大きさ */
const START = 66

/*
 * START から下りる横木の高さ。
 *
 * ★ 前は曲線の折れ位置を成り行きに任せていたので、
 *   横木が START の丸の中を通っていた。
 *   丸の下から幹を下ろし、ここで横に渡し、
 *   そこから各々の額へ下ろす。
 */
const BUS = PAD_TOP - NODE / 2 - 22

/*
 * 線を、額のどれだけ下から出すか。
 *
 * ★ 札の裏は通してよい。
 *
 *   前は札を避けて、札の下から線を出していた。
 *   すると段の間に見える線が二十数ピクセルしかなく、
 *   繋がっているように見えなかった。
 *
 *   札は白く塗り潰してあるので、
 *   裏を通った線は見えない。
 *   額の下から出せば、札の下に続いて出てくる。
 */
const LABEL_H = -4

/** 中の絵が占める割合。額の白い面に合わせてある */
const ART = 0.56

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
     */
    const [pickedId, setPickedId] = useState<string | null>(null)

    /*
     * 種類で絞る。
     *
     * ★ 絞っても、木の形は崩さない。
     *   外れたものは薄くして、繋がりは残す。
     */
    const [filter, setFilter] = useState<string>('all')
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')

    /*
     * ★ 手に入れた瞬間を、そこで見せる。
     *
     *   いちばんの見せ場なのに、
     *   下に小さく「交換しました」と出るだけだった。
     *   取った額で光らせる。
     */
    const [burstId, setBurstId] = useState<string | null>(null)

    /* 指を乗せているもの。条件の吹き出しを出す */
    const [hoverId, setHoverId] = useState<string | null>(null)

    /*
     * 枠の幅を測る。
     *
     * ★ 狭い画面では、木を縮めて丸ごと入れる。
     *
     *   横に送って見る作りだと、
     *   真ん中に寄せた木の左半分に手が届かない。
     *   （中央寄せしたものが枠からはみ出すと、
     *     左へは送れない）
     *
     *   縮めれば、送らずに全体が見える。
     */
    const boxRef = useRef<HTMLDivElement | null>(null)
    const [boxWidth, setBoxWidth] = useState(0)

    useEffect(() => {
        /*
         * ★ 読み込みが終わってから測る。
         *
         *   読み込み中は何も描いていないので、
         *   最初の一回では枠がまだ無い。
         */
        const box = boxRef.current
        if (!box) return

        const watch = new ResizeObserver(() => setBoxWidth(box.clientWidth))
        watch.observe(box)
        setBoxWidth(box.clientWidth)

        return () => watch.disconnect()
    }, [isLoading])

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
                setMessage('手に入れました。')
                setBurstId(item.id)
                window.setTimeout(() => setBurstId(null), 1500)
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

        /*
         * ★ その段にひとつしかないものは、親の真下へ寄せる。
         *
         *   葉は左から詰めて置くので、
         *   いちばん奥の一個が左端に落ちて、
         *   段の見出しに重なっていた。
         */
        const perTier = new Map<number, Item[]>()
        for (const item of items) {
            if (!perTier.has(item.tier)) perTier.set(item.tier, [])
            perTier.get(item.tier)!.push(item)
        }

        for (const [, only] of perTier) {
            if (only.length !== 1) continue

            const lone = only[0]
            const parent = lone.requires_item_id
                ? spot.get(lone.requires_item_id)
                : null
            if (!parent) continue

            const here = spot.get(lone.id)!
            spot.set(lone.id, { x: Math.max(parent.x, PAD_X), y: here.y })
        }

        const list: Placed[] = items.map((item) => ({
            ...item,
            ...spot.get(item.id)!,
            state: stateOf(item),
        }))

        return {
            placed: list,
            width: Math.max(...list.map((one) => one.x)) + 96,
            height: Math.max(...list.map((one) => one.y)) + 126,
        }
    }, [items, owned, points])

    if (isLoading) return null

    const byId = new Map(placed.map((one) => [one.id, one]))
    const picked = placed.find((one) => one.id === pickedId) ?? null

    const roots = placed.filter((one) => !one.requires_item_id)

    /*
     * ★ 入りきらないときだけ縮める。
     *   半分より小さくすると字が読めないので、そこで止める。
     */
    const fit =
        boxWidth > 0 && width > boxWidth
            ? Math.max(0.7, boxWidth / width)
            : 1

    /*
     * 指を乗せているものと、そこに出す言葉。
     *
     * ★ 伏せてあるものは、出る条件。
     * ★ 前の品物が要るものは、その名前。
     * ★ それ以外は、品物の名前。
     */
    const hovered = placed.find((one) => one.id === hoverId) ?? null

    const hoverText = (() => {
        if (!hovered) return ''

        const veiled = hovered.is_secret && hovered.state !== 'owned'

        if (veiled) {
            return hovered.hint
                ? hovered.hint
                : '出る条件は、まだ決まっていません。'
        }

        if (hovered.state === 'locked') {
            const from = placed.find(
                (one) => one.id === hovered.requires_item_id,
            )
            return from ? `先に「${from.name}」が要ります` : hovered.name
        }

        if (hovered.state === 'coming') return `${hovered.name}（準備中）`

        return hovered.name
    })()

    /*
     * 次に手が届くもの。
     *
     * ★ 前の品物が揃っていて、まだ持っていなくて、
     *   いちばん安いもの。いま目指すべき一個。
     */
    const next =
        placed
            .filter(
                (one) =>
                    one.state === 'poor' &&
                    (one.free_price ?? 0) > points,
            )
            .sort((a, b) => (a.free_price ?? 0) - (b.free_price ?? 0))[0] ?? null

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
                 * ★ 地に絵を敷く。
                 *
                 *   空と海の絵を上に置き、
                 *   その下は絵の水の色で埋める。
                 *   継ぎ目が出ない。
                 *
                 * ★ 白い薄布を一枚かける。
                 *   そのままだと、字も額も絵に負ける。
                 */
                position: 'relative',
                background: '#eef6f9',
                border: '1px solid rgba(120,160,185,.3)',
                borderRadius: 16,
                boxShadow: [
                    'inset 0 1px 0 rgba(255,255,255,.8)',
                    'inset 0 0 70px rgba(255,255,255,.5)',
                ].join(', '),
                padding: '18px 20px 26px',
                overflow: 'hidden',
            }}
        >
            {/*
              * ★ いま取れるものを、ゆっくり明滅させる。
              *
              *   金の額は目立つが、止まっていると
              *   「飾り」として流し見られてしまう。
              *   息をするように光ると、目が止まる。
              *
              * ★ 動きを嫌う設定の人には、動かさない。
              */}
            <style>{`
                @keyframes gtree-breathe {
                    0%, 100% { filter: drop-shadow(0 0 5px rgba(217,164,65,.5)); }
                    50%      { filter: drop-shadow(0 0 15px rgba(217,164,65,.95)); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .gtree-breathe { animation: none !important; }
                    .gtree-burst { display: none !important; }
                }

                /* 手に入れた瞬間 */
                @keyframes gtree-pop {
                    0%   { transform: translate(-50%, -50%) scale(.55); }
                    45%  { transform: translate(-50%, -50%) scale(1.3); }
                    70%  { transform: translate(-50%, -50%) scale(.94); }
                    100% { transform: translate(-50%, -50%) scale(1); }
                }
                @keyframes gtree-wave {
                    0%   { transform: translate(-50%, -50%) scale(.5); opacity: .95; }
                    100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0; }
                }
                @keyframes gtree-fly {
                    0%   { transform: rotate(var(--a)) translateY(-6px) scale(.3); opacity: 1; }
                    70%  { opacity: 1; }
                    100% { transform: rotate(var(--a)) translateY(-78px) scale(1.1); opacity: 0; }
                }
                @keyframes gtree-flash {
                    0%   { opacity: 0; }
                    18%  { opacity: .85; }
                    100% { opacity: 0; }
                }
            `}</style>

            {/*
              * ★ 地の絵は、別の板にして上から溶かす。
              *
              *   板そのものの背景にすると、
              *   板の高さで絵の出方が変わり、
              *   真ん中に水平線が横切る。
              *   上に敷いて、下へ消す。
              */}
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    height: 780,
                    background: 'url(/items/tree-bg.webp) center top / 100% auto no-repeat',
                    WebkitMaskImage:
                        'linear-gradient(180deg, rgba(0,0,0,.95) 12%, rgba(0,0,0,.62) 52%, rgba(0,0,0,0) 100%)',
                    maskImage:
                        'linear-gradient(180deg, rgba(0,0,0,.95) 12%, rgba(0,0,0,.62) 52%, rgba(0,0,0,0) 100%)',
                    pointerEvents: 'none',
                }}
            />

            {/*
              * ★ 見出しは、白い板に載せる。
              *
              *   地の絵に直に置くと、
              *   薄い字が絵に負けて読めない。
              */}
            <div
                style={{
                    position: 'relative',
                    padding: '12px 14px 10px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,.82)',
                    border: '1px solid rgba(120,160,185,.28)',
                    boxShadow: '0 2px 10px rgba(40,70,95,.06)',
                    marginBottom: 14,
                    maxWidth: 1180,
                    marginLeft: 'auto',
                    marginRight: 'auto',
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
                    color: 'var(--color-text-muted)',
                    marginBottom: 10,
                }}
            >
                集めたポイントで、スタンプやプロフィールの飾りと交換できます。
                中身はこれから増やしていきます。
            </p>

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
                                    : '1px solid rgba(120,160,185,.45)',
                            background:
                                filter === key
                                    ? 'var(--color-brand)'
                                    : 'rgba(255,255,255,.78)',
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
                    background: 'rgba(120,160,185,.16)',
                    border: '1px solid rgba(120,160,185,.28)',
                    overflow: 'hidden',
                    marginBottom: 6,
                }}
            >
                <div
                    style={{
                        width: `${items.length > 0 ? Math.round((owned.length / items.length) * 100) : 0}%`,
                        height: '100%',
                        background:
                            'linear-gradient(90deg, #d9a441, #e8c479)',
                        transition: 'width .3s ease',
                    }}
                />
            </div>
            </div>

            {/*
              * ★ 木と、詳しい欄を横に並べる。
              *   下に出すと、押すたびに画面が伸び縮みして
              *   木のどこを見ていたか分からなくなる。
              */}
            {/*
              * ★ 広い画面で、伸ばしきらない。
              *   横いっぱいに広げると、右下が
              *   ただの空き地になる。
              */}
            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    maxWidth: 1180,
                    margin: '0 auto',
                }}
            >
                <div
                    ref={boxRef}
                    style={{
                        overflowX: 'auto',
                        paddingBottom: 8,
                        flex: '1 1 480px',
                        minWidth: 0,
                        /*
                         * ★ 入るときは真ん中、はみ出すときは左から。
                         *
                         *   ただ真ん中に寄せると、はみ出した左半分に
                         *   手が届かなくなる（左へは送れない）。
                         *   safe を付けると、はみ出すときだけ左端に付く。
                         */
                        display: 'flex',
                        justifyContent: 'safe center',
                    }}
                >
                    <div
                        style={{
                            /*
                             * ★ 縮めたぶん、場所も詰める。
                             *   縮めても元の大きさで場所を取ると、
                             *   下に大きな余白が残る。
                             */
                            flex: '0 0 auto',
                            width: width * fit,
                            height: height * fit,
                        }}
                    >
                    <div
                        style={{
                            position: 'relative',
                            width,
                            height,
                            transform: fit < 1 ? `scale(${fit})` : undefined,
                            transformOrigin: 'top left',
                        }}
                    >
                        {Object.entries(TIER_LABEL).map(([tier, label]) => {
                            const level = Number(tier)
                            if (!placed.some((one) => one.tier === level))
                                return null

                            return (
                                <div
                                    key={tier}
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: PAD_TOP + (level - 1) * GAP_Y - 20,
                                        width: 130,
                                        paddingLeft: 12,
                                        borderLeft:
                                            '2px solid rgba(96,140,170,.55)',
                                        pointerEvents: 'none',
                                    }}
                                >
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
                                            textShadow:
                                                '0 1px 0 rgba(255,255,255,.9)',
                                        }}
                                    >
                                        {label.title}
                                    </div>
                                    <div
                                        style={{
                                            marginTop: 2,
                                            fontSize: 9.5,
                                            lineHeight: 1.5,
                                            color: '#6d8190',
                                            textShadow:
                                                '0 1px 0 rgba(255,255,255,.9)',
                                        }}
                                    >
                                        {label.note}
                                    </div>

                                    {/*
                                      * ★ その段を取りきったら、旗を立てる。
                                      *   区切りがあると、次の段へ進みたくなる。
                                      */}
                                    {placed
                                        .filter((one) => one.tier === level)
                                        .every((one) =>
                                            owned.includes(one.id),
                                        ) && (
                                        <div
                                            style={{
                                                display: 'inline-block',
                                                marginTop: 5,
                                                padding: '1px 8px',
                                                borderRadius: 999,
                                                background:
                                                    'linear-gradient(180deg, #e6c47e, #c49a45)',
                                                color: '#3b2c0d',
                                                fontSize: 9,
                                                fontWeight: 700,
                                                letterSpacing: '.08em',
                                                boxShadow:
                                                    '0 1px 3px rgba(120,90,20,.35)',
                                            }}
                                        >
                                            制覇
                                        </div>
                                    )}
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
                            {/* 幹。START の丸の下から、横木まで */}
                            <path
                                d={`M${startX} ${PAD_TOP - 120 + START / 2} V${BUS}`}
                                fill="none"
                                stroke="rgba(74,112,138,.5)"
                                strokeWidth={3}
                                strokeLinecap="round"
                            />

                            {roots.map((root) => (
                                <path
                                    key={`start-${root.id}`}
                                    d={elbow(
                                        startX,
                                        PAD_TOP - 120 + START / 2,
                                        root.x,
                                        root.y - NODE / 2 - 2,
                                        BUS,
                                    )}
                                    fill="none"
                                    stroke={
                                        root.state === 'owned'
                                            ? '#4f9c82'
                                            : 'rgba(74,112,138,.5)'
                                    }
                                    strokeWidth={3}
                                    strokeLinecap="round"
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
                                        d={elbow(
                                            from.x,
                                            from.y + NODE / 2 + LABEL_H,
                                            item.x,
                                            /*
                                             * ★ 目標の札は、王冠のぶん背が高い。
                                             *   王冠の手前で止めると、
                                             *   線の先が宙に浮いて見える。
                                             *   札の中まで伸ばし、
                                             *   王冠に隠してしまう。
                                             */
                                            item.y -
                                                (item.tier >= 5 &&
                                                item.is_secret &&
                                                item.state !== 'owned'
                                                    ? 34
                                                    : NODE / 2 + 2),
                                        )}
                                        fill="none"
                                        /*
                                         * ★ 道の様子で、線の色を変える。
                                         *   取った道 緑／次の道 金／まだの道 薄灰
                                         */
                                        stroke={
                                            done
                                                ? '#4f9c82'
                                                : item.state === 'ready'
                                                  ? '#d9a441'
                                                  : 'rgba(74,112,138,.38)'
                                        }
                                        strokeWidth={
                                            done || item.state === 'ready' ? 3 : 2
                                        }
                                        strokeLinecap="round"
                                    />
                                )
                            })}
                        </svg>

                        <div
                            style={{
                                position: 'absolute',
                                left: startX,
                                top: PAD_TOP - 120,
                                transform: 'translate(-50%, -50%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: START,
                                height: START,
                                borderRadius: '50%',
                                /*
                                 * ★ START も、絵の額に合わせる。
                                 *   平たい紺の丸のままだと、
                                 *   ここだけ描き足したように見える。
                                 */
                                background:
                                    'radial-gradient(120% 120% at 50% 18%, #35708f 0%, #234b68 52%, #16324a 100%)',
                                color: '#f6efdc',
                                fontSize: 14,
                                fontWeight: 700,
                                letterSpacing: '.14em',
                                textShadow: '0 1px 2px rgba(0,0,0,.4)',
                                boxShadow: [
                                    'inset 0 0 0 2px rgba(226,196,124,.85)',
                                    'inset 0 2px 6px rgba(255,255,255,.22)',
                                    '0 0 0 5px rgba(255,255,255,.92)',
                                    '0 0 0 8px rgba(150,185,205,.45)',
                                    '0 8px 22px rgba(30,70,100,.34)',
                                ].join(', '),
                            }}
                        >
                            START
                        </div>

                        {placed.map((item) => {
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
                                    burst={item.id === burstId}
                                    onHover={(on) =>
                                        setHoverId(on ? item.id : null)
                                    }
                                    onPick={() => {
                                        setPickedId(item.id)
                                        setMessage('')
                                    }}
                                />
                            )
                        })}
                        {/*
                          * ★ 指を乗せたら、出る条件を見せる。
                          *
                          *   「？」だけだと、諦めて通り過ぎる。
                          *   条件が見えれば、取りに行く。
                          *
                          * ★ 吹き出しは額の外に出るので、
                          *   額の中ではなく、木の板に置く。
                          */}
                        {hovered && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: hovered.x,
                                    top:
                                        hovered.y -
                                        (hovered.tier >= 5 ? 86 : NODE / 2) -
                                        12,
                                    transform: 'translate(-50%, -100%)',
                                    /*
                                     * ★ 幅は中身なり。
                                     *   放っておくと、右端に近い額では
                                     *   細長い短冊になって読めない。
                                     */
                                    width: 'max-content',
                                    maxWidth: 220,
                                    padding: '7px 11px',
                                    borderRadius: 9,
                                    background: 'rgba(19,47,77,.95)',
                                    color: '#f1e7cf',
                                    fontSize: 11,
                                    lineHeight: 1.65,
                                    textAlign: 'center',
                                    boxShadow: '0 6px 16px rgba(10,30,50,.35)',
                                    pointerEvents: 'none',
                                    zIndex: 5,
                                }}
                            >
                                {hoverText}

                                <span
                                    style={{
                                        position: 'absolute',
                                        left: '50%',
                                        bottom: -5,
                                        marginLeft: -5,
                                        width: 10,
                                        height: 10,
                                        background: 'rgba(19,47,77,.95)',
                                        transform: 'rotate(45deg)',
                                    }}
                                />
                            </div>
                        )}
                    </div>
                    </div>
                </div>

                {/*
                  * ★ 右の欄は、送っても付いてくる。
                  *   木は縦に長い。下のほうの額を押したとき、
                  *   欄が上に置いたままだと見えない。
                  */}
                <div
                    style={{
                        flex: '0 0 278px',
                        minWidth: 252,
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
                        <div
                            style={{
                                padding: '26px 18px 30px',
                                borderRadius: 14,
                                border: '1px solid rgba(120,160,185,.34)',
                                background: 'rgba(255,255,255,.82)',
                                boxShadow: '0 2px 12px rgba(40,70,95,.08)',
                                textAlign: 'center',
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={RING.secret}
                                alt=""
                                style={{
                                    width: 96,
                                    height: 96,
                                    margin: '0 auto 12px',
                                    display: 'block',
                                    opacity: 0.85,
                                }}
                            />

                            <p
                                style={{
                                    fontSize: 11.5,
                                    lineHeight: 1.9,
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                気になるアイテムを押すと、
                                <br />
                                ここに詳しく出ます。
                            </p>

                            {/*
                              * ★ 何も選んでいないあいだは、
                              *   いまの進み具合を出しておく。
                              *   空の箱が右に立っているだけにしない。
                              */}
                            <div
                                style={{
                                    marginTop: 16,
                                    paddingTop: 14,
                                    borderTop: '1px solid rgba(120,160,185,.22)',
                                    fontSize: 11.5,
                                    textAlign: 'left',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                    <span>交換したもの</span>
                                    <b
                                        style={{
                                            color: 'var(--color-text)',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {owned.length} / {items.length}
                                    </b>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginTop: 5,
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                    <span>いま交換できる</span>
                                    <b
                                        style={{
                                            color: '#9a7326',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {
                                            placed.filter(
                                                (one) => one.state === 'ready',
                                            ).length
                                        }{' '}
                                        個
                                    </b>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginTop: 5,
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                    <span>手持ち</span>
                                    <b
                                        style={{
                                            color: 'var(--color-brand)',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {points.toLocaleString()} pt
                                    </b>
                                </div>

                                {/*
                                  * ★ 次の一個を名指しする。
                                  *
                                  *   「あと 150 pt」と出ていると、
                                  *   その額まで貯める気になる。
                                  *   木を眺めるだけで終わらせない。
                                  */}
                                {next && (
                                    <button
                                        type="button"
                                        onClick={() => setPickedId(next.id)}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            marginTop: 12,
                                            padding: '8px 10px',
                                            borderRadius: 9,
                                            border: '1px solid rgba(217,164,65,.5)',
                                            background: 'rgba(217,164,65,.12)',
                                            fontSize: 11,
                                            lineHeight: 1.7,
                                            color: '#8a6a25',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        次は「
                                        {next.is_secret
                                            ? 'シークレット'
                                            : next.name}
                                        」
                                        <br />
                                        <b style={{ fontSize: 12 }}>
                                            あと{' '}
                                            {(
                                                (next.free_price ?? 0) - points
                                            ).toLocaleString()}{' '}
                                            pt
                                        </b>
                                    </button>
                                )}
                            </div>
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
 *   斜めの線が交差すると、
 *   どれがどれに繋がっているか分からなくなる。
 */
function elbow(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    /** 横に渡す高さ。渡さなければ、間の 62% のところ */
    at?: number,
): string {
    if (Math.abs(x1 - x2) < 1) return `M${x1} ${y1} L${x2} ${y2}`

    const mid = at ?? y1 + (y2 - y1) * 0.62
    /*
     * ★ 丸みは、上下の間合いに収まる範囲で。
     *   間が狭いのに大きく丸めると、線が行き過ぎて折り返す。
     */
    const r = Math.max(
        3,
        Math.min(14, Math.abs(mid - y1), Math.abs(y2 - mid), Math.abs(x2 - x1) / 2),
    )
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

/**
 * 手に入れた瞬間の光。
 *
 * ★ 額の上に一瞬だけ重ねる。
 *   輪が広がり、粒が飛び、白く光る。
 */
function Burst() {
    return (
        <span
            className="gtree-burst"
            aria-hidden="true"
            style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 0,
                height: 0,
                pointerEvents: 'none',
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: 120,
                    height: 120,
                    marginLeft: -60,
                    marginTop: -60,
                    borderRadius: '50%',
                    background:
                        'radial-gradient(circle, rgba(255,240,200,.95) 0%, rgba(255,215,120,.5) 45%, rgba(255,215,120,0) 70%)',
                    animation: 'gtree-flash .8s ease-out',
                    opacity: 0,
                }}
            />

            {[0, 1].map((n) => (
                <span
                    key={n}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: 96,
                        height: 96,
                        borderRadius: '50%',
                        border: '3px solid rgba(233,196,120,.9)',
                        animation: `gtree-wave ${0.9 + n * 0.25}s ease-out ${n * 0.18}s`,
                        opacity: 0,
                    }}
                />
            ))}

            {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
                <span
                    key={a}
                    style={
                        {
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: 9,
                            height: 9,
                            marginLeft: -4.5,
                            marginTop: -4.5,
                            background:
                                i % 2 === 0 ? '#f6e2ab' : '#ffffff',
                            clipPath:
                                'polygon(50% 0%, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0% 50%, 38% 38%)',
                            '--a': `${a}deg`,
                            animation: `gtree-fly ${0.85 + (i % 3) * 0.12}s ease-out`,
                            opacity: 0,
                        } as React.CSSProperties
                    }
                />
            ))}
        </span>
    )
}

/** どの額を使うか */
function ringOf(item: Placed, hidden: boolean): string {
    if (item.state === 'owned') return RING.owned
    if (hidden) return RING.secret
    if (item.state === 'locked') return RING.locked
    if (item.tier >= 5) return RING.goal
    return RING[item.state] ?? RING.poor
}

/** 品物ひとつ */
function Node({
    item,
    dim,
    chosen,
    burst,
    onPick,
    onHover,
}: {
    item: Placed
    /** 絞りから外れているか。薄くするだけで、消さない */
    dim?: boolean
    /** いま右の欄に出ているか */
    chosen?: boolean
    /** いま手に入れたところか */
    burst?: boolean
    onPick: () => void
    onHover: (on: boolean) => void
}) {
    const hidden = item.is_secret && item.state !== 'owned'

    /* いちばん奥の品物は、大きく */
    const isGoal = item.tier >= 5
    const size = isGoal ? 128 : NODE

    const art = item.asset_url ?? STAND_IN

    /*
     * ★ いちばん奥で、まだ中身を伏せているものは、
     *   丸ではなく横長の札で出す。
     *
     *   絵に値段と「まだ見ぬアイテムがここに」が
     *   描き込まれているので、下の札は付けない。
     */
    if (isGoal && hidden) {
        return (
            <button
                type="button"
                onClick={onPick}
                style={{
                    position: 'absolute',
                    left: item.x,
                    top: item.y,
                    transform: chosen
                        ? 'translate(-50%, -50%) scale(1.05)'
                        : 'translate(-50%, -50%)',
                    transition: 'transform .16s ease',
                    zIndex: chosen ? 3 : 1,
                    width: GOAL_W,
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    opacity: dim ? 0.28 : 1,
                    filter: chosen
                        ? 'drop-shadow(0 0 12px rgba(217,164,65,.9))'
                        : 'drop-shadow(0 5px 12px rgba(40,70,95,.2))',
                }}
            >
                <GoalPlate
                    price={item.free_price ?? 0}
                    caption="まだ見ぬアイテムがここに"
                    width={GOAL_W}
                />
            </button>
        )
    }

    return (
        <button
            type="button"
            /*
             * ★ どの様子でも、押せる。
             *
             *   前は「まだ用意していない」ものを押せなくしていた。
             *   置いてあるのは全部まだ用意前なので、
             *   どれを押しても何も起きなかった。
             *   中身は右の欄で伝えればよい。
             */
            onClick={onPick}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            onFocus={() => onHover(true)}
            onBlur={() => onHover(false)}
            style={{
                position: 'absolute',
                left: item.x,
                top: item.y,
                transform: chosen
                    ? 'translate(-50%, -50%) scale(1.07)'
                    : 'translate(-50%, -50%)',
                transition: 'transform .16s ease',
                zIndex: chosen ? 3 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                opacity: dim ? 0.28 : 1,
            }}
        >
            <span
                className={item.state === 'ready' ? 'gtree-breathe' : undefined}
                style={{
                    position: 'relative',
                    width: size,
                    height: size,
                    display: 'block',
                    animation:
                        item.state === 'ready' && !chosen
                            ? 'gtree-breathe 2.4s ease-in-out infinite'
                            : undefined,
                    /*
                     * ★ 選んでいるものは、後ろを光らせる。
                     *   額の形を崩さずに、居場所が分かる。
                     */
                    filter: chosen
                        ? 'drop-shadow(0 0 10px rgba(217,164,65,.85))'
                        : 'drop-shadow(0 4px 8px rgba(40,70,95,.16))',
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={ringOf(item, hidden)}
                    alt=""
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                    }}
                />

                {/*
                  * ★ 中の絵は、額の上に載せる。
                  *
                  *   額の白い面は塗り潰してあるので、
                  *   後ろに置くと透けて見えない。
                  */}
                {!hidden && item.state !== 'locked' && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={art}
                        alt=""
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: `${ART * 100}%`,
                            height: `${ART * 100}%`,
                            objectFit: 'contain',
                            opacity: item.state === 'coming' ? 0.55 : 1,
                            animation: burst
                                ? 'gtree-pop .7s cubic-bezier(.2,1.4,.5,1)'
                                : undefined,
                        }}
                    />
                )}

                {burst && <Burst />}
            </span>

            <span
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    marginTop: -10,
                    padding: '4px 10px 5px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,.94)',
                    border: '1px solid rgba(120,160,185,.4)',
                    boxShadow: '0 2px 6px rgba(40,70,95,.14)',
                    minWidth: 76,
                    position: 'relative',
                    zIndex: 2,
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
                        fontSize: 11.5,
                        fontWeight: 700,
                        color:
                            item.state === 'owned'
                                ? '#3d7a63'
                                : item.state === 'ready'
                                  ? '#9a7326'
                                  : item.state === 'coming'
                                    ? 'var(--color-text-faint)'
                                    : 'var(--color-text)',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {/*
                      * ★ まだ用意していないものに値段を出さない。
                      *
                      *   「50 pt」と出ていれば、取れると思う。
                      *   取れないものは、そう書く。
                      */}
                    {item.state === 'owned'
                        ? '交換済み'
                        : item.state === 'coming'
                          ? '準備中'
                          : `${(item.free_price ?? 0).toLocaleString()} pt`}
                </span>
            </span>
        </button>
    )
}

/**
 * 選んだ品物の中身。
 *
 * ★ 上に大きな額、下に使い道と仲間。
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
    const color = KIND_COLOR[item.kind] ?? '#5f849c'
    const art = item.asset_url ?? STAND_IN

    /* 先に取っておく必要のあるもの */
    const needs = item.requires_item_id
        ? (all.find((one) => one.id === item.requires_item_id) ?? null)
        : null
    const needsDone = needs ? ownedIds.includes(needs.id) : true

    /* 同じ種類の仲間 */
    const kin = all
        .filter((one) => one.kind === item.kind && one.id !== item.id)
        .sort((a, b) => a.tier - b.tier || a.position - b.position)
        .slice(0, 4)

    return (
        <div
            style={{
                borderRadius: 14,
                border: '1px solid rgba(120,160,185,.4)',
                background: 'rgba(255,255,255,.96)',
                boxShadow: '0 6px 22px rgba(40,70,95,.14)',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'relative',
                    padding: '14px 16px 16px',
                    background: `linear-gradient(180deg, ${color}22 0%, ${color}0a 62%, rgba(255,255,255,0) 100%)`,
                    borderBottom: '1px solid rgba(120,160,185,.18)',
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
                        border: '1px solid rgba(120,160,185,.34)',
                        background: 'rgba(255,255,255,.85)',
                        fontSize: 12,
                        lineHeight: 1,
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                    }}
                >
                    ✕
                </button>

                {/*
                  * ★ 木で押した額を、そのまま大きくする。
                  *   押したものが右に来たと、ひと目で分かる。
                  */}
                <span
                    style={{
                        position: 'relative',
                        display: 'block',
                        width: 132,
                        height: 132,
                        margin: '2px auto 10px',
                        filter: 'drop-shadow(0 4px 10px rgba(40,70,95,.18))',
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={ringOf(item, hidden)}
                        alt=""
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                        }}
                    />

                    {!hidden && item.state !== 'locked' && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={art}
                            alt=""
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: `${ART * 100}%`,
                                height: `${ART * 100}%`,
                                objectFit: 'contain',
                            }}
                        />
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
                            background: `${color}26`,
                            color: '#3f5462',
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
                            background: 'rgba(120,160,185,.18)',
                            color: '#3f5462',
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
                                background: 'rgba(79,156,130,.2)',
                                color: '#37705b',
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
                        ? (item.hint ??
                          '交換するまで、中身は分かりません。')
                        : item.description ||
                          'この品物の説明は、これから用意します。'}
                </p>

                {/*
                  * ★ 伏せてあるものは、出る条件を先に見せる。
                  *   何も手がかりが無いと、諦められる。
                  */}
                {hidden && item.hint && (
                    <p
                        style={{
                            marginTop: 6,
                            fontSize: 10.5,
                            color: 'var(--color-text-faint)',
                        }}
                    >
                        これが、この品物の出る条件です。
                    </p>
                )}

                {!owned && item.is_active && (
                    <div
                        style={{
                            marginTop: 12,
                            padding: '9px 12px',
                            borderRadius: 9,
                            background: 'rgba(120,160,185,.1)',
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
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {points.toLocaleString()} pt
                            </span>
                        </div>
                    </div>
                )}

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
                            border: '1px solid rgba(217,164,65,.5)',
                            background: 'rgba(217,164,65,.12)',
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
                            background: 'rgba(79,156,130,.14)',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#37705b',
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
                            background: 'rgba(120,160,185,.12)',
                            fontSize: 11.5,
                            lineHeight: 1.8,
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
                                    ? 'rgba(120,160,185,.24)'
                                    : 'linear-gradient(180deg, #d9a441, #c08c2f)',
                            color:
                                price > points || !needsDone
                                    ? 'var(--color-text-muted)'
                                    : '#fff',
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

                {!hidden && (
                    <>
                        <Line label="使い道" />
                        <Usage kind={item.kind} color={color} art={art} item={item} />
                    </>
                )}

                {kin.length > 0 && (
                    <>
                        <Line label="同じ種類" />

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                                            position: 'relative',
                                            width: 54,
                                            height: 54,
                                            border: 'none',
                                            background: 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={ringOf(one, veil)}
                                            alt=""
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                width: '100%',
                                                height: '100%',
                                            }}
                                        />

                                        {!veil && one.state !== 'locked' && (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={one.asset_url ?? STAND_IN}
                                                alt=""
                                                style={{
                                                    position: 'absolute',
                                                    left: '50%',
                                                    top: '50%',
                                                    transform:
                                                        'translate(-50%, -50%)',
                                                    width: `${ART * 100}%`,
                                                    height: `${ART * 100}%`,
                                                    objectFit: 'contain',
                                                }}
                                            />
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
                    background: 'rgba(120,160,185,.26)',
                }}
            />
        </div>
    )
}

/**
 * 使い道の見本。
 *
 * ★ 出る場所を、形で示す。
 *   名前と値段だけでは、
 *   取ったあと何が変わるのか分からない。
 */
function Usage({
    kind,
    color,
    art,
    item,
}: {
    kind: string
    color: string
    art: string
    item: Placed
}) {
    const box: React.CSSProperties = {
        padding: 12,
        borderRadius: 10,
        background:
            'linear-gradient(180deg, rgba(120,160,185,.08) 0%, rgba(120,160,185,.03) 100%)',
        border: '1px solid rgba(120,160,185,.18)',
    }

    const note: React.CSSProperties = {
        marginTop: 7,
        fontSize: 10.5,
        lineHeight: 1.7,
        color: 'var(--color-text-faint)',
    }

    /* eslint-disable-next-line @next/next/no-img-element */
    const picture = (size: number) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={art}
            alt=""
            style={{ width: size, height: size, objectFit: 'contain' }}
        />
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
                            background: 'rgba(120,160,185,.24)',
                            flex: '0 0 auto',
                        }}
                    />

                    <span
                        style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '2px 10px 10px 10px',
                            background: '#fff',
                            border: '1px solid rgba(120,160,185,.22)',
                        }}
                    >
                        <span
                            style={{
                                display: 'block',
                                height: 6,
                                width: '76%',
                                borderRadius: 3,
                                background: 'rgba(120,160,185,.22)',
                            }}
                        />
                        <span
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 8,
                            }}
                        >
                            {picture(64)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                        style={{
                            position: 'relative',
                            width: 52,
                            height: 52,
                            flex: '0 0 auto',
                        }}
                    >
                        <span
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: 'rgba(120,160,185,.3)',
                            }}
                        />
                        {kind === 'frame' && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={art}
                                alt=""
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                }}
                            />
                        )}
                    </span>

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
                                        : 'rgba(120,160,185,.32)',
                            }}
                        />
                        <span
                            style={{
                                display: 'block',
                                height: 6,
                                width: '40%',
                                marginTop: 6,
                                borderRadius: 3,
                                background: 'rgba(120,160,185,.18)',
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
                        height: 78,
                        borderRadius: 8,
                        background: `center / cover no-repeat url(${art})`,
                        border: '1px solid rgba(120,160,185,.22)',
                    }}
                />

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
                        color: '#3f5462',
                    }}
                >
                    {picture(16)}
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
                    width: 62,
                    height: 82,
                    borderRadius: '3px 7px 7px 3px',
                    background: '#fff',
                    border: '1px solid rgba(120,160,185,.24)',
                    borderLeft: `5px solid ${color}`,
                    overflow: 'hidden',
                }}
            >
                {picture(40)}
            </span>

            <p style={note}>本の見た目に使えます。</p>
        </div>
    )
}
