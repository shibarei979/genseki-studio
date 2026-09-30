"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * たくさんの人のアイコン衣装をまとめて読む
 *
 *   const costumes = useCostumes(["id1", "id2", …]);
 *   costumes["id1"]  → その人がつけている衣装の絵（無ければ undefined）
 *
 * ★ コメント欄・コミュニティなど、人が並ぶ所で使う。
 *   人の顔ぶれが変わったときだけ読み直す。
 * ============================================================
 */

import { useEffect, useState } from "react";

export function useCostumes(ids: (string | null | undefined)[]): Record<string, string> {
    const key = Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
        .sort()
        .slice(0, 100)
        .join(",");
    const [costumes, setCostumes] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!key) return;
        let alive = true;
        fetch(`/api/points/costumes?ids=${encodeURIComponent(key)}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((data: { costumes?: Record<string, string> } | null) => {
                if (alive && data?.costumes) setCostumes(data.costumes);
            })
            .catch(() => {
                /* 衣装が読めなくても、ほかは読める */
            });
        return () => {
            alive = false;
        };
    }, [key]);

    return costumes;
}
