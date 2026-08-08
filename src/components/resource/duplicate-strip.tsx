/**
 * ============================================================
 * 原石航路 Studio
 * DuplicateStrip — 同じ名前のものをまとめる
 *
 * すでに並んでしまった重複を片付ける帯。
 * 重複が無いときは何も出ない。
 *
 * まとめると、消すほうの中身は残すほうへ引き継ぐ。
 * 名前は別名として残す。書いたものを失わないため。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import type { DuplicateGroup } from "@/lib/resource/dedupe";
import { findDuplicates, mergeInto } from "@/lib/resource/dedupe";
import type { ResourceEntry } from "@/types";

interface Props {
    entries: ResourceEntry[];
    onMerge: (group: DuplicateGroup) => void;
}

export default function DuplicateStrip({ entries, onMerge }: Props) {
    const groups = useMemo(() => findDuplicates(entries), [entries]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const shown = groups.filter((group) => !dismissed.has(group.keep.id));
    if (shown.length === 0) return null;

    const total = shown.reduce((sum, group) => sum + group.drop.length, 0);

    return (
        <div className="overflow-hidden rounded-lg border border-[var(--color-amber)] bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[var(--color-amber-tint)] px-4 py-2.5">
                <p className="text-xs font-medium text-ink">
                    同じ名前のものがあります
                    <span className="ml-1.5 text-[11px] font-normal text-muted">
                        {shown.length}組・{total}件が重複
                    </span>
                </p>

                <button
                    type="button"
                    onClick={() => {
                        for (const group of shown) onMerge(group);
                    }}
                    className="rounded-md border border-forest bg-surface px-2.5 py-1 text-[11px] text-forest hover:bg-forest-tint"
                >
                    すべてまとめる
                </button>
            </div>

            <ul className="thin-scroll max-h-64 divide-y divide-line overflow-y-auto">
                {shown.slice(0, 20).map((group) => (
                    <li
                        key={group.keep.id}
                        className="flex flex-wrap items-center gap-2 px-4 py-2.5"
                    >
                        <span className="text-[13px] font-medium text-ink">
                            {group.name}
                        </span>
                        <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] text-muted">
                            {group.drop.length + 1}件
                        </span>

                        {group.keep.summary && (
                            <span className="min-w-0 flex-1 truncate text-[11px] text-faint">
                                {group.keep.summary}
                            </span>
                        )}

                        <span className="ml-auto flex shrink-0 gap-1.5">
                            <button
                                type="button"
                                onClick={() => onMerge(group)}
                                className="rounded-md bg-forest px-3 py-1 text-[11px] text-white hover:bg-forest-dark"
                            >
                                まとめる
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setDismissed(
                                        (prev) => new Set(prev).add(group.keep.id),
                                    )
                                }
                                className="rounded-md px-2 py-1 text-[11px] text-faint hover:text-ink"
                            >
                                別もの
                            </button>
                        </span>
                    </li>
                ))}
            </ul>

            <p className="border-t border-line px-4 py-2 text-[11px] text-faint">
                中身は残すほうへ引き継ぎ、名前は別名として残します。
            </p>
        </div>
    );
}
