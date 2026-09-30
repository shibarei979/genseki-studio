"use client";

/**
 * ランキングの絞り込み（携帯で下から出る窓）を、見出しを下へなでて閉じる。
 *
 * ★ 開け閉めは頁の印（#rk-more の checkbox）で行っている（頁はサーバーで組むため）。
 *   ここは、なでて閉じる動きだけを足す。何も描かない。
 */

import { useEffect } from "react";

import { attachSwipeClose } from "@/lib/swipe-close";

export default function RankSheetSwipe() {
    useEffect(() => {
        const box = document.getElementById("rk-more") as HTMLInputElement | null;
        if (!box) return;
        let detach: (() => void) | null = null;
        const sync = () => {
            detach?.();
            detach = null;
            if (!box.checked) return;
            const head = document.querySelector<HTMLElement>(".rk-sheet-head");
            const sheet = document.querySelector<HTMLElement>(".ranking-filter");
            if (!head || !sheet) return;
            detach = attachSwipeClose(head, sheet, () => {
                box.checked = false;
                sync();
            });
        };
        box.addEventListener("change", sync);
        sync();
        return () => {
            box.removeEventListener("change", sync);
            detach?.();
        };
    }, []);
    return null;
}
