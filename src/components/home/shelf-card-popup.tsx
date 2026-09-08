'use client'

import { useEffect, useState } from 'react'

import NovelPreviewPopup from '@/components/novel-preview-popup'
import { createClient } from '@/lib/supabase/client'

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

            /*
             * ★ 本棚の本と、下の一覧の行、どちらからも出す。
             *
             *   前は本棚だけだった。
             *   同じ作品なのに、押す場所で出方が変わっていた。
             *   一覧から押した人には、いきなり作品ページが出る。
             */
            const book = target?.closest('a.book') as HTMLAnchorElement | null
            const row = target?.closest('a.rwl_item') as HTMLAnchorElement | null

            if (book) {
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
                return
            }

            if (!row) return

            /* 中身の無い枠（is-empty）は開かない */
            if (row.classList.contains('is-empty')) return

            /* 栞の押し具を押したときは、開かない */
            if (target?.closest('.rwl_mark')) return

            event.preventDefault()

            const id = (row.getAttribute('href') ?? '')
                .replace('/novel/', '')
                .split('/')[0]

            if (!id) return

            const title =
                row.querySelector('.rwl_item-title')?.textContent?.trim() ?? ''
            const author = (
                row.querySelector('.rwl_item-author')?.textContent?.trim() ?? ''
            ).replace(/^著：/, '')

            setPicked({
                id,
                title,
                genre: '',
                /*
                 * 一覧の行は、あらすじを持っていない。
                 * 小窓の側が、作品の id から読み直す。
                 */
                summary: null,
                display_name: author,
                tags: [],
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

    /*
     * 一覧の行から開いたときは、あらすじを持っていない。
     * 開いてから読み足す。開くのを待たせない。
     */
    useEffect(() => {
        if (!picked?.id || picked.summary !== null) return

        let alive = true

        void (async () => {
            try {
                const { data } = await createClient()
                    .from('novels')
                    .select('summary, genre, tags')
                    .eq('id', picked.id)
                    .maybeSingle()

                if (!alive || !data) return

                setPicked((now) =>
                    now && now.id === picked.id
                        ? {
                              ...now,
                              summary: (data.summary as string) ?? '',
                              genre: (data.genre as string) ?? '',
                              tags: ((data.tags as string[]) ?? []).slice(0, 3),
                          }
                        : now,
                )
            } catch {
                /* 読めなくても、題名と作者は出ている */
            }
        })()

        return () => {
            alive = false
        }
    }, [picked?.id, picked?.summary])

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
