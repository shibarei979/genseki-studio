/**
 * ============================================================
 * 原石航路 Studio
 * MergePanel — 表記ゆれの統合
 *
 * 機械が勝手にまとめることはしない。並べて選ばせるだけ。
 * 別人の同名を勝手に統合されたら取り返しがつかない。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import { findDuplicateGroups } from "@/lib/resource/name-match";
import type { ResourceEntry } from "@/types";

interface Props {
    entries: ResourceEntry[];
    onMerge: (keepId: string, mergeId: string) => Promise<void>;
}

export default function MergePanel({ entries, onMerge }: Props) {
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [busyId, setBusyId] = useState<string | null>(null);

    const groups = useMemo(
        () =>
            findDuplicateGroups(
                entries
                    .filter((entry) => entry.candidate_status === "none" && entry.name)
                    .map((entry) => ({
                        id: entry.id,
                        name: entry.name,
                        aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
                        page_id: entry.page_id,
                    })),
            ),
        [entries],
    );

    const shown = groups.filter((group) => !dismissed.has(group.keep.id));
    if (shown.length === 0) return null;

    return (
        <div className="border-b border-line bg-[var(--color-amber-tint)] px-6 py-4">
            <p className="text-sm text-ink">
                同じものかもしれない項目が{shown.length}組あります
            </p>
            <p className="mt-1 text-xs text-muted">
                まとめると、消えるほうの名前は別名として残り、関係と本文リンクも引き継がれます。
            </p>

            <ul className="mt-3 space-y-2">
                {shown.map((group) => (
                    <li
                        key={group.keep.id}
                        className="rounded-md border border-line bg-surface px-3 py-2.5"
                    >
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="rounded bg-forest-tint px-2 py-0.5 text-xs text-forest">
                                残す
                            </span>
                            <span className="text-ink">{group.keep.name}</span>
                        </div>

                        <ul className="mt-2 space-y-1.5">
                            {group.others.map((other) => (
                                <li
                                    key={other.entry.id}
                                    className="flex flex-wrap items-center gap-2 text-sm"
                                >
                                    <span className="text-muted">{other.entry.name}</span>
                                    <span className="text-xs text-faint">
                                        一致度 {Math.round(other.score * 100)}%
                                    </span>
                                    <button
                                        type="button"
                                        disabled={busyId === other.entry.id}
                                        onClick={async () => {
                                            setBusyId(other.entry.id);
                                            await onMerge(group.keep.id, other.entry.id);
                                            setBusyId(null);
                                        }}
                                        className="rounded-md border border-forest-line px-2.5 py-1 text-xs text-forest hover:bg-forest-tint disabled:opacity-40"
                                    >
                                        「{group.keep.name}」にまとめる
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <button
                            type="button"
                            onClick={() =>
                                setDismissed((current) => new Set(current).add(group.keep.id))
                            }
                            className="mt-2 text-xs text-faint hover:text-ink"
                        >
                            別のものなので、まとめない
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
