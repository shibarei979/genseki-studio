'use client'

import { useEffect, useState } from 'react'

import NovelPreviewPopup from '@/components/novel-preview-popup'

/**
 * ============================================================
 * 原石航路
 * ShelfCardPopup — 本棚の本を、札で見せる
 *
 * 本棚の本は home.js が立体的に並べている。
 * React の部品で包めないので、押されたのを拾って
 * こちらで札を開く。
 *
 * 設定が「本を開く」のときは何もしない。
 * home.js がそのまま見開きを出す。
 * ============================================================
 */

interface Picked {
    id: string
    title: string
    genre: string
    summary: string | null
    display_name: string
    tags: string[]
}

export default function ShelfCardPopup() {
    const [picked, setPicked] = useState<Picked | null>(null)

    useEffect(() => {
        function handle(event: MouseEvent) {
            /* 設定が「本を開く」なら、home.js に任せる */
            if (document.body.dataset.workPopup !== 'card') return

            const target = event.target as HTMLElement | null
            const book = target?.closest('a.book') as HTMLAnchorElement | null
            if (!book) return

            /* 準備中の本は開かない */
            if (book.dataset.placeholder) return

            event.preventDefault()

            const text = (selector: string) =>
                book.querySelector(selector)?.textContent?.trim() ?? ''

            const tags = Array.from(book.querySelectorAll('.b_tags li'))
                .map((li) => li.textContent?.trim() ?? '')
                .filter(Boolean)

            setPicked({
                id: book.dataset.id ?? '',
                title: text('.b_title'),
                genre: tags[0] ?? '',
                summary: text('.b_head') || null,
                display_name: text('.b_author'),
                tags,
            })
        }

        /*
         * 拾うのは掴まえる側で。
         *
         * home.js より先に受け取らないと、
         * あちらが見開きを開いてしまう。
         */
        document.addEventListener('click', handle, true)
        return () => document.removeEventListener('click', handle, true)
    }, [])

    if (!picked) return null

    return (
        <NovelPreviewPopup
            key={picked.id}
            novel={picked}
            openAtOnce
            onClosed={() => setPicked(null)}
        >
            {/* 押す所は要らない。開いた状態で出す */}
            <span style={{ display: 'none' }} />
        </NovelPreviewPopup>
    )
}
