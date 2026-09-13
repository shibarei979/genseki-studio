'use client'

import { useCallback, useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

/**
 * ============================================================
 * 原石航路 Studio
 * PendingComments — 承認待ちのコメント
 *
 * ★ 「承認後に公開」を選んだ作品にだけ出る。
 *
 *   選べるのに承認する場所が無い、という
 *   宙ぶらりんの状態を無くすために作った。
 *
 * ★ 承認と、断りの両方を置く。
 *
 *   出すか出さないかを決める場所なので、
 *   出さない道も要る。
 *   断ったものは消す。残しておく意味がない。
 *
 * ★ 何も無いときは、何も出さない。
 *   「0件」を毎回見せても、場所を取るだけ。
 * ============================================================
 */

interface Pending {
    id: string
    body: string
    created_at: string
    novel_id: string
    novel_title: string
    author_name: string
}

export default function PendingComments() {
    const supabase = createClient()

    const [items, setItems] = useState<Pending[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [working, setWorking] = useState<string | null>(null)

    const reload = useCallback(async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) {
                setIsLoading(false)
                return
            }

            /* 自分の作品で、承認を待っているもの */
            const { data: mine } = await supabase
                .from('novels')
                .select('id, title')
                .eq('author_id', user.id)
                .eq('moderate_comments', true)

            const titleById = new Map(
                (mine ?? []).map((n: any) => [n.id, n.title as string]),
            )

            if (titleById.size === 0) {
                setItems([])
                setIsLoading(false)
                return
            }

            const { data: rows } = await supabase
                .from('comments')
                .select('id, body, created_at, novel_id, user_id')
                .in('novel_id', Array.from(titleById.keys()))
                .eq('is_approved', false)
                .order('created_at', { ascending: false })
                .limit(100)

            /* 書いた人の名前を引く */
            const userIds = Array.from(
                new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)),
            )

            const nameById = new Map<string, string>()

            if (userIds.length > 0) {
                const { data: people } = await supabase
                    .from('public_profiles')
                    .select('user_id, display_name')
                    .in('user_id', userIds)

                for (const one of people ?? []) {
                    nameById.set(
                        (one as any).user_id,
                        (one as any).display_name ?? '',
                    )
                }
            }

            setItems(
                (rows ?? []).map((r: any) => ({
                    id: r.id,
                    body: r.body ?? '',
                    created_at: r.created_at,
                    novel_id: r.novel_id,
                    novel_title: titleById.get(r.novel_id) ?? '',
                    author_name: nameById.get(r.user_id) || '名もなき読者',
                })),
            )
        } catch {
            /* 読めなくても、ほかの画面は動く */
        }

        setIsLoading(false)
    }, [supabase])

    useEffect(() => {
        void reload()
    }, [reload])

    async function decide(id: string, approve: boolean) {
        setWorking(id)

        try {
            if (approve) {
                await supabase
                    .from('comments')
                    .update({ is_approved: true })
                    .eq('id', id)
            } else {
                /*
                 * ★ 断ったものは消す。
                 *   未承認のまま残しておく意味がない。
                 */
                await supabase.from('comments').delete().eq('id', id)
            }

            setItems((now) => now.filter((one) => one.id !== id))
        } catch {
            /* 失敗したら、そのまま残る。押し直せばよい */
        }

        setWorking(null)
    }

    /* 読み込み中と、何も無いときは出さない */
    if (isLoading || items.length === 0) return null

    return (
        /*
         * ★ 目に付く色にする。
         *
         *   通知から飛んでくる場所なので、
         *   来た人がすぐ見つけられないと意味がない。
         *   ほかの枠と同じ色だと、埋もれる。
         */
        <section
            style={{
                marginBottom: 20,
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--color-brand)',
                background: 'var(--color-brand-light)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h2
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                    }}
                >
                    承認待ちのコメント
                </h2>
                <span
                    style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
                >
                    {items.length}件
                </span>
            </div>

            <p
                style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: 'var(--color-text-faint)',
                }}
            >
                認めるまで、書いた人以外には出ません。
            </p>

            <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
                {items.map((one) => (
                    <li
                        key={one.id}
                        style={{
                            padding: '10px 0',
                            borderTop: '1px solid var(--color-border)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                                fontSize: 11,
                                color: 'var(--color-text-faint)',
                            }}
                        >
                            <span>{one.novel_title}</span>
                            <span>{one.author_name}</span>
                            <span>
                                {new Date(one.created_at).toLocaleString('ja-JP', {
                                    timeZone: 'Asia/Tokyo',
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </span>
                        </div>

                        <p
                            style={{
                                marginTop: 4,
                                fontSize: 13,
                                lineHeight: 1.8,
                                color: 'var(--color-text)',
                                wordBreak: 'break-word',
                            }}
                        >
                            {one.body}
                        </p>

                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                                type="button"
                                disabled={working === one.id}
                                onClick={() => void decide(one.id, true)}
                                style={{
                                    background: 'var(--color-brand)',
                                    color: 'var(--color-text-inverse)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '6px 16px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                公開する
                            </button>

                            <button
                                type="button"
                                disabled={working === one.id}
                                onClick={() => void decide(one.id, false)}
                                style={{
                                    background: 'none',
                                    color: 'var(--color-text-muted)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 6,
                                    padding: '6px 16px',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                }}
                            >
                                消す
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}
