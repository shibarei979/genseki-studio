/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeStatusMark — 話のステータスを表す丸印
 *
 * クリックで 未着手 → 執筆中 → 完成 → 未着手 と切り替わる。
 * ============================================================
 */

"use client";

import type { EpisodeStatus } from "@/types";
import { EPISODE_STATUS_LABEL } from "@/types";

interface Props {
    status: EpisodeStatus;
    onToggle: () => void;
}

export default function EpisodeStatusMark({ status, onToggle }: Props) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onToggle();
            }}
            title={`${EPISODE_STATUS_LABEL[status]}（クリックで変更）`}
            aria-label={`ステータス：${EPISODE_STATUS_LABEL[status]}。クリックで変更`}
            className="shrink-0 rounded-full p-0.5"
        >
            {status === "done" && (
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <circle cx="9" cy="9" r="8" fill="var(--color-forest)" />
                    <path
                        d="M5 9.2 L7.8 12 L13 6.6"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
            {status === "writing" && (
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <circle
                        cx="9"
                        cy="9"
                        r="8"
                        fill="none"
                        stroke="var(--color-amber)"
                        strokeWidth="1.8"
                    />
                    <path d="M9 1 A8 8 0 0 1 9 17 Z" fill="var(--color-amber)" />
                </svg>
            )}
            {status === "todo" && (
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <circle
                        cx="9"
                        cy="9"
                        r="8"
                        fill="none"
                        stroke="var(--color-faint)"
                        strokeWidth="1.8"
                    />
                </svg>
            )}
        </button>
    );
}
