/**
 * ============================================================
 * 原石航路 Studio
 * useAiStatus — モデルに繋がっているか
 *
 * 一度調べたら覚えておく。
 * 画面を開くたびに問い合わせても、鍵の有無は変わらない。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

export interface AiStatus {
    connected: boolean;
    model: string | null;
    imageModel: string | null;
    /** まだ調べ終わっていない */
    isChecking: boolean;
}

let cached: { connected: boolean; model: string | null; imageModel: string | null } | null =
    null;

export function useAiStatus(): AiStatus {
    const [status, setStatus] = useState<AiStatus>(() =>
        cached
            ? { ...cached, isChecking: false }
            : { connected: false, model: null, imageModel: null, isChecking: true },
    );

    useEffect(() => {
        if (cached) return;

        void (async () => {
            try {
                const response = await fetch("/api/ai/status");
                const data = (await response.json()) as {
                    connected?: boolean;
                    model?: string | null;
                    imageModel?: string | null;
                };
                cached = {
                    connected: data.connected === true,
                    model: data.model ?? null,
                    imageModel: data.imageModel ?? null,
                };
            } catch {
                // 調べられなければ繋がっていないものとして扱う
                cached = { connected: false, model: null, imageModel: null };
            }
            setStatus({ ...cached, isChecking: false });
        })();
    }, []);

    return status;
}
