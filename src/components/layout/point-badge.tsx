"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

/**
 * ============================================================
 * 原石航路 Studio
 * PointBadge — 頭の帯に出す、いまの無料ポイント
 *
 * ★ 2 段で出す。
 *
 *     無料pt
 *      50
 *
 *   横に並べると帯が狭くなる。
 *   縦に積めば、幅を取らずに数が大きく見える。
 *
 * ★ 入っている人にだけ出す。
 *   入っていない人に 0 を見せても、意味がない。
 *
 * ★ 有料ポイントは、まだ無い。
 *
 *   できたら「有料pt ｜ 無料pt」と並べる。
 *   いま器だけ作って 0 を並べても、
 *   何か月も 0 のままになる。
 * ============================================================
 */

export default function PointBadge() {
    const [points, setPoints] = useState<number | null>(null);

    useEffect(() => {
        let alive = true;

        void (async () => {
            try {
                const response = await fetch("/api/points/me");
                if (!response.ok) return;

                const data = (await response.json()) as { free?: number };
                if (alive && typeof data.free === "number") {
                    setPoints(data.free);
                }
            } catch {
                /* 読めなくても、ほかは動く */
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    /* 読めていないあいだは、場所を取らない */
    if (points === null) return null;

    return (
        <Link
            href="/mypage"
            aria-label={`無料ポイント ${points}`}
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1.15,
                padding: "2px 10px",
                borderRadius: 8,
                textDecoration: "none",
                color: "var(--color-text-muted)",
            }}
        >
            <span style={{ fontSize: 9.5, letterSpacing: ".04em" }}>
                無料pt
            </span>

            <span
                style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--color-brand)",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {points.toLocaleString()}
            </span>
        </Link>
    );
}
