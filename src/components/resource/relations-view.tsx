/**
 * ============================================================
 * 原石航路 Studio
 * RelationsView — 関係図
 *
 * 人物同士に限らない。人物と組織、人物と場所、人物と出来事も結べる。
 * 恋愛の「すれ違い」も、ミステリーの「容疑者」も同じ形で持てる。
 *
 * 関係は 1 つのラベルで固定しない。
 * 「初対面 → 警戒 → 信頼 → 決別」を 1 語で表すことはできないので、
 * 話数に沿った変化を下段の帯に並べる。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import DeleteButton from "@/components/common/delete-button";
import { pairKey, suggestRelations } from "@/lib/resource/relation-suggest";
import RelationGraph from "@/components/resource/relation-graph";
import ResourceIcon from "@/components/resource/resource-icons";
import type { Episode, ResourceEntry, ResourcePage, ResourceRelation } from "@/types";

const PRESETS = ["家族", "友人", "恋人", "師弟", "所属", "対立", "協力", "容疑者", "片想い"];

interface Props {
    relations: ResourceRelation[];
    entries: ResourceEntry[];
    pages: ResourcePage[];
    episodes: Episode[];
    onCreate: (fromId: string, toId: string, label: string) => void;
    onUpdate: (relationId: string, patch: Partial<ResourceRelation>) => void;
    onDelete: (relation: ResourceRelation) => void;
    onUpdatePage: (patch: Partial<ResourcePage>) => void;
}

export default function RelationsView({
    relations,
    entries,
    pages,
    episodes,
    onCreate,
    onUpdate,
    onDelete,
    onUpdatePage,
}: Props) {
    const [mode, setMode] = useState<"graph" | "list">("graph");
    const [focusId, setFocusId] = useState<string | null>(null);
    const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    /*
     * 同じ段落に何度も並ぶ組を探す。
     * 何の関係かは決めない。そこは書き手が決める。
     */
    const suggestions = useMemo(() => {
        const existing = new Set(
            relations.map((row) => pairKey(row.from_entry_id, row.to_entry_id)),
        );
        for (const key of Array.from(dismissed)) existing.add(key);

        return suggestRelations(
            episodes.map((episode) => episode.body),
            entries.filter((entry) => entry.candidate_status === "none"),
            existing,
            episodes.map((episode) => `第${episode.ep_number}話`),
        );
    }, [relations, entries, episodes, dismissed]);
    const [fromId, setFromId] = useState("");
    const [toId, setToId] = useState("");
    const [label, setLabel] = useState("");

    const entryById = new Map(entries.map((entry) => [entry.id, entry]));
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const canCreate = fromId && toId && fromId !== toId && label.trim();

    const selected = relations.find((relation) => relation.id === selectedRelationId) ?? null;
    const from = selected ? entryById.get(selected.from_entry_id) : null;
    const to = selected ? entryById.get(selected.to_entry_id) : null;

    return (
        <div className="space-y-4">
            <header>
                <h1 className="flex items-center gap-2 text-xl font-medium text-ink">
                    <span className="text-forest">
                        <ResourceIcon builtinKey="relation" size={22} />
                    </span>
                    関係図
                </h1>
                <p className="mt-1 text-sm text-muted">
                    人物・場所・組織・出来事のつながりを見える形にします。関係は後から変えられます。
                </p>
            </header>

            {entries.length < 2 ? (
                <div className="rounded-lg border border-dashed border-line py-20 text-center">
                    <p className="text-sm text-ink">関係を結ぶには、資料の項目が2つ以上必要です。</p>
                    <p className="mt-1 text-sm text-muted">
                        人物や場所を登録してから戻ってきてください。
                    </p>
                </div>
            ) : (
                <>
                    {/* 関係を追加 */}
                    <div className="rounded-lg border border-line bg-surface px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted">関係を追加</span>
                            <EntrySelect
                                value={fromId}
                                onChange={setFromId}
                                entries={entries}
                                label="出発点を選ぶ"
                            />
                            <span className="text-sm text-faint">→</span>
                            <EntrySelect
                                value={toId}
                                onChange={setToId}
                                entries={entries.filter((entry) => entry.id !== fromId)}
                                label="到達点を選ぶ"
                            />
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="関係ラベルを入力"
                                aria-label="関係の名前"
                                className="w-36 rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-forest"
                            />
                            <button
                                type="button"
                                disabled={!canCreate}
                                onClick={() => {
                                    onCreate(fromId, toId, label.trim());
                                    setLabel("");
                                }}
                                className="rounded-md bg-forest px-4 py-1.5 text-sm text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                結ぶ
                            </button>

                            <div className="ml-auto flex gap-0.5 rounded-md border border-line p-0.5">
                                {(["graph", "list"] as const).map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setMode(key)}
                                        aria-pressed={mode === key}
                                        className={[
                                            "rounded px-3 py-1 text-xs",
                                            mode === key
                                                ? "bg-forest text-white"
                                                : "text-muted hover:text-ink",
                                        ].join(" ")}
                                    >
                                        {key === "graph" ? "図" : "一覧"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <ul className="mt-2 flex flex-wrap gap-1.5">
                            {PRESETS.map((preset) => (
                                <li key={preset}>
                                    <button
                                        type="button"
                                        onClick={() => setLabel(preset)}
                                        className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        {preset}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-lg border border-line bg-surface p-4">
                            {mode === "graph" ? (
                                <RelationGraph
                                    entries={entries}
                                    relations={relations}
                                    selectedId={focusId}
                                    onSelect={(id) => {
                                        setFocusId(id);
                                        // 選んだ項目に繋がる関係を右に出す
                                        const hit = relations.find(
                                            (relation) =>
                                                relation.from_entry_id === id ||
                                                relation.to_entry_id === id,
                                        );
                                        setSelectedRelationId(hit?.id ?? null);
                                    }}
                                />
                            ) : relations.length === 0 ? (
                                <p className="py-16 text-center text-sm text-faint">
                                    まだ関係が登録されていません。
                                </p>
                            ) : (
                                <ul className="divide-y divide-line">
                                    {relations.map((relation) => {
                                        const left = entryById.get(relation.from_entry_id);
                                        const right = entryById.get(relation.to_entry_id);
                                        return (
                                            <li
                                                key={relation.id}
                                                className={[
                                                    "flex items-center gap-2 px-2 py-2",
                                                    relation.id === selectedRelationId
                                                        ? "bg-forest-tint"
                                                        : "hover:bg-canvas",
                                                ].join(" ")}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedRelationId(relation.id)
                                                    }
                                                    className="min-w-0 flex-1 truncate text-left text-sm text-ink"
                                                >
                                                    {left?.name ?? "?"}
                                                </button>

                                                {/*
                                                 * 呼び名はここで直せる。
                                                 * 選び直してから編集欄を探すのでは、
                                                 * 一つ直すのに手数がかかりすぎる。
                                                 */}
                                                <input
                                                    type="text"
                                                    defaultValue={relation.label}
                                                    placeholder="関係"
                                                    aria-label={`${left?.name ?? ""}と${right?.name ?? ""}の関係`}
                                                    onBlur={(e) => {
                                                        const next = e.target.value.trim();
                                                        if (next !== relation.label) {
                                                            onUpdate(relation.id, {
                                                                label: next,
                                                            });
                                                        }
                                                    }}
                                                    className="w-24 shrink-0 rounded border border-transparent bg-forest-tint px-2 py-0.5 text-center text-xs text-forest outline-none hover:border-forest-line focus:border-forest focus:bg-surface"
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedRelationId(relation.id)
                                                    }
                                                    className="min-w-0 flex-1 truncate text-right text-sm text-ink"
                                                >
                                                    {right?.name ?? "?"}
                                                </button>

                                                {relation.changes.length > 0 && (
                                                    <span className="shrink-0 text-[10px] text-faint">
                                                        変化{relation.changes.length}
                                                    </span>
                                                )}

                                                <DeleteButton
                                                    label={`${left?.name ?? "?"} — ${right?.name ?? "?"}`}
                                                    onDelete={() => onDelete(relation)}
                                                    size="small"
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* 選んだ関係 */}
                        <div className="rounded-lg border border-line bg-surface p-4">
                            {!selected || !from || !to ? (
                                <p className="py-16 text-center text-xs text-faint">
                                    図や一覧から関係を選ぶと、ここに詳しく出ます。
                                </p>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="min-w-0 truncate text-sm font-medium text-ink">
                                            {from.name} ↔ {to.name}
                                        </h2>
                                        <DeleteButton
                                            label={`${from.name} ↔ ${to.name}`}
                                            onDelete={() => {
                                                onDelete(selected);
                                                setSelectedRelationId(null);
                                            }}
                                            size="small"
                                        />
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-faint">
                                        {pageById.get(from.page_id)?.label} ／{" "}
                                        {pageById.get(to.page_id)?.label}
                                    </p>

                                    <div className="mt-3">
                                        <p className="text-xs text-muted">現在の関係</p>
                                        <input
                                            type="text"
                                            defaultValue={selected.label}
                                            onBlur={(e) =>
                                                onUpdate(selected.id, { label: e.target.value })
                                            }
                                            aria-label="関係の名前"
                                            className="mt-1 w-full rounded-md border border-line bg-forest-tint px-2 py-1.5 text-sm text-forest outline-none focus:border-forest"
                                        />
                                    </div>

                                    <div className="mt-3">
                                        <p className="text-xs text-muted">メモ</p>
                                        <textarea
                                            defaultValue={selected.note}
                                            onBlur={(e) =>
                                                onUpdate(selected.id, { note: e.target.value })
                                            }
                                            rows={4}
                                            placeholder="どんな関係か、どう変わってきたか"
                                            aria-label="関係のメモ"
                                            className="mt-1 w-full resize-y rounded-md border border-line px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-forest"
                                        />
                                    </div>

                                    <ChangeEditor
                                        relation={selected}
                                        onUpdate={(patch) => onUpdate(selected.id, patch)}
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* 関係の履歴 */}
                    {selected && selected.changes.length > 0 && (
                        <div className="rounded-lg border border-line bg-surface px-5 py-4">
                            <p className="text-sm text-ink">関係の履歴</p>
                            <ol className="mt-3 flex flex-wrap items-center gap-2">
                                {selected.changes.map((change, index) => (
                                    <li key={index} className="flex items-center gap-2">
                                        <span className="rounded-full border border-forest-line bg-forest-tint px-3 py-1 text-xs text-forest">
                                            {change.label}
                                        </span>
                                        <span className="text-[10px] text-faint">
                                            {change.at || "—"}
                                        </span>
                                        {index < selected.changes.length - 1 && (
                                            <span className="text-faint">→</span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ChangeEditor({
    relation,
    onUpdate,
}: {
    relation: ResourceRelation;
    onUpdate: (patch: Partial<ResourceRelation>) => void;
}) {
    const [at, setAt] = useState("");
    const [label, setLabel] = useState("");

    function add() {
        if (!label.trim()) return;
        onUpdate({
            changes: [...relation.changes, { at: at.trim(), label: label.trim() }],
        });
        setAt("");
        setLabel("");
    }

    return (
        <div className="mt-3 border-t border-line pt-3">
            <p className="text-xs text-muted">関係の変化</p>
            <p className="mt-0.5 text-[10px] text-faint">
                1つのラベルで固定せず、話が進むにつれての変化を残せます。
            </p>

            {relation.changes.length > 0 && (
                <ol className="mt-2 space-y-1">
                    {relation.changes.map((change, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs">
                            <span className="text-forest">{change.at || "—"}</span>
                            <span className="min-w-0 flex-1 truncate text-ink">
                                {change.label}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    onUpdate({
                                        changes: relation.changes.filter((_, i) => i !== index),
                                    })
                                }
                                aria-label="この変化を削除"
                                className="text-faint hover:text-ink"
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ol>
            )}

            <div className="mt-2 flex gap-1.5">
                <input
                    type="text"
                    value={at}
                    onChange={(e) => setAt(e.target.value)}
                    placeholder="第5話"
                    aria-label="いつ"
                    className="w-20 rounded border border-line px-2 py-1 text-[11px] outline-none focus:border-forest"
                />
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder="すれ違い、和解 …"
                    aria-label="関係の変化"
                    className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-[11px] outline-none focus:border-forest"
                />
                <button
                    type="button"
                    onClick={add}
                    disabled={!label.trim()}
                    className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-forest-line hover:text-forest disabled:opacity-40"
                >
                    足す
                </button>
            </div>
        </div>
    );
}

function EntrySelect({
    value,
    onChange,
    entries,
    label,
}: {
    value: string;
    onChange: (value: string) => void;
    entries: ResourceEntry[];
    label: string;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-forest"
        >
            <option value="">{label}</option>
            {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                    {entry.name || "（名前未設定）"}
                </option>
            ))}
        </select>
    );
}
