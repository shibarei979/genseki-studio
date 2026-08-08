/**
 * ============================================================
 * 原石航路 Studio
 * HomeSideCards — ホームの左の柱
 *
 * 上から書きはじめる入口、コンテスト、お知らせ。
 *
 * ロゴはヘッダーに戻した。
 * ヘッダーを端から端まで通したので、柱の上にもう一度置くと
 * 同じものが二段になって見える。
 *
 * 執筆室はここから外した。
 * 部屋は絵を見て選ぶものなので、右の広いところへ移した。
 * ここに残すのは「文字だけで足りるもの」に限る。
 * ============================================================
 */

"use client";

import Link from "next/link";

import BannerStrip from "@/components/common/banner-strip";
import ContestBanner from "@/components/common/contest-banner";
import { compareDate } from "@/types";
import type { Contest } from "@/types";

/** ホームで出すお知らせ。運営のものと組み込みのものを同じ形にして受ける */
export interface SideNotice {
    id: string;
    /** YYYY-MM-DD または YYYY/MM/DD */
    date: string;
    label: string;
    link?: string;
}

interface Props {
    /** 開催中のコンテスト。準備中のものは渡さない */
    contests: Contest[];
    /** 新しい順に並んだお知らせ */
    notices: SideNotice[];
    /** 続きを書ける作品。無ければ「続きを書く」は出さない */
    latestWorkId: string | null;
}

/** 「2026-07-18」も「2026/07/18」も「07/18」にする */
function shortDate(value: string): string {
    const parts = value.slice(0, 10).split(/[-/]/);
    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : value;
}

/** 締切の見せ方。点で区切ると日付として読みやすい */
function dotDate(value: string | null | undefined): string {
    if (!value) return "未定";
    return value.slice(0, 10).replace(/-/g, ".");
}

export default function HomeSideCards({ contests, notices, latestWorkId }: Props) {
    // 締切が近いものを先に出す
    const contest = [...contests].sort((a, b) =>
        compareDate(a.ends_at, b.ends_at),
    )[0];

    return (
        <div className="space-y-5">
            {/*
             * 書きはじめる入口。
             *
             * 新しく作るほうを濃く、続きを書くほうを白抜きにする。
             * 二つとも濃くすると、どちらを押すか一瞬迷う。
             * 続きが無い人には二つ目を出さない。押せない入口は要らない。
             */}
            <div className="space-y-2">
                <Link
                    href="/post"
                    className="flex items-center justify-center gap-2 rounded-lg bg-forest-dark px-4 py-3 text-sm font-medium text-white hover:opacity-90"
                >
                    <PenIcon />
                    作品を描く
                </Link>

                {latestWorkId && (
                    <Link
                        href={`/workspace/${latestWorkId}`}
                        className="flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:border-forest-line hover:text-forest"
                    >
                        <BookIcon />
                        作品の続きを書く
                    </Link>
                )}
            </div>

            {/* コンテスト */}
            <section>
                <SectionHead title="コンテスト" href="/contest" />

                {!contest ? (
                    <p className="mt-2.5 rounded-xl border border-line bg-surface px-4 py-4 text-[11px] leading-relaxed text-muted">
                        現在開催中のコンテストはございません。
                        <br />
                        開始しましたら通知にてお知らせいたします。
                    </p>
                ) : (
                    <Link
                        href={`/contest/${contest.id}`}
                        className="relative mt-3 block overflow-hidden rounded-xl bg-forest-dark hover:opacity-95"
                    >
                        {contest.banner_url && (
                            <ContestBanner
                                contest={contest}
                                className="absolute inset-0 h-full w-full"
                            />
                        )}
                        {/*
                         * 絵の上に文字を置くので、必ず暗く伏せる。
                         * 絵が無いときも同じ濃さになるよう、地色を濃紺にしてある。
                         */}
                        <span
                            className="absolute inset-0"
                            style={{
                                background:
                                    "linear-gradient(180deg, rgba(20,56,78,0.82) 0%, rgba(20,56,78,0.92) 100%)",
                            }}
                            aria-hidden="true"
                        />

                        <span className="relative block px-4 py-4">
                            <span className="block text-[15px] font-semibold leading-snug text-white">
                                {contest.title || "名前のないコンテスト"}
                            </span>
                            {contest.catchphrase && (
                                <span className="mt-1.5 block text-[11px] leading-relaxed text-white/75">
                                    {contest.catchphrase}
                                </span>
                            )}
                            <span className="mt-3 block text-[11px] text-white/70">
                                応募締切：{dotDate(contest.ends_at)}
                            </span>
                            <span className="mt-4 inline-block rounded-md border border-white/45 px-3.5 py-1.5 text-[11px] text-white">
                                詳細を見る
                            </span>
                        </span>
                    </Link>
                )}
            </section>

            {/* お知らせ */}
            <section>
                <SectionHead title="お知らせ" href="/notices" />

                <div className="mt-2.5 rounded-xl border border-line bg-surface px-4 py-3.5">
                    {notices.length === 0 ? (
                        <p className="py-2 text-xs leading-relaxed text-muted">
                            まだお知らせはありません。
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {notices.slice(0, 4).map((notice) => {
                                const inner = (
                                    <>
                                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                                        <span className="shrink-0 text-[11px] tabular-nums text-faint">
                                            {shortDate(notice.date)}
                                        </span>
                                        <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink">
                                            {notice.label}
                                        </span>
                                    </>
                                );

                                return (
                                    <li key={notice.id}>
                                        {notice.link ? (
                                            <Link
                                                href={notice.link}
                                                className="flex gap-2.5 hover:text-forest"
                                            >
                                                {inner}
                                            </Link>
                                        ) : (
                                            <span className="flex gap-2.5">{inner}</span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </section>

            {/* 運営が出す帯。無ければ何も出ない */}
            <BannerStrip place="home-side" />
        </div>
    );
}

/**
 * 節の見出し。
 * 左に題、右に「すべて見る」。
 * 同じ形をホームの中で繰り返し、どこが節の切れ目か分かるようにする。
 */
function SectionHead({ title, href }: { title: string; href: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-wide text-ink">{title}</h2>
            <Link
                href={href}
                className="shrink-0 text-[11px] text-muted hover:text-forest"
            >
                すべて見る <span aria-hidden="true">›</span>
            </Link>
        </div>
    );
}

function BookIcon() {
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
            <path d="M13.5 3.5H6.5A2 2 0 0 0 4.5 5.5v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9.5Z" />
            <path d="M13.5 3.5v6h6" />
        </svg>
    );
}

function PenIcon() {
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
            <path d="M4.5 19.5h3.6L19.4 8.2a2.6 2.6 0 0 0-3.6-3.6L4.5 15.9Z" />
            <path d="m14.6 5.8 3.6 3.6" />
        </svg>
    );
}
