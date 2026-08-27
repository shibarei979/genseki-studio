'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { getRepository } from '@/lib/repository'

/**
 * ============================================================
 * 原石航路
 * BirthdateNotice — 生年月日を促す帯
 *
 * 入れていない人には R15・R18 を出さない。
 * ただ、黙って隠すと「作品が少ない」としか見えない。
 *
 * なぜ見えないのか、どうすれば見えるのかを、
 * 目に入る場所で伝える。
 *
 * ホームとマイページに置く。
 * ============================================================
 */

export default function BirthdateNotice() {
    const [needs, setNeeds] = useState(false)

    useEffect(() => {
        void (async () => {
            try {
                const profile = await getRepository().getProfile()

                /*
                 * ログインしていない人には出さない。
                 * 入れる場所がないので、言われても困る。
                 */
                if (!profile) return

                setNeeds(!profile.birthdate)
            } catch {
                /* 読めないときは出さない。誤って責めない */
            }
        })()
    }, [])

    if (!needs) return null

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid var(--color-danger)',
                background: 'color-mix(in srgb, var(--color-danger) 7%, transparent)',
                marginBottom: 14,
            }}
        >
            <span style={{ color: 'var(--color-danger)', fontSize: 15, lineHeight: 1.4 }}>
                ●
            </span>

            <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-danger)',
                    margin: 0,
                }}>
                    生年月日が未設定です
                </p>

                <p style={{
                    fontSize: 12,
                    lineHeight: 1.8,
                    color: 'var(--color-text)',
                    marginTop: 4,
                }}>
                    設定するまで、R15・R18 の作品は表示されません。
                    <br />
                    生年月日は年齢の確認にだけ使い、ほかの人には見えません。
                </p>

                <Link
                    href="/mypage?tab=settings"
                    style={{
                        display: 'inline-block',
                        marginTop: 8,
                        padding: '7px 16px',
                        borderRadius: 8,
                        background: 'var(--color-danger)',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'none',
                    }}
                >
                    生年月日を設定する
                </Link>
            </div>
        </div>
    )
}
