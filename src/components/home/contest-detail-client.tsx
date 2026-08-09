/**
 * ============================================================
 * 原石航路 Studio
 * ContestDetailClient — コンテストの詳しい説明
 *
 * 上に見出しと締切、下に本文。
 *
 * 画像は本文の幅に収める。
 * 画面いっぱいに広げると、絵が引き伸ばされて荒くなるうえ、
 * 何のコンテストかを読む前に絵だけで一画面が終わる。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ContestBanner from "@/components/common/contest-banner";
import Header from "@/components/layout/header";
import { getRepository } from "@/lib/repository";
import { formatNumber } from "@/lib/utils/text";
import {
    daysUntil,
    statusColor,
    statusLabel,
} from "@/types";
import type {
    ContestEntry, Contest, WorkWithStats } from "@/types";

export default function ContestDetailClient({ contestId }: { contestId: string }) {
    const [contest, setContest] = useState<Contest | null>(null);
    const [works, setWorks] = useState<WorkWithStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        void (async () => {
            const repository = getRepository();
            setContest(await repository.getContest(contestId));
            setWorks(await repository.listWorks());
            setIsLoading(false);
        })();
    }, [contestId]);

    /*
     * 応募の持ち物。
     *
     * Hook は早い戻りより前に置く。
     * 途中に書くと、出る回と出ない回ができて壊れる。
     */
    const [entries, setEntries] = useState<ContestEntry[]>([]);
    const [notice, setNotice] = useState("");

    useEffect(() => {
        if (!contest) return;

        void (async () => {
            setEntries(await getRepository().listContestEntries(contest.id));
        })();
    }, [contest]);

    /**
     * 作品を出す。
     *
     * 同じ作品は 2 度出せない。出せる数にも上限がある。
     */
    async function apply(workId: string, title: string) {
        if (!contest) return;

        if (entries.some((row) => row.work_id === workId)) {
            setNotice("その作品はすでに応募しています。");
            return;
        }

        if (contest.entry_limit > 0 && entries.length >= contest.entry_limit) {
            setNotice(`出せるのは${contest.entry_limit}作品までです。`);
            return;
        }

        await getRepository().createContestEntry(contest.id, {
            work_id: workId,
            work_title: title,
            author_id: "",
            author_name: "",
            char_count: 0,
            is_shortlisted: false,
            is_awarded: false,
            award_label: "",
            note: "",
        });

        setEntries(await getRepository().listContestEntries(contest.id));
        setNotice("応募しました。");
        window.setTimeout(() => setNotice(""), 3000);
    }


    if (isLoading) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header />
                <p className="py-24 text-center text-sm text-faint">読み込んでいます</p>
            </div>
        );
    }

    if (!contest || contest.status === "draft") {
        return (
            <div className="min-h-screen bg-canvas">
                <Header breadcrumbs={[{ label: "コンテスト", href: "/contest" }]} />
                <p className="py-24 text-center text-sm text-faint">
                    このコンテストは見つかりませんでした。
                </p>
            </div>
        );
    }

    const tone = statusColor(contest.status);
    const remaining = daysUntil(contest.ends_at);

    const isOpen = contest.status === "open";

    const prizes = contest.prizes ?? [];
    const checkpoints = contest.checkpoints ?? [];
    const steps = contest.steps ?? [];
    const notices = contest.notices ?? [];

    return (
        <div className="min-h-screen bg-canvas pb-16">
            <Header
                breadcrumbs={[
                    { label: "コンテスト", href: "/contest" },
                    { label: contest.title || "名前のないコンテスト" },
                ]}
            />

            {/* ---- 見出し。画像と要点を横に並べる ---- */}
            <div className="border-b border-line bg-surface">
                <div className="mx-auto grid max-w-5xl items-center gap-6 px-8 py-8 md:grid-cols-[300px_minmax(0,1fr)]">
                    {/*
                     * 絵に影を落とす。
                     * 平らに置くと、紙に刷った絵のように沈む。
                     */}
                    <div className="overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(31,78,107,0.14)]">
                        <ContestBanner
                            contest={contest}
                            className="aspect-video w-full"
                            fallback="画像なし"
                        />
                    </div>

                    <div className="min-w-0">
                        {/*
                         * 募集中の札。
                         *
                         * 絵の上に重ねると、絵柄に紛れて読めない。
                         * 題名の上に置けば、まず目に入る。
                         */}
                        <div className="mb-2 flex flex-wrap items-center gap-2.5">
                            <span
                                className="rounded-full px-3.5 py-1 text-[11px] font-medium text-white"
                                style={{ background: tone.chip }}
                            >
                                {statusLabel(contest.status)}
                            </span>

                            {contest.organizer && (
                                <span className="text-[11px] text-muted">
                                    主催：{contest.organizer}
                                </span>
                            )}
                        </div>

                        <h1 className="mt-1 text-[22px] font-semibold leading-snug text-ink">
                            {contest.title || "名前のないコンテスト"}
                        </h1>

                        {contest.catchphrase && (
                            <p className="mt-2 text-sm text-muted">
                                {contest.catchphrase}
                            </p>
                        )}

                        {/* 締切。ここが一番よく見られる */}
                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                            <div>
                                <p className="text-[11px] text-faint">応募締切</p>
                                <p className="text-sm font-medium text-ink">
                                    {formatDate(contest.ends_at)}
                                </p>
                            </div>

                            {isOpen && remaining >= 0 && (
                                <div
                                    className="rounded-lg px-4 py-1.5 text-center"
                                    style={{ background: tone.bg }}
                                >
                                    <span
                                        className="text-lg font-semibold"
                                        style={{ color: tone.text }}
                                    >
                                        {remaining}
                                    </span>
                                    <span
                                        className="ml-1 text-[11px]"
                                        style={{ color: tone.text }}
                                    >
                                        日
                                    </span>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    /* 下の「出せそうな作品」へ送る */
                                    document
                                        .getElementById("entry-works")
                                        ?.scrollIntoView({ behavior: "smooth" });
                                }}
                                disabled={!isOpen}
                                className="ml-auto rounded-lg px-6 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(31,78,107,0.25)] hover:opacity-90 disabled:opacity-45 disabled:shadow-none"
                                style={{ background: tone.chip }}
                            >
                                {isOpen ? "応募する" : "受付終了"}
                            </button>
                        </div>

                        {entries.length > 0 && (
                            <p className="mt-1.5 text-right text-[10px] text-forest">
                                {entries.length}作品を応募しています
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ---- 本文 ---- */}
            <main className="mx-auto max-w-3xl px-8 py-8">
                {contest.description && (
                    <p className="whitespace-pre-wrap text-sm leading-loose text-ink">
                        {contest.description}
                    </p>
                )}

                {/* 求めるもの */}
                {(contest.theme || contest.audience) && (
                    <Section title="募集テーマ" tone={tone.chip}>
                        {contest.theme && (
                            <p className="whitespace-pre-wrap text-sm leading-loose text-ink">
                                {contest.theme}
                            </p>
                        )}
                        {contest.audience && (
                            <p className="mt-3 inline-block rounded-full bg-canvas px-3.5 py-1 text-xs text-muted">
                                読者層　{contest.audience}
                            </p>
                        )}
                    </Section>
                )}

                {/* 賞 */}
                {prizes.length > 0 && (
                    <Section title="各賞" tone={tone.chip}>
                        <ul className="space-y-2">
                            {prizes.map((row, index) => (
                                <li
                                    key={index}
                                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg bg-surface px-4 py-3"
                                >
                                    <span
                                        className="text-sm font-semibold"
                                        style={{ color: tone.text }}
                                    >
                                        {row.label}
                                    </span>
                                    <span className="text-sm text-ink">{row.detail}</span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {/* 見るところ */}
                {checkpoints.length > 0 && (
                    <Section title="選考で見るところ" tone={tone.chip}>
                        <ul className="space-y-3">
                            {checkpoints.map((row, index) => (
                                <li key={index}>
                                    <p className="text-sm font-semibold text-ink">
                                        {row.title}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-loose text-muted">
                                        {row.body}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {/* 日どり */}
                <Section title="開催期間" tone={tone.chip}>
                    <dl className="space-y-2.5">
                        <Row label="募集期間">
                            {formatLongDate(contest.starts_at)} 〜{" "}
                            {formatLongDate(contest.ends_at)}
                        </Row>
                        <Row label="応募締切">
                            {formatLongDate(contest.ends_at)}
                        </Row>
                        <Row label="結果発表">{formatLongDate(contest.result_at)}</Row>
                    </dl>
                </Section>

                {/* 条件 */}
                <Section title="応募条件" tone={tone.chip}>
                    <dl className="space-y-2.5">
                        {contest.eligibility && (
                            <Row label="参加資格">{contest.eligibility}</Row>
                        )}
                        <Row label="文字数">
                            {contest.min_chars === 0 && contest.max_chars === 0
                                ? "制限なし"
                                : contest.max_chars === 0
                                  ? `${formatNumber(contest.min_chars)}文字以上`
                                  : contest.min_chars === 0
                                    ? `${formatNumber(contest.max_chars)}文字以下`
                                    : `${formatNumber(contest.min_chars)}〜${formatNumber(contest.max_chars)}文字`}
                        </Row>
                        {contest.required_materials && (
                            <Row label="本文以外">{contest.required_materials}</Row>
                        )}
                        <Row label="完結・未完結">
                            {contest.allow_unfinished
                                ? "未完結でも出せます"
                                : "完結済みのみ"}
                        </Row>
                        <Row label="出せる数">
                            {contest.entry_limit === 0
                                ? "何作品でも"
                                : `一人 ${contest.entry_limit} 作品まで`}
                        </Row>
                        <Row label="既発表作">
                            {contest.allow_published
                                ? "他所で公開した作品も出せます"
                                : "未公開の作品のみ"}
                        </Row>
                        {contest.ai_policy && (
                            <Row label="AIの扱い">{contest.ai_policy}</Row>
                        )}
                    </dl>
                </Section>

                {/* 出し方 */}
                {steps.length > 0 && (
                    <Section title="応募のしかた" tone={tone.chip}>
                        <ol className="space-y-3">
                            {steps.map((step, index) => (
                                <li key={index} className="flex gap-3">
                                    <span
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                                        style={{ background: tone.chip }}
                                    >
                                        {index + 1}
                                    </span>
                                    <span className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
                                        {step}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </Section>
                )}

                {/* 注意 */}
                {notices.length > 0 && (
                    <Section title="注意すること" tone={tone.chip}>
                        <ul className="space-y-2">
                            {notices.map((notice, index) => (
                                <li
                                    key={index}
                                    className="flex gap-2 text-xs leading-relaxed text-muted"
                                >
                                    <span className="shrink-0 text-faint">・</span>
                                    <span className="min-w-0 flex-1">{notice}</span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {/* 規約 */}
                {contest.terms && (
                    <details className="mt-10 border-t border-line pt-4">
                        <summary className="cursor-pointer text-sm font-medium text-ink">
                            応募規約
                        </summary>
                        <div className="thin-scroll mt-3 max-h-96 overflow-y-auto rounded-lg bg-surface px-4 py-3">
                            <p className="whitespace-pre-wrap text-[11px] leading-loose text-muted">
                                {contest.terms}
                            </p>
                        </div>
                    </details>
                )}

                {notice && (
                    <p className="mt-6 rounded-lg bg-forest-tint px-4 py-3 text-center text-xs text-forest">
                        {notice}
                    </p>
                )}

                {/* 出せそうな作品 */}
                {isOpen && works.length > 0 && (
                    <div
                        id="entry-works"
                        className="mt-10 rounded-xl border border-line bg-surface px-5 py-4 shadow-[0_2px_10px_rgba(31,78,107,0.06)]"
                    >
                        <p className="text-sm font-medium text-ink">出せそうな作品</p>
                        <p className="mt-1 text-[11px] text-muted">
                            出したい作品の「応募する」を押してください。
                            {contest.entry_limit > 0 &&
                                `${contest.entry_limit}作品まで出せます。`}
                        </p>
                        <ul className="mt-2.5 divide-y divide-line">
                            {works
                                .filter(
                                    (work) =>
                                        contest.min_chars === 0 ||
                                        work.total_char_count >= contest.min_chars,
                                )
                                .slice(0, 5)
                                .map((work) => (
                                    <li key={work.id}>
                                        <div className="flex items-center gap-3 py-2">
                                            <Link
                                                href={`/workspace/${work.id}`}
                                                className="min-w-0 flex-1 truncate text-xs text-ink hover:text-forest"
                                            >
                                                {work.title}
                                            </Link>

                                            <span className="shrink-0 text-[11px] text-faint">
                                                {formatNumber(work.total_char_count)}字
                                            </span>

                                            {/* 出す */}
                                            {entries.some(
                                                (row) => row.work_id === work.id,
                                            ) ? (
                                                <span className="shrink-0 rounded-full bg-forest-tint px-3 py-1 text-[10px] text-forest">
                                                    応募済み
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void apply(work.id, work.title)
                                                    }
                                                    className="shrink-0 rounded-full border border-forest-line px-3.5 py-1 text-[10px] text-forest hover:bg-forest-tint"
                                                >
                                                    応募する
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                        </ul>
                    </div>
                )}
            </main>
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

/**
 * 話の区切り。
 * 左に色の縦線を引くだけにする。
 * 囲みを重ねると、どこからどこまでが一つの話か分からなくなる。
 */
function Section({
    title,
    tone,
    children,
}: {
    title: string;
    tone: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mt-10">
            <h2 className="flex items-center gap-2.5">
                <span
                    className="h-4 w-1 rounded-full"
                    style={{ background: tone }}
                />
                <span className="text-[15px] font-semibold text-ink">{title}</span>
            </h2>
            <div className="mt-4">{children}</div>
        </section>
    );
}

/** 見出しと中身。線を引かず、余白で仕切る */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <dt className="w-28 shrink-0 text-xs leading-6 text-faint">{label}</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-6 text-ink">
                {children}
            </dd>
        </div>
    );
}

/** 「2026/09/02（水）」 */
function formatDate(text: string): string {
    const date = toDate(text);
    if (!date) return text;

    const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return (
        `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}` +
        `（${week}）${formatTimePart(date)}`
    );
}

/**
 * 日どりを日付に直す。
 *
 * 時刻まで決めてあれば、そのまま。
 * 日にちだけなら、その日の始まりとして読む。
 */
function toDate(text: string): Date | null {
    if (!text) return null;

    const date = new Date(text.includes("T") ? text : `${text}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 時刻の部分。
 * 0 時ちょうどなら出さない。決めていないのと区別がつかない。
 */
function formatTimePart(date: Date): string {
    if (date.getHours() === 0 && date.getMinutes() === 0) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    return ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 「2026年9月2日（水）」 */
function formatLongDate(text: string): string {
    const date = toDate(text);
    if (!date) return text;

    const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return (
        `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${week}）` +
        formatTimePart(date)
    );
}
