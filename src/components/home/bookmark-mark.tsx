'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { useLoginRequired } from '@/hooks/use-login-required'

/**
 * ============================================================
 * 原石航路
 * BookmarkMark — 一覧から押せる保存の印
 *
 * これまでは飾りとして置いてあった。
 * 目に入るのに押せないと、壊れているように見える。
 *
 * 「気になるから、あとで読む」を、
 * 一覧を眺めたまま残せるようにする。
 * ============================================================
 */

export default function BookmarkMark({ novelId }: { novelId: string }) {
    const [saved, setSaved] = useState(false)
    const [busy, setBusy] = useState(false)

    /* 押した直後だけ立つ。少し経つと戻る */
    const [popping, setPopping] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)

    const { guard, prompt } = useLoginRequired(userId)

    useEffect(() => {
        void (async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            setUserId(user.id)

            const { data } = await supabase
                .from('bookmarks')
                .select('novel_id')
                .eq('novel_id', novelId)
                .eq('user_id', user.id)
                .maybeSingle()

            setSaved(Boolean(data))
        })()
    }, [novelId])

    /** 保存する・やめる。ログインしていなければ窓が出る */
    const toggle = guard('作品を保存する', () => {
        if (!userId || busy) return

        setBusy(true)

        /*
         * 先に見た目を変える。
         *
         * 押してから色が変わるまで待たされると、
         * 押せていないと思って二度押しされる。
         */
        const next = !saved
        setSaved(next)

        /*
         * 保存したときだけ弾ませる。
         * 外すときに跳ねると、消したのに祝われている気がする。
         */
        if (next) {
            setPopping(true)
            /* 輪が消えきるまで待つ */
            window.setTimeout(() => setPopping(false), 450)
        }

        void (async () => {
            const supabase = createClient()

            if (next) {
                await supabase
                    .from('bookmarks')
                    .insert({ novel_id: novelId, user_id: userId })
            } else {
                await supabase
                    .from('bookmarks')
                    .delete()
                    .eq('novel_id', novelId)
                    .eq('user_id', userId)
            }

            setBusy(false)
        })()
    })

    return (
        <>
            <button
                type="button"
                onClick={(e) => {
                    /*
                     * 押しても作品へ飛ばさない。
                     *
                     * この印は行の中にあるので、
                     * そのままだと作品の小窓が開いてしまう。
                     */
                    e.preventDefault()
                    e.stopPropagation()
                    toggle()
                }}
                aria-label={saved ? '保存をやめる' : '保存する'}
                title={saved ? '保存をやめる' : 'あとで読む'}
                className="rwl_mark"
                data-popping={popping ? "1" : undefined}
                style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    /*
                     * 保存したら、明るい山吹に。
                     * 暗いと、栞というより汚れに見える。
                     */
                    color: saved ? '#f5b731' : undefined,

                    /*
                     * 押した瞬間だけ、少し弾ませる。
                     *
                     * 色が変わるだけだと、
                     * 押せたのかどうか手応えがない。
                     */
                    transform: popping ? 'scale(1.35)' : 'scale(1)',
                    transition: 'transform .22s cubic-bezier(.34,1.56,.64,1), color .15s ease',
                }}
            >
                <svg width="19" height="19" viewBox="0 0 24 24"
                    fill={saved ? 'currentColor' : 'none'}
                    stroke="currentColor" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
            </button>

            {prompt}
        </>
    )
}
