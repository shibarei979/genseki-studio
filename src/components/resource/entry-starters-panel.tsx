/**
 * ============================================================
 * 原石航路 Studio
 * EntryStartersPanel — 資料の入口
 *
 * まだ何も無いページに出す。
 * 押せるものがあると、手が動く。
 * ============================================================
 */

"use client";

import { startersFor } from "@/lib/resource/entry-starters";

interface Props {
    builtinKey?: string | null;
    label: string;
    description?: string;
    onCreate: (name: string) => void;
    onCreateEmpty: () => void;
}

export default function EntryStartersPanel({
    builtinKey,
    label,
    description,
    onCreate,
    onCreateEmpty,
}: Props) {
    const starters = startersFor(builtinKey);

    return (
        <div className="rounded-lg border border-line bg-surface px-5 py-6">
            <p className="text-sm font-medium text-ink">
                まだ{label}がありません
            </p>

            {description && (
                <p className="mt-1 text-xs leading-relaxed text-muted">
                    {description}
                </p>
            )}

            {/*
             * まとまりごとに分けて出す。
             *
             * 20 個をひと並びにすると、目が滑って選べない。
             * 「物語の中心」「まわりの人」と分ければ、
             * どこから手を付けるかが決めやすい。
             */}
            {starters.length > 0 && (
                <div className="mt-5 space-y-4">
                    {starters.map((group) => (
                        <div key={group.group}>
                            <p className="text-[11px] text-faint">{group.group}</p>

                            <ul className="mt-1.5 flex flex-wrap gap-2">
                                {group.items.map((name) => (
                                    <li key={name}>
                                        <button
                                            type="button"
                                            onClick={() => onCreate(name)}
                                            className="rounded-full border border-line px-3.5 py-1.5 text-xs text-ink hover:border-forest-line hover:text-forest"
                                        >
                                            ＋ {name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

            <button
                type="button"
                onClick={onCreateEmpty}
                className="mt-4 rounded-md border border-line px-4 py-2 text-xs text-muted hover:border-forest-line hover:text-forest"
            >
                名前を決めずに作る
            </button>
        </div>
    );
}
