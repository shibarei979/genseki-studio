'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { getRepository } from '@/lib/repository'
import { createClient } from '@/lib/supabase/client'

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
                /*
                 * ログインしている人にだけ出す。
                 *
                 * 前は getProfile() だけを見ていた。
                 * ログインしていない人にも空でない何かが返ることがあり、
                 * 入っていない人の画面にも帯が出ていた。
                 * 入っていない人に「生年月日を設定してください」と言っても、
                 * 設定する場所そのものが無い。
                 */
                const { data } = await createClient().auth.getUser()
                if (!data.user) return

                const profile = await getRepository().getProfile()
                if (!profile) return

                setNeeds(!profile.birthdate)
            } catch {
                /* 出せなくても、読むことはできる */
            }
        })()
    }, [])

    if (!needs) return null

    /*
     * 一行に収める。
     *
     * 前は 3 段あった。見出し・説明 2 行・押し具。
     * ホームのいちばん上を占めていて、
     * 作品を見に来た人の邪魔になっていた。
     *
     * 伝えたいのは「設定しないと R15・R18 が出ない」の一点。
     * それだけ書いて、行き先を文の中に置く。
     */
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 14px',
                borderRadius: 8,
                /* 赤を薄く。注意であって、警告ではない */
                border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
                background: 'color-mix(in srgb, var(--color-danger) 4%, transparent)',
                marginBottom: 12,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'var(--color-text)',
            }}
        >
            <span style={{
                color: 'color-mix(in srgb, var(--color-danger) 70%, transparent)',
                fontSize: 11,
                flexShrink: 0,
            }}>
                ●
            </span>

            <span style={{ minWidth: 0 }}>
                生年月日を設定すると、R15・R18 の作品も表示されます。
                {' '}
                <Link
                    href="/mypage?tab=settings"
                    style={{
                        color: 'var(--color-danger)',
                        fontWeight: 600,
                        textDecoration: 'underline',
                    }}
                >
                    設定する
                </Link>
            </span>
        </div>
    )
}
