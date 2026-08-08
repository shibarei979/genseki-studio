/**
 * ============================================================
 * 原石航路 Studio
 * HomeFooterCards — 執筆室の状況と、最近の進捗
 * ============================================================
 */

"use client";

import Link from "next/link";

import { formatNumber } from "@/lib/utils/text";
import type { WorkWithStats, WritingLog } from "@/types";
import { todayKey } from "@/types";

/** 目標が決まっていないときの当てはめ。切りのいい値まで */
function guessGoal(chars: number): number {
    if (chars < 2000) return 2000;
    if (chars < 5000) return 5000;
    if (chars < 10000) return 10000;
    return Math.ceil(chars / 10000) * 10000;
}

interface Props {
    works: WorkWithStats[];
    logs: WritingLog[];
}

export default function HomeFooterCards({ works, logs }: Props) {
    const today = todayKey();
    const writtenToday = logs
        .filter((log) => log.date === today && log.delta > 0)
        .reduce((sum, log) => sum + log.delta, 0);

    const recent = [...works]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 3);

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* 執筆室 */}
            <section className="relative overflow-hidden rounded-xl border border-line bg-surface">
                <div
                    className="absolute inset-0 bg-cover bg-right bg-no-repeat"
                    style={{ backgroundImage: "url('/images/room-desk.webp')" }}
                    aria-hidden="true"
                />
                {/* 文字側を白く伏せる */}
                <div
                    className="absolute inset-0 bg-gradient-to-r from-[var(--color-surface)] from-25% via-[var(--color-surface)]/80 via-50% to-transparent"
                    aria-hidden="true"
                />

                <div className="relative px-6 py-7">
                    <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                        <HouseIcon />
                        執筆室の状況
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                        {writtenToday > 0 ? (
                            <>
                                今日はすでに{formatNumber(writtenToday)}文字書いています。
                                <br />
                                続けて書くなら、静かな部屋が使えます。
                            </>
                        ) : (
                            <>
                                現在、静かな執筆室です。
                                <br />
                                集中して物語と向き合う環境を整えましょう。
                            </>
                        )}
                    </p>

                    <Link
                        href="/rooms"
                        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink hover:border-forest-line hover:text-forest"
                    >
                        <DoorIcon />
                        静かな執筆室へ
                    </Link>
                </div>
            </section>

            {/* 進捗 */}
            <section className="rounded-xl border border-line bg-surface px-6 py-5">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                    <TrendIcon />
                    最近の進捗
                </h2>

                {recent.length === 0 ? (
                    <p className="py-8 text-center text-xs text-faint">
                        作品を作ると、ここに進み具合が出ます。
                    </p>
                ) : (
                    <ul className="mt-4 space-y-3.5">
                        {recent.map((work) => {
                            const goal = guessGoal(work.total_char_count);
                            const ratio = Math.min(1, work.total_char_count / goal);

                            return (
                                <li key={work.id}>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <Link
                                            href={`/workspace/${work.id}`}
                                            className="min-w-0 truncate text-xs text-ink hover:text-forest"
                                        >
                                            {work.title}
                                        </Link>
                                        <span className="shrink-0 text-[11px] text-muted">
                                            {formatNumber(work.total_char_count)} / 目標{" "}
                                            {formatNumber(goal)} 文字
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                                        <div
                                            className="h-full rounded-full bg-forest transition-all"
                                            style={{ width: `${Math.round(ratio * 100)}%` }}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <p className="mt-4 text-[10px] leading-relaxed text-faint">
                    目標は文字数から当てはめています。作品ごとの目標は、
                    設定の「執筆の記録」で決められます。
                </p>
            </section>
        </div>
    );
}

function HouseIcon() {
    return (
        <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M3.5 10.8 12 3.8l8.5 7v8.4a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8Z" />
            <path d="M9.5 20.5v-6h5v6" />
        </svg>
    );
}

function DoorIcon() {
    return (
        <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M6.5 20.5V4.5a1.2 1.2 0 0 1 1.2-1.2h8.6a1.2 1.2 0 0 1 1.2 1.2v16" />
            <path d="M4 20.5h16" />
            <circle cx="14.2" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
    );
}

function TrendIcon() {
    return (
        <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m3.5 16.5 5-5.5 4 4 6.5-8" />
            <path d="M14.5 6.5h5v5" />
        </svg>
    );
}
