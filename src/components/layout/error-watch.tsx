'use client'

import { useEffect } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * ErrorWatch — 落ちたことを、こちらへ知らせる
 *
 * ★ 画面が動いている最中の落ちを拾う。
 *
 *   error.tsx が受け止めるのは、組み立てに失敗したとき。
 *   押したときに落ちる、裏の仕事が落ちる——
 *   そういうものは、そこには来ない。
 *
 * ★ 数を絞る。
 *
 *   同じ落ち方が続くと、その頁を開いている間ずっと送り続ける。
 *   1 回の頁で 3 件まで。同じ言葉は 1 回だけ。
 *
 *   絞らないと、記録が同じもので埋まって読めなくなる。
 *
 * ★ 落ちても、何もしない。
 *   知らせる仕組みのせいで頁が壊れたら、本末転倒。
 * ============================================================
 */

const MAX_PER_PAGE = 3

export default function ErrorWatch() {
    useEffect(() => {
        let sent = 0
        const seen = new Set<string>()

        function tell(message: string, kind: string) {
            if (!message) return
            if (sent >= MAX_PER_PAGE) return
            if (seen.has(message)) return

            seen.add(message)
            sent += 1

            try {
                void fetch('/api/error', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message,
                        kind,
                        path: window.location.pathname + window.location.search,
                    }),
                    keepalive: true,
                })
            } catch {
                /* 知らせられなくても、頁は動く */
            }
        }

        function onError(e: ErrorEvent) {
            tell(
                [e.message, e.filename ? `（${e.filename}:${e.lineno}）` : '']
                    .join('')
                    .trim(),
                'client',
            )
        }

        function onRejection(e: PromiseRejectionEvent) {
            const reason = e.reason
            const message =
                reason instanceof Error
                    ? `${reason.name}: ${reason.message}`
                    : String(reason)
            tell(message, 'promise')
        }

        window.addEventListener('error', onError)
        window.addEventListener('unhandledrejection', onRejection)

        return () => {
            window.removeEventListener('error', onError)
            window.removeEventListener('unhandledrejection', onRejection)
        }
    }, [])

    return null
}
