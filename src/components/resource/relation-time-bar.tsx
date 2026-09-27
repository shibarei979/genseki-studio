/**
 * ============================================================
 * 原石航路 Studio
 * RelationTimeBar — 話を追って見る（話・章ごとの関係図・Pro）
 *
 * ★ 関係図の上に、たたんだ 1 行で置く。はじめはたたんでおく。
 *   開くと「話を追って見る」になり、閉じると いまの全体 に戻る。
 *   切り替えの押し具を別に置くと、開いているのに全体のまま、のような食い違いが起きる。
 *
 * ★ 開いたら、いちばん大きく「いつの時点か」を出す。
 *   その下に ◀ つまみ ▶ と、章の終わりへ飛ぶ押し具。
 *   章の区切りは、つまみの下に目盛りとしても出す。
 *
 * ★ その話で起きたこと（初めて出た人・変わった関係）を、下に札で出す。
 *   図だけ見比べても、何が変わったかは見落とす。
 *
 * ★ Pro でない人が開くと、何ができるかの説明と、Pro で使えることを出す。
 * ============================================================
 */

"use client";

import { useState } from "react";

import ProBadge from "@/components/common/pro-badge";
import { formatEpisodeLabel } from "@/types";
import type { Episode, ResourceEntry } from "@/types";
import type { RelationAtPoint } from "@/lib/resource/relation-at";

export interface ChapterStop {
    label: string;
    /** その章の最後の話（0 から） */
    lastIndex: number;
}

interface Props {
    isPro: boolean;
    episodes: Episode[];
    chapterStops: ChapterStop[];
    /** null なら「いまの全体」（たたんでいる） */
    upTo: number | null;
    onChange: (upTo: number | null) => void;
    point: RelationAtPoint | null;
    entryById: Map<string, ResourceEntry>;
}

export default function RelationTimeBar({
    isPro,
    episodes,
    chapterStops,
    upTo,
    onChange,
    point,
    entryById,
}: Props) {
    /* Pro でない人が開いたとき（説明を出す） */
    const [isPeek, setIsPeek] = useState(false);
    if (episodes.length === 0) return null;

    const last = episodes.length - 1;
    const isOpen = isPro ? upTo !== null : isPeek;

    function toggle() {
        if (!isPro) {
            setIsPeek((on) => !on);
            return;
        }
        onChange(upTo === null ? last : null);
    }

    /* 章の区切りの目盛り（つまみの上の位置、%） */
    const tickAt = (index: number) => (last === 0 ? 0 : (index / last) * 100);

    return (
        <div
            className={[
                "overflow-hidden rounded-lg border bg-surface",
                isOpen ? "border-forest-line" : "border-line",
            ].join(" ")}
        >
            {/* たたんだ行。押すと開く */}
            <button
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                className={[
                    "flex w-full items-center gap-2.5 px-3 py-2.5 text-left",
                    isOpen ? "bg-forest-tint/50" : "hover:bg-canvas",
                ].join(" ")}
            >
                <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest"
                >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <circle cx="8" cy="8" r="6.2" />
                        <path d="M8 4.6V8l2.4 1.6" />
                    </svg>
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                        話を追って見る
                        <ProBadge />
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                        {isPro && upTo !== null
                            ? `「${formatEpisodeLabel(episodes[upTo])}」の時点の関係を出しています`
                            : "何話の時点で誰と誰がどんな関係だったかを、話・章ごとにたどれます"}
                    </span>
                </span>
                <span className="shrink-0 text-[11px] text-muted">
                    {isOpen ? (isPro ? "閉じて全体に戻す" : "閉じる") : "開く"}
                </span>
                <span
                    aria-hidden
                    className={["shrink-0 text-[10px] text-faint transition-transform", isOpen ? "rotate-180" : ""].join(" ")}
                >
                    ▼
                </span>
            </button>

            {/* Pro でない人 */}
            {!isPro && isPeek && (
                <div className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-muted">
                    <p>
                        つまみを動かすと、その話までに出てきた人と、その時点の関係の名前で図を描き直します。
                        章の終わりへ一度に飛んだり、その話で初めて出た人・変わった関係を確かめたりできます。
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-ink">
                        <ProBadge />
                        の機能です。サブスクに入ると使えます。
                    </p>
                </div>
            )}

            {isPro && upTo !== null && (
                <div className="border-t border-forest-line/60 px-3 pb-3 pt-3 sm:px-4">
                    {/* いつの時点か。いちばん大きく */}
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-[16px] font-semibold text-ink">
                            「{formatEpisodeLabel(episodes[upTo])}」<span className="text-[13px] font-normal text-muted">まで</span>
                        </p>
                        <p className="text-[12px] tabular-nums text-muted">
                            {upTo + 1}<span className="text-faint">／{episodes.length}話</span>
                        </p>
                    </div>

                    {/* ◀ つまみ ▶ */}
                    <div className="mt-2.5 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onChange(Math.max(0, upTo - 1))}
                            disabled={upTo <= 0}
                            aria-label="前の話"
                            className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-[12px] text-muted hover:border-forest-line hover:text-forest disabled:opacity-30"
                        >
                            ◀<span className="hidden sm:inline">前の話</span>
                        </button>
                        <div className="relative min-w-0 flex-1">
                            <input
                                type="range"
                                min={0}
                                max={last}
                                value={upTo}
                                onChange={(event) => onChange(Number(event.target.value))}
                                aria-label="何話までの関係を見るか"
                                className="w-full accent-[var(--color-forest)]"
                            />
                            {/* 章の区切り */}
                            {chapterStops.length > 1 && (
                                <div aria-hidden className="pointer-events-none relative mx-2 h-2">
                                    {chapterStops.slice(0, -1).map((stop) => (
                                        <span
                                            key={stop.lastIndex}
                                            className="absolute top-0 h-2 w-px bg-forest-line"
                                            style={{ left: `${tickAt(stop.lastIndex)}%` }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => onChange(Math.min(last, upTo + 1))}
                            disabled={upTo >= last}
                            aria-label="次の話"
                            className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-[12px] text-muted hover:border-forest-line hover:text-forest disabled:opacity-30"
                        >
                            <span className="hidden sm:inline">次の話</span>▶
                        </button>
                    </div>

                    {/* 章の終わりへ */}
                    {chapterStops.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-faint">章の終わりへ</span>
                            {chapterStops.map((stop) => (
                                <button
                                    key={`${stop.label}-${stop.lastIndex}`}
                                    type="button"
                                    onClick={() => onChange(stop.lastIndex)}
                                    aria-pressed={upTo === stop.lastIndex}
                                    className={[
                                        "max-w-[12rem] truncate rounded-full border px-3 py-1 text-[12px]",
                                        upTo === stop.lastIndex
                                            ? "border-forest bg-forest text-white"
                                            : "border-line bg-surface text-muted hover:border-forest-line hover:text-forest",
                                    ].join(" ")}
                                >
                                    {stop.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => onChange(last)}
                                aria-pressed={upTo === last}
                                className={[
                                    "rounded-full border px-3 py-1 text-[12px]",
                                    upTo === last
                                        ? "border-forest bg-forest text-white"
                                        : "border-line bg-surface text-muted hover:border-forest-line hover:text-forest",
                                ].join(" ")}
                            >
                                最新話
                            </button>
                        </div>
                    )}

                    {/* この話で起きたこと */}
                    {point && (
                        <div className="mt-3">
                            <p className="text-[11px] font-medium text-muted">この話で起きたこと</p>
                            {point.newcomers.length === 0 && point.changed.length === 0 ? (
                                <p className="mt-1 text-[12px] text-faint">新しく出た人・変わった関係はありません。</p>
                            ) : (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {point.newcomers.map((entry) => (
                                        <span
                                            key={entry.id}
                                            className="inline-flex items-center gap-1.5 rounded-md border border-forest-line bg-forest-tint/60 px-2 py-1 text-[12px] text-ink"
                                        >
                                            <span className="rounded bg-forest px-1 text-[10px] text-white">初登場</span>
                                            {entry.name}
                                        </span>
                                    ))}
                                    {point.changed.map(({ relation, before, after }) => (
                                        <span
                                            key={relation.id}
                                            className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--color-amber)] bg-[var(--color-amber-tint)] px-2 py-1 text-[12px] text-ink"
                                        >
                                            <span className="rounded bg-[var(--color-amber)] px-1 text-[10px] text-white">変化</span>
                                            {entryById.get(relation.from_entry_id)?.name ?? "?"}
                                            <span className="text-faint">と</span>
                                            {entryById.get(relation.to_entry_id)?.name ?? "?"}
                                            <span className="text-muted">
                                                {before}
                                                <span className="mx-0.5 text-faint">→</span>
                                                <span className="font-medium text-[var(--color-amber)]">{after}</span>
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                                この話より後で初めて出る人は出しません。関係の名前は「関係の変化」に書いたものを使います（「いつ」に話の題名か「5話」のように書いたもの）。
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
