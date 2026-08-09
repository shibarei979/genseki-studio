/**
 * ============================================================
 * 原石航路 Studio
 * ContestEntryClient — コンテストに応募する
 *
 * 詳細のページから分けた。
 *
 * 詳細は「読むもの」、ここは「出すもの」。
 * 同じ画面に混ぜると、読んでいる途中に
 * 出すボタンが目に入り、落ち着かない。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { getRepository } from "@/lib/repository";
import { formatNumber } from "@/lib/utils/text";
import type { Contest, ContestEntry, WorkWithStats } from "@/types";
import { tileOf } from "@/types";

const C = {
    navy: "#1e3a5f",
    teal: "#2b7e91",
    tealDark: "#236a7b",
    tint: "#eef3f7",
    line: "#d8e2ec",
    body: "#44566b",
    dim: "#7d8fa3",
};

export default function ContestEntryClient({
    contestId,
}: {
    contestId: string;
}) {
    const router = useRouter();

    const [contest, setContest] = useState<Contest | null>(null);
    const [works, setWorks] = useState<WorkWithStats[]>([]);
    const [entries, setEntries] = useState<ContestEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    /* 選んだ作品 */
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isAgreed, setIsAgreed] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const repository = getRepository();

        const [found, workList, entryList] = await Promise.all([
            repository.getContest(contestId),
            repository.listWorks(),
            repository.listContestEntries(contestId),
        ]);

        setContest(found);
        setWorks(workList);
        setEntries(entryList);
        setIsLoading(false);
    }, [contestId]);

    useEffect(() => {
        void load();
    }, [load]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white">
                <Header />
                <p className="py-24 text-center text-sm text-faint">
                    読み込んでいます
                </p>
            </div>
        );
    }

    if (!contest) {
        return (
            <div className="min-h-screen bg-white">
                <Header />
                <p className="py-24 text-center text-sm text-faint">
                    このコンテストは見つかりませんでした。
                </p>
                <Footer />
            </div>
        );
    }

    const entered = new Set(entries.map((row) => row.work_id));

    /* 出せる数の残り */
    const rest =
        contest.entry_limit === 0
            ? null
            : Math.max(0, contest.entry_limit - entries.length);

    /*
     * 出せる作品。
     *
     * すでに出したものは選べない。
     * 字数が足りないものも選べないが、一覧には出す。
     * 「なぜ出せないか」が分からないと直しようがない。
     */
    const candidates = works.map((work) => {
        const isEntered = entered.has(work.id);
        const isShort =
            contest.min_chars > 0 && work.total_char_count < contest.min_chars;

        return {
            work,
            isEntered,
            isShort,
            canPick: !isEntered && !isShort,
        };
    });

    const selected = candidates.find((row) => row.work.id === selectedId);

    async function submit() {
        if (!selected || isSending) return;

        setIsSending(true);
        setError("");

        try {
            await getRepository().createContestEntry(contestId, {
                work_id: selected.work.id,
                work_title: selected.work.title,
                author_id: "",
                author_name: "",
                char_count: selected.work.total_char_count,
                is_shortlisted: false,
                is_awarded: false,
                award_label: "",
                note: "",
            });

            router.push(`/contest/${contestId}?entered=1`);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "応募できませんでした。時間をおいて試してください。",
            );
            setIsSending(false);
        }
    }

    return (
        <div className="min-h-screen bg-white pb-20">
            <Header
                breadcrumbs={[
                    { label: "コンテスト", href: "/contest" },
                    { label: contest.title, href: `/contest/${contestId}` },
                    { label: "応募する" },
                ]}
            />

            <main className="mx-auto max-w-3xl px-6 py-9 sm:px-8">
                <h1
                    className="text-[20px] font-semibold"
                    style={{ color: C.navy }}
                >
                    応募する
                </h1>
                <p className="mt-1.5 text-[13px]" style={{ color: C.body }}>
                    {contest.title}
                </p>

                {rest !== null && (
                    <p className="mt-3 text-[12px]" style={{ color: C.dim }}>
                        あと {rest} 作品出せます
                    </p>
                )}

                {/* 作品を選ぶ */}
                <section className="mt-8">
                    <h2
                        className="text-[14px] font-medium"
                        style={{ color: C.navy }}
                    >
                        1. 作品を選ぶ
                    </h2>

                    {candidates.length === 0 ? (
                        <p
                            className="mt-3 rounded-xl border border-dashed py-14 text-center text-[13px]"
                            style={{ borderColor: C.line, color: C.dim }}
                        >
                            出せる作品がありません。
                            <br />
                            <Link
                                href="/post"
                                className="mt-2 inline-block"
                                style={{ color: C.teal }}
                            >
                                作品を書く →
                            </Link>
                        </p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {candidates.map(
                                ({ work, isEntered, isShort, canPick }) => {
                                    const tile = tileOf(work);
                                    const isPicked = selectedId === work.id;

                                    return (
                                        <li key={work.id}>
                                            <label
                                                className={[
                                                    "flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3.5",
                                                    canPick
                                                        ? "hover:bg-[#f7fafc]"
                                                        : "cursor-not-allowed opacity-55",
                                                ].join(" ")}
                                                style={{
                                                    borderColor: isPicked
                                                        ? C.teal
                                                        : C.line,
                                                    background: isPicked
                                                        ? C.tint
                                                        : undefined,
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="entry-work"
                                                    disabled={!canPick}
                                                    checked={isPicked}
                                                    onChange={() =>
                                                        setSelectedId(work.id)
                                                    }
                                                    className="sr-only"
                                                />

                                                <span
                                                    className="flex h-14 w-11 shrink-0 items-center justify-center rounded"
                                                    style={{ background: tile.bg }}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={tile.src}
                                                        alt=""
                                                        className="h-5 w-5 object-contain"
                                                    />
                                                </span>

                                                <span className="min-w-0 flex-1">
                                                    <span
                                                        className="block truncate text-[14px]"
                                                        style={{ color: C.navy }}
                                                    >
                                                        {work.title ||
                                                            "名前のない作品"}
                                                    </span>

                                                    <span
                                                        className="mt-0.5 block text-[11px]"
                                                        style={{ color: C.dim }}
                                                    >
                                                        {formatNumber(
                                                            work.total_char_count,
                                                        )}
                                                        字
                                                        {isEntered &&
                                                            " ・ 応募済み"}
                                                        {isShort &&
                                                            ` ・ ${formatNumber(contest.min_chars)}字以上が必要`}
                                                    </span>
                                                </span>

                                                {isPicked && (
                                                    <span
                                                        className="shrink-0 text-[18px]"
                                                        style={{ color: C.teal }}
                                                        aria-hidden="true"
                                                    >
                                                        ✓
                                                    </span>
                                                )}
                                            </label>
                                        </li>
                                    );
                                },
                            )}
                        </ul>
                    )}
                </section>

                {/* 確かめる */}
                <section className="mt-9">
                    <h2
                        className="text-[14px] font-medium"
                        style={{ color: C.navy }}
                    >
                        2. 確かめる
                    </h2>

                    <div
                        className="mt-3 overflow-hidden rounded-xl border"
                        style={{ borderColor: C.line }}
                    >
                        <Row label="コンテスト" value={contest.title} />
                        <Row
                            label="応募する作品"
                            value={selected?.work.title ?? "まだ選んでいません"}
                        />
                        <Row
                            label="締切"
                            value={formatWhen(contest.ends_at)}
                        />
                    </div>

                    {contest.terms && (
                        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
                            <input
                                type="checkbox"
                                name="agree-terms"
                                checked={isAgreed}
                                onChange={(e) => setIsAgreed(e.target.checked)}
                                className="mt-0.5 accent-[#2b7e91]"
                            />
                            <span
                                className="text-[12px] leading-relaxed"
                                style={{ color: C.body }}
                            >
                                <Link
                                    href={`/contest/${contestId}#terms`}
                                    className="underline"
                                    style={{ color: C.teal }}
                                >
                                    応募規約
                                </Link>
                                を読み、同意します。
                            </span>
                        </label>
                    )}
                </section>

                {error && (
                    <p className="mt-5 rounded-lg bg-[#fef2f2] px-4 py-3 text-[12px] text-[#dc2626]">
                        {error}
                    </p>
                )}

                {/* 出す */}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={
                            !selected ||
                            isSending ||
                            (Boolean(contest.terms) && !isAgreed) ||
                            (rest !== null && rest === 0)
                        }
                        className="rounded-lg px-8 py-3 text-[13px] font-medium text-white disabled:opacity-40"
                        style={{ background: C.teal }}
                    >
                        {isSending ? "送っています…" : "この作品で応募する"}
                    </button>

                    <Link
                        href={`/contest/${contestId}`}
                        className="text-[12px]"
                        style={{ color: C.dim }}
                    >
                        やめる
                    </Link>
                </div>

                {rest !== null && rest === 0 && (
                    <p className="mt-3 text-[12px]" style={{ color: C.dim }}>
                        出せる数に達しています。
                    </p>
                )}
            </main>

            <Footer />
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div
            className="flex gap-4 border-b px-4 py-3 last:border-b-0"
            style={{ borderColor: C.line }}
        >
            <span
                className="w-28 shrink-0 text-[12px]"
                style={{ color: C.dim }}
            >
                {label}
            </span>
            <span className="min-w-0 flex-1 text-[12px]" style={{ color: C.navy }}>
                {value}
            </span>
        </div>
    );
}

/** 「2026年8月17日（月）20:00」 */
function formatWhen(text: string): string {
    if (!text) return "—";

    const at = new Date(text.includes("T") ? text : `${text}T00:00:00`);
    if (Number.isNaN(at.getTime())) return text;

    const week = ["日", "月", "火", "水", "木", "金", "土"][at.getDay()];
    const pad = (n: number) => String(n).padStart(2, "0");

    const day = `${at.getFullYear()}年${at.getMonth() + 1}月${at.getDate()}日（${week}）`;

    /* 0 時ちょうどなら時刻を出さない。決めていないのと区別がつかない */
    if (at.getHours() === 0 && at.getMinutes() === 0) return day;

    return `${day} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
