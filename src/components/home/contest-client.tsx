/**
 * ============================================================
 * 原石航路 Studio
 * ContestClient — コンテスト
 *
 * 立っているコンテストを並べる。
 * 上に横長の画像、下に題名・締切・説明。
 *
 * 準備中のものは出さない。
 * 運営の入口も出さない。書き手が使う画面なので。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import BannerStrip from "@/components/common/banner-strip";
import ContestBanner from "@/components/common/contest-banner";
import Header from "@/components/layout/header";
import { getRepository } from "@/lib/repository";
import {
    compareDate,
    daysUntil,
    statusColor,
    statusLabel,
} from "@/types";
import type { Contest } from "@/types";

export default function ContestClient() {
    const [contests, setContests] = useState<Contest[] | null>(null);

    useEffect(() => {
        void (async () => {
            const rows = await getRepository().listContests();
            setContests(rows.filter((row) => row.status !== "draft"));
        })();
    }, []);

    /*
     * 募集中を先に、終わったものを後ろへ。
     * 出せるものが上にあると、探さずに済む。
     */
    const sorted = (contests ?? []).sort((a, b) => {
        const rank = (row: Contest) => (row.status === "open" ? 0 : row.status === "judging" ? 1 : 2);
        /* 状態の組の中では、運営の決めた順 → 締切の近い順 */
        return (
            rank(a) - rank(b) ||
            (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) ||
            compareDate(a.ends_at, b.ends_at)
        );
    });

    return (
        <div className="min-h-screen bg-page">
            <Header breadcrumbs={[{ label: "コンテスト" }]} />

            <main className="px-8 py-7 sm:px-12">
                <BannerStrip place="contest-top" className="mb-5" limit={2} />

                <h1 className="text-xl font-semibold tracking-wide text-ink">
                    コンテスト
                    {sorted.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-muted">
                            {sorted.length}
                        </span>
                    )}
                </h1>

                {/* 状態ごとの数。色で今どこかが分かる */}
                {sorted.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {(["open", "judging", "closed"] as const).map((key) => {
                            const count = sorted.filter(
                                (row) => row.status === key,
                            ).length;
                            if (count === 0) return null;

                            const tone = statusColor(key);
                            return (
                                <li
                                    key={key}
                                    className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px]"
                                    style={{
                                        background: tone.bg,
                                        color: tone.text,
                                        borderColor: tone.border,
                                    }}
                                >
                                    <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{ background: tone.chip }}
                                    />
                                    {statusLabel(key)}
                                    <span className="font-semibold">{count}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {contests === null ? (
                    <p className="py-20 text-center text-sm text-faint">
                        読み込んでいます
                    </p>
                ) : sorted.length === 0 ? (
                    <EmptyState />
                ) : (
                    <ul className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                        {sorted.map((contest) => (
                            <li key={contest.id}>
                                <ContestCard contest={contest} />
                            </li>
                        ))}
                    </ul>
                )}

                {/*
                 * 自主企画。
                 *
                 * 運営のコンテストの下に置く。
                 * 賞のあるものと無いものを、上下で分ける。
                 * ここに来る人は「参加できるもの」を探しているので、
                 * 同じ場所にあったほうが見つかる。
                 */}
                {/*
                 * 自主企画は、この画面では出さない。
                 *
                 * コンテストは書く側の道になったので、
                 * 読む人はここへ来ない。
                 * 企画は /projects に置いてある。
                 */}
            </main>
        </div>
    );
}

/**
 * ============================================================
 * 一枚ぶん
 *
 * 画像の左上に募集の状態を重ねる。
 * 一覧を眺めたとき、出せるかどうかが最初に目に入る。
 * ============================================================
 */

function ContestCard({ contest }: { contest: Contest }) {
    const remaining = daysUntil(contest.ends_at);
    const isOpen = contest.status === "open";
    const tone = statusColor(contest.status);

    return (
        <Link
            href={`/contest/${contest.id}`}
            className="flex h-full flex-col overflow-hidden rounded-xl bg-surface shadow-sm transition-shadow hover:shadow-md"
            style={{
                /*
                 * 状態の色を枠にも回す。
                 * 札だけだと小さすぎて、一覧を眺めたとき色が目に入らない。
                 */
                borderTop: `3px solid ${tone.chip}`,
            }}
        >
            {/* 画像 */}
            <div className="relative">
                <ContestBanner
                    contest={contest}
                    className="aspect-[21/9] w-full sm:aspect-video"
                    fallback="画像なし"
                />

                <span
                    className="absolute left-0 top-0 px-2.5 py-1 text-[11px] font-medium text-white"
                    style={{ background: tone.chip }}
                >
                    {statusLabel(contest.status)}
                </span>
            </div>

            {/* 中身 */}
            <div className="flex flex-1 flex-col px-3.5 py-3 sm:px-4 sm:py-3.5">
                <h2 className="text-[15px] font-semibold leading-snug text-ink">
                    {contest.title || "名前のないコンテスト"}
                </h2>

                {contest.catchphrase && (
                    <p className="mt-2 text-xs text-muted">{contest.catchphrase}</p>
                )}

                {/*
                 * 締切。色は付けない。
                 * 状態は上の帯と札で分かるので、ここまで色を回すと
                 * どこを見ればよいのか分からなくなる。
                 */}
                <p className="mt-2 text-xs text-muted">
                    締切：{formatDate(contest.ends_at)}
                    {isOpen && remaining >= 0 && (
                        <span className="ml-2 text-faint">あと{remaining}日</span>
                    )}
                </p>

                {/*
                 * 説明と賞は出さない。
                 *
                 * 一覧は「どれを開くか」を選ぶ場。
                 * 題名・ひとこと・締切があれば足りる。
                 * 中身は開いた先で読める。
                 */}
            </div>
        </Link>
    );
}

/** 「2026/08/31（月）」の形にする */
function formatDate(text: string): string {
    /* 時刻まで決めてあれば、そのまま読む */
    const date = new Date(text.includes("T") ? text : `${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) return text;

    /*
     * 日付だけを出す。
     *
     * text をそのまま使うと、時刻まで入っているとき
     * 「2026/08/21T09:00（金）」と生の形が出てしまう。
     * 読んだ日付から組み直す。
     */
    const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    const ymd = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
    return `${ymd}（${week}）`;
}

function EmptyState() {
    return (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <p className="text-sm text-ink">開催中のコンテストはありません</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">
                いまは自分の記録を見る場所として使えます。
                書いた量と続いた日数が残っていれば、
                コンテストが始まったときの手がかりになります。
            </p>

            <div className="mx-auto mt-6 grid max-w-lg gap-3 sm:grid-cols-2">
                <Link
                    href="/mypage"
                    className="rounded-xl border border-line px-5 py-4 text-left hover:border-forest-line"
                >
                    <span className="block text-sm text-ink">執筆の記録</span>
                    <span className="mt-1 block text-xs text-muted">
                        書いた量と続いた日数を見る
                    </span>
                </Link>
                <Link
                    href="/rooms"
                    className="rounded-xl border border-line px-5 py-4 text-left hover:border-forest-line"
                >
                    <span className="block text-sm text-ink">執筆室</span>
                    <span className="mt-1 block text-xs text-muted">
                        誰かがいる空間で書く
                    </span>
                </Link>
            </div>
        </div>
    );
}
