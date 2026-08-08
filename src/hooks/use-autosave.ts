/**
 * ============================================================
 * 原石航路 Studio
 * useAutosave — 入力が止まったら保存する
 *
 * 値が変わるたびにタイマーを張り直し、
 * AUTOSAVE_DELAY_MS のあいだ入力が無ければ保存する。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { AUTOSAVE_DELAY_MS } from "@/config";

/**
 * 保存の状態。
 *
 * error を持たせているのは、
 * 失敗したことを書き手に伝えるため。
 * 黙って戻ると、書いたものが消えたと思われる。
 */
export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

interface Options<T> {
    /** 監視する値。これが変わると保存待ちに入る */
    value: T;
    /** 実際の保存処理 */
    onSave: (value: T) => Promise<void>;
    /** false のあいだは保存しない（読み込み中など） */
    enabled?: boolean;
}

export function useAutosave<T>({ value, onSave, enabled = true }: Options<T>) {
    const [state, setState] = useState<SaveState>("idle");
    const [savedAt, setSavedAt] = useState<string | null>(null);

    // 初回マウント時の値は「変更」ではないので保存しない
    const previousRef = useRef<T | null>(null);
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;

    useEffect(() => {
        if (!enabled) return;

        if (previousRef.current === null) {
            previousRef.current = value;
            return;
        }
        if (previousRef.current === value) return;
        previousRef.current = value;

        setState("pending");
        const timer = window.setTimeout(async () => {
            setState("saving");
            try {
                await onSaveRef.current(value);
                setSavedAt(new Date().toISOString());
                setState("saved");
            } catch {
                setState("error");
            }
        }, AUTOSAVE_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [value, enabled]);

    /** 保存待ちの内容をすぐ書き出す（画面を離れるときなど） */
    async function flush() {
        if (state !== "pending" && state !== "error") return;
        await save();
    }

    /** いま書き出す。失敗したら state に残す */
    async function save() {
        setState("saving");
        try {
            await onSaveRef.current(value);
            setSavedAt(new Date().toISOString());
            setState("saved");
        } catch {
            setState("error");
        }
    }

    return { state, savedAt, flush, save };
}
