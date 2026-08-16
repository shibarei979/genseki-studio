/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeList — 左サイドバーの話一覧
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
    /** 章の一覧。無ければ章の欄は出ない */
    chapters?: Chapter[];
    /** 話を章へ入れる・外す */
    onAssignChapter?: (episodeId: string, chapterId: string | null) => void;
    /** 章を作る。作った章に、その話を入れる */
    onCreateChapter?: (episodeId: string) => void;
}

export default function EpisodeList({
    episodes,
    chapters = [],
    onAssignChapter,
    onCreateChapter,
    selectedId,
    onSelect,
    onCreate,
    onDelete,
    onToggleStatus,
    onReorder,
}: Props) {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);

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

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-3.5 py-2.5">
                <h2 className="text-[13px] font-medium text-ink">エピソード</h2>
                <button
                    type="button"
                    onClick={onCreate}
                    className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-forest-line hover:text-forest"
                >
                    ＋ 新規作成
                </button>
            </div>

            <ul className="thin-scroll flex-1 overflow-y-auto px-2 pb-2">
                {episodes.map((episode) => {
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
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setOverId(episode.id);
                            }}
                            onDrop={() => handleDrop(episode.id)}
                            className={[
                                "group mb-1 flex flex-wrap items-center gap-2 rounded-md px-2 py-2",
                                isSelected ? "bg-forest-tint" : "hover:bg-canvas",
                                isOver ? "border-t-2 border-forest" : "border-t-2 border-transparent",
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
                                    {formatEpisodeLabel(episode)}
                                </span>
                                <span className="mt-0.5 block text-xs text-faint">
                                    {formatNumber(episode.char_count)}文字
                                </span>
                            </button>

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

                            {/*
                             * 章。
                             *
                             * 選んでいる話にだけ出す。
                             * 全部の話に出すと一覧が二重に見えて、
                             * どれを書いているのか分からなくなる。
                             *
                             * ここで作れるようにするのは、
                             * 章を作る場所が投稿の設定にしかなく、
                             * 書いている最中には遠いため。
                             */}
                            {isSelected && onAssignChapter && (
                                <span
                                    className="basis-full pl-6 pr-1 pt-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <span className="mb-1 block text-[10px] text-faint">
                                        この話をどの章に入れるか
                                    </span>

                                    {/*
                                     * 札を並べる。
                                     *
                                     * 小さな選択欄だと、押せる所に見えず、
                                     * 中を開くまで何が選べるかも分からない。
                                     * いま入っている章が一目で分かるように、
                                     * 選ばれている札だけ色を変える。
                                     */}
                                    <span className="flex flex-wrap gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onAssignChapter(episode.id, null)
                                            }
                                            className={[
                                                "rounded-full border px-2.5 py-1 text-[11px]",
                                                !episode.chapter_id
                                                    ? "border-forest bg-forest text-white"
                                                    : "border-line bg-surface text-muted hover:border-forest-line",
                                            ].join(" ")}
                                        >
                                            章なし
                                        </button>

                                        {chapters.map((chapter, chapterIndex) => (
                                            <button
                                                key={chapter.id}
                                                type="button"
                                                onClick={() =>
                                                    onAssignChapter(
                                                        episode.id,
                                                        chapter.id,
                                                    )
                                                }
                                                className={[
                                                    "max-w-[150px] truncate rounded-full border px-2.5 py-1 text-[11px]",
                                                    episode.chapter_id ===
                                                    chapter.id
                                                        ? "border-forest bg-forest text-white"
                                                        : "border-line bg-surface text-muted hover:border-forest-line",
                                                ].join(" ")}
                                            >
                                                {formatChapterLabel(
                                                    chapter,
                                                    chapterIndex,
                                                )}
                                            </button>
                                        ))}

                                        {onCreateChapter && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onCreateChapter(episode.id)
                                                }
                                                className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                                            >
                                                ＋ 章を作る
                                            </button>
                                        )}
                                    </span>
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>

            {episodes.length === 0 && (
                <p className="px-4 pb-4 text-xs text-faint">
                    まだ話がありません。「新規作成」で第1話を作ります。
                </p>
            )}

            {episodes.length > 1 && (
                <p className="border-t border-line px-3.5 py-2 text-[11px] text-faint">
                    ドラッグ＆ドロップで並び替えできます
                </p>
            )}
        </div>
    );
}
