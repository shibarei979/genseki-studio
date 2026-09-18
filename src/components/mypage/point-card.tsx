'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

/**
 * ============================================================
 * 原石航路 Studio
 * PointCard — マイページに出す、無料ポイントの枠
 *
 * ★ 携帯では、ここだけが見せ場。
 *
 *   頭の帯は狭いので、携帯では出していない。
 *   ここに無いと、自分が何ポイント持っているか
 *   確かめる場所が無くなる。
 *
 * ★ 次に消える日も出す。
 *
 *   半年で消えるので、出さないと
 *   「知らないうちに減った」になる。
 *
 * ★ 有料ポイントは、まだ無い。
 *   できたら、ここに並べて出す。
 * ============================================================
 */

/**
 * 消えるまで 1 か月を切っているか。
 *
 * ★ それより前から出しても、目に入らなくなる。
 *   本当に気にしてほしいのは、消える間際。
 */
function isSoon(at: string): boolean {
    const left = new Date(at).getTime() - Date.now()
    if (Number.isNaN(left)) return false

    const month = 1000 * 60 * 60 * 24 * 30
    return left <= month
}


/**
 * この人は運営か。
 *
 * ★ ポイントは、まだ試している最中。
 *
 *   読む人に見えてしまうと、
 *   「これは何に使えるのか」と聞かれることになる。
 *   中身が揃うまでは、運営だけに見せる。
 *
 * ★ 開けるときは、この gate を外すだけでよい。
 */
function useIsOperator(): boolean | null {
    const [isOperator, setIsOperator] = useState<boolean | null>(null)

    useEffect(() => {
        let alive = true

        void (async () => {
            try {
                const supabase = createClient()
                const { data: auth } = await supabase.auth.getUser()
                const userId = auth.user?.id

                if (!userId) {
                    if (alive) setIsOperator(false)
                    return
                }

                const { data } = await supabase
                    .from('profiles')
                    .select('is_admin')
                    .eq('user_id', userId)
                    .maybeSingle()

                if (alive) {
                    setIsOperator(
                        (data as { is_admin?: boolean } | null)?.is_admin ===
                            true,
                    )
                }
            } catch {
                /* 調べられなければ、出さない */
                if (alive) setIsOperator(false)
            }
        })()

        return () => {
            alive = false
        }
    }, [])

    return isOperator
}

export default function PointCard() {
    const [free, setFree] = useState<number | null>(null)
    const [expiresAt, setExpiresAt] = useState<string | null>(null)
    const [expiresAmount, setExpiresAmount] = useState(0)
    const isOperator = useIsOperator()

    useEffect(() => {
        if (isOperator !== true) return

        let alive = true

        void (async () => {
            try {
                const response = await fetch('/api/points/me')
                if (!response.ok) return

                const data = (await response.json()) as {
                    free?: number
                    nextExpiresAt?: string | null
                    nextExpiresAmount?: number
                }

                if (!alive || typeof data.free !== 'number') return

                setFree(data.free)
                setExpiresAt(data.nextExpiresAt ?? null)
                setExpiresAmount(data.nextExpiresAmount ?? 0)
            } catch {
                /* 読めなくても、ほかは動く */
            }
        })()

        return () => {
            alive = false
        }
    }, [isOperator])

    /* いまは運営だけに見せている */
    if (isOperator !== true) return null

    /* 読めていないあいだは、場所を取らない */
    if (free === null) return null

    return (
        /*
         * ★ ほかの枠と、同じ形にする。
         *
         *   「最近の投稿作品」「下書き」「閲覧履歴」と
         *   同じ並びに入るので、形が違うとそこだけ浮く。
         */
        <section
            style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-brand-border)',
                borderRadius: 14,
                padding: '18px 20px',
                marginBottom: 16,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
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
                    無料ポイント
                </span>

                <span
                    style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: 'var(--color-brand)',
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.1,
                    }}
                >
                    {free.toLocaleString()}
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 400,
                            marginLeft: 3,
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        pt
                    </span>
                </span>
            </div>

            {/*
              * 次に消える日。
              *
              * ★ 1 か月前から出す。
              *
              *   半年先の日付を毎日見せても、
              *   そのうち目に入らなくなる。
              *   本当に気にしてほしいのは、消える間際。
              *
              * ★ 出さないと「知らないうちに減った」になる。
              * ★ 何も持っていない人には出さない。
              */}
            {free > 0 && expiresAt && isSoon(expiresAt) && (
                <p
                    style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: 'var(--color-text-faint)',
                    }}
                >
                    {/*
                      * ★ 短く。
                      *
                      *   年は要らない。1 か月前から出すので、
                      *   同じ年か、せいぜい年をまたぐ程度。
                      *   「消えます」だけで、使わないと、は言わずに済む。
                      */}
                    {new Date(expiresAt).toLocaleDateString('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        month: 'numeric',
                        day: 'numeric',
                    })}
                    に {expiresAmount.toLocaleString()} pt 消えます
                </p>
            )}

            {free === 0 && (
                <p
                    style={{
                        marginTop: 6,
                        fontSize: 11,
                        lineHeight: 1.8,
                        color: 'var(--color-text-faint)',
                    }}
                >
                    ミッションを達成すると貯まります。
                </p>
            )}
        </section>
    )
}
