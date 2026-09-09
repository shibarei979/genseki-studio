"use client";

import { useEffect, type RefObject } from "react";

/**
 * ============================================================
 * 原石航路 Studio
 * useVerticalWheel — 縦書きのとき、輪の上下を横送りに変える
 *
 * ★ なぜ要るか。
 *
 *   縦書きの本文は、行が右から左へ伸びる。
 *   送るのは横だが、指も輪も上下に動かす道具。
 *   何もしないと、本文の上で回しても中身は動かず、
 *   代わりに頁ごと下へ流れる。
 *
 *   読む人からも書く人からも、同じ声が届いた。
 *
 * ★ 読む側と書く側で、同じものを使う。
 *
 *   前は書く画面にだけ入れていた。
 *   縦書きの本文を出す所は 4 つあり、
 *   別々に書くと、片方だけ直った状態が残る。
 *
 * ★ 枠の中に印があれば、どこでも効く。
 *   見張りは外枠に付ける。中の本文だけに付けると、
 *   目盛りの帯や余白の上では効かない。
 *
 * ★ 端に着いたら、そこから先は頁に譲る。
 *   止めてしまうと、枠の中に印があるあいだ
 *   頁を動かせなくなる。
 * ============================================================
 */
export function useVerticalWheel(
    /** 見張る外枠。この中で回したときだけ効く */
    boxRef: RefObject<HTMLElement | null>,
    /** 縦書きのときだけ効かせる */
    isVertical: boolean,
    /** 送ったあとにすること。目盛りを合わせるなど */
    onScrolled?: () => void,
) {
    useEffect(() => {
        const box = boxRef.current;
        if (!box || !isVertical) return;

        /**
         * 横にはみ出していて、その向きにまだ余地がある箱を探す。
         *
         * 縦書きで横に動く箱が、本文そのものとは限らない。
         * 印の下にある物から親をたどって見つける。
         */
        function findScroller(from: EventTarget | null, toward: number) {
            let node = from instanceof Element ? from : null;

            while (node && boxRef.current?.contains(node)) {
                if (node.scrollWidth - node.clientWidth > 1) {
                    const left = node.scrollLeft;
                    const max = node.scrollWidth - node.clientWidth;

                    if (toward < 0 ? left > 0 : left < max) return node;
                }
                node = node.parentElement;
            }

            /* 見つからなければ、外枠そのものを試す */
            const outer = boxRef.current;
            if (outer && outer.scrollWidth - outer.clientWidth > 1) {
                const left = outer.scrollLeft;
                const max = outer.scrollWidth - outer.clientWidth;
                if (toward < 0 ? left > 0 : left < max) return outer;
            }

            return null;
        }

        function onWheel(event: WheelEvent) {
            /* 横の動きは、そのまま任せる */
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
            if (event.deltaY === 0) return;

            /*
             * 動く量。輪によって単位が違う。
             *
             *   0  そのまま画素
             *   1  行。1 行を 16 画素とみなす
             *   2  頁。見えている幅ぶん
             */
            const width = boxRef.current?.clientWidth ?? 0;
            const step =
                event.deltaMode === 1
                    ? event.deltaY * 16
                    : event.deltaMode === 2
                      ? event.deltaY * width
                      : event.deltaY;

            /*
             * 読み進む向きは左。
             * 右端が本文の頭なので、送るほど scrollLeft は減る。
             */
            const target = findScroller(event.target, -step);
            if (!target) return;

            const before = target.scrollLeft;
            target.scrollLeft = before - step;

            if (target.scrollLeft !== before) {
                event.preventDefault();
                onScrolled?.();
            }
        }

        box.addEventListener("wheel", onWheel, { passive: false });
        return () => box.removeEventListener("wheel", onWheel);
    });
}

export default useVerticalWheel;
