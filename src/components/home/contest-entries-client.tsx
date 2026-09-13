"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import WorkShelf, { type ShelfWork } from "@/components/common/work-shelf";
import { getRepository } from "@/lib/repository";
import type { Contest } from "@/types";

/**
 * ============================================================
 * 原石航路 Studio
 * ContestEntriesClient — 応募作品を並べる
 *
 * ★ 一覧と本棚を選べる。
 *
 *   一覧  題名・作者・文字数が並ぶ。数が多いとき向き
 *   本棚  表紙が並ぶ。眺めて選びたいとき向き
 *
 *   どちらが良いかは、そのときの気分で変わる。
 *   こちらで決めずに、選んでもらう。
 *
 * ★ 選んだ形は覚える。
 *   開くたびに選び直させない。
 *
 * ★ 読めない作品は出さない。
 *   応募したあとに非公開へ戻した作品を開くと、
 *   「見つかりません」に当たる。
 *   （外すのは読み口の側でやっている）
 * ============================================================
 */

interface Entry {
    work_id: string;
    work_title: string;
    author_name: string;
    char_count: number;
    entered_at: string;
}

/** 見せ方の覚え。開くたびに選び直させない */
const VIEW_KEY = "genseki:contest-entries-view";

export default function ContestEntriesClient({
    contestId,
}: {
    contestId: string;
}) {
    const [contest, setContest] = useState<Contest | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [view, setView] = useState<"list" | "shelf">("list");

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(VIEW_KEY);
            if (saved === "shelf" || saved === "list") setView(saved);
        } catch {
            /* 読めなくても、一覧で出せばよい */
        }
    }, []);

    function changeView(next: "list" | "shelf") {
        setView(next);
        try {
            window.localStorage.setItem(VIEW_KEY, next);
        } catch {
            /* 覚えられなくても、その場では効く */
        }
    }

    const reload = useCallback(async () => {
        const repository = getRepository();

        setContest(await repository.getContest(contestId));
        setEntries(await repository.listPublicContestEntries(contestId));
        setIsLoading(false);
    }, [contestId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    /* 本棚に渡す形にする */
    const shelfWorks: ShelfWork[] = entries.map((entry) => ({
        id: entry.work_id,
        title: entry.work_title || "（題名なし）",
        author: entry.author_name || "名もなき作者",
    }));

    return (
        <main className="mx-auto w-full max-w-4xl px-5 py-8">
            <Link
                href={`/contest/${contestId}`}
                className="text-[12px] text-muted hover:text-ink"
            >
                ‹ コンテストの説明へもどる
            </Link>

            <h1 className="mt-3 text-xl font-medium text-ink">
                応募作品
                {contest?.title && (
                    <span className="ml-2 text-[13px] text-muted">
                        {contest.title}
                    </span>
                )}
            </h1>

            {isLoading ? (
                <p className="mt-8 text-center text-sm text-faint">
                    読み込んでいます…
                </p>
            ) : entries.length === 0 ? (
                <div className="mt-10 rounded-lg border border-dashed border-line py-16 text-center">
                    <p className="text-sm text-ink">
                        まだ応募がありません。
                    </p>
                    <p className="mt-1 text-[12px] text-muted">
                        最初の一作になりませんか。
                    </p>
                </div>
            ) : (
                <>
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-[12px] text-muted">
                            {entries.length}作品。新しく出したものから並んでいます。
                        </p>

                        {/* 見せ方を選ぶ */}
                        <div className="flex gap-0.5 rounded-md border border-line p-0.5">
                            {(
                                [
                                    { key: "list", label: "一覧" },
                                    { key: "shelf", label: "本棚" },
                                ] as { key: "list" | "shelf"; label: string }[]
                            ).map((one) => (
                                <button
                                    key={one.key}
                                    type="button"
                                    onClick={() => changeView(one.key)}
                                    aria-pressed={view === one.key}
                                    className={[
                                        "rounded px-3 py-1 text-[11.5px]",
                                        view === one.key
                                            ? "bg-forest text-white"
                                            : "text-muted hover:text-ink",
                                    ].join(" ")}
                                >
                                    {one.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {view === "shelf" ? (
                        <div className="mt-4">
                            <WorkShelf works={shelfWorks} />
                        </div>
                    ) : (
                        <ul className="mt-4 divide-y divide-line">
                            {entries.map((entry) => (
                                <li key={entry.work_id}>
                                    <Link
                                        href={`/novel/${entry.work_id}`}
                                        className="flex items-baseline gap-3 px-2 py-3 hover:bg-forest-tint/40"
                                    >
                                        <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                                            {entry.work_title || "（題名なし）"}
                                        </span>

                                        <span className="shrink-0 text-[12px] text-muted">
                                            {entry.author_name || "名もなき作者"}
                                        </span>

                                        {entry.char_count > 0 && (
                                            <span className="hidden shrink-0 text-[11px] text-faint sm:inline">
                                                {entry.char_count.toLocaleString()}字
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </main>
    );
}
