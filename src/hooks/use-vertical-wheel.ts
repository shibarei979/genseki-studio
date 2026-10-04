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
 *
 * ★ ただし、端で一度止まる（2026-10 に足した）。
 *   輪は勢いで続けて回るので、端に着いた瞬間に頁へ譲ると、
 *   最後の行を読む前に本文が画面の上へ流れていった。
 *   続けて回しているあいだ（PAUSE_MS より短い間隔）は止め、
 *   いったん手を止めてから回したときだけ頁を動かす。
 *
 * ★ 本文の枠が画面からはみ出しているあいだは、頁を先に動かす（2026-10 に足した）。
 *   前は枠の上に印があると、必ず本文が送られた。
 *   頁を上へ戻したいだけでも本文が戻ってしまい、
 *   印を枠の外へ出してから戻す手間がかかっていた。
 *   枠がぴったり画面に収まる所まで頁を動かし、そこで一度止まってから本文を送る。
 * ============================================================
 */
/** 続けて回しているとみなす間隔。これより長く止めたら、次は新しいひと回し */
const PAUSE_MS = 450;
/** 収まっているとみなす余裕（画素） */
const SLACK = 4;

/** 上に貼り付いている帯の高さ（globals.css の --gk-head-h）。読めなければ 0 */
function stickyTop(): number {
    try {
        const value = getComputedStyle(document.documentElement).getPropertyValue("--gk-head-h");
        const px = parseFloat(value);
        return Number.isFinite(px) ? px : 0;
    } catch {
        return 0;
    }
}

/** 頁そのものが縦に動けるか（書く画面のように頁が動かない作りでは、頁を先に動かす決まりを使わない） */
function pageCanScroll(): boolean {
    const root = document.scrollingElement || document.documentElement;
    return root.scrollHeight > window.innerHeight + 1;
}

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
        /**
         * その向きに、まだ動く余地があるか。
         *
         * ★ 縦書きでは、横の位置がマイナスになる。
         *
         *   右から左へ読む並びでは、右端が 0 で、
         *   左へ送るほど scrollLeft は負の値になる。
         *
         *     縦書き   -最大 〜 0
         *     横書き     0 〜 最大
         *
         *   前は「0 より大きいか」だけを見ていた。
         *   縦書きでは 0 以下にしかならないので、
         *   左へは一度も動けなかった。
         *
         *   「奥に回すと右へ行くのに、手前に回しても何も起きない」
         *   という声は、これ。
         *
         *   両方の並びに合うよう、上と下の端を数え直す。
         */
        function canMove(node: Element, toward: number) {
            const span = node.scrollWidth - node.clientWidth;
            if (span <= 1) return false;

            const left = node.scrollLeft;

            /* どちらの並びでも通るよう、両端を広く取る */
            const lower = Math.min(0, -span);
            const upper = Math.max(0, span);

            /* 端まで 1 画素以内なら、もう動けないとみなす */
            return toward < 0 ? left > lower + 1 : left < upper - 1;
        }

        function findScroller(from: EventTarget | null, toward: number) {
            let node = from instanceof Element ? from : null;

            while (node && boxRef.current?.contains(node)) {
                if (canMove(node, toward)) return node;
                node = node.parentElement;
            }

            /* 見つからなければ、外枠そのものを試す */
            const outer = boxRef.current;
            if (outer && canMove(outer, toward)) return outer;

            return null;
        }

        /* いまのひと回しで、こちらが動かした（本文を送った・頁を合わせた）か */
        let lastAt = 0;
        let consumed = false;
        /* いまのひと回しで、頁を合わせていたか（合わせ終えても、そのひと回しでは本文を送らない） */
        let aligning = false;
        /*
         * 頁が（こちらが動かしたのではなく）動いた時刻。
         * 頁を送っている勢いのまま枠の上に来たとき、いきなり本文を送らないために見る。
         */
        let pageMovedAt = 0;
        let selfMoveUntil = 0;
        function onPageScroll() {
            if (Date.now() > selfMoveUntil) pageMovedAt = Date.now();
        }

        function onWheel(event: WheelEvent) {
            /* 横の動きは、そのまま任せる */
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
            if (event.deltaY === 0) return;

            /* 手を止めてから回したら、新しいひと回し */
            const now = Date.now();
            if (now - lastAt > PAUSE_MS) {
                consumed = false;
                aligning = false;
            }
            lastAt = now;

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
             * ★ 枠が画面からはみ出していれば、先に頁を動かして枠を収める。
             *   収まる所でぴったり止め、そのひと回しは本文を送らない。
             */
            const outer = boxRef.current;
            if (outer && pageCanScroll()) {
                const rect = outer.getBoundingClientRect();
                const top = stickyTop();
                const view = window.innerHeight;
                const tooTall = rect.height > view - top;

                let need = 0;
                if (step > 0) {
                    /* 下へ：枠の下が画面の下より下にある → 下が見えるまで（背が高ければ上を帯の下に合わせる） */
                    if (rect.bottom > view + SLACK) need = tooTall ? rect.top - top : rect.bottom - view;
                } else {
                    /* 上へ：枠の上が帯に隠れている → 上が見えるまで（背が高ければ下を画面の下に合わせる） */
                    if (rect.top < top - SLACK) need = tooTall ? rect.bottom - view : rect.top - top;
                }

                if ((step > 0 && need > SLACK) || (step < 0 && need < -SLACK)) {
                    const move = step > 0 ? Math.min(step, need) : Math.max(step, need);
                    selfMoveUntil = Date.now() + 120;
                    window.scrollBy(0, move);
                    event.preventDefault();
                    consumed = true;
                    aligning = true;
                    return;
                }
            }

            /*
             * 読み進む向きは左。
             * 右端が本文の頭なので、送るほど scrollLeft は減る。
             */
            const target = findScroller(event.target, -step);

            if (!target) {
                /*
                 * ★ 端に着いた。続けて回しているあいだは止める（頁へ流さない）。
                 *   手を止めてから回したときだけ、頁に譲る。
                 */
                if (consumed) event.preventDefault();
                return;
            }

            /*
             * 頁を合わせ終えた直後、または頁を送っていた勢いのまま枠の上に来たとき。
             * 手を止めるまでは本文を送らない（行き過ぎ防止）。
             */
            if (aligning || (!consumed && now - pageMovedAt < PAUSE_MS)) {
                aligning = true;
                event.preventDefault();
                return;
            }

            const before = target.scrollLeft;
            target.scrollLeft = before - step;

            if (target.scrollLeft !== before) {
                event.preventDefault();
                consumed = true;
                onScrolled?.();
            }
        }

        box.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("scroll", onPageScroll, { passive: true });
        return () => {
            box.removeEventListener("wheel", onWheel);
            window.removeEventListener("scroll", onPageScroll);
        };

        /*
         * ★ 見張りの掛け直しは、縦書きの切り替えのときだけ。
         *
         *   見張りを持たないと、画面が組み直るたびに
         *   外して付け直すことになる。
         *   打つたびに組み直るので、そのたびに掛け直していた。
         */
    }, [boxRef, isVertical, onScrolled]);
}

export default useVerticalWheel;
