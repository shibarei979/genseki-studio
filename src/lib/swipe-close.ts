"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * 下から出る窓を、見出しの所を下へなでて閉じる
 *
 *   attachSwipeClose(つまむ所, 窓, 閉じる)
 *   useSwipeClose(つまむ所の ref, 窓の ref, 閉じる, 開いているか)
 *
 * ★ つまむ所（見出しの段）だけで受ける。
 *   窓の中身で受けると、中を送る動きと区別できない。
 * ★ 指に合わせて窓を下げ、80px 以上下げて離したら閉じる。足りなければ戻す。
 * ============================================================
 */

import { useEffect, type RefObject } from "react";

const CLOSE_AT = 80;

export function attachSwipeClose(handle: HTMLElement, sheet: HTMLElement, onClose: () => void): () => void {
    let startY = 0;
    let dy = 0;
    let active = false;

    const start = (event: TouchEvent) => {
        active = true;
        startY = event.touches[0].clientY;
        dy = 0;
        sheet.style.transition = "none";
    };
    const move = (event: TouchEvent) => {
        if (!active) return;
        dy = Math.max(0, event.touches[0].clientY - startY);
        sheet.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
        /* 下げているあいだは、後ろの頁を送らない */
        if (dy > 0 && event.cancelable) event.preventDefault();
    };
    const end = () => {
        if (!active) return;
        active = false;
        sheet.style.transition = "transform .2s ease";
        if (dy >= CLOSE_AT) {
            sheet.style.transform = "translateY(100%)";
            window.setTimeout(() => {
                sheet.style.transform = "";
                sheet.style.transition = "";
                onClose();
            }, 180);
        } else {
            sheet.style.transform = "";
            window.setTimeout(() => {
                sheet.style.transition = "";
            }, 220);
        }
    };

    handle.addEventListener("touchstart", start, { passive: true });
    handle.addEventListener("touchmove", move, { passive: false });
    handle.addEventListener("touchend", end);
    handle.addEventListener("touchcancel", end);
    return () => {
        handle.removeEventListener("touchstart", start);
        handle.removeEventListener("touchmove", move);
        handle.removeEventListener("touchend", end);
        handle.removeEventListener("touchcancel", end);
    };
}

export function useSwipeClose(
    handleRef: RefObject<HTMLElement>,
    sheetRef: RefObject<HTMLElement>,
    onClose: () => void,
    isOpen: boolean,
) {
    useEffect(() => {
        if (!isOpen || !handleRef.current || !sheetRef.current) return;
        return attachSwipeClose(handleRef.current, sheetRef.current, onClose);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);
}
