/**
 * ============================================================
 * 原石航路 Studio
 * NotesView — メモ
 *
 * メモは「思いついた瞬間に置く」もの。
 * 一覧を開いて、追加を押して、欄を埋めて……では間に合わない。
 * だから上端に一行の入力欄を常に出しておく。
 *
 * 種類は色で分ける。数が増えたときに、
 * 探しているのが台詞なのか伏線なのかを目で拾えるようにするため。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import DeleteButton from "@/components/common/delete-button";
import ResourceIcon from "@/components/resource/resource-icons";
import type { Episode, ResourceEntry, ResourcePage } from "@/types";
import { formatEpisodeLabel } from "@/types";

const CATEGORIES = ["次の展開", "伏線", "台詞", "調査", "自由メモ"] as const;

/** 種類ごとの色。付箋の色分けと同じ役割 */
const CATEGORY_STYLE: Record<string, { card: string; chip: string }> = {
    次の展開: { card: "border-l-[#c99a2e] bg-[#fdf8ec]", chip: "text-[#a97c1a]" },
    伏線: { card: "border-l-[#4a8c62] bg-[#f0f7f2]", chip: "text-[#3d7553]" },
    台詞: { card: "border-l-[#6b7fbf] bg-[#f1f3fa]", chip: "text-[#5566a6]" },
    調査: { card: "border-l-[#7d8a95] bg-[#f3f5f6]", chip: "text-[#67737d]" },
    自由メモ: { card: "border-l-[#c98a5e] bg-[#fdf4ee]", chip: "text-[#a86f47]" },
};

const DEFAULT_STYLE = { card: "border-l-line bg-surface", chip: "text-muted" };

interface Props {
    page: ResourcePage;
    entries: ResourceEntry[];
    episodes: Episode[];
    onCreate: (name: string, category: string) => void;
    onUpdate: (entryId: string, patch: Partial<ResourceEntry>) => void;
    onDelete: (entry: ResourceEntry) => void;
}

export default function NotesView({
    page,
    entries,
    episodes,
    onCreate,
    onUpdate,
    onDelete,
}: Props) {
    const [draft, setDraft] = useState("");
    const [draftCategory, setDraftCategory] = useState<string>("自由メモ");
    const [filter, setFilter] = useState("all");
    const [pinnedOnly, setPinnedOnly] = useState(false);
    const [mode, setMode] = useState<"cards" | "list">("cards");
    const [editingId, setEditingId] = useState<string | null>(null);

    const notes = entries.filter((entry) => entry.candidate_status === "none");
    const episodeById = useMemo(
        () => new Map(episodes.map((episode) => [episode.id, episode])),
        [episodes],
    );

    const counts = useMemo(() => {
        const map = new Map<string, number>();
        for (const note of notes) {
            const category = String(note.values.category ?? "自由メモ");
            map.set(category, (map.get(category) ?? 0) + 1);
        }
        return map;
    }, [notes]);

    const shown = notes.filter((note) => {
        if (pinnedOnly && !note.is_major) return false;
        if (filter === "all") return true;
        return String(note.values.category ?? "自由メモ") === filter;
    });

    // ピン留めは上、それ以外は新しい順
    const pinned = shown.filter((note) => note.is_major);
    const rest = shown
        .filter((note) => !note.is_major)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    function handleQuickAdd() {
        const text = draft.trim();
        if (!text) return;
        onCreate(text, draftCategory);
        setDraft("");
    }

    return (
        <div className="space-y-4">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-xl font-medium text-ink">
                        <span className="text-forest">
                            <ResourceIcon builtinKey="memo" size={22} />
                        </span>
                        {page.label}
                    </h1>
                    <p className="mt-1 text-sm text-muted">
                        思いつきや考えを自由に残す場所です。小さなひらめきが、物語の種になります。
                    </p>
                </div>
            </header>

            {/* すぐ書ける入力欄 */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
                <span className="text-forest">
                    <ResourceIcon builtinKey="memo" size={16} />
                </span>
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            handleQuickAdd();
                        }
                    }}
                    placeholder="ひらめきや気づきをすぐメモ…（例：セリフ案、設定、疑問など）"
                    aria-label="メモを書く"
                    className="min-w-[200px] flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
                />
                <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                    aria-label="メモの種類"
                    className="rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-forest"
                >
                    {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                            {category}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={handleQuickAdd}
                    disabled={draft.trim().length === 0}
                    className="rounded-md bg-forest px-4 py-1.5 text-sm text-white hover:bg-forest-dark disabled:opacity-40"
                >
                    追加
                </button>
            </div>

            {/* 絞り込み */}
            <div className="flex flex-wrap items-center gap-1.5">
                <Chip
                    label="すべて"
                    count={notes.length}
                    isActive={filter === "all"}
                    onClick={() => setFilter("all")}
                />
                {CATEGORIES.map((category) => (
                    <Chip
                        key={category}
                        label={category}
                        count={counts.get(category) ?? 0}
                        isActive={filter === category}
                        onClick={() => setFilter(category)}
                    />
                ))}

                <button
                    type="button"
                    onClick={() => setPinnedOnly((on) => !on)}
                    aria-pressed={pinnedOnly}
                    className={[
                        "rounded-full border px-3 py-1 text-xs",
                        pinnedOnly
                            ? "border-forest bg-forest-tint text-forest"
                            : "border-line text-muted hover:bg-canvas",
                    ].join(" ")}
                >
                    ピン留めのみ
                </button>

                <div className="ml-auto flex gap-0.5 rounded-md border border-line p-0.5">
                    {(["cards", "list"] as const).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setMode(key)}
                            aria-pressed={mode === key}
                            className={[
                                "rounded px-2.5 py-1 text-xs",
                                mode === key ? "bg-forest text-white" : "text-muted hover:text-ink",
                            ].join(" ")}
                        >
                            {key === "cards" ? "カード表示" : "一覧表示"}
                        </button>
                    ))}
                </div>
            </div>

            {shown.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line py-20 text-center text-sm text-faint">
                    まだメモがありません。上の欄に思いついたことを書いてみてください。
                </p>
            ) : (
                <>
                    {pinned.length > 0 && !pinnedOnly && (
                        <section>
                            <h2 className="text-sm text-muted">
                                ピン留め（{pinned.length}件）
                            </h2>
                            <NoteGrid
                                notes={pinned}
                                mode={mode}
                                episodeById={episodeById}
                                editingId={editingId}
                                onEdit={setEditingId}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                            />
                        </section>
                    )}

                    <section>
                        {pinned.length > 0 && !pinnedOnly && (
                            <h2 className="text-sm text-muted">最近追加したメモ</h2>
                        )}
                        <NoteGrid
                            notes={pinnedOnly ? shown : rest}
                            mode={mode}
                            episodeById={episodeById}
                            editingId={editingId}
                            onEdit={setEditingId}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                        />
                    </section>
                </>
            )}
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

function NoteGrid({
    notes,
    mode,
    episodeById,
    editingId,
    onEdit,
    onUpdate,
    onDelete,
}: {
    notes: ResourceEntry[];
    mode: "cards" | "list";
    episodeById: Map<string, Episode>;
    editingId: string | null;
    onEdit: (id: string | null) => void;
    onUpdate: (entryId: string, patch: Partial<ResourceEntry>) => void;
    onDelete: (entry: ResourceEntry) => void;
}) {
    return (
        <ul
            className={[
                "mt-2 gap-3",
                mode === "cards" ? "grid sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col",
            ].join(" ")}
        >
            {notes.map((note) => {
                const category = String(note.values.category ?? "自由メモ");
                const style = CATEGORY_STYLE[category] ?? DEFAULT_STYLE;
                const episodeIds = Array.isArray(note.values.episodes)
                    ? note.values.episodes
                    : [];
                const isEditing = editingId === note.id;

                return (
                    <li
                        key={note.id}
                        className={`group rounded-lg border border-y-line border-r-line border-l-4 p-3 ${style.card}`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <span className={`text-[11px] ${style.chip}`}>{category}</span>
                            <div className="flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => onUpdate(note.id, { is_major: !note.is_major })}
                                    aria-pressed={note.is_major}
                                    aria-label="ピン留め"
                                    className={[
                                        "px-1 text-xs",
                                        note.is_major
                                            ? "text-forest"
                                            : "text-faint opacity-0 group-hover:opacity-100",
                                    ].join(" ")}
                                >
                                    ピン
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onEdit(isEditing ? null : note.id)}
                                    className="px-1 text-xs text-faint opacity-0 hover:text-ink group-hover:opacity-100"
                                >
                                    {isEditing ? "閉じる" : "編集"}
                                </button>
                                <DeleteButton
                                    label={note.name || "このメモ"}
                                    onDelete={() => onDelete(note)}
                                    isFloating
                                    size="small"
                                />
                            </div>
                        </div>

                        {isEditing ? (
                            <div className="mt-2 space-y-2">
                                <input
                                    type="text"
                                    defaultValue={note.name}
                                    onBlur={(e) => onUpdate(note.id, { name: e.target.value })}
                                    aria-label="見出し"
                                    className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-forest"
                                />
                                <textarea
                                    defaultValue={String(note.values.detail ?? "")}
                                    onBlur={(e) =>
                                        onUpdate(note.id, {
                                            values: { ...note.values, detail: e.target.value },
                                        })
                                    }
                                    rows={4}
                                    aria-label="内容"
                                    className="w-full resize-y rounded-md border border-line bg-surface px-2 py-1 text-xs leading-relaxed outline-none focus:border-forest"
                                />
                                <select
                                    defaultValue={category}
                                    onChange={(e) =>
                                        onUpdate(note.id, {
                                            values: { ...note.values, category: e.target.value },
                                        })
                                    }
                                    aria-label="種類"
                                    className="rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-forest"
                                >
                                    {CATEGORIES.map((row) => (
                                        <option key={row} value={row}>
                                            {row}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <>
                                <p className="mt-1 text-sm font-medium text-ink">
                                    {note.name || "（見出しなし）"}
                                </p>
                                {(note.summary || note.values.detail) && (
                                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted">
                                        {String(note.values.detail ?? note.summary)}
                                    </p>
                                )}
                            </>
                        )}

                        {episodeIds.length > 0 && (
                            <p className="mt-2 truncate text-[11px] text-faint">
                                リンク：
                                {episodeIds
                                    .map((id) => {
                                        const episode = episodeById.get(String(id));
                                        return episode ? formatEpisodeLabel(episode) : null;
                                    })
                                    .filter(Boolean)
                                    .join("・")}
                            </p>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

function Chip({
    label,
    count,
    isActive,
    onClick,
}: {
    label: string;
    count: number;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isActive}
            className={[
                "rounded-full border px-3 py-1 text-xs",
                isActive
                    ? "border-forest bg-forest-tint text-forest"
                    : "border-line text-muted hover:bg-canvas",
            ].join(" ")}
        >
            {label}
            {count > 0 && <span className="ml-1.5 text-faint">{count}</span>}
        </button>
    );
}
