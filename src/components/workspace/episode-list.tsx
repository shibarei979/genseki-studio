/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeList — 左の作品構造
 *
 * 章で束ね、その中に話を並べる。
 * 章を作らずに書き始められるので、章の無い話もある。
 *
 * 並べ替えは HTML5 のドラッグ＆ドロップ。
 * ライブラリを入れずに済ませ、依存を増やさない。
 *
 * 章と話でドラッグを分ける。
 * 混ぜると「章を話の中に入れる」ような操作ができてしまう。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

import EpisodeStatusMark from "@/components/workspace/episode-status-mark";
import { formatNumber } from "@/lib/utils/text";
import type { Chapter, Episode } from "@/types";
import { formatChapterLabel } from "@/types";

interface Props {
    episodes: Episode[];
    chapters: Chapter[];
    selectedId: string | null;

    onSelect: (episodeId: string) => void;
    onCreate: (chapterId?: string | null) => void;
    onDelete: (episodeId: string) => void;
    onDuplicate: (episode: Episode) => void;
    onToggleStatus: (episode: Episode) => void;
    onReorder: (orderedIds: string[]) => void;
    onMoveToChapter: (episodeId: string, chapterId: string | null) => void;

    onCreateChapter: () => void;
    onRenameChapter: (chapterId: string, title: string) => void;
    onDeleteChapter: (chapterId: string) => void;
    onReorderChapters: (orderedIds: string[]) => void;
}

export default function EpisodeList({
    episodes,
    chapters,
    selectedId,
    onSelect,
    onCreate,
    onDelete,
    onDuplicate,
    onToggleStatus,
    onReorder,
    onMoveToChapter,
    onCreateChapter,
    onRenameChapter,
    onDeleteChapter,
    onReorderChapters,
}: Props) {
    const [keyword, setKeyword] = useState("");
    const [closed, setClosed] = useState<Set<string>>(new Set());
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [editingChapter, setEditingChapter] = useState<string | null>(null);

    /* ドラッグ中のもの。章と話で分ける */
    const [dragEpisode, setDragEpisode] = useState<string | null>(null);
    const [dragChapter, setDragChapter] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);

    /* 外を押したら「…」を閉じる */
    useEffect(() => {
        if (!menuFor) return;
        const close = () => setMenuFor(null);
        window.addEventListener("click", close);
        return () => window.removeEventListener("click", close);
    }, [menuFor]);

    /** 探しているときは、当たった話だけ出す */
    const shown = keyword
        ? episodes.filter((row) => row.title.includes(keyword))
        : episodes;

    /** 章に属さない話 */
    const loose = shown.filter((row) => !row.chapter_id);

    function toggleClosed(id: string) {
        setClosed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    /**
     * 話を落とした。
     *
     * 同じ章の中なら並べ替え、違う章なら移す。
     */
    function dropEpisode(targetId: string, targetChapter: string | null) {
        if (!dragEpisode || dragEpisode === targetId) return reset();

        const moving = episodes.find((row) => row.id === dragEpisode);
        if (!moving) return reset();

        if ((moving.chapter_id ?? null) !== targetChapter) {
            onMoveToChapter(dragEpisode, targetChapter);
            return reset();
        }

        const ids = episodes.map((row) => row.id);
        const from = ids.indexOf(dragEpisode);
        const to = ids.indexOf(targetId);
        if (from === -1 || to === -1) return reset();

        ids.splice(from, 1);
        ids.splice(to, 0, dragEpisode);
        onReorder(ids);
        reset();
    }

    /** 章を落とした */
    function dropChapter(targetId: string) {
        if (!dragChapter || dragChapter === targetId) return reset();

        const ids = chapters.map((row) => row.id);
        const from = ids.indexOf(dragChapter);
        const to = ids.indexOf(targetId);
        if (from === -1 || to === -1) return reset();

        ids.splice(from, 1);
        ids.splice(to, 0, dragChapter);
        onReorderChapters(ids);
        reset();
    }

    function reset() {
        setDragEpisode(null);
        setDragChapter(null);
        setOverId(null);
    }

    return (
        <div className="flex h-full flex-col">
            {/* 探す */}
            <div className="border-b border-line px-3 py-2.5">
                <input
                    type="search"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="話を探す"
                    aria-label="話を探す"
                    className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-forest"
                />
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
                {/* 章に属さない話 */}
                {loose.length > 0 && (
                    <ul
                        className="mb-1 space-y-0.5"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropEpisode("", null)}
                    >
                        {loose.map((episode) => (
                            <EpisodeRow
                                key={episode.id}
                                episode={episode}
                                isSelected={episode.id === selectedId}
                                isOver={overId === episode.id}
                                isMenuOpen={menuFor === episode.id}
                                onSelect={() => onSelect(episode.id)}
                                onToggleStatus={() => onToggleStatus(episode)}
                                onOpenMenu={() => setMenuFor(episode.id)}
                                onDuplicate={() => onDuplicate(episode)}
                                onDelete={() => onDelete(episode.id)}
                                onDragStart={() => setDragEpisode(episode.id)}
                                onDragOver={() => setOverId(episode.id)}
                                onDrop={() => dropEpisode(episode.id, null)}
                            />
                        ))}
                    </ul>
                )}

                {/* 章ごと */}
                {chapters.map((chapter, index) => {
                    const own = shown.filter((row) => row.chapter_id === chapter.id);
                    const isClosed = closed.has(chapter.id);

                    return (
                        <div
                            key={chapter.id}
                            className="mb-1"
                            draggable={editingChapter !== chapter.id}
                            onDragStart={() => setDragChapter(chapter.id)}
                            onDragEnd={reset}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (dragChapter) setOverId(chapter.id);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (dragChapter) dropChapter(chapter.id);
                                else dropEpisode("", chapter.id);
                            }}
                            style={{
                                outline:
                                    overId === chapter.id && dragChapter
                                        ? "2px solid var(--color-forest)"
                                        : "none",
                                outlineOffset: 2,
                            }}
                        >
                            {/* 章の見出し */}
                            <div className="group flex items-center gap-1 rounded px-1.5 py-1.5 hover:bg-canvas">
                                <button
                                    type="button"
                                    onClick={() => toggleClosed(chapter.id)}
                                    aria-label={isClosed ? "開く" : "閉じる"}
                                    className="shrink-0 text-faint"
                                >
                                    <Caret isOpen={!isClosed} />
                                </button>

                                {editingChapter === chapter.id ? (
                                    <input
                                        type="text"
                                        defaultValue={chapter.title}
                                        autoFocus
                                        onBlur={(e) => {
                                            onRenameChapter(
                                                chapter.id,
                                                e.target.value.trim(),
                                            );
                                            setEditingChapter(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") e.currentTarget.blur();
                                        }}
                                        className="min-w-0 flex-1 rounded border border-forest px-1.5 py-0.5 text-xs outline-none"
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onDoubleClick={() =>
                                            setEditingChapter(chapter.id)
                                        }
                                        title="ふたつ押すと名前を変えられます"
                                        className="min-w-0 flex-1 truncate text-left text-xs font-medium text-ink"
                                    >
                                        {formatChapterLabel(chapter, index)}
                                    </button>
                                )}

                                <span className="shrink-0 text-[10px] text-faint">
                                    {own.length}
                                </span>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuFor(
                                            menuFor === chapter.id ? null : chapter.id,
                                        );
                                    }}
                                    aria-label="章の操作"
                                    className="shrink-0 px-1 text-faint opacity-0 group-hover:opacity-100"
                                >
                                    …
                                </button>
                            </div>

                            {menuFor === chapter.id && (
                                <div className="relative">
                                    <div className="absolute right-0 top-0 z-20 w-36 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
                                        <MenuItem
                                            onClick={() => {
                                                setEditingChapter(chapter.id);
                                                setMenuFor(null);
                                            }}
                                        >
                                            名前を変える
                                        </MenuItem>
                                        <MenuItem
                                            isDanger
                                            onClick={() => {
                                                onDeleteChapter(chapter.id);
                                                setMenuFor(null);
                                            }}
                                        >
                                            章を消す
                                        </MenuItem>
                                    </div>
                                </div>
                            )}

                            {!isClosed && (
                                <ul className="ml-3 space-y-0.5 border-l border-line pl-1.5">
                                    {own.length === 0 ? (
                                        <li>
                                            <button
                                                type="button"
                                                onClick={() => onCreate(chapter.id)}
                                                className="w-full rounded px-2 py-1.5 text-left text-[11px] text-faint hover:text-forest"
                                            >
                                                ＋ 話を追加
                                            </button>
                                        </li>
                                    ) : (
                                        own.map((episode) => (
                                            <EpisodeRow
                                                key={episode.id}
                                                episode={episode}
                                                isSelected={episode.id === selectedId}
                                                isOver={overId === episode.id}
                                                isMenuOpen={menuFor === episode.id}
                                                                onSelect={() => onSelect(episode.id)}
                                                onToggleStatus={() =>
                                                    onToggleStatus(episode)
                                                }
                                                onOpenMenu={() => setMenuFor(episode.id)}
                                                onDuplicate={() => onDuplicate(episode)}
                                                onDelete={() => onDelete(episode.id)}
                                                onDragStart={() =>
                                                    setDragEpisode(episode.id)
                                                }
                                                onDragOver={() => setOverId(episode.id)}
                                                onDrop={() =>
                                                    dropEpisode(episode.id, chapter.id)
                                                }
                                            />
                                        ))
                                    )}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 足す */}
            <div className="flex gap-1.5 border-t border-line px-2.5 py-2.5">
                <button
                    type="button"
                    onClick={() => onCreate(null)}
                    className="flex-1 rounded-md bg-forest py-2 text-xs text-white hover:bg-forest-dark"
                >
                    ＋ 話
                </button>
                <button
                    type="button"
                    onClick={onCreateChapter}
                    className="flex-1 rounded-md border border-line py-2 text-xs text-muted hover:border-forest-line hover:text-forest"
                >
                    ＋ 章
                </button>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 話ひとつぶん
 * ============================================================
 */

function EpisodeRow({
    episode,
    isSelected,
    isOver,
    isMenuOpen,
    onSelect,
    onToggleStatus,
    onOpenMenu,
    onDuplicate,
    onDelete,
    onDragStart,
    onDragOver,
    onDrop,
}: {
    episode: Episode;
    isSelected: boolean;
    isOver: boolean;
    isMenuOpen: boolean;
    onSelect: () => void;
    onToggleStatus: () => void;
    onOpenMenu: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onDragStart: () => void;
    onDragOver: () => void;
    onDrop: () => void;
}) {
    return (
        <li
            draggable
            onDragStart={(e) => {
                e.stopPropagation();
                onDragStart();
            }}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDragOver();
            }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDrop();
            }}
            className="relative"
            style={{
                borderTop: isOver ? "2px solid var(--color-forest)" : "2px solid transparent",
            }}
        >
            <div
                className={[
                    "group flex items-center gap-2 rounded px-2 py-1.5",
                    isSelected ? "bg-forest-tint" : "hover:bg-canvas",
                ].join(" ")}
            >
                <EpisodeStatusMark
                    status={episode.status}
                    onToggle={onToggleStatus}
                />

                <button
                    type="button"
                    onClick={onSelect}
                    className="min-w-0 flex-1 text-left"
                >
                    <span
                        className={[
                            "block truncate text-xs",
                            isSelected ? "font-medium text-forest" : "text-ink",
                        ].join(" ")}
                    >
                        {episode.title || `第${episode.ep_number}話`}
                    </span>
                </button>

                {/*
                 * 話ごとの公開。
                 * 一覧で見えないと、どれが出ているのか分からない。
                 */}
                {episode.is_published ? (
                    <span className="shrink-0 rounded bg-forest-tint px-1.5 py-0.5 text-[9px] text-forest">
                        公開
                    </span>
                ) : episode.publish_at ? (
                    <span
                        className="shrink-0 rounded bg-[var(--color-amber-tint)] px-1.5 py-0.5 text-[9px] text-[var(--color-amber)]"
                        title={`${formatWhen(episode.publish_at)}に公開`}
                    >
                        予約
                    </span>
                ) : null}

                <span className="shrink-0 text-[10px] text-faint">
                    {episode.char_count > 0
                        ? `${formatNumber(episode.char_count)}字`
                        : "—"}
                </span>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenMenu();
                    }}
                    aria-label="話の操作"
                    className="shrink-0 px-0.5 text-faint opacity-0 group-hover:opacity-100"
                >
                    …
                </button>
            </div>

            {/*
             * 章の移動はここに出さない。
             * ドラッグでできるので、並べると迷いが増える。
             */}
            {isMenuOpen && (
                <div className="absolute right-1 top-full z-20 w-32 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
                    <MenuItem onClick={onDuplicate}>複製する</MenuItem>
                    <MenuItem isDanger onClick={onDelete}>
                        削除する
                    </MenuItem>
                </div>
            )}
        </li>
    );
}

/**
 * ============================================================
 * 小さな部品
 * ============================================================
 */

function MenuItem({
    children,
    onClick,
    isDanger = false,
}: {
    children: React.ReactNode;
    onClick: () => void;
    isDanger?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={[
                "block w-full border-t border-line px-3 py-2 text-left text-[11px] first:border-t-0",
                isDanger
                    ? "text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                    : "text-ink hover:bg-canvas",
            ].join(" ")}
        >
            {children}
        </button>
    );
}

function Caret({ isOpen }: { isOpen: boolean }) {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{
                transform: isOpen ? "rotate(90deg)" : "none",
                transition: "transform 0.15s",
            }}
        >
            <path d="m9 5 7 7-7 7" />
        </svg>
    );
}

/** 「8月20日 20:00」の形にする */
function formatWhen(iso: string | null | undefined): string {
    if (!iso) return "";
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${at.getMonth() + 1}月${at.getDate()}日 ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
