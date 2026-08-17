/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeList — 左サイドバーの話一覧
 *
 * 章ごとに束ねて並べる。
 *
 *   第一章　出会い          ← 見出し。名前を直せる・消せる
 *     第1話 はじまり
 *     第2話 出会い
 *   章に入れていない
 *     第3話
 *
 * 話は章の見出しへドラッグして入れられる。
 * 話どうしをドラッグすれば、今までどおり並びが変わる。
 *
 * 並び替えは HTML5 のドラッグ＆ドロップを使う。
 * ライブラリを入れずに済ませ、依存を増やさないため。
 * ============================================================
 */

"use client";

import { useState } from "react";

import DeleteButton from "@/components/common/delete-button";
import EpisodeStatusMark from "@/components/workspace/episode-status-mark";
import { formatNumber } from "@/lib/utils/text";
import type { Chapter, Episode } from "@/types";
import { formatChapterLabel, formatEpisodeLabel } from "@/types";

interface Props {
    episodes: Episode[];
    selectedId: string | null;
    onSelect: (episodeId: string) => void;
    onCreate: () => void;
    onDelete: (episodeId: string) => void;
    onToggleStatus: (episode: Episode) => void;
    onReorder: (orderedIds: string[]) => void;
    /** 章の一覧 */
    chapters?: Chapter[];
    /** 話を章へ入れる・外す */
    onAssignChapter?: (episodeId: string, chapterId: string | null) => void;
    /** 章を作る。話を渡せば、その話を作った章に入れる */
    onCreateChapter?: (episodeId: string | null) => void;
    /** 章の名前を変える */
    onRenameChapter?: (chapterId: string, title: string) => void;
    /** 章を消す。中の話は「章に入れていない」へ戻る */
    onDeleteChapter?: (chapterId: string) => void;
    /** 「第◯話」を出すか */
    showNumber?: boolean;
    /** 番号の出し入れを切り替える */
    onToggleNumber?: () => void;
    /** 話の題名を変える */
    onRenameEpisode?: (episodeId: string, title: string) => void;
}

export default function EpisodeList({
    episodes,
    chapters = [],
    onAssignChapter,
    onCreateChapter,
    onRenameChapter,
    onDeleteChapter,
    showNumber = true,
    onToggleNumber,
    onRenameEpisode,
    selectedId,
    onSelect,
    onCreate,
    onDelete,
    onToggleStatus,
    onReorder,
}: Props) {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    /* ドラッグが乗っている章の見出し */
    const [overChapterId, setOverChapterId] = useState<string | null>(null);

    function handleDrop(targetId: string) {
        if (!draggingId || draggingId === targetId) {
            setDraggingId(null);
            setOverId(null);
            return;
        }

        const ids = episodes.map((ep) => ep.id);
        const from = ids.indexOf(draggingId);
        const to = ids.indexOf(targetId);
        ids.splice(from, 1);
        ids.splice(to, 0, draggingId);

        onReorder(ids);
        setDraggingId(null);
        setOverId(null);
    }

    /*
     * 章ごとに束ねる。
     *
     * 章の並びはそのまま、最後に「章に入れていない」を置く。
     * 章の無い作品では、束ねずにただ並べる（見出しだけ増えても邪魔）。
     */
    const hasChapters = chapters.length > 0;

    const groups: { chapter: Chapter | null; items: Episode[] }[] = hasChapters
        ? [
              ...chapters.map((chapter) => ({
                  chapter,
                  items: episodes.filter((ep) => ep.chapter_id === chapter.id),
              })),
              {
                  chapter: null,
                  items: episodes.filter(
                      (ep) =>
                          !ep.chapter_id ||
                          !chapters.some((c) => c.id === ep.chapter_id),
                  ),
              },
          ]
        : [{ chapter: null, items: episodes }];

    function renderEpisode(episode: Episode) {
        const isSelected = episode.id === selectedId;
        const isOver = episode.id === overId && episode.id !== draggingId;

        return (
            <li
                key={episode.id}
                draggable
                onDragStart={() => setDraggingId(episode.id)}
                onDragEnd={() => {
                    setDraggingId(null);
                    setOverId(null);
                    setOverChapterId(null);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setOverId(episode.id);
                }}
                onDrop={() => handleDrop(episode.id)}
                className={[
                    "group mb-1 flex items-center gap-2 rounded-md px-2 py-2",
                    isSelected ? "bg-forest-tint" : "hover:bg-canvas",
                    isOver
                        ? "border-t-2 border-forest"
                        : "border-t-2 border-transparent",
                    draggingId === episode.id ? "opacity-40" : "",
                ].join(" ")}
            >
                <span
                    aria-hidden="true"
                    className="cursor-grab select-none text-xs leading-none text-faint"
                >
                    ⠿
                </span>

                <button
                    type="button"
                    onClick={() => onSelect(episode.id)}
                    className="min-w-0 flex-1 text-left"
                >
                    <span className="block truncate text-[13px] text-ink">
                        {/*
                         * 番号を出すかは設定しだい。
                         * 題名だけで並べたい人もいる。
                         * 題名が空のときは、番号が無いと見分けが付かないので
                         * そのときだけ番号を出す。
                         */}
                        {showNumber || !episode.title.trim()
                            ? formatEpisodeLabel(episode)
                            : episode.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-faint">
                        {formatNumber(episode.char_count)}文字
                    </span>
                </button>

                {onRenameEpisode && (
                    <button
                        type="button"
                        onClick={() => {
                            const next = window.prompt(
                                `第${episode.ep_number}話の名前`,
                                episode.title ?? "",
                            );
                            if (next === null) return;
                            onRenameEpisode(episode.id, next.trim());
                        }}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-faint opacity-0 hover:text-forest group-hover:opacity-100"
                    >
                        名前
                    </button>
                )}

                <EpisodeStatusMark
                    status={episode.status}
                    onToggle={() => onToggleStatus(episode)}
                />

                <DeleteButton
                    label={formatEpisodeLabel(episode)}
                    note="この話の本文と履歴を削除します。元に戻せません。"
                    onDelete={() => onDelete(episode.id)}
                    isFloating
                    size="small"
                />
            </li>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-3.5 py-2.5">
                <h2 className="text-[13px] font-medium text-ink">エピソード</h2>
                <span className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onCreate}
                        className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-forest-line hover:text-forest"
                    >
                        ＋ 新規作成
                    </button>

                    {onCreateChapter && (
                        <button
                            type="button"
                            onClick={() => onCreateChapter(null)}
                            className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-forest-line hover:text-forest"
                        >
                            ＋ 章
                        </button>
                    )}

                    {/* 「第◯話」を出すか。押すたびに切り替わる */}
                    {onToggleNumber && (
                        <button
                            type="button"
                            onClick={onToggleNumber}
                            title={
                                showNumber
                                    ? "「第◯話」を隠します"
                                    : "「第◯話」を出します"
                            }
                            className={[
                                "rounded-md border px-2.5 py-1 text-xs",
                                showNumber
                                    ? "border-forest-line bg-forest-tint/50 text-forest"
                                    : "border-line text-muted hover:border-forest-line",
                            ].join(" ")}
                        >
                            第◯話
                        </button>
                    )}
                </span>
            </div>

            <div className="thin-scroll flex-1 overflow-y-auto px-2 pb-2">
                {groups.map(({ chapter, items }, groupIndex) => {
                    /* 章が無い作品では、見出しを出さずに並べるだけ */
                    if (!hasChapters) {
                        return (
                            <ul key="all">{items.map(renderEpisode)}</ul>
                        );
                    }

                    /* 空の「章に入れていない」は出さない。見出しだけ残っても仕方ない */
                    if (!chapter && items.length === 0) return null;

                    const isOverHere =
                        overChapterId === (chapter?.id ?? "__none__");

                    return (
                        <div key={chapter?.id ?? "__none__"} className="mb-1">
                            {/*
                             * 章の見出し。
                             *
                             * ここへ話をドラッグすると、その章に入る。
                             * 受け取れることが分かるよう、
                             * 乗っている間は枠を光らせる。
                             */}
                            <div
                                onDragOver={(e) => {
                                    if (!onAssignChapter) return;
                                    e.preventDefault();
                                    setOverChapterId(chapter?.id ?? "__none__");
                                }}
                                onDragLeave={() => setOverChapterId(null)}
                                onDrop={() => {
                                    if (draggingId && onAssignChapter) {
                                        onAssignChapter(
                                            draggingId,
                                            chapter?.id ?? null,
                                        );
                                    }
                                    setDraggingId(null);
                                    setOverChapterId(null);
                                }}
                                className={[
                                    "group/chapter mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5",
                                    isOverHere
                                        ? "bg-forest-tint ring-1 ring-forest"
                                        : "bg-canvas",
                                ].join(" ")}
                            >
                                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink">
                                    {chapter
                                        ? formatChapterLabel(chapter, groupIndex)
                                        : "章に入れていない"}
                                    <span className="ml-1.5 font-normal text-faint">
                                        {items.length}話
                                    </span>
                                </span>

                                {chapter && onRenameChapter && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = window.prompt(
                                                "章の名前",
                                                chapter.title ?? "",
                                            );
                                            if (next === null) return;
                                            onRenameChapter(
                                                chapter.id,
                                                next.trim(),
                                            );
                                        }}
                                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-faint opacity-0 hover:text-forest group-hover/chapter:opacity-100"
                                    >
                                        名前
                                    </button>
                                )}

                                {chapter && onDeleteChapter && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (
                                                !window.confirm(
                                                    `「${chapter.title || "この章"}」を消しますか？\n中の話は消えません。「章に入れていない」へ戻ります。`,
                                                )
                                            ) {
                                                return;
                                            }
                                            onDeleteChapter(chapter.id);
                                        }}
                                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-faint opacity-0 hover:text-[var(--color-danger)] group-hover/chapter:opacity-100"
                                    >
                                        消す
                                    </button>
                                )}
                            </div>

                            <ul>{items.map(renderEpisode)}</ul>

                            {items.length === 0 && (
                                <p className="px-3 py-2 text-[10px] text-faint">
                                    ここへ話をドラッグすると入ります
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {episodes.length === 0 && (
                <p className="px-4 pb-4 text-xs text-faint">
                    まだ話がありません。「新規作成」で第1話を作ります。
                </p>
            )}

            {episodes.length > 1 && (
                <p className="border-t border-line px-3.5 py-2 text-[11px] text-faint">
                    ドラッグ＆ドロップで並び替え
                    {hasChapters && "・章の見出しへ入れられます"}
                </p>
            )}
        </div>
    );
}
