"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * useContestMarks — 作品ごとの「応募中」の印を読む（画面の側）
 *
 *   作品の id の並びを渡すと、/api/contest-marks から読んで返す。
 *   読めなかったときは空のまま（印が出ないだけで、ほかは動く）。
 * ============================================================
 */

import { useEffect, useState } from "react";

import type { ContestMark } from "@/lib/contest-marks";

export function useContestMarks(ids: string[]): Record<string, ContestMark[]> {
    const [marks, setMarks] = useState<Record<string, ContestMark[]>>({});
    /* 並びが同じなら読み直さない */
    const key = Array.from(new Set(ids)).sort().join(",");

    useEffect(() => {
        if (!key) return;
        let alive = true;
        void (async () => {
            try {
                const response = await fetch(`/api/contest-marks?ids=${encodeURIComponent(key)}`);
                if (!response.ok) return;
                const data = (await response.json()) as { marks?: Record<string, ContestMark[]> };
                if (alive && data.marks) setMarks(data.marks);
            } catch {
                /* 読めなくても、ほかは出す */
            }
        })();
        return () => {
            alive = false;
        };
    }, [key]);

    return marks;
}
