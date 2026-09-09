'use client'

import { useEffect } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * CopyAttribution — 写した本文に、出どころを添える
 *
 * ★ 写すこと自体は止めない。
 *
 *   本文はブラウザに届いた時点で、その人の機械の中にある。
 *   右クリックを止めても、頁の元を見れば読める。
 *   選択を止めれば、なぞって引用も、読み上げも、
 *   翻訳も、目の不自由な人の道具も使えなくなる。
 *
 *   止められないものを止めようとするより、
 *   持ち出されたものに出どころが残るほうが、実際に効く。
 *   無断で転載されたときの証しにもなる。
 *
 * ★ 本文の中で写したときだけ添える。
 *
 *   感想や見出しを写しても添えない。
 *   本文の文には data-sentence が付いているので、それで見分ける。
 *
 * ★ 短いものには添えない。
 *
 *   一節を引くだけなら、下に 3 行の断りが付くほうが
 *   じゃまになる。感想に一文を引く読み方は、
 *   作者にとっても損ではない。
 *
 *   まとまった量を持ち出したときにだけ添える。
 * ============================================================
 */

/** これより短いときは、何も添えない */
const MIN_LENGTH = 100

export default function CopyAttribution({
    workTitle,
    episodeTitle,
    authorName,
}: {
    workTitle: string
    episodeTitle?: string
    authorName?: string
}) {
    useEffect(() => {
        function onCopy(event: ClipboardEvent) {
            const selection = window.getSelection?.()
            if (!selection || selection.isCollapsed) return

            const text = selection.toString()
            if (text.trim().length < MIN_LENGTH) return

            /* 本文の中で選んだものか確かめる */
            let node: Node | null = selection.anchorNode
            let inBody = false

            while (node) {
                if (
                    node instanceof HTMLElement &&
                    node.hasAttribute('data-sentence')
                ) {
                    inBody = true
                    break
                }
                node = node.parentNode
            }

            if (!inBody) return

            const where = [
                `『${workTitle}』`,
                episodeTitle ? ` ${episodeTitle}` : '',
                authorName ? `／${authorName}` : '',
            ].join('')

            const note = `\n\n―――\n${where}\n${window.location.href}`

            event.clipboardData?.setData('text/plain', text + note)
            event.preventDefault()
        }

        document.addEventListener('copy', onCopy)
        return () => document.removeEventListener('copy', onCopy)
    }, [workTitle, episodeTitle, authorName])

    return null
}
