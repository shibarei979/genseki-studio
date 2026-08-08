/**
 * ============================================================
 * 原石航路 Studio
 * SaveState — 設定の保存の状態
 *
 * 設定はすべて自動保存にする。
 *
 * ページによって「保存ボタンがある／ない」が違うと、
 * 押した瞬間に保存されているのか分からない。
 * 全部で同じ振る舞いにして、同じ場所に同じ表示を出す。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useSettingsSave() {
    const [status, setStatus] = useState<SaveStatus>("idle");
    const timerRef = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        },
        [],
    );

    /** 保存する。終わったら少しのあいだ「保存しました」を出す */
    const run = useCallback(async (task: () => Promise<unknown>) => {
        setStatus("saving");
        try {
            await task();
            setStatus("saved");

            if (timerRef.current !== null) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => setStatus("idle"), 2000);
        } catch {
            setStatus("error");
        }
    }, []);

    return { status, run };
}

export default function SaveState({ status }: { status: SaveStatus }) {
    if (status === "idle") return null;

    if (status === "saving") {
        return (
            <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-amber)]" />
                保存中…
            </span>
        );
    }

    if (status === "error") {
        return (
            <span className="text-xs text-[var(--color-danger)]">
                保存できませんでした
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1.5 text-xs text-forest">
            <CheckIcon />
            保存しました
        </span>
    );
}

function CheckIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m4 12.5 5.5 5.5L20 6.5" />
        </svg>
    );
}
