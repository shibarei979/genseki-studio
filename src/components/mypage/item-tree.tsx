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
            style={{
                background: 'var(--color-bg-card)',
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
                    marginBottom: 14,
                }}
            >
                集めたポイントで、スタンプやプロフィールの飾りと交換できます。
                中身はこれから増やしていきます。
            </p>

            {sortedTiers.map(([tier, list]) => (
                <section key={tier} style={{ marginBottom: 18 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 10,
                            marginBottom: 8,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: 'var(--color-brand)',
                            }}
                        >
                            {TIER_LABEL[tier]?.title ?? `Lv.${tier}`}
                        </span>

                        <span
                            style={{
                                fontSize: 11,
                                color: 'var(--color-text-faint)',
                            }}
                        >
                            {TIER_LABEL[tier]?.note ?? ''}
                        </span>

                        <span
                            style={{
                                flex: 1,
                                height: 1,
                                background: 'var(--color-brand-border)',
                            }}
                        />
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns:
                                'repeat(auto-fill, minmax(92px, 1fr))',
                            gap: 10,
                        }}
                    >
                        {list.map((item) => {
                            const state = stateOf(item)

                            /* 伏せたものと、まだ用意していないもの */
                            const hidden =
                                state === 'coming' ||
                                (item.is_secret && state !== 'owned')

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    disabled={state === 'coming'}
                                    onClick={() => {
                                        setPicked(item)
                                        setMessage('')
                                    }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '10px 6px',
                                        borderRadius: 10,
                                        border:
                                            state === 'owned'
                                                ? '1.5px solid var(--color-brand)'
                                                : '1px solid var(--color-brand-border)',
                                        background:
                                            state === 'owned'
                                                ? 'var(--color-brand-light)'
                                                : 'var(--color-bg-page)',
                                        cursor:
                                            state === 'coming'
                                                ? 'default'
                                                : 'pointer',
                                        opacity:
                                            state === 'ready' ||
                                            state === 'owned'
                                                ? 1
                                                : 0.45,
                                    }}
                                >
                                    {/* 絵。まだ無ければ印だけ */}
                                    <span
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 8,
                                            background: 'var(--color-bg-card)',
                                            border:
                                                '1px solid var(--color-brand-border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 17,
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
                                        ) : (
                                            '?'
                                        )}
                                    </span>

                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: 'var(--color-text-muted)',
                                            textAlign: 'center',
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {hidden
                                            ? state === 'coming'
                                                ? '？？？'
                                                : 'シークレット'
                                            : KIND_LABEL[item.kind] ?? item.kind}
                                    </span>

                                    <span
                                        style={{
                                            fontSize: 10.5,
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
