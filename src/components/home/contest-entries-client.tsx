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
    cover_url: string | null;
    cover_is_ai: boolean | null;
    cover_stamp_corner: "tl" | "tr" | "bl" | "br" | null;
    summary: string;
    genre: string;
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
        cover_url: entry.cover_url,
        cover_is_ai: entry.cover_is_ai,
        cover_stamp_corner: entry.cover_stamp_corner,
    }));

    return (
        /*
         * ★ 地を少し沈める。
         *
         *   札を白にしても、地も白だと浮かない。
         *   地を落として、札が乗っているように見せる。
         */
        <main className="mx-auto w-full max-w-4xl bg-canvas px-5 py-8">
            {/*
              * 頭。
              *
              * ★ コンテストの絵を出す。
              *
              *   文字だけだと、どのコンテストの頁か
              *   一目で分からない。
              *   説明の頁から来た人が、同じ場所にいると分かる。
              *
              * ★ 絵が無いコンテストもある。
              *   そのときは文字だけで出す。
              */}
            {contest?.banner_url ? (
                <div>
                    <Link
                        href={`/contest/${contestId}`}
                        className="text-[12px] text-muted hover:text-ink"
                    >
                        ‹ {contest.title || "コンテスト"}の説明へもどる
                    </Link>

                    {/*
                      * コンテストの絵。
                      *
                      * ★ 切り取らない。
                      *
                      *   前は高さを決めて、はみ出しを切っていた。
                      *   絵の真ん中だけが横長に残り、
                      *   何の絵なのか分からなくなっていた。
                      *
                      *   絵の形はコンテストごとに違う。
                      *   こちらで決めた形に押し込まず、
                      *   そのままの形で出す。
                      *
                      * ★ 額に入れる。
                      *
                      *   絵をそのまま置くと、地に溶ける。
                      *   薄い縁と影を付けて、貼ってあるように見せる。
                      */}
                    <div className="mt-2.5 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_2px_10px_rgba(40,35,25,.07)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={contest.banner_url}
                            alt={contest.title || "コンテスト"}
                            className="block max-h-[340px] w-full object-contain"
                        />
                    </div>

                    <h1 className="mt-4 text-xl font-medium text-ink">
                        応募作品
                    </h1>
                </div>
            ) : (
                <>
                    <Link
                        href={`/contest/${contestId}`}
                        className="text-[12px] text-muted hover:text-ink"
                    >
                        ‹ コンテストの説明へもどる
                    </Link>

                    <h1 className="mt-2 text-xl font-medium text-ink">
                        応募作品
                        {contest?.title && (
                            <span className="ml-2 text-[13px] text-muted">
                                {contest.title}
                            </span>
                        )}
                    </h1>
                </>
            )}

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
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                        {/*
                          * 件数と並び。
                          *
                          * ★ 数を大きく出す。
                          *   「67作品」はこの頁の顔になる数字。
                          *   説明文に埋もれさせない。
                          */}
                        <p className="text-[13px] text-ink">
                            <b className="text-[17px] font-medium">
                                {entries.length}
                            </b>
                            <span className="ml-1 text-[12px] text-muted">作品</span>
                            <span className="ml-2.5 text-[11.5px] text-faint">
                                新しく出したものから
                            </span>
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
                        /*
                         * 一覧。
                         *
                         * ★ 一列に潰さない。
                         *
                         *   前は題名・作者・文字数を横一列に並べていた。
                         *   狭い画面では題名が切れ、何の作品か分からない。
                         *
                         *   題名を大きく、その下に作者とあらすじ。
                         *   目が題名から入って、そのまま下へ流れる。
                         *
                         * ★ あらすじを添える。
                         *   題名だけでは選べない。
                         */
                        <ul className="mt-4 grid gap-2">
                            {entries.map((entry) => (
                                <li key={entry.work_id}>
                                    <Link
                                        href={`/novel/${entry.work_id}`}
                                        /*
                                         * ★ 地と分かれる色にする。
                                         *
                                         *   枠線だけだと、背景が同じ色なので
                                         *   一枚の紙に線が引いてあるだけに見える。
                                         *   1 件ずつの区切りが分からない。
                                         */
                                        className="block rounded-lg border border-line bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(40,35,25,.04)] hover:border-forest-line hover:bg-forest-tint/40"
                                    >
                                        <p className="text-[14.5px] font-medium leading-snug text-ink">
                                            {entry.work_title || "（題名なし）"}
                                        </p>

                                        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-muted">
                                            <span>
                                                {entry.author_name || "名もなき作者"}
                                            </span>

                                            {entry.genre && (
                                                <span className="text-faint">
                                                    {entry.genre}
                                                </span>
                                            )}

                                            {entry.char_count > 0 && (
                                                <span className="text-faint">
                                                    {entry.char_count.toLocaleString()}字
                                                </span>
                                            )}
                                        </p>

                                        {entry.summary && (
                                            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                                                {entry.summary}
                                            </p>
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
