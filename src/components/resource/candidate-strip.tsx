/**
 * ============================================================
 * 原石航路 Studio
 * CandidateStrip — 本文から拾った候補
 *
 * 1 件につき、拾えたことを全部まとめて出す。
 * 名前だけ見せて承認させると、書き手はそのあと
 * 空の入力欄を一つずつ埋めることになり、拾った意味が薄い。
 *
 * 承認・訂正・拒否の 3 つ。
 * 拒否したものを覚えておかないと、読み直すたびに戻ってくる。
 * ============================================================
 */

"use client";

import { useState } from "react";

import type { ResourceEntry, ResourceField } from "@/types";

interface Props {
    candidates: ResourceEntry[];
    /** そのページの入力欄。拾えた値を見出しつきで出すために使う */
    fields?: ResourceField[];
    onApprove: (
        entry: ResourceEntry,
        name: string,
        summary: string,
        values?: Record<string, string>,
    ) => void;
    onReject: (entry: ResourceEntry) => void;
    /** まとめて承認・拒否。1 件ずつ押させると数が多いとき手が持たない */
    onApproveAll?: (entries: ResourceEntry[]) => void;
    onRejectAll?: (entries: ResourceEntry[]) => void;
}

export default function CandidateStrip({
    candidates,
    fields = [],
    onApprove,
    onReject,
    onApproveAll,
    onRejectAll,
}: Props) {
    const [editingId, setEditingId] = useState<string | null>(null);
    /*
     * 拒否のときだけ確かめる。
     * 承認は間違えてもあとから消せるが、拒否は次に読み直しても戻らない。
     */
    const [isConfirmingReject, setIsConfirmingReject] = useState(false);

    if (candidates.length === 0) return null;

    return (
        <div>
            <div className="border-b border-line bg-[var(--color-amber-tint)] px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-ink">
                        本文から拾った候補
                        <span className="ml-1.5 text-[11px] font-normal text-muted">
                            {candidates.length}件
                        </span>
                    </p>

                    {(onApproveAll || onRejectAll) && !isConfirmingReject && (
                        <span className="flex gap-1.5">
                            {onApproveAll && (
                                <button
                                    type="button"
                                    onClick={() => onApproveAll(candidates)}
                                    className="rounded-md border border-forest bg-surface px-2.5 py-1 text-[11px] text-forest hover:bg-forest-tint"
                                >
                                    すべて承認（{candidates.length}件）
                                </button>
                            )}
                            {onRejectAll && (
                                <button
                                    type="button"
                                    onClick={() => setIsConfirmingReject(true)}
                                    className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] text-muted hover:text-ink"
                                >
                                    すべて拒否
                                </button>
                            )}
                        </span>
                    )}
                </div>

                {isConfirmingReject && (
                    <div className="mt-2 rounded-md border border-[var(--color-danger)] bg-surface px-3 py-2">
                        <p className="text-[11px] text-ink">
                            {candidates.length}件をまとめて拒否します。
                            次に読み直しても戻ってきません。
                        </p>
                        <div className="mt-1.5 flex justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={() => setIsConfirmingReject(false)}
                                className="rounded px-2.5 py-1 text-[11px] text-faint hover:text-ink"
                            >
                                やめる
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onRejectAll?.(candidates);
                                    setIsConfirmingReject(false);
                                }}
                                className="rounded bg-[var(--color-danger)] px-3 py-1 text-[11px] text-white"
                            >
                                拒否する
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <ul className="thin-scroll max-h-[420px] divide-y divide-line overflow-y-auto">
                {candidates.map((entry) => (
                    <li key={entry.id} className="px-4 py-3">
                        {editingId === entry.id ? (
                            <CandidateEditor
                                entry={entry}
                                fields={fields}
                                onSave={(name, summary, values) => {
                                    onApprove(entry, name, summary, values);
                                    setEditingId(null);
                                }}
                                onCancel={() => setEditingId(null)}
                            />
                        ) : (
                            <CandidateCard
                                entry={entry}
                                fields={fields}
                                onApprove={() =>
                                    onApprove(entry, entry.name, entry.summary)
                                }
                                onEdit={() => setEditingId(entry.id)}
                                onReject={() => onReject(entry)}
                            />
                        )}
                    </li>
                ))}
            </ul>

            <p className="border-t border-line px-4 py-2 text-[11px] text-faint">
                本文に書かれていることだけを拾っています。違うものは拒否してください。
            </p>
        </div>
    );
}

/**
 * ============================================================
 * 1 件ぶん
 * ============================================================
 */

function CandidateCard({
    entry,
    fields,
    onApprove,
    onEdit,
    onReject,
}: {
    entry: ResourceEntry;
    fields: ResourceField[];
    onApprove: () => void;
    onEdit: () => void;
    onReject: () => void;
}) {
    const filled = filledFields(entry, fields);

    return (
        <div>
            <div className="flex flex-wrap items-start gap-2">
                <p className="text-sm font-semibold text-ink">{entry.name}</p>
                {filled.length > 0 && (
                    <span className="mt-0.5 rounded-full bg-forest-tint px-2 py-0.5 text-[10px] text-forest">
                        {filled.length + 1}項目
                    </span>
                )}

                <span className="ml-auto flex shrink-0 gap-1.5">
                    <button
                        type="button"
                        onClick={onApprove}
                        className="rounded-md bg-forest px-3 py-1 text-[11px] text-white hover:bg-forest-dark"
                    >
                        承認
                    </button>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="rounded-md border border-line px-3 py-1 text-[11px] text-muted hover:text-ink"
                    >
                        直す
                    </button>
                    <button
                        type="button"
                        onClick={onReject}
                        className="rounded-md px-2 py-1 text-[11px] text-faint hover:text-ink"
                    >
                        拒否
                    </button>
                </span>
            </div>

            {/* 拾えたことを全部出す */}
            {entry.summary && (
                <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-ink">
                    {entry.summary}
                </p>
            )}

            {filled.length > 0 && (
                <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {filled.map((row) => (
                        <div key={row.key} className="flex gap-2 text-[11px]">
                            <dt className="shrink-0 text-faint">{row.label}</dt>
                            <dd className="min-w-0 flex-1 truncate text-muted">
                                {row.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}

            {entry.candidate_source && (
                <div className="mt-2 border-l-2 border-line pl-2">
                    {entry.source_ref && (
                        <p className="text-[10px] text-forest">{entry.source_ref}</p>
                    )}
                    <p className="text-[11px] leading-relaxed text-faint">
                        {entry.candidate_source}
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * ============================================================
 * 直すとき
 *
 * 全部の欄をここで直せる。承認してから開き直す手間を省く。
 * ============================================================
 */

function CandidateEditor({
    entry,
    fields,
    onSave,
    onCancel,
}: {
    entry: ResourceEntry;
    fields: ResourceField[];
    onSave: (name: string, summary: string, values: Record<string, string>) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(entry.name);
    const [summary, setSummary] = useState(entry.summary);
    const [values, setValues] = useState<Record<string, string>>(
        () => ({ ...(entry.values ?? {}) }) as Record<string, string>,
    );

    const editable = fields.filter(
        (field) =>
            field.type === "text" || field.type === "textarea" || field.type === "tags",
    );

    return (
        <div className="space-y-2">
            <input
                type="text"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                aria-label="名前"
                className="w-full rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-forest"
            />

            <textarea
                value={summary}
                rows={2}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="説明"
                aria-label="説明"
                className="w-full resize-y rounded-md border border-line px-3 py-1.5 text-xs leading-relaxed outline-none focus:border-forest"
            />

            {editable.map((field) => (
                <div key={field.key}>
                    <label
                        htmlFor={`cand-${entry.id}-${field.key}`}
                        className="text-[11px] text-faint"
                    >
                        {field.label}
                    </label>
                    {field.type === "textarea" ? (
                        <textarea
                            id={`cand-${entry.id}-${field.key}`}
                            value={values[field.key] ?? ""}
                            rows={2}
                            onChange={(e) =>
                                setValues({ ...values, [field.key]: e.target.value })
                            }
                            className="mt-0.5 w-full resize-y rounded-md border border-line px-2.5 py-1.5 text-xs outline-none focus:border-forest"
                        />
                    ) : (
                        <input
                            id={`cand-${entry.id}-${field.key}`}
                            type="text"
                            value={values[field.key] ?? ""}
                            onChange={(e) =>
                                setValues({ ...values, [field.key]: e.target.value })
                            }
                            placeholder={field.placeholder}
                            className="mt-0.5 w-full rounded-md border border-line px-2.5 py-1.5 text-xs outline-none focus:border-forest"
                        />
                    )}
                </div>
            ))}

            <div className="flex justify-end gap-1.5 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md px-3 py-1 text-[11px] text-faint hover:text-ink"
                >
                    やめる
                </button>
                <button
                    type="button"
                    onClick={() => onSave(name.trim(), summary.trim(), values)}
                    disabled={name.trim().length === 0}
                    className="rounded-md bg-forest px-3 py-1 text-[11px] text-white disabled:opacity-40"
                >
                    直して承認
                </button>
            </div>
        </div>
    );
}

/** 値の入っている欄だけを、見出しつきで返す */
function filledFields(
    entry: ResourceEntry,
    fields: ResourceField[],
): { key: string; label: string; value: string }[] {
    const values = (entry.values ?? {}) as Record<string, unknown>;

    return fields
        .map((field) => {
            const raw = values[field.key];
            const value =
                typeof raw === "string"
                    ? raw
                    : Array.isArray(raw)
                      ? raw.join("、")
                      : "";
            return { key: field.key, label: field.label, value: value.trim() };
        })
        .filter((row) => row.value.length > 0);
}
