'use client'

import { useEffect, useRef } from 'react'

import { getRepository } from '@/lib/repository'
import { createClient } from '@/lib/supabase/client'

/**
 * ============================================================
 * 原石航路
 * NovelBookPopup — 作品を本の見開きで見せる
 *
 * 本棚と同じ見開きを使う。
 *
 * 別に作ると、直すたびに片方だけ古くなる。
 * 見た目も微妙にずれて、同じサイトに見えなくなる。
 * 器（book_info）と開く処理は home.js が持っているので、
 * それを呼ぶだけにする。
 * ============================================================
 */

declare global {
    interface Window {
        openBookInfo?: (data: {
            id: string
            href: string
            title: string
            author: string
            head: string
            excerpt: string
            comment: string
            likes: string
            tags: string[]
        }) => void
        closeBookInfo?: () => void
    }
}

interface Props {
    novel: {
        id: string
        title: string
        genre: string
        novel_type?: string
        summary?: string | null
        catchcopy?: string | null
        display_name?: string
        like_count?: number
        tags?: string[]
    }
    children: React.ReactNode
    /** 最初から開いた状態で出すか */
    openAtOnce?: boolean
    /** 閉じたときに知らせる */
    onClosed?: () => void
}

export default function NovelBookPopup({
    novel,
    children,
    openAtOnce = false,
    onClosed,
}: Props) {
    const opened = useRef(false)

    /*
     * 見開きの中に「今後この小窓を出さない」を差し込む。
     *
     * ★ 見開きは home.js が開いている。
     *   あのファイルは触らない決まりなので、
     *   開いたあとに、こちらから 1 つ足す。
     *
     * ★ 二重に足さない。
     *   同じ印を付けて、あれば何もしない。
     */
    function addOptOut() {
        const root = document.querySelector('.book_info')
        if (!root) return
        if (root.querySelector('[data-popup-optout]')) return

        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.popupOptout = '1'
        button.textContent = '今後この小窓を出さない（マイページの設定で戻せます）'
        button.style.cssText =
            'display:block;width:100%;margin:10px 0 4px;padding:6px;border:none;' +
            'background:none;color:var(--color-text-faint);font-size:11px;' +
            'cursor:pointer;text-decoration:underline'

        button.onclick = () => {
            void (async () => {
                try {
                    const me = await getRepository().getProfile()
                    const userId = (me as { user_id?: string } | null)?.user_id
                    if (userId) {
                        await createClient()
                            .from('profiles')
                            .update({ work_popup_style: 'none' })
                            .eq('user_id', userId)
                    }
                } catch {
                    /* 控えられなくても、いまは閉じる */
                }
                /*
                 * 頁を読み直す。
                 * 出すかどうかは組み上がるときに一度しか読まないので、
                 * 読み直さないと次の作品でもまだ開く。
                 */
                window.location.reload()
            })()
        }

        root.appendChild(button)
    }

    function open() {
        /*
         * 器がまだ無いことがある。
         *
         * home.js は後から読み込まれるので、
         * 押した時点で用意できていない場合は、
         * ふつうに作品ページへ行かせる。
         */
        if (!window.openBookInfo) {
            window.location.href = `/novel/${novel.id}`
            return
        }

        /* 開いたあとに差し込む。器ができるのを少し待つ */
        window.setTimeout(addOptOut, 120)

        window.openBookInfo({
            id: novel.id,
            href: `/novel/${novel.id}`,
            title: novel.title,
            author: novel.display_name ?? '',
            head: (novel.summary || novel.catchcopy || '').trim(),
            excerpt: '',
            comment: '',
            likes: String(novel.like_count ?? 0),
            tags: [novel.genre, ...(novel.tags ?? [])].filter(Boolean),
        })
    }

    useEffect(() => {
        if (!openAtOnce || opened.current) return
        opened.current = true
        open()

        /*
         * 閉じたら知らせる。
         *
         * 器の開閉は home.js が印（is_open）で持っている。
         * それが消えたら閉じたとみなす。
         */
        if (!onClosed) return

        const timer = window.setInterval(() => {
            const root = document.querySelector('.book_info')
            if (root && !root.classList.contains('is_open')) {
                window.clearInterval(timer)
                onClosed()
            }
        }, 300)

        return () => window.clearInterval(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openAtOnce])

    return (
        <div onClick={() => open()} style={{ cursor: 'pointer' }}>
            {children}
        </div>
    )
}
