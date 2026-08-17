/**
 * ============================================================
 * 原石航路 Studio
 * HomeSideCards — ホームの左の柱
 *
 * 上から、つづきから書く、執筆室、コンテスト、お知らせ。
 *
 * いちばん上は「つづきから書く」。
 * ホームに来る用のほとんどは昨日の続きなので、
 * いま書いている作品と進み具合を柱の頭に出し、
 * 一押しで机に戻れるようにする。
 *
 * コンテストの絵はここでは出さない。
 * 絵は右の流れる帯に移した。柱は文字だけで済ませ、
 * 同じ絵が 2 か所に出ないようにする。運営の帯も同じ。
 * ============================================================
 */

"use client";

import Link from "next/link";

import { compareDate } from "@/types";
import type { Contest, Episode, WorkWithStats } from "@/types";
import { formatNumber } from "@/lib/utils/text";
import { COVERS, hashOf } from "@/components/home/home-work-table";
import ContestBanner from "@/components/common/contest-banner";

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
    /** 自分の作品。つづきから書く札に使う */
    works: WorkWithStats[];
    /** 全作品の話。いちばん新しい話の進みを出すのに使う */
    episodes: Episode[];
}

/**
 * 1 話の目安の字数。
 *
 * 進みの棒を出すための物差しで、締切でも上限でもない。
 * Web 小説の 1 話としてよく区切られる長さに合わせた。
 */
const EPISODE_GOAL_CHARS = 10000;

/** 「2026-07-18」も「2026/07/18」も「07/18」にする */
function shortDate(value: string): string {
    const parts = value.slice(0, 10).split(/[-/]/);
    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : value;
}

/** 更新日の見せ方。斜線で区切る */
function slashDate(value: string): string {
    return value.slice(0, 10).replace(/-/g, "/");
}


export default function HomeSideCards({ contests, notices, works, episodes }: Props) {
    // いちばん最近さわった作品
    const latest = [...works].sort((a, b) =>
        compareDate(b.updated_at, a.updated_at),
    )[0];

    // その作品のいちばん新しい話
    const latestEpisode = latest
        ? [...episodes]
              .filter((episode) => episode.work_id === latest.id)
              .sort((a, b) => b.ep_number - a.ep_number)[0]
        : undefined;

    const progress = latestEpisode
        ? Math.min(1, latestEpisode.char_count / EPISODE_GOAL_CHARS)
        : 0;

    /*
     * 並べ直さない。運営が決めた順（listContests の順）の
     * 先頭 2 つを出す。柱に何を出すかは運営が並びで決められる。
     */
    const shownContests = contests.slice(0, 2);

    return (
        // pt-3: 柱の頭を少し下げ、右の並びと目の高さを揃える
        <div className="space-y-5 pt-3">
            {/* つづきから書く。見出しは置かない。札を見れば分かる */}
            <section>
                <div className="rounded-xl border border-line bg-surface p-3.5">
                    {latest && (
                        <>
                            <div className="flex gap-3">
                                {/*
                                 * 小さな表紙。
                                 * 棚と同じ式で色を選ぶので、柱の本と棚の本が
                                 * 必ず同じ色になる。字は入れない。
                                 * この大きさに入れても読めず、汚れて見える。
                                 */}
                                <span
                                    className="h-14 w-10 shrink-0 rounded-[3px]"
                                    style={{
                                        background:
                                            COVERS[
                                                hashOf(latest.title || latest.id) %
                                                    COVERS.length
                                            ].base,
                                        boxShadow:
                                            "inset 0 0 0 1px rgba(0,0,0,0.07), inset 3px 0 0 rgba(0,0,0,0.10)",
                                    }}
                                    aria-hidden="true"
                                />

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-semibold text-ink">
                                        {latest.title || "無題"}
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-muted">
                                        {latest.visibility === "public"
                                            ? "公開中"
                                            : latest.visibility === "limited"
                                              ? "限定公開"
                                              : "下書き"}
                                        ・更新 {slashDate(latest.updated_at)}
                                    </p>
                                    {latestEpisode && (
                                        <p className="mt-1.5 truncate text-[11px] text-ink">

                                            {latestEpisode.title || "無題"}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {latestEpisode && (
                                <>
                                    {/* 進みの棒。10,000 字を物差しにした目安 */}
                                    <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-canvas">
                                        <div
                                            className="h-full rounded-full bg-forest"
                                            style={{ width: `${progress * 100}%` }}
                                        />
                                    </div>
                                    <p className="mt-1 text-right text-[10px] tabular-nums text-muted">
                                        {formatNumber(latestEpisode.char_count)} /{" "}
                                        {formatNumber(EPISODE_GOAL_CHARS)} 文字
                                    </p>
                                </>
                            )}

                            <Link
                                href={`/workspace/${latest.id}`}
                                className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-forest-dark px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                            >
                                <PenIcon />
                                執筆をつづける
                            </Link>
                        </>
                    )}

                    <Link
                        href="/post"
                        className={[
                            "flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-[13px] font-medium text-ink hover:border-forest-line hover:text-forest",
                            latest ? "mt-2" : "",
                        ].join(" ")}
                    >
                        <PlusIcon />
                        新しい作品を書く
                    </Link>
                </div>
            </section>

            {/*
             * 執筆室への入口。
             *
             * 部屋は絵で誘う。文字の一覧はコミュニティー側にある。
             */}
            <Link
                href="/rooms"
                className="relative block overflow-hidden rounded-xl border border-forest-line/60 bg-surface hover:border-forest-line"
            >
                {/*
                 * 机の絵は札いっぱいに敷く。
                 * 収めようとするから余りが出る。地にしてしまえば余りは無い。
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
                {/*
                 * 白のかぶせ。
                 * 文字の側を白く塗り、絵との境目はなだらかに透かす。
                 * 端をくっきり切ると、絵を白い紙で隠したように見える。
                 */}
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
                        静かな部屋で、
                        <br />
                        誰かと一緒に書く
                    </p>
                    <span className="mt-2.5 inline-flex items-center gap-1 rounded-md border border-line bg-surface px-3 py-1.5 text-[11px] text-ink">
                        執筆室へ <span aria-hidden="true">→</span>
                    </span>
                </div>
            </Link>

            {/*
             * コンテストとお知らせ。
             *
             * もらった絵のとおり、2 つで 1 枚の白い札にまとめる。
             * 見出しは札の中に置く。絵はここには出さない。
             * 絵は右の流れる帯にある。
             */}
            <section className="rounded-xl border border-line bg-surface p-3.5">
                <SectionHead title="開催中のコンテスト" href="/contest" />

                {/*
                 * 絵で見せる。右の流れる帯と同じ置き方の小さい版（幅 200px）。
                 * カーソルを当てると少し暗くなり、押せるものだと分かる。
                 * 絵の無いコンテストは、締切と題の行で出す。
                 */}
                {shownContests.length === 0 ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                        現在開催中のコンテストはございません。
                        <br />
                        開始しましたら通知にてお知らせいたします。
                    </p>
                ) : (
                    <ul className="mt-2.5 space-y-2.5">
                        {shownContests.map((contest) => (
                            <li key={contest.id}>
                                {contest.banner_url ? (
                                    <Link
                                        href={`/contest/${contest.id}`}
                                        title={contest.title || "コンテスト"}
                                        className="group/card relative mx-auto block w-[200px] max-w-full overflow-hidden rounded-lg border border-line"
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
                                ) : (
                                    <Link
                                        href={`/contest/${contest.id}`}
                                        className="flex items-center gap-2.5 py-1 hover:text-forest"
                                    >
                                        <span className="shrink-0 text-[11px] tabular-nums text-faint">
                                            {shortDate(contest.ends_at)}締切
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                                            {contest.title || "名前のないコンテスト"}
                                        </span>
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-4 border-t border-line/70 pt-3.5">
                    <SectionHead title="お知らせ" href="/notices" />

                    {notices.length === 0 ? (
                        <p className="mt-2 text-xs leading-relaxed text-muted">
                            まだお知らせはありません。
                        </p>
                    ) : (
                        <ul className="mt-1.5 divide-y divide-line/70">
                            {notices.slice(0, 4).map((notice) => {
                                const inner = (
                                    <>
                                        <span className="shrink-0 text-[11px] tabular-nums text-faint">
                                            {shortDate(notice.date)}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                                            {notice.label}
                                        </span>
                                    </>
                                );

                                return (
                                    <li key={notice.id} className="py-2 last:pb-0">
                                        {notice.link ? (
                                            <Link
                                                href={notice.link}
                                                className="flex items-center gap-2.5 hover:text-forest"
                                            >
                                                {inner}
                                            </Link>
                                        ) : (
                                            <span className="flex items-center gap-2.5">
                                                {inner}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </section>

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
            <h2 className="text-[13px] font-semibold tracking-wide text-ink">{title}</h2>
            <Link
                href={href}
                className="shrink-0 text-[11px] text-muted hover:text-forest"
            >
                すべて見る <span aria-hidden="true">›</span>
            </Link>
        </div>
    );
}

function PenIcon() {
    return (
        <svg
            width="15"
            height="15"
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
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M4 21V9l8-5 8 5v12" />
            <path d="M9 21v-6h6v6" />
        </svg>
    );
}
