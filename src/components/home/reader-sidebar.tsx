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

export interface SidebarReading {
    novelId: string;
    episodeId: string;
    title: string;
    updatedAt: string;
    episodeLabel: string;
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
}: {
    /** 一番最近読んでいた作品。無ければ出さない */
    reading: SidebarReading | null;
    notices: SidebarNotice[];
}) {
    return (
        <aside className="reader-side space-y-5 pt-3">
            {/* 読みかけの作品 */}
            {reading && (
                <div className="rounded-xl border border-line bg-surface p-3.5">
                    {/* 見出し。執筆向けの「執筆中の作品」と同じ位置 */}
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
                            <p className="mt-1 truncate text-[11px] text-muted">
                                {reading.episodeLabel}
                            </p>
                        </div>
                    </div>

                    <Link
                        href={`/novel/${reading.novelId}/episode/${reading.episodeId}`}
                        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-forest py-2 text-[12px] font-medium text-white hover:bg-forest-dark"
                    >
                        <BookIcon />
                        続きを読む
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
