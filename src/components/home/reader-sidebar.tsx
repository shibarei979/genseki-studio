"use client";

/**
 * ============================================================
 * 原石航路
 * ReaderSidebar — 読者向けホームの左の柱
 *
 * 執筆向けの柱（home-side-cards）と同じ作りにしてある。
 * 枠・余白・字の大きさ・色は、そちらの組をそのまま使う。
 * 読む側と書く側で見た目が違うと、同じサイトに見えない。
 *
 * 上から、読みかけの作品、執筆室、お知らせ。
 *
 * いちばん上は読みかけ。
 * ホームに来る用のほとんどは昨日の続きなので、
 * 一押しで続きへ戻れるようにする。
 * ============================================================
 */

import Link from "next/link";

import { COVERS, hashOf } from "@/components/home/home-work-table";
import ContestBanner from "@/components/common/contest-banner";
import type { Contest } from "@/types";

export interface SidebarReading {
    novelId: string;
    episodeId: string;
    title: string;
    /** 最後に読んだ日時 */
    lastReadAt: string;
    /** 「12話目まで」 */
    episodeLabel: string;
    /** ここまで読んだ話数 */
    readCount: number;
    /** その作品の全話数 */
    totalCount: number;
}

export interface SidebarNotice {
    id: string;
    href: string;
    date: string;
    title: string;
}

export default function ReaderSidebar({
    reading,
    notices,
    contests = [],
}: {
    /** 一番最近読んでいた作品。無ければ出さない */
    reading: SidebarReading | null;
    notices: SidebarNotice[];
    /** 開催中のコンテスト。読む人にも出す */
    contests?: Contest[];
}) {
    return (
        <aside className="reader-side space-y-5 pt-3">
            {/* 読みかけの作品 */}
            {reading && (
                <div className="rounded-xl border border-line bg-surface p-3.5">
                    <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                        <RoomIcon />
                        読みかけの作品
                    </p>

                    <div className="flex gap-3">
                        {/*
                         * 小さな表紙。
                         * 棚と同じ式で色を選ぶので、柱の本と棚の本が
                         * 必ず同じ色になる。字は入れない。
                         */}
                        <span
                            className="h-14 w-10 shrink-0 rounded-[3px]"
                            style={{
                                background:
                                    COVERS[
                                        hashOf(reading.title || reading.novelId) %
                                            COVERS.length
                                    ].base,
                                boxShadow:
                                    "inset 0 0 0 1px rgba(0,0,0,0.07), inset 3px 0 0 rgba(0,0,0,0.10)",
                            }}
                            aria-hidden="true"
                        />

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-ink">
                                {reading.title || "無題"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted">
                                最後に読んだ日 {slashDate(reading.lastReadAt)}
                            </p>
                            <p className="mt-1.5 truncate text-[11px] text-ink">
                                {reading.episodeLabel}
                            </p>
                        </div>
                    </div>

                    {/*
                     * 進みの棒。
                     *
                     * 全話のうち、どこまで読んだか。
                     * 執筆側の「10,000字を物差しにした棒」と同じ形にする。
                     */}
                    {reading.totalCount > 0 && (
                        <>
                            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-canvas">
                                <div
                                    className="h-full rounded-full bg-forest"
                                    style={{
                                        width: `${Math.min(100, Math.round((reading.readCount / reading.totalCount) * 100))}%`,
                                    }}
                                />
                            </div>
                            <p className="mt-1 text-right text-[10px] tabular-nums text-muted">
                                {reading.readCount} / {reading.totalCount} 話
                            </p>
                        </>
                    )}

                    <Link
                        href={`/novel/${reading.novelId}/episode/${reading.episodeId}`}
                        className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-forest-dark px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                    >
                        <BookIcon />
                        続きを読む
                    </Link>

                    <Link
                        href="/search"
                        className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-[13px] font-medium text-ink hover:border-forest-line hover:text-forest"
                    >
                        <PlusIcon />
                        新しい作品を探す
                    </Link>
                </div>
            )}

            {/* 読みかけが無い人にも、探す入口は出す */}
            {!reading && (
                <div className="rounded-xl border border-line bg-surface p-3.5">
                    <p className="text-[13px] font-semibold text-ink">まだ読みかけがありません</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                        気になる一冊を探してみましょう。
                    </p>
                    <Link
                        href="/search"
                        className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-forest-dark px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                    >
                        <PlusIcon />
                        新しい作品を探す
                    </Link>
                </div>
            )}

            {/*
             * 執筆室への入口。
             *
             * 執筆向けの柱と同じ作り。
             * 部屋は絵で誘う。読む人でも入れる。
             */}
            <Link
                href="/rooms"
                className="relative block overflow-hidden rounded-xl border border-forest-line/60 bg-surface hover:border-forest-line"
            >
                {/*
                 * 机の絵は札いっぱいに敷く。
                 * 右寄せで切り出し、机と窓が残るようにする。
                 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/images/room-desk.webp"
                    alt=""
                    draggable={false}
                    className="absolute inset-0 h-full w-full select-none object-cover object-right"
                    aria-hidden="true"
                />
                {/* 文字の側を白く塗り、絵との境目はなだらかに透かす */}
                <span
                    className="absolute inset-0"
                    style={{
                        background:
                            "linear-gradient(90deg, #ffffff 0%, #ffffff 42%, rgba(255,255,255,0) 80%)",
                    }}
                    aria-hidden="true"
                />
                <div className="relative z-10 p-3.5 pr-24">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                        <RoomIcon />
                        執筆室に入る
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                        静かな環境で、
                        <br />
                        創作に集中しましょう。
                    </p>
                    <span className="mt-2.5 inline-flex items-center gap-1 rounded-md border border-line bg-surface px-3 py-1.5 text-[11px] text-ink">
                        執筆室へ <span aria-hidden="true">→</span>
                    </span>
                </div>
            </Link>

            {/*
             * 開催中のコンテスト。
             *
             * 読む人にも出す。
             * 応募しない人でも、どんな作品が集まるかを知る入口になる。
             */}
            <section className="rounded-xl border border-line bg-surface p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-[13px] font-semibold tracking-wide text-ink">
                        開催中のコンテスト
                    </h2>
                    <Link
                        href="/contest"
                        className="shrink-0 text-[11px] text-muted hover:text-forest"
                    >
                        すべて見る <span aria-hidden="true">›</span>
                    </Link>
                </div>

                {contests.length === 0 ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        現在開催中のコンテストはございません。
                    </p>
                ) : (
                    <ul className="mt-2.5 space-y-2.5">
                        {contests.map((contest) => (
                            <li key={contest.id}>
                                {/*
                                 * 絵は執筆側と同じ部品で出す。
                                 * 保存先から読み直す仕組みが要るので、
                                 * URL を直に img へ渡しても出ないことがある。
                                 */}
                                <Link
                                    href={`/contest/${contest.id}`}
                                    title={contest.title || "コンテスト"}
                                    /*
                                     * 絵は小さめに。
                                     *
                                     * 読む人の柱では、コンテストは主役ではない。
                                     * 上の読みかけと下のお知らせに挟まれるので、
                                     * 大きいと柱の真ん中だけが騒がしくなる。
                                     */
                                    className="group/card relative mx-auto block w-[150px] max-w-full overflow-hidden rounded-lg border border-line"
                                >
                                    <span className="block aspect-video">
                                        <ContestBanner
                                            contest={contest}
                                            className="h-full w-full"
                                        />
                                    </span>
                                    <span
                                        className="absolute inset-0 bg-[rgba(20,56,78,0.28)] opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* お知らせ */}
            <section className="rounded-xl border border-line bg-surface p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-[13px] font-semibold tracking-wide text-ink">
                        お知らせ
                    </h2>
                    <Link
                        href="/announcements"
                        className="shrink-0 text-[11px] text-muted hover:text-forest"
                    >
                        すべて見る <span aria-hidden="true">›</span>
                    </Link>
                </div>

                {notices.length === 0 ? (
                    <p className="mt-2.5 text-[11px] text-faint">
                        まだお知らせはありません。
                    </p>
                ) : (
                    <ul className="mt-2 divide-y divide-line">
                        {notices.map((notice) => (
                            <li key={notice.id}>
                                <Link
                                    href={notice.href}
                                    className="flex items-baseline gap-2.5 py-2 hover:text-forest"
                                >
                                    <span className="shrink-0 text-[10px] text-faint">
                                        {notice.date}
                                    </span>
                                    <span className="min-w-0 truncate text-[11px] text-ink">
                                        {notice.title}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </aside>
    );
}

/** 日付を「2026/08/19」の形に */
function slashDate(value: string): string {
    return value.slice(0, 10).replace(/-/g, "/");
}

function PlusIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
        </svg>
    );
}

function RoomIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M3 10.5 12 4l9 6.5" />
            <path d="M5 10v9h14v-9" />
        </svg>
    );
}

function BookIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
    );
}
