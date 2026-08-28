"use client";

import { useEffect, useState } from "react";

import { getRepository } from "@/lib/repository";
import type { Chapter, Episode } from "@/types";

/**
 * ============================================================
 * 原石航路 Studio
 * ChapterStructure — 章の構成
 *
 * 章を 2 段にする。
 *
 * これまでの章は、すべて「小さい章」として扱う。
 * それをいくつか束ねたものが「大きい章」。
 *
 *   第一部          ← 大きい章
 *     第一章  話 3
 *     第二章  話 5
 *
 * 執筆画面の一覧に足そうとすると、
 * すでに入り組んでいて壊しやすい。
 * ここだけで完結させる。
 * ============================================================
 */

export default function ChapterStructure({ workId }: { workId: string }) {
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    /* まとめる章を選んでいる間だけ立つ */
    const [picked, setPicked] = useState<string[]>([]);

    async function reload() {
        const repository = getRepository();
        const [chapterRows, episodeRows] = await Promise.all([
            repository.listChapters(workId),
            repository.listEpisodes(workId),
        ]);

        setChapters(chapterRows);
        setEpisodes(episodeRows);
        setIsLoading(false);
    }

    useEffect(() => {
        void reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workId]);

    /* 親を持たない章が大きい章。持つものが小さい章 */
    const bigChapters = chapters.filter((c) => !c.parent_id);
    const smallOf = (parentId: string) =>
        chapters.filter((c) => c.parent_id === parentId);

    /*
     * まとめていない章。
     *
     * 親を持たず、子も持たないもの。
     * まだ束ねられていない小さい章として扱う。
     */
    const loose = bigChapters.filter((c) => smallOf(c.id).length === 0);

    /* その章に入っている話の数 */
    const countOf = (chapterId: string) =>
        episodes.filter((e) => e.chapter_id === chapterId).length;

    /** 選んだ章を、新しい大きい章の下に入れる */
    async function group() {
        if (picked.length < 2 || busy) return;

        const title = window.prompt("大きい章の名前を入れてください", "");
        if (title === null || title.trim().length === 0) return;

        setBusy(true);
        const repository = getRepository();

        /*
         * 先に器を作り、それから中身を移す。
         *
         * 逆にすると、行き先の無い章ができる。
         */
        const parent = await repository.createChapter(workId, title.trim());

        for (const id of picked) {
            await repository.updateChapter(id, { parent_id: parent.id });
        }

        setPicked([]);
        await reload();
        setBusy(false);
    }

    /** 名前を直す */
    async function rename(chapter: Chapter) {
        const title = window.prompt("名前を入れてください", chapter.title);
        if (title === null || title.trim().length === 0) return;

        setBusy(true);
        await getRepository().updateChapter(chapter.id, { title: title.trim() });
        await reload();
        setBusy(false);
    }

    /** まとめを解く。中の章は残し、束ねだけ外す */
    async function ungroup(parent: Chapter) {
        const children = smallOf(parent.id);

        if (
            !window.confirm(
                `「${parent.title}」のまとめを解きます。\n中の${children.length}つの章と話は残ります。`,
            )
        ) {
            return;
        }

        setBusy(true);
        const repository = getRepository();

        /* 先に子を出してから、器を消す */
        for (const child of children) {
            await repository.updateChapter(child.id, { parent_id: null });
        }
        await repository.deleteChapter(parent.id);

        await reload();
        setBusy(false);
    }

    /** 並べ替え。上下に 1 つ動かす */
    async function move(chapter: Chapter, to: -1 | 1) {
        const siblings = chapter.parent_id
            ? smallOf(chapter.parent_id)
            : bigChapters;

        const at = siblings.findIndex((c) => c.id === chapter.id);
        const next = at + to;
        if (next < 0 || next >= siblings.length) return;

        setBusy(true);
        const repository = getRepository();

        /* 並び順を入れ替える */
        await repository.updateChapter(chapter.id, {
            sort_order: siblings[next].sort_order,
        });
        await repository.updateChapter(siblings[next].id, {
            sort_order: chapter.sort_order,
        });

        await reload();
        setBusy(false);
    }

    if (isLoading) {
        return <p className="py-10 text-center text-sm text-faint">読み込んでいます</p>;
    }

    if (chapters.length === 0) {
        return (
            <p className="rounded-lg border border-line bg-surface px-5 py-10 text-center text-sm text-faint">
                まだ章がありません。
                <br />
                執筆画面で章を作ると、ここでまとめられます。
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-xs leading-relaxed text-muted">
                章をいくつか選んで、ひとつの大きな章にまとめられます。
                <br />
                「第一部 → 第一章」のように、2段で束ねたいときに使います。
            </p>

            {/* まとめた章 */}
            {bigChapters
                .filter((c) => smallOf(c.id).length > 0)
                .map((parent) => (
                    <div
                        key={parent.id}
                        className="rounded-lg border-2 border-forest-line bg-forest-tint/20 px-4 py-3"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-ink">
                                {parent.title || "名前のない大きい章"}
                            </span>

                            <span className="flex shrink-0 items-center gap-2">
                                <MoveButtons
                                    onUp={() => void move(parent, -1)}
                                    onDown={() => void move(parent, 1)}
                                    busy={busy}
                                />
                                <button
                                    type="button"
                                    onClick={() => void rename(parent)}
                                    className="text-[11px] text-muted hover:text-forest"
                                >
                                    名前
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void ungroup(parent)}
                                    className="text-[11px] text-muted hover:text-[var(--color-danger)]"
                                >
                                    解く
                                </button>
                            </span>
                        </div>

                        <ul className="mt-2.5 space-y-1.5">
                            {smallOf(parent.id).map((child) => (
                                <li
                                    key={child.id}
                                    className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2"
                                >
                                    <span className="min-w-0 truncate text-[13px] text-ink">
                                        {child.title || "名前のない章"}
                                        <span className="ml-2 text-[11px] text-faint">
                                            {countOf(child.id)}話
                                        </span>
                                    </span>

                                    <span className="flex shrink-0 items-center gap-2">
                                        <MoveButtons
                                            onUp={() => void move(child, -1)}
                                            onDown={() => void move(child, 1)}
                                            busy={busy}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void rename(child)}
                                            className="text-[11px] text-muted hover:text-forest"
                                        >
                                            名前
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}

            {/* まとめていない章 */}
            {loose.length > 0 && (
                <div className="rounded-lg border border-line bg-surface px-4 py-3">
                    <p className="text-[12px] font-medium text-ink">
                        まとめていない章
                    </p>

                    <ul className="mt-2.5 space-y-1.5">
                        {loose.map((chapter) => (
                            <li
                                key={chapter.id}
                                className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
                            >
                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={picked.includes(chapter.id)}
                                        onChange={() =>
                                            setPicked((prev) =>
                                                prev.includes(chapter.id)
                                                    ? prev.filter((x) => x !== chapter.id)
                                                    : [...prev, chapter.id],
                                            )
                                        }
                                        className="h-3.5 w-3.5 shrink-0"
                                    />
                                    <span className="min-w-0 truncate text-[13px] text-ink">
                                        {chapter.title || "名前のない章"}
                                        <span className="ml-2 text-[11px] text-faint">
                                            {countOf(chapter.id)}話
                                        </span>
                                    </span>
                                </label>

                                <span className="flex shrink-0 items-center gap-2">
                                    <MoveButtons
                                        onUp={() => void move(chapter, -1)}
                                        onDown={() => void move(chapter, 1)}
                                        busy={busy}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void rename(chapter)}
                                        className="text-[11px] text-muted hover:text-forest"
                                    >
                                        名前
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>

                    {picked.length >= 2 && (
                        <button
                            type="button"
                            onClick={() => void group()}
                            disabled={busy}
                            className="mt-3 w-full rounded-md bg-forest py-2 text-[12px] text-white hover:opacity-90 disabled:opacity-50"
                        >
                            選んだ{picked.length}つを大きい章にまとめる
                        </button>
                    )}

                    {picked.length === 1 && (
                        <p className="mt-2 text-[11px] text-faint">
                            もう1つ以上選ぶと、まとめられます。
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

/** 上下に動かす小さな押し具 */
function MoveButtons({
    onUp,
    onDown,
    busy,
}: {
    onUp: () => void;
    onDown: () => void;
    busy: boolean;
}) {
    return (
        <span className="flex items-center">
            <button
                type="button"
                onClick={onUp}
                disabled={busy}
                aria-label="上へ"
                className="px-1 text-[11px] text-faint hover:text-forest disabled:opacity-40"
            >
                ▲
            </button>
            <button
                type="button"
                onClick={onDown}
                disabled={busy}
                aria-label="下へ"
                className="px-1 text-[11px] text-faint hover:text-forest disabled:opacity-40"
            >
                ▼
            </button>
        </span>
    );
}
