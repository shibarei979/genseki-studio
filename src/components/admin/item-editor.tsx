'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * ItemEditor — 品物と、繋がりを決める
 *
 * ★ 運営だけが開く。
 *
 * ★ 繋がりが、絵の枝になる。
 *
 *   「これを取ったら、次が買える」を 1 本ずつ決める。
 *   決めると、アイテムツリーに線が引かれる。
 *
 * ★ 出すかどうかも、ここで決める。
 *
 *   中身が揃うまでは「出さない」にしておく。
 *   出さないものは、読む人には「？」で並ぶ。
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

const KINDS = [
    ['stamp', 'スタンプ'],
    ['frame', 'フレーム'],
    ['background', '背景'],
    ['badge', '称号'],
    ['name_style', 'プロフィール装飾'],
    ['bookmark', '栞'],
    ['cover', 'ブックカバー'],
    ['shelf', '本棚背景'],
] as const

export default function ItemEditor() {
    const [items, setItems] = useState<Item[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [busy, setBusy] = useState<string | null>(null)
    const [message, setMessage] = useState('')

    const reload = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/items')
            const data = (await response.json()) as { items?: Item[] }
            setItems(data.items ?? [])
        } catch {
            /* 読めなくても、ほかは動く */
        }

        setIsLoading(false)
    }, [])

    useEffect(() => {
        void reload()
    }, [reload])

    async function save(id: string, patch: Record<string, unknown>) {
        setBusy(id)
        setMessage('')

        try {
            const response = await fetch('/api/admin/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, patch }),
            })

            const data = (await response.json()) as { error?: string }

            if (data.error) {
                setMessage(data.error)
            } else {
                /* 画面だけ先に直す。読み直すと場所が飛ぶ */
                setItems((now) =>
                    now.map((one) =>
                        one.id === id ? { ...one, ...patch } : one,
                    ),
                )
            }
        } catch {
            setMessage('繋がりませんでした。')
        }

        setBusy(null)
    }

    if (isLoading) return null

    const field: React.CSSProperties = {
        border: '1px solid var(--color-brand-border)',
        borderRadius: 6,
        padding: '4px 8px',
        fontSize: 12,
        background: 'var(--color-bg-page)',
        color: 'var(--color-text)',
    }

    return (
        <section
            style={{
                border: '1px solid var(--color-brand-border)',
                borderRadius: 12,
                padding: '16px 18px',
                background: 'var(--color-bg-card)',
            }}
        >
            <h2
                style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                }}
            >
                品物と、繋がり
            </h2>

            <p
                style={{
                    marginTop: 4,
                    marginBottom: 12,
                    fontSize: 11,
                    lineHeight: 1.8,
                    color: 'var(--color-text-faint)',
                }}
            >
                「前の品物」を決めると、アイテムツリーに線が引かれます。
                「絵」は public/items に置いた絵の場所です（例 /items/it-book.webp）。
                中身が揃うまでは「出す」を切っておいてください。
            </p>

            {message && (
                <p
                    style={{
                        marginBottom: 10,
                        fontSize: 12,
                        color: 'var(--color-danger)',
                    }}
                >
                    {message}
                </p>
            )}

            <div style={{ overflowX: 'auto' }}>
                <table
                    style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 12,
                        minWidth: 880,
                    }}
                >
                    <thead>
                        <tr
                            style={{
                                fontSize: 10.5,
                                color: 'var(--color-text-faint)',
                                textAlign: 'left',
                            }}
                        >
                            <th style={{ padding: '4px 6px' }}>段</th>
                            <th style={{ padding: '4px 6px' }}>並び</th>
                            <th style={{ padding: '4px 6px' }}>種類</th>
                            <th style={{ padding: '4px 6px' }}>名前</th>
                            <th style={{ padding: '4px 6px' }}>絵</th>
                            <th style={{ padding: '4px 6px' }}>値段</th>
                            <th style={{ padding: '4px 6px' }}>前の品物</th>
                            <th style={{ padding: '4px 6px' }}>伏せる</th>
                            <th style={{ padding: '4px 6px' }}>出す</th>
                        </tr>
                    </thead>

                    <tbody>
                        {items.map((item) => (
                            <tr
                                key={item.id}
                                style={{
                                    borderTop: '1px solid var(--color-border)',
                                    opacity: busy === item.id ? 0.5 : 1,
                                }}
                            >
                                <td style={{ padding: '5px 6px' }}>
                                    <input
                                        type="number"
                                        min={1}
                                        max={9}
                                        defaultValue={item.tier}
                                        onBlur={(e) =>
                                            void save(item.id, {
                                                tier: Number(e.target.value),
                                            })
                                        }
                                        style={{ ...field, width: 44 }}
                                    />
                                </td>

                                <td style={{ padding: '5px 6px' }}>
                                    <input
                                        type="number"
                                        min={0}
                                        max={20}
                                        defaultValue={item.position}
                                        onBlur={(e) =>
                                            void save(item.id, {
                                                position: Number(e.target.value),
                                            })
                                        }
                                        style={{ ...field, width: 44 }}
                                    />
                                </td>

                                <td style={{ padding: '5px 6px' }}>
                                    <select
                                        defaultValue={item.kind}
                                        onChange={(e) =>
                                            void save(item.id, {
                                                kind: e.target.value,
                                            })
                                        }
                                        style={field}
                                    >
                                        {KINDS.map(([key, label]) => (
                                            <option key={key} value={key}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </td>

                                <td style={{ padding: '5px 6px' }}>
                                    <input
                                        type="text"
                                        defaultValue={item.name}
                                        onBlur={(e) =>
                                            void save(item.id, {
                                                name: e.target.value,
                                            })
                                        }
                                        style={{ ...field, width: 150 }}
                                    />
                                </td>

                                {/*
                                  * 絵の場所。
                                  *
                                  * ★ public/items に置いた絵なら
                                  *   /items/〇〇.webp と書く。
                                  * ★ 空のままなら、仮の絵が出る。
                                  */}
                                <td style={{ padding: '5px 6px' }}>
                                    <input
                                        type="text"
                                        placeholder="/items/〇〇.webp"
                                        defaultValue={item.asset_url ?? ''}
                                        onBlur={(e) =>
                                            void save(item.id, {
                                                asset_url:
                                                    e.target.value.trim() || null,
                                            })
                                        }
                                        style={{ ...field, width: 150 }}
                                    />
                                </td>

                                <td style={{ padding: '5px 6px' }}>
                                    <input
                                        type="number"
                                        min={0}
                                        step={50}
                                        defaultValue={item.free_price ?? 0}
                                        onBlur={(e) =>
                                            void save(item.id, {
                                                free_price: Number(e.target.value),
                                            })
                                        }
                                        style={{ ...field, width: 70 }}
                                    />
                                </td>

                                {/*
                                  * 前の品物。
                                  *
                                  * ★ これが、絵の枝になる。
                                  * ★ 自分自身は選べない。
                                  */}
                                <td style={{ padding: '5px 6px' }}>
                                    <select
                                        defaultValue={item.requires_item_id ?? ''}
                                        onChange={(e) =>
                                            void save(item.id, {
                                                requires_item_id:
                                                    e.target.value || null,
                                            })
                                        }
                                        style={{ ...field, maxWidth: 190 }}
                                    >
                                        <option value="">（なし）</option>

                                        {items
                                            .filter((one) => one.id !== item.id)
                                            .map((one) => (
                                                <option key={one.id} value={one.id}>
                                                    Lv{one.tier}-{one.position}{' '}
                                                    {one.name}
                                                </option>
                                            ))}
                                    </select>
                                </td>

                                <td style={{ padding: '5px 6px' }}>
                                    <input
                                        type="checkbox"
                                        defaultChecked={item.is_secret}
                                        onChange={(e) =>
                                            void save(item.id, {
                                                is_secret: e.target.checked,
                                            })
                                        }
                                    />
                                </td>

                                <td style={{ padding: '5px 6px' }}>
                                    <input
                                        type="checkbox"
                                        defaultChecked={item.is_active}
                                        onChange={(e) =>
                                            void save(item.id, {
                                                is_active: e.target.checked,
                                            })
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
