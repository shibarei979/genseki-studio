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

import { useEffect, useRef, useState } from "react";

import DeleteButton from "@/components/common/delete-button";
import EpisodeStatusMark from "@/components/workspace/episode-status-mark";
import { formatNumber } from "@/lib/utils/text";
import type { Chapter, Episode } from "@/types";
import { formatChapterLabel, formatEpisodeLabel } from "@/types";

import {
    buildChapterGroups,
    formatChapterNumber,
    formatPartNumber,
    hasOwnNumber,
    orderedEpisodeIds,
} from "./chapter-tree";

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
    /** 章を並べ替える。渡した順に上から並ぶ */
    onReorderChapters?: (orderedIds: string[]) => void;
    /** 選んだ話をまとめて消す */
    onDeleteMany?: (episodeIds: string[]) => void;
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
    onReorderChapters,
    onDeleteMany,
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
    /* つかんでいる章。話とは別に覚える */
    const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null);

    /*
     * まとめて消すために選んでいる話。
     *
     * ふだんは出さない。「選んで消す」を押したときだけ
     * 丸が出る。書いている最中に消す口が見えていると、
     * 手が滑ったときに戻せない。
     */
    /*
     * 閉じている章。
     *
     * 章が増えると、一覧が長くなって目当ての話まで遠い。
     * 見出しを押すと、その章の中身をしまえる。
     */
    const [closedChapters, setClosedChapters] = useState<string[]>([]);

    /*
     * 章を作ったあと、入れる話を選ぶ窓。
     *
     * ドラッグで入れるには、話を掴んだまま
     * 章の帯が出るまで画面を送らねばならない。
     * 100 話を超えると、これがひどく辛い。
     * 名前で探して選べるようにする。
     */
    const [fillingChapterId, setFillingChapterId] = useState<string | null>(null);
    const [fillQuery, setFillQuery] = useState("");
    const [fillPicked, setFillPicked] = useState<string[]>([]);

    const [isPicking, setIsPicking] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);

    /* 直前に選んだ話。シフトで「ここからここまで」を出すのに使う */
    const lastPicked = useRef<string | null>(null);

    /* 入れる窓のほうの、直前に選んだ話 */
    const lastFillPicked = useRef<string | null>(null);

    /*
     * 入れる窓に出ている話。
     *
     * 探した言葉で絞ったあとの並びが、そのまま
     * 「ここからここまで」の順になる。
     */
    const fillList = episodes.filter(
        (ep) =>
            !fillQuery.trim() ||
            formatEpisodeLabel(ep)
                .toLowerCase()
                .includes(fillQuery.trim().toLowerCase()),
    );

    /**
     * 入れる窓で話を選ぶ。
     *
     * シフトを押しながらだと、直前に選んだ話から
     * この話までを、まとめて選ぶ。
     * すでにその章に入っている話は、あいだにあっても飛ばす。
     */
    function toggleFillPicked(id: string, withShift = false) {
        if (withShift && lastFillPicked.current && lastFillPicked.current !== id) {
            const order = fillList.map((ep) => ep.id);
            const from = order.indexOf(lastFillPicked.current);
            const to = order.indexOf(id);

            if (from >= 0 && to >= 0) {
                const span = fillList
                    .slice(Math.min(from, to), Math.max(from, to) + 1)
                    .filter((ep) => ep.chapter_id !== fillingChapterId)
                    .map((ep) => ep.id);

                setFillPicked((list) => Array.from(new Set([...list, ...span])));
                lastFillPicked.current = id;
                return;
            }
        }

        lastFillPicked.current = id;
        setFillPicked((list) =>
            list.includes(id) ? list.filter((at) => at !== id) : [...list, id],
        );
    }

    /**
     * 話を選ぶ。
     *
     * シフトを押しながらだと、直前に選んだ話から
     * この話までを、まとめて選ぶ。
     * 100 話を選ぶのに 100 回押すことになっていた。
     */
    function togglePicked(id: string, withShift = false) {
        if (withShift && lastPicked.current && lastPicked.current !== id) {
            const order = orderedEpisodeIds(chapters, episodes);
            const from = order.indexOf(lastPicked.current);
            const to = order.indexOf(id);

            if (from >= 0 && to >= 0) {
                const span = order.slice(
                    Math.min(from, to),
                    Math.max(from, to) + 1,
                );
                setPicked((list) => Array.from(new Set([...list, ...span])));
                lastPicked.current = id;
                return;
            }
        }

        lastPicked.current = id;
        setPicked((list) =>
            list.includes(id) ? list.filter((at) => at !== id) : [...list, id],
        );
    }

    /**
     * 1 つ上（または下）へ動かす。
     *
     * ★ つまんで動かす操作は、携帯でできない。
     *   指では別の動き（画面を送る）になってしまう。
     *
     * ★ パソコンでも気づかれにくい。
     *   実際、並べ替えが無いと思われていた。
     *
     * 押し具なら、どこでも同じように使える。
     */
    function moveBy(episodeId: string, step: -1 | 1) {
        /*
         * 画面に見えている順で数える。
         *
         * 章を作ると、見えている順は章ごとに束ねた順になり、
         * 配列の順（ep_number 順）とずれる。
         */
        const order = orderedEpisodeIds(chapters, episodes);
        const from = order.indexOf(episodeId);
        if (from < 0) return;

        const to = from + step;
        if (to < 0 || to >= order.length) return;

        const next = [...order];
        [next[from], next[to]] = [next[to], next[from]];
        onReorder(next);
    }

    function handleDrop(targetId: string) {
        if (!draggingId || draggingId === targetId) {
            setDraggingId(null);
            setOverId(null);
            return;
        }

        /*
         * 並べ替えは、画面に見えている順で数える。
         *
         * 前は episodes の配列の順（ep_number 順）で数えていた。
         * 章を作ると、見えている順は章ごとに束ねた順になり、
         * 配列の順とずれる。
         * ずれたまま「3 番目に落とした」と数えるので、
         * まったく違う場所に入っていた。
         */
        const ids = orderedEpisodeIds(chapters, episodes);
        const from = ids.indexOf(draggingId);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) {
            setDraggingId(null);
            setOverId(null);
            return;
        }
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

    /*
     * 章を 2 段で組み立てる。
     *
     * 大きい章のすぐ後ろに、その子が続く。
     * 組み立ては chapter-tree.ts にある。
     */
    const groups = buildChapterGroups(chapters, episodes);

    /*
     * 選ばれた話まで送る。
     *
     * 新しく作った話は一番下に来るので、
     * 話が多いと画面の外にできる。
     * 見えていなければ、そこまで滑らせる。
     */
    useEffect(() => {
        if (!selectedId) return;

        /* 描き終わってから探す。すぐだとまだ無い */
        const timer = window.setTimeout(() => {
            const row = document.querySelector<HTMLElement>(
                'li[data-selected="1"]',
            );
            if (!row) return;

            /*
             * すでに見えているなら動かさない。
             *
             * 一覧の話を押すたびに画面が跳ねると、
             * 選んだつもりの場所を見失う。
             */
            const box = row.getBoundingClientRect();
            const isVisible = box.top >= 0 && box.bottom <= window.innerHeight;
            if (isVisible) return;

            row.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60);

        return () => window.clearTimeout(timer);
    }, [selectedId, episodes.length]);

    function renderEpisode(episode: Episode) {
        const isSelected = episode.id === selectedId;
        const isOver = episode.id === overId && episode.id !== draggingId;

        return (
            <li
                key={episode.id}
                /*
                 * 選ばれた行に印を付ける。
                 *
                 * 新しく作った話は一覧の一番下に来る。
                 * 話が増えると画面の外なので、
                 * 作ってもどこへ行ったか分からない。
                 * この印を目印に、そこまで送る。
                 */
                data-selected={isSelected ? "1" : undefined}
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
                    "group relative mb-1 flex items-center gap-2 rounded-md px-2 py-2",
                    /* 移す先を選んでいる間は、ほかを目立たせない */
                    isSelected ? "bg-forest-tint" : "hover:bg-canvas",
                    isOver
                        ? "border-t-2 border-forest"
                        : "border-t-2 border-transparent",
                    draggingId === episode.id ? "opacity-40" : "",
                ].join(" ")}
            >
                {/*
                  * 上下へ動かす押し具。
                  *
                  * ★ つまんで動かす操作は、携帯でできない。
                  *   指では画面を送る動きになってしまう。
                  *   パソコンでも気づかれにくい。
                  *
                  * ★ 選んでいる間は出さない。
                  *   まとめて動かす作業と混ざる。
                  */}
                {/*
                  * 移す先を選んでいる間は、
                  * 「ここへ」の押し具に変える。
                  */}

                {/*
                  * ★ 行の上に重ねて置く。
                  *
                  *   並べて置くと、その幅だけ題名の場所が減る。
                  *   実際、題名が 1 文字ずつ折り返して読めなくなった。
                  *   隠すだけでは、場所は取ったまま。
                  *
                  *   重ねれば幅を取らない。
                  *   指を置いたときだけ出す。
                  */}
                {!isPicking && (
                    <span className="absolute -left-0.5 top-1/2 z-10 flex -translate-y-1/2 flex-col rounded bg-surface/95 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveBy(episode.id, -1) }}
                            title="1つ上へ"
                            aria-label="1つ上へ動かす"
                            className="flex h-3 w-3 items-center justify-center text-[8px] leading-none text-faint hover:text-forest"
                        >
                            ▲
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveBy(episode.id, 1) }}
                            title="1つ下へ"
                            aria-label="1つ下へ動かす"
                            className="flex h-3 w-3 items-center justify-center text-[8px] leading-none text-faint hover:text-forest"
                        >
                            ▼
                        </button>
                    </span>
                )}



                {/* 選んでいる間は、つまみの代わりに丸を出す */}
                {isPicking ? (
                    <button
                        type="button"
                        onClick={(e) => togglePicked(episode.id, e.shiftKey)}
                        aria-pressed={picked.includes(episode.id)}
                        /* 四角。選ぶ印は丸より四角のほうが伝わる */
                        className={[
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px]",
                            picked.includes(episode.id)
                                ? "border-[var(--color-danger)] bg-[var(--color-danger)] text-white"
                                : "border-line text-transparent hover:border-[var(--color-danger)]",
                        ].join(" ")}
                    >
                        ✓
                    </button>
                ) : (
                    <span
                        aria-hidden="true"
                        className="cursor-grab select-none text-xs leading-none text-faint"
                    >
                        ⠿
                    </span>
                )}

                <button
                    type="button"
                    onClick={(e) =>
                        isPicking
                            ? togglePicked(episode.id, e.shiftKey)
                            : onSelect(episode.id)
                    }
                    className="min-w-0 flex-1 text-left"
                >
                    <span className="block truncate text-[13px] text-ink">
                        {formatEpisodeLabel(episode)}
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
                                `${episode.ep_number}話目の名前`,
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

                {/*
                  * 章から出す。
                  *
                  * つまんで落とす道も作ったが、
                  * スマホや、つまむのが不得手な人には届かない。
                  * 章に入っている話にだけ出す。
                  */}
                {episode.chapter_id && onAssignChapter && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAssignChapter(episode.id, null);
                        }}
                        title="この話を章から出す"
                        className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-faint hover:border-forest hover:text-forest"
                    >
                        章から出す
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

                </span>
            </div>

            {/*
             * まとめて消す。
             *
             * 余分な話を 1 つずつ消すのは骨が折れる。
             * ただし戻せない操作なので、
             * ふだんは丸を出さず、押したときだけ選べるようにする。
             */}
            {onDeleteMany && episodes.length > 0 && (
                /*
                 * 選んでいる間は、この帯を上に貼り付ける。
                 *
                 * 下のほうの話を選んでいると、
                 * 「◯話を選んでいます」も操作の押し具も
                 * 画面の外へ行ってしまい、何をしているのか分からなくなる。
                 */
                <div
                    className={[
                        "px-3.5 pb-2",
                        isPicking ? "sticky top-0 z-10 bg-surface pt-2 shadow-sm" : "",
                    ].join(" ")}
                >
                    {!isPicking ? (
                        <button
                            type="button"
                            onClick={() => {
                                setIsPicking(true);
                                setPicked([]);
                            }}
                            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-surface py-1.5 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                        >
                            <span aria-hidden="true">☑</span>
                            話を選ぶ
                        </button>
                    ) : (
                        <div className="rounded-md border border-line bg-canvas px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-ink">
                                    {picked.length > 0
                                        ? `${picked.length}話を選んでいます`
                                        : "消す話を選んでください"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPicking(false);
                                        setPicked([]);
                                    }}
                                    className="shrink-0 text-[11px] text-faint hover:text-ink"
                                >
                                    やめる
                                </button>
                            </div>

                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPicked(
                                            picked.length === episodes.length
                                                ? []
                                                : episodes.map((ep) => ep.id),
                                        )
                                    }
                                    className="rounded border border-line px-2 py-0.5 text-[10px] text-muted hover:border-forest-line"
                                >
                                    {picked.length === episodes.length
                                        ? "選択を外す"
                                        : "すべて選ぶ"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setPicked(
                                            episodes
                                                .filter(
                                                    (ep) =>
                                                        !ep.title.trim() &&
                                                        ep.char_count === 0,
                                                )
                                                .map((ep) => ep.id),
                                        )
                                    }
                                    title="名前も本文も無い話を選びます"
                                    className="rounded border border-line px-2 py-0.5 text-[10px] text-muted hover:border-forest-line"
                                >
                                    空の話を選ぶ
                                </button>

                            </div>

                            {/*
                             * 選んだ話にできること。
                             *
                             * 消すだけでなく、章へ入れる・外すもここから。
                             * 1 話ずつ章を選び直すのは骨が折れる。
                             */}
                            {picked.length > 0 && (
                                <div className="mt-2 border-t border-line pt-2">
                                    {onAssignChapter && (
                                        <>
                                            <p className="text-[10px] text-faint">
                                                選んだ{picked.length}話を
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {chapters.map((chapter, at) => (
                                                    <button
                                                        key={chapter.id}
                                                        type="button"
                                                        onClick={() => {
                                                            picked.forEach((id) =>
                                                                onAssignChapter(id, chapter.id),
                                                            );
                                                            setIsPicking(false);
                                                            setPicked([]);
                                                        }}
                                                        className="max-w-[140px] truncate rounded-full border border-line px-2.5 py-1 text-[10px] text-muted hover:border-forest-line hover:text-forest"
                                                    >
                                                        {formatChapterLabel(chapter, at)}へ
                                                    </button>
                                                ))}

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        picked.forEach((id) =>
                                                            onAssignChapter(id, null),
                                                        );
                                                        setIsPicking(false);
                                                        setPicked([]);
                                                    }}
                                                    className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted hover:border-forest-line hover:text-forest"
                                                >
                                                    章から出す
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const names = episodes
                                                .filter((ep) => picked.includes(ep.id))
                                                .slice(0, 5)
                                                .map((ep) => formatEpisodeLabel(ep))
                                                .join("\n");

                                            if (
                                                !window.confirm(
                                                    `${picked.length}話を消します。元に戻せません。\n\n` +
                                                        `${names}${picked.length > 5 ? "\nほか" : ""}`,
                                                )
                                            ) {
                                                return;
                                            }
                                            onDeleteMany(picked);
                                            setIsPicking(false);
                                            setPicked([]);
                                        }}
                                        className="mt-2 w-full rounded bg-[var(--color-danger)] py-1.5 text-[10px] text-white hover:opacity-90"
                                    >
                                        {picked.length}話を消す
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="thin-scroll flex-1 overflow-y-auto px-2 pb-2">
                {groups.map((group, groupAt) => {
                    const {
                        chapter,
                        items,
                        depth,
                        isBig,
                        parentId,
                        labelIndex,
                        totalCount,
                    } = group;

                    /* 章が無い作品では、見出しを出さずに並べるだけ */
                    if (!hasChapters) {
                        return (
                            <ul key="all">{items.map(renderEpisode)}</ul>
                        );
                    }

                    /* 空の「章に入れていない」は出さない。見出しだけ残っても仕方ない */
                    if (!chapter && items.length === 0) return null;

                    /*
                     * 親をしまっているあいだ、小さい章は出さない。
                     *
                     * 中の話だけでなく、章の見出しごと隠す。
                     * でないと「しまった」ように見えない。
                     */
                    if (parentId && closedChapters.includes(parentId)) {
                        return null;
                    }

                    const isOverHere =
                        overChapterId === (chapter?.id ?? "__none__");

                    return (
                        <div
                            /*
                             * 同じ章が並びの中に何度も出ることがある。
                             * 章の id だけを目印にすると重なって、
                             * 描き直しのときに行が入れ替わる。
                             * 並びの位置を混ぜて、必ず別物にする。
                             */
                            key={`${chapter?.id ?? "__none__"}-${groupAt}`}
                            className="mb-1"
                            style={depth > 0 ? { paddingLeft: 14 } : undefined}
                        >
                            {/*
                             * 章の見出し。
                             *
                             * ここへ話をドラッグすると、その章に入る。
                             * 受け取れることが分かるよう、
                             * 乗っている間は枠を光らせる。
                             */}
                            <div
                                /*
                                 * 章そのものも動かせる。
                                 * 上から並んだ順が、そのまま章の順になる。
                                 */
                                draggable={Boolean(chapter && onReorderChapters)}
                                onDragStart={() => {
                                    if (chapter) setDraggingChapterId(chapter.id);
                                }}
                                onDragEnd={() => {
                                    setDraggingChapterId(null);
                                    setOverChapterId(null);
                                }}
                                onDragOver={(e) => {
                                    if (!onAssignChapter && !draggingChapterId) return;
                                    e.preventDefault();
                                    setOverChapterId(chapter?.id ?? "__none__");
                                }}
                                onDragLeave={() => setOverChapterId(null)}
                                onDrop={() => {
                                    /* 章を章の上へ落としたら、並べ替え */
                                    if (
                                        draggingChapterId &&
                                        chapter &&
                                        draggingChapterId !== chapter.id &&
                                        onReorderChapters
                                    ) {
                                        const ids = chapters.map((c) => c.id);
                                        const from = ids.indexOf(draggingChapterId);
                                        const to = ids.indexOf(chapter.id);
                                        ids.splice(from, 1);
                                        ids.splice(to, 0, draggingChapterId);
                                        onReorderChapters(ids);
                                    } else if (draggingId && onAssignChapter) {
                                        /* 話を落としたら、その章に入れる */
                                        onAssignChapter(
                                            draggingId,
                                            chapter?.id ?? null,
                                        );
                                    }
                                    setDraggingId(null);
                                    setDraggingChapterId(null);
                                    setOverChapterId(null);
                                }}
                                className={[
                                    /*
                                     * 2 段にする。
                                     *
                                     * 名前と押し具を横に並べていたので、
                                     * 細い一覧では名前の幅が 3 分の 1 ほどしか
                                     * 残らず、「第一部　白書の魔女」が切れた。
                                     * 名前に 1 行ぜんぶを渡す。
                                     */
                                    "group/chapter mt-2 flex flex-col gap-1 rounded-md px-2 py-1.5",
                                    isOverHere
                                        ? "bg-forest-tint ring-1 ring-forest"
                                        : "bg-canvas",
                                ].join(" ")}
                            >
                                {/* 1 段目：つまみ・開閉・名前 */}
                                <div className="flex w-full items-center gap-1.5">
                                {chapter && onReorderChapters && (
                                    <span
                                        aria-hidden="true"
                                        className="cursor-grab select-none text-[10px] leading-none text-faint"
                                    >
                                        ⠿
                                    </span>
                                )}

                                {chapter && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setClosedChapters((list) =>
                                                list.includes(chapter.id)
                                                    ? list.filter((at) => at !== chapter.id)
                                                    : [...list, chapter.id],
                                            )
                                        }
                                        aria-expanded={!closedChapters.includes(chapter.id)}
                                        title={
                                            closedChapters.includes(chapter.id)
                                                ? "開く"
                                                : "しまう"
                                        }
                                        className="shrink-0 px-0.5 text-[10px] text-faint hover:text-forest"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="inline-block transition-transform"
                                            style={{
                                                transform: closedChapters.includes(chapter.id)
                                                    ? "rotate(-90deg)"
                                                    : "none",
                                            }}
                                        >
                                            ▾
                                        </span>
                                    </button>
                                )}

                                {/*
                                 * 番号は札にして、名前とは分ける。
                                 *
                                 * 「第一部　白書の魔女」を 1 つの文字列に
                                 * していたので、細い一覧では番号だけが見えて
                                 * 名前が切れていた。
                                 * 札は縮まないので、残り全部が名前に渡る。
                                 */}
                                {/*
                                 * 番号の札。
                                 *
                                 * 作者が名前に番号を入れているときは出さない。
                                 * 「第二章」という名前に「第一章」の札が付き、
                                 * 二重に見えていた。
                                 */}
                                {chapter && !hasOwnNumber(chapter.title) && (
                                    <span
                                        className={[
                                            "shrink-0 rounded px-1 py-0.5 text-[9px] leading-none",
                                            isBig
                                                ? "bg-forest font-bold text-white"
                                                : "bg-forest-tint font-medium text-forest",
                                        ].join(" ")}
                                    >
                                        {isBig
                                            ? formatPartNumber(labelIndex)
                                            : formatChapterNumber(labelIndex)}
                                    </span>
                                )}

                                <span
                                    className={[
                                        "min-w-0 flex-1 truncate text-[11px] text-ink",
                                        isBig ? "font-semibold" : "font-medium",
                                    ].join(" ")}
                                    title={chapter?.title || undefined}
                                >
                                    {chapter
                                        ? chapter.title || (
                                              <span className="text-faint">
                                                  名前なし
                                              </span>
                                          )
                                        : "章に入れていない"}
                                </span>

                                {/*
                                 * 大きい章は、配下の小さい章まで合わせた数。
                                 * 部の見出しに「0話」と出ては困る。
                                 */}
                                <span className="shrink-0 text-[10px] font-normal text-faint">
                                    {totalCount}話
                                </span>
                                </div>

                                {/* 2 段目：押し具。名前の幅を取らない */}
                                <div className="flex w-full items-center gap-1">

                                {chapter && onAssignChapter && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFillingChapterId(chapter.id);
                                            setFillQuery("");
                                            setFillPicked([]);
                                        }}
                                        title="この章に話を入れる"
                                        className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint hover:border-forest hover:text-forest"
                                    >
                                        話を入れる
                                    </button>
                                )}

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
                                        className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint hover:border-forest hover:text-forest"
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
                                        className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                                    >
                                        消す
                                    </button>
                                )}
                                </div>
                            </div>

                            {!(chapter && closedChapters.includes(chapter.id)) && (
                                <ul>{items.map(renderEpisode)}</ul>
                            )}

                            {/*
                             * 大きい章には出さない。
                             * 話は小さい章のほうへ入れてもらう。
                             */}
                            {items.length === 0 && !isBig && (
                                <p className="px-3 py-2 text-[10px] text-faint">
                                    ここへ話をドラッグすると入ります
                                </p>
                            )}
                        </div>
                    );
                })}

                {/*
                  * 章から出す先。
                  *
                  * 出す仕組みは前からあったが、口が2つとも
                  * 見つけにくい所にあった。
                  *
                  *   「話を選ぶ」で選んでから押す
                  *   「章に入れていない」の見出しへ落とす
                  *
                  * 後者は、章に入っていない話が1つも無いと
                  * 見出しごと出ない。全部を章に入れた瞬間、
                  * 出す先が画面から消えていた。
                  * 「章を消して組み直すしかない」と言われたのは、そのため。
                  *
                  * つまんでいる間だけ、必ずここに出す。
                  */}
                {draggingId && onAssignChapter && (
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setOverId("__unassign__");
                        }}
                        onDragLeave={() => setOverId(null)}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (draggingId) onAssignChapter(draggingId, null);
                            setDraggingId(null);
                            setOverId(null);
                        }}
                        className={[
                            "mt-2 rounded-md border border-dashed px-3 py-3 text-center text-[11px]",
                            overId === "__unassign__"
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line text-faint",
                        ].join(" ")}
                    >
                        ここへ落とすと、章から出ます
                    </div>
                )}
            </div>

            {episodes.length === 0 && (
                <p className="px-4 pb-4 text-xs text-faint">
                    まだ話がありません。「新規作成」で第1話を作ります。
                </p>
            )}

            {/*
             * 章に話を入れる窓。
             *
             * 名前で探して選ぶ。ドラッグで運ぶより確実で速い。
             */}
            {fillingChapterId && onAssignChapter && (
                <div
                    onClick={() => setFillingChapterId(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex max-h-[70vh] w-[min(420px,100%)] flex-col overflow-hidden rounded-xl bg-surface"
                    >
                        <div className="flex items-center justify-between border-b border-line px-4 py-3">
                            <span className="text-[13px] font-medium text-ink">
                                {formatChapterLabel(
                                    chapters.find((c) => c.id === fillingChapterId)!,
                                    chapters.findIndex((c) => c.id === fillingChapterId),
                                )}
                                に入れる話
                            </span>
                            <button
                                type="button"
                                onClick={() => setFillingChapterId(null)}
                                className="text-[13px] text-faint hover:text-ink"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="px-4 pt-3">
                            <input
                                type="text"
                                value={fillQuery}
                                onChange={(e) => setFillQuery(e.target.value)}
                                placeholder="話の名前で探す"
                                className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest"
                            />
                        </div>

                        <ul className="thin-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                            {fillList.map((ep) => {
                                /*
                                 * すでにこの章に入っている話は選べない。
                                 *
                                 * 押しても何も起きないのに押せてしまうと、
                                 * 入れたつもりの数が合わなくなる。
                                 */
                                const isIn = ep.chapter_id === fillingChapterId;
                                const isPicked = fillPicked.includes(ep.id);

                                return (
                                    <li key={ep.id}>
                                        <button
                                            type="button"
                                            disabled={isIn}
                                            onClick={(e) =>
                                                toggleFillPicked(ep.id, e.shiftKey)
                                            }
                                            className={[
                                                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left",
                                                isIn
                                                    ? "cursor-not-allowed opacity-50"
                                                    : "hover:bg-canvas",
                                            ].join(" ")}
                                        >
                                            <span
                                                className={[
                                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px]",
                                                    isIn
                                                        ? "border-line bg-canvas text-transparent"
                                                        : isPicked
                                                          ? "border-forest bg-forest text-white"
                                                          : "border-line text-transparent",
                                                ].join(" ")}
                                            >
                                                ✓
                                            </span>
                                            <span
                                                className={[
                                                    "min-w-0 flex-1 truncate text-[13px]",
                                                    isIn ? "text-faint" : "text-ink",
                                                ].join(" ")}
                                            >
                                                {formatEpisodeLabel(ep)}
                                            </span>
                                            {isIn && (
                                                <span className="shrink-0 text-[10px] text-faint">
                                                    入っています
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
                            <span className="text-[11px] text-muted">
                                {fillPicked.length}話を選択
                            </span>
                            <button
                                type="button"
                                disabled={fillPicked.length === 0}
                                onClick={() => {
                                    fillPicked.forEach((id) =>
                                        onAssignChapter(id, fillingChapterId),
                                    );
                                    setFillingChapterId(null);
                                    setFillPicked([]);
                                }}
                                className="ml-auto rounded-md bg-forest px-4 py-1.5 text-[12px] text-white hover:bg-forest-dark disabled:opacity-40"
                            >
                                この章に入れる
                            </button>
                        </div>
                    </div>
                </div>
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
