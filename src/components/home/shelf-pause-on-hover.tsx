'use client'

import { useEffect } from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * ShelfPauseOnHover — 本棚に印を置いているあいだ、送りを止める
 *
 * ★ なぜ要るか。
 *
 *   本棚はひとりでに横へ流れている。
 *   題名を読もうとして印を置いた本が、
 *   読み終える前に流れていってしまう。
 *
 *   小窓を開いたときは止まる作りになっているので、
 *   止める仕組み自体は元からある。
 *   それを、印を置いたときにも使う。
 *
 * ★ home.js には触らない。
 *
 *   あちらは本の位置を計算している。触ると崩れる。
 *   窓に出してある stop() / start() を、こちらから呼ぶ。
 *
 * ★ 見張りは頁全体に置く。
 *
 *   本棚は、画面が組み上がったあとに作られる。
 *   棚そのものに見張りを付けようとすると、
 *   まだ無いことがある。頁で受けて、
 *   印の下に棚があるかを見る。
 * ============================================================
 */

interface Loop {
    /** 送りを止める */
    stop?: () => void
    /** 送りを始める */
    start?: () => void
    root?: HTMLElement
}

export default function ShelfPauseOnHover() {
    useEffect(() => {
        /* 止めているあいだは true。二重に止めない */
        let holding = false

        function loops(): Loop[] {
            return (window as unknown as { bookshelfLoops?: Loop[] })
                .bookshelfLoops ?? []
        }

        function onOver(event: Event) {
            const target = event.target
            if (!(target instanceof Element)) return
            if (!target.closest('.bookshelf-loop')) return
            if (holding) return

            holding = true
            loops().forEach((one) => one.stop?.())
        }

        function onOut(event: Event) {
            const target = event.target
            if (!(target instanceof Element)) return
            if (!holding) return

            /*
             * 棚の中で本から本へ移っただけなら、止めたまま。
             * 出た先がまだ棚の中かどうかを見る。
             */
            const to = (event as MouseEvent).relatedTarget
            if (to instanceof Element && to.closest('.bookshelf-loop')) return

            if (!target.closest('.bookshelf-loop')) return

            holding = false
            loops().forEach((one) => one.start?.())
        }

        document.addEventListener('mouseover', onOver)
        document.addEventListener('mouseout', onOut)

        return () => {
            document.removeEventListener('mouseover', onOver)
            document.removeEventListener('mouseout', onOut)
            /* 頁を離れるときは、止めっぱなしにしない */
            if (holding) loops().forEach((one) => one.start?.())
        }
    }, [])

    return null
}
