/**
 * ============================================================
 * 原石航路 Studio
 * SprintTimer — 集中の時間を区切る
 *
 * 「今から25分書く」と決めるだけで、机に向かいやすくなる。
 * ひとりで使っても意味があるのは、この部分。
 *
 * 終わったら何文字書けたかを出す。
 * 時間だけ計っても、進んだ実感が残らない。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

/** 区切りの候補。長い区切りは続かないので短めに並べる */
const PRESETS = [
    { minutes: 15, label: "15分", note: "軽く一場面" },
    { minutes: 25, label: "25分", note: "ふつうの一区切り" },
    { minutes: 45, label: "45分", note: "じっくり" },
];

interface Props {
    /** いま書いている文字数。始めたときとの差を出す */
    currentChars: number;
    onFinish?: (result: { minutes: number; chars: number }) => void;
}

export default function SprintTimer({ currentChars, onFinish }: Props) {
    const [minutes, setMinutes] = useState(25);
    const [remaining, setRemaining] = useState<number | null>(null);
    const [result, setResult] = useState<{ minutes: number; chars: number } | null>(null);
    const startCharsRef = useRef(0);

    // 1 秒ごとに減らす
    useEffect(() => {
        if (remaining === null) return;

        if (remaining <= 0) {
            const chars = currentChars - startCharsRef.current;
            const done = { minutes, chars };
            setResult(done);
            setRemaining(null);
            onFinish?.(done);
            return;
        }

        const timer = window.setTimeout(() => {
            setRemaining((value) => (value === null ? null : value - 1));
        }, 1000);
        return () => window.clearTimeout(timer);
    }, [remaining, minutes, currentChars, onFinish]);

    function start() {
        startCharsRef.current = currentChars;
        setResult(null);
        setRemaining(minutes * 60);
    }

    const isRunning = remaining !== null;
    const written = isRunning ? currentChars - startCharsRef.current : 0;
    const progress = isRunning ? 1 - remaining / (minutes * 60) : 0;

    return (
        <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <ClockIcon />
                集中の時間
            </h3>

            {isRunning ? (
                <div className="mt-3">
                    {/* 残り時間 */}
                    <div className="flex items-baseline justify-between">
                        <p className="text-4xl font-semibold tabular-nums text-ink">
                            {formatClock(remaining)}
                        </p>
                        <p className="text-xs text-muted">
                            {written > 0 ? `+${written.toLocaleString("ja-JP")}文字` : "—"}
                        </p>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
                        <div
                            className="h-full rounded-full bg-forest transition-all duration-1000 ease-linear"
                            style={{ width: `${progress * 100}%` }}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setRemaining(null)}
                        className="mt-2.5 w-full rounded-md border border-line py-1.5 text-xs text-muted hover:text-ink"
                    >
                        やめる
                    </button>
                </div>
            ) : (
                <div className="mt-3">
                    {result && (
                        <p className="mb-2.5 rounded-md bg-forest-tint px-3 py-2 text-xs leading-relaxed text-ink">
                            {result.minutes}分で {result.chars.toLocaleString("ja-JP")}文字。
                            {result.chars > 0
                                ? "おつかれさまでした。"
                                : "進まない日もあります。"}
                        </p>
                    )}

                    <div className="flex gap-1">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.minutes}
                                type="button"
                                onClick={() => setMinutes(preset.minutes)}
                                aria-pressed={minutes === preset.minutes}
                                className={[
                                    "flex-1 rounded-lg border py-2 text-center",
                                    minutes === preset.minutes
                                        ? "border-forest bg-forest-tint text-forest"
                                        : "border-line text-muted hover:border-forest-line hover:text-ink",
                                ].join(" ")}
                            >
                                <span className="block text-sm font-semibold">
                                    {preset.label}
                                </span>
                                <span className="mt-0.5 block text-[10px] leading-tight opacity-80">
                                    {preset.note}
                                </span>
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={start}
                        className="mt-2.5 w-full rounded-lg bg-forest py-2.5 text-sm font-medium text-white hover:bg-forest-dark"
                    >
                        はじめる
                    </button>

                    <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
                        時間を区切ると、机に向かいやすくなります。
                    </p>
                </div>
            )}
        </section>
    );
}

function formatClock(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function ClockIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </svg>
    );
}
