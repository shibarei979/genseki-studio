/**
 * ============================================================
 * 原石航路 Studio
 * useReorder — 長押しでつかんで並べ替える
 *
 * 行を 0.35 秒押さえるとつかめる。
 * つかんだまま上下に動かすと、通り過ぎた行と入れ替わる。
 * 離すと確定し、onCommit で保存してもらう。
 *
 * ドラッグ&ドロップの API を使わないのは、
 * 指（スマートフォン）で効かないため。
 * Pointer Events なら指もマウスも同じ道で通る。
 *
 * 使い方:
 *   const reorder = useReorder({ onMove, onCommit });
 *   <ul ref={reorder.listRef} {...reorder.listProps}>
 *       <li data-reorder-id={id} {...reorder.itemProps(id)}>
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

/** 押さえてからつかめるまで。短いと、押すつもりが動いてしまう */
const HOLD_MS = 350;

interface Options {
    /** つかんだ行が別の行を通ったとき。並びの入れ替えは親が行う */
    onMove: (fromId: string, toId: string) => void;
    /** 離して確定したとき。保存は親が行う */
    onCommit: () => void;
}

export function useReorder({ onMove, onCommit }: Options) {
    const [heldId, setHeldId] = useState<string | null>(null);
    const heldRef = useRef<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const draggedRef = useRef(false);
    const listRef = useRef<HTMLUListElement>(null);

    /*
     * つかんでいる間は、指の動きで頁を送らせない。
     *
     * touch-action を後から変えても間に合わないので、
     * touchmove を passive でない形で聞き、
     * つかんでいるときだけ既定の動きを止める。
     */
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const block = (event: TouchEvent) => {
            if (heldRef.current) event.preventDefault();
        };
        list.addEventListener("touchmove", block, { passive: false });
        return () => list.removeEventListener("touchmove", block);
    }, []);

    function clearTimer() {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }

    function release() {
        clearTimer();
        if (heldRef.current) {
            heldRef.current = null;
            setHeldId(null);
            onCommit();
        }
    }

    function itemProps(id: string) {
        return {
            "data-reorder-id": id,
            onPointerDown: (event: React.PointerEvent) => {
                /* 入力欄や飛び先の上からはつかまない。書く・開くが先 */
                const target = event.target as HTMLElement;
                if (target.closest("a, input, textarea, select, label")) {
                    return;
                }
                draggedRef.current = false;
                clearTimer();
                timerRef.current = window.setTimeout(() => {
                    heldRef.current = id;
                    setHeldId(id);
                }, HOLD_MS);
            },
            /* 長押しの右クリック相当（スマートフォンのメニュー）を出さない */
            onContextMenu: (event: React.MouseEvent) => {
                if (heldRef.current || timerRef.current !== null) {
                    event.preventDefault();
                }
            },
        };
    }

    const listProps = {
        onPointerMove: (event: React.PointerEvent) => {
            if (!heldRef.current) return;
            draggedRef.current = true;

            const under = document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest("[data-reorder-id]");
            const overId = under?.getAttribute("data-reorder-id");

            if (overId && overId !== heldRef.current) {
                onMove(heldRef.current, overId);
            }
        },
        onPointerUp: release,
        onPointerCancel: release,
        /* 押したまま動かさず離した＝ただの押し。つかみ待ちを片づける */
        onPointerLeave: clearTimer,
        /*
         * つかんで動かした直後の「押した扱い」を 1 回だけ握り潰す。
         * 離した場所の行が開いたり選ばれたりしないように。
         */
        onClickCapture: (event: React.MouseEvent) => {
            if (draggedRef.current) {
                draggedRef.current = false;
                event.preventDefault();
                event.stopPropagation();
            }
        },
    };

    return { heldId, listRef, itemProps, listProps };
}
