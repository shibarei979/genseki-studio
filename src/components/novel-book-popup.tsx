'use client'

import { useEffect, useRef } from 'react'

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
