'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * ============================================================
 * 原石航路 Studio
 * AdminRangePicker — 期間を日付で選ぶ
 *
 * 決まった範囲（7日・30日・90日・1年）で足りないときに、
 * 日付を自分で入れられるようにする。
 *
 * ★ 画面の中で数え直さない。
 *   数え上げはサーバー側で行うので、住所を変えて開き直す。
 *   住所に残るぶん、その期間のまま人に渡せる。
 * ============================================================
 */

export default function AdminRangePicker({
    from,
    to,
    label,
}: {
    from?: string
    to?: string
    /** いま選ばれている期間の名前。閉じているときに出す */
    label: string
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)

    /* 既定は「30日前から今日まで」 */
    const today = new Date().toISOString().slice(0, 10)
    const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)

    const [start, setStart] = useState(from || monthAgo)
    const [end, setEnd] = useState(to || today)

    function apply() {
        if (start > end) {
            window.alert('始まりの日が、終わりの日より後になっています。')
            return
        }
        router.push(`/admin?from=${start}&to=${end}`)
        setOpen(false)
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, padding: '5px 12px', borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    background: 'var(--admin-bg-card)',
                    color: 'var(--admin-text-muted)', cursor: 'pointer',
                }}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {label}
            </button>
        )
    }

    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 6px', borderRadius: 8,
            border: '1px solid var(--admin-border)',
            background: 'var(--admin-bg-card)',
        }}>
            <input
                type="date"
                value={start}
                max={end}
                onChange={(e) => setStart(e.target.value)}
                style={{ fontSize: 12, padding: '3px 6px', border: 'none', background: 'transparent' }}
            />
            <span style={{ fontSize: 12, color: 'var(--admin-text-faint)' }}>〜</span>
            <input
                type="date"
                value={end}
                min={start}
                max={today}
                onChange={(e) => setEnd(e.target.value)}
                style={{ fontSize: 12, padding: '3px 6px', border: 'none', background: 'transparent' }}
            />

            <button type="button" onClick={apply}
                style={{
                    fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none',
                    background: 'var(--admin-stat-blue)', color: '#fff', cursor: 'pointer',
                }}>
                見る
            </button>
            <button type="button" onClick={() => setOpen(false)}
                style={{
                    fontSize: 12, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid var(--admin-border)',
                    background: 'var(--admin-bg)', color: 'var(--admin-text-muted)',
                }}>
                やめる
            </button>
        </div>
    )
}
