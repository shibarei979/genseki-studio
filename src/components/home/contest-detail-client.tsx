/**
 * ============================================================
 * 原石航路 Studio
 * ContestDetailClient — コンテストの詳しい説明
 *
 * 上から順に読ませる。
 *
 *   顔      … 絵・題・期日・応募のボタン
 *   目次    … 節へ飛ぶ帯（上に貼り付く）
 *   概要    … どんなコンテストか
 *   各賞    … いくら貰えるか
 *   開催期間 … いつからいつまで
 *   応募条件 … 出せる作品の決まり
 *   応募方法 … 何をすればよいか
 *   応募規約 … 長いので畳んでおく
 *   応募作品 … 自分の棚から選んで出す
 *
 * ------------------------------------------------------------
 * 節の作り
 *
 * 左に「図案＋節の名前」、右に中身。
 * 縦一列に並べるより、左の列が目次の代わりになって、
 * 長い頁でもいま何の話かを見失わない。
 *
 * 狭い画面では上下に積む。左右に割ると、どちらも読めない幅になる。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";

import ContestBanner from "@/components/common/contest-banner";
import Header from "@/components/layout/header";
import { getRepository } from "@/lib/repository";
import { loadIdentity } from "@/lib/room/presence";
import { formatNumber } from "@/lib/utils/text";
import type { Contest, ContestEntry } from "@/types";
import { daysUntil, statusColor, statusLabel } from "@/types";

/**
 * この頁でだけ使う色。
 *
 * アプリの中は橙だが、コンテストは紺と青緑で組む。
 * 賞や規約が並ぶ改まった頁なので、
 * 書く画面と同じ暖色だと、軽く見える。
 *
 * トークンには足さない。使うのはこの 1 枚だけなので、
 * ここに閉じておく。
 */
const C = {
    /** 見出しと図案 */
    navy: "#1e3a5f",
    /** 押してほしいもの */
    teal: "#2b7e91",
    tealDark: "#236a7b",
    /** 薄い地 */
    tint: "#eef3f7",
    /** 升の見出しの地 */
    label: "#e5edf4",
    line: "#d8e2ec",
    body: "#4a5a6e",
    dim: "#8496a8",
};

export default function ContestDetailClient({ contestId }: { contestId: string }) {
    const router = useRouter();

    const [contest, setContest] = useState<Contest | null>(null);
    const [entries, setEntries] = useState<ContestEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        const repository = getRepository();
        setContest(await repository.getContest(contestId));
        setEntries(await repository.listContestEntries(contestId));
        setIsLoading(false);
    }, [contestId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white">
                <Header />
                <p className="py-24 text-center text-sm text-faint">読み込んでいます</p>
            </div>
        );
    }

    if (!contest || contest.status === "draft") {
        return (
            <div className="min-h-screen bg-white">
                <Header breadcrumbs={[{ label: "コンテスト", href: "/contest" }]} />
                <p className="py-24 text-center text-sm text-faint">
                    このコンテストは見つかりませんでした。
                </p>
            </div>
        );
    }

    const tone = statusColor(contest.status);

    /* 賞金の総額。拾えなければ出さない */
    const totalPrize = sumPrize(contest.prizes ?? []);
    const remaining = daysUntil(contest.ends_at);
    const isOpen = contest.status === "open";

    const prizes = contest.prizes ?? [];
    /*
     * 中身の無い手順は出さない。
     *
     * 管理画面で行を足したまま書かずに保存すると、
     * 番号だけの空の札が並ぶ。
     * 空欄は「まだ書いていない」であって「手順」ではない。
     */
    const steps = (contest.steps ?? []).filter((step) => step.trim().length > 0);
    const notices = (contest.notices ?? []).filter(
        (notice) => notice.trim().length > 0,
    );

    /** すでに出した作品 */

    /** あと何作品出せるか */
    const remainingSlots =
        contest.entry_limit === 0
            ? Number.POSITIVE_INFINITY
            : contest.entry_limit - entries.length;


    async function withdraw(workId: string) {
        const row = entries.find((entry) => entry.work_id === workId);
        if (!row) return;
        await getRepository().deleteContestEntry(row.id);
        await reload();
    }

    return (
        <div className="min-h-screen bg-white pb-20">
            <Header
                breadcrumbs={[
                    { label: "コンテスト", href: "/contest" },
                    { label: contest.title || "名前のないコンテスト" },
                ]}
            />

            {/* ============ 顔 ============ */}
            <div className="bg-surface">
                <div className="mx-auto grid max-w-6xl items-center gap-5 px-4 py-6 sm:gap-9 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
                    {/*
                     * 絵。
                     *
                     * 札は載せない。絵柄に紛れて読めないうえ、
                     * 状態は締切のところで分かる。
                     */}
                    <div className="overflow-hidden rounded-2xl shadow-[0_4px_20px_rgba(31,78,107,0.14)]">
                        <ContestBanner
                            contest={contest}
                            className="aspect-[4/3] w-full"
                            fallback="画像なし"
                        />
                    </div>

                    <div className="min-w-0">
                        <h1
                            className="text-[22px] font-semibold leading-snug sm:text-[26px]"
                            style={{ color: C.navy }}
                        >
                            {contest.title || "名前のないコンテスト"}
                        </h1>

                        {contest.catchphrase && (
                            <p className="mt-2.5 text-[13px]" style={{ color: C.body }}>
                                {contest.catchphrase}
                            </p>
                        )}

                        {/*
                         * 札。
                         *
                         * 賞金の総額を先頭に置く。
                         * 出す人がまず知りたいのはそこ。
                         *
                         * 賞は自由に書ける欄なので、金額は
                         * 「¥30,000」「3万円」のような書き方から拾う。
                         * 拾えなければ出さない。
                         */}
                        <ul className="mt-4 flex flex-wrap gap-2">
                            {totalPrize && <Chip isStrong>賞金総額 {totalPrize}</Chip>}

                            {contest.theme && <Chip>{contest.theme}</Chip>}

                            <Chip>
                                {contest.allow_unfinished
                                    ? "未完結OK"
                                    : "完結作品のみ"}
                            </Chip>
                            <Chip>
                                {contest.entry_limit === 0
                                    ? "何作品でも"
                                    : `一人${contest.entry_limit}作品まで`}
                            </Chip>
                            {contest.allow_published && <Chip>他所公開OK</Chip>}
                        </ul>

                        {/* 期日。ここが一番よく見られる */}
                        <div
                            className="mt-5 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2"
                            style={{ borderColor: C.line, background: C.line }}
                        >
                            <div className="bg-surface px-4 py-3.5">
                                <p
                                    className="flex items-center gap-1.5 text-[11px]"
                                    style={{ color: C.dim }}
                                >
                                    <span style={{ color: C.teal }}>
                                        <CalendarIcon />
                                    </span>
                                    応募期間
                                </p>
                                <p
                                    className="mt-1.5 text-[12px] leading-relaxed"
                                    style={{ color: C.navy }}
                                >
                                    {formatLongDate(contest.starts_at)}
                                    <br />― {formatLongDate(contest.ends_at)}
                                </p>
                            </div>

                            <div className="bg-surface px-4 py-3.5">
                                <p
                                    className="flex items-center gap-1.5 text-[11px]"
                                    style={{ color: C.dim }}
                                >
                                    <span style={{ color: C.teal }}>
                                        <MegaphoneIcon />
                                    </span>
                                    結果発表
                                </p>
                                <p
                                    className="mt-1.5 text-[12px] leading-relaxed"
                                    style={{ color: C.navy }}
                                >
                                    {formatLongDate(contest.result_at)}
                                </p>
                            </div>
                        </div>

                        {/*
                         * 応募のページへ。
                         *
                         * 同じ画面に作品を並べていたが、
                         * 読んでいる途中に出すボタンが目に入り落ち着かない。
                         * 読むものと出すものを分けた。
                         */}
                        <Link
                            href={`/contest/${contestId}/entry`}
                            className="mt-5 flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-medium text-white hover:opacity-90"
                            style={{
                                background: C.teal,
                                opacity: isOpen ? 1 : 0.5,
                                pointerEvents: isOpen ? undefined : "none",
                            }}
                        >
                            {isOpen ? "応募する" : "受付終了"}
                            <span aria-hidden="true">›</span>
                        </Link>

                        {isOpen && remaining >= 0 && (
                            <p className="mt-2 text-center text-[11px] text-muted">
                                締切まであと {remaining} 日
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ============ 目次 ============ */}

            <main className="mx-auto max-w-5xl px-6 sm:px-8">
                <Section id="about" icon={<QuillIcon />} title="このコンテストについて">
                    {contest.description && (
                        <p className="whitespace-pre-wrap text-[13px] leading-[2] text-ink">
                            {contest.description}
                        </p>
                    )}
                </Section>

                {contest.theme && (
                    <Section id="theme" icon={<QuillIcon />} title="募集テーマ">
                        <p className="text-[15px] font-semibold" style={{ color: C.navy }}>
                            {contest.theme.split("\n")[0]}
                        </p>
                        {contest.theme.split("\n").length > 1 && (
                            <p className="mt-3 whitespace-pre-wrap text-[12px] leading-[2] text-muted">
                                {contest.theme.split("\n").slice(1).join("\n").trim()}
                            </p>
                        )}
                    </Section>
                )}

                {prizes.length > 0 && (
                    <Section id="prizes" icon={<TrophyIcon />} title="各賞">
                        <ul className="grid gap-4 sm:grid-cols-2">
                            {prizes.map((row, index) => (
                                <li
                                    key={index}
                                    className="relative overflow-hidden rounded-lg border px-5 py-4"
                                    style={{ borderColor: C.line, background: C.tint }}
                                >
                                    <p
                                        className="text-[12px] font-medium"
                                        style={{ color: C.navy }}
                                    >
                                        {row.label}
                                    </p>

                                    {/*
                                     * 金額を大きく出す。
                                     *
                                     * 賞の中身は自由に書ける欄なので、
                                     * 「Amazonギフトカード ¥30,000」のように
                                     * 前置きと金額が続けて書かれる。
                                     * 数字だけを抜き出して大きくすると、
                                     * 何の金額なのか分からなくなるので、
                                     * 1 行目を小さく、2 行目を大きくする。
                                     */}
                                    <PrizeDetail detail={row.detail} />

                                    <span
                                        className="absolute bottom-3 right-4"
                                        style={{ color: C.teal, opacity: 0.3 }}
                                    >
                                        <GiftIcon />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {/*
                 * 日どり。
                 *
                 * 表で 3 行並べるより、横一本の線に点を打つ。
                 * いま全体のどのあたりにいるかが、線の長さで分かる。
                 */}
                <Section id="schedule" icon={<CalendarIcon large />} title="開催期間">
                    {/*
                     * 線は、点そのものから引く。
                     *
                     * 外から「左から 16%」のように置くと、
                     * 3 等分した位置（16.67%）と噛み合わず、
                     * 線の端が点からずれる。
                     *
                     * 各点が自分の左右へ線を伸ばせば、必ず中心で繋がる。
                     */}
                    <ol className="flex pt-1">
                        {[
                            { label: "募集開始", at: contest.starts_at },
                            { label: "応募締切", at: contest.ends_at },
                            { label: "結果発表", at: contest.result_at },
                        ].map((point, index, all) => (
                            <li
                                key={point.label}
                                className="relative flex flex-1 flex-col items-center text-center"
                            >
                                {/* 左へ伸ばす線。先頭には引かない */}
                                {index > 0 && (
                                    <span
                                        className="absolute left-0 right-1/2 top-[6px] h-[2px]"
                                        style={{ background: C.teal, opacity: 0.35 }}
                                        aria-hidden="true"
                                    />
                                )}

                                {/* 右へ伸ばす線。末尾には引かない */}
                                {index < all.length - 1 && (
                                    <span
                                        className="absolute left-1/2 right-0 top-[6px] h-[2px]"
                                        style={{ background: C.teal, opacity: 0.35 }}
                                        aria-hidden="true"
                                    />
                                )}

                                <span
                                    className="relative h-3.5 w-3.5 rounded-full border-[3px] bg-surface"
                                    style={{ borderColor: C.teal }}
                                />
                                <span
                                    className="mt-3 text-[12px] font-medium"
                                    style={{ color: C.navy }}
                                >
                                    {point.label}
                                </span>
                                <span
                                    className="mt-1 text-[11px] leading-relaxed"
                                    style={{ color: C.body }}
                                >
                                    {formatLongDate(point.at)}
                                </span>
                            </li>
                        ))}
                    </ol>
                </Section>

                <Section id="rules" icon={<ListIcon />} title="応募条件">
                    <div className="grid gap-x-4 gap-y-px sm:grid-cols-2">
                        {contest.eligibility && (
                            <Cell label="参加資格">{contest.eligibility}</Cell>
                        )}
                        <Cell label="完結・未完結">
                            {contest.allow_unfinished
                                ? "未完結でも出せます"
                                : "完結済みのみ"}
                        </Cell>
                        <Cell label="文字数">
                            {contest.min_chars === 0 && contest.max_chars === 0
                                ? "制限なし"
                                : contest.max_chars === 0
                                  ? `${formatNumber(contest.min_chars)}文字以上`
                                  : contest.min_chars === 0
                                    ? `${formatNumber(contest.max_chars)}文字以下`
                                    : `${formatNumber(contest.min_chars)}〜${formatNumber(contest.max_chars)}文字`}
                        </Cell>
                        <Cell label="出せる数">
                            {contest.entry_limit === 0
                                ? "何作品でも"
                                : `一人${contest.entry_limit}作品まで`}
                        </Cell>
                        {contest.required_materials && (
                            <Cell label="本文以外">{contest.required_materials}</Cell>
                        )}
                        <Cell label="既発表作">
                            {contest.allow_published
                                ? "他所で公開した作品も出せます"
                                : "未公開の作品のみ"}
                        </Cell>
                    </div>

                    {/*
                     * AI の扱いは長いので、表から出して囲みにする。
                     * 表の升に入れると、そこだけ何行にもなって崩れる。
                     */}
                    {contest.ai_policy && (
                        <div
                            className="mt-4 rounded-lg border px-5 py-4"
                            style={{ borderColor: C.line, background: C.tint }}
                        >
                            <p
                                className="text-[12px] font-medium"
                                style={{ color: C.navy }}
                            >
                                AIの扱い
                            </p>
                            <p
                                className="mt-2 whitespace-pre-wrap text-[12px] leading-[2]"
                                style={{ color: C.body }}
                            >
                                {contest.ai_policy}
                            </p>
                        </div>
                    )}
                </Section>

                {steps.length > 0 && (
                    <Section id="how" icon={<PenIcon />} title="応募のしかた">
                        {/*
                         * 手順。
                         *
                         * 横一列に詰めない。
                         * 手順が 5 つある部屋では 1 列あたりが細くなり、
                         * 「コンテス／トページ／の「作品」のように
                         * 途中で折り返して読めなくなる。
                         *
                         * 3 つまでなら横に並べ、矢印でつなぐ。
                         * 順に進むことが目で分かる。
                         *
                         * 4 つ以上は折り返す。
                         * 詰めると 1 列が細くなり、途中で折れて読めない。
                         * そのときは矢印を置かない。折り返した先で
                         * 行末に残ると、次がどこか分からなくなる。
                         */}
                        <ol
                            className={
                                steps.length <= 3
                                    ? "flex flex-col gap-2 sm:flex-row sm:items-stretch"
                                    : "grid gap-3"
                            }
                            style={
                                steps.length <= 3
                                    ? undefined
                                    : {
                                          gridTemplateColumns:
                                              "repeat(auto-fit, minmax(210px, 1fr))",
                                      }
                            }
                        >
                            {steps.map((step, index) => (
                                <Fragment key={index}>
                                    <li
                                        className="flex-1 rounded-lg border bg-surface px-4 py-4"
                                        style={{ borderColor: C.line }}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span
                                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                                                style={{ background: C.navy }}
                                            >
                                                {index + 1}
                                            </span>

                                            {index < 3 && (
                                                <span style={{ color: C.teal }}>
                                                    <StepIcon index={index} />
                                                </span>
                                            )}
                                        </div>

                                        <p
                                            className="mt-2.5 text-[12px] leading-[1.9]"
                                            style={{ color: C.body }}
                                        >
                                            {step}
                                        </p>
                                    </li>

                                    {/* つなぎの矢印。横に並ぶときだけ */}
                                    {steps.length <= 3 &&
                                        index < steps.length - 1 && (
                                            <li
                                                aria-hidden="true"
                                                className="hidden shrink-0 items-center text-[18px] sm:flex"
                                                style={{ color: C.teal, opacity: 0.5 }}
                                            >
                                                ›
                                            </li>
                                        )}
                                </Fragment>
                            ))}
                        </ol>
                    </Section>
                )}

                {(contest.terms || notices.length > 0) && (
                    <Section id="terms" icon={<DocIcon />} title="応募規約">
                        <div
                            className="overflow-hidden rounded-lg border bg-surface"
                            style={{ borderColor: C.line }}
                        >
                            {/*
                             * 規約は初めから開いておく。
                             *
                             * 畳むと読まないまま出す人が出る。
                             * 読んでほしいものを隠す理由が無い。
                             */}
                            {splitTerms(contest.terms).map((part) => (
                                <div
                                    key={part.title}
                                    className="border-b px-5 py-4 last:border-b-0"
                                    style={{ borderColor: C.line }}
                                >
                                    <p
                                        className="text-[12px] font-medium"
                                        style={{ color: C.navy }}
                                    >
                                        {part.title}
                                    </p>
                                    <p className="mt-2 whitespace-pre-wrap text-[12px] leading-[2] text-muted">
                                        {part.body}
                                    </p>
                                </div>
                            ))}

                            {notices.length > 0 && (
                                <Accordion title="その他の注意事項">
                                    <ul className="space-y-2">
                                        {notices.map((notice, index) => (
                                            <li
                                                key={index}
                                                className="flex gap-2 text-[12px] leading-[1.9] text-muted"
                                            >
                                                <span className="shrink-0 text-faint">・</span>
                                                <span className="min-w-0 flex-1">{notice}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </Accordion>
                            )}
                        </div>
                    </Section>
                )}

            </main>
        </div>
    );
}

/**
 * ============================================================
 * 目次の帯
 *
 * 上に貼り付いて付いてくる。
 * 長い頁なので、下まで読んでから別の節へ戻れるようにする。
 *
 * いまどの節にいるかは追わない。
 * 追うと、読んでいる途中で下線が動き続けて気が散る。
 * ============================================================
 */


/**
 * ============================================================
 * 節
 *
 * 左に図案と名前、右に中身。
 * 狭い画面では上下に積む。
 * ============================================================
 */

function Section({
    id,
    icon,
    title,
    children,
}: {
    id: string;
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section
            id={id}
            /* 貼り付いた目次の下に隠れないよう、飛び先を下げる */
            className="scroll-mt-28 border-b border-line py-8 last:border-b-0"
        >
            <div className="grid gap-3 sm:gap-5 lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
                <h2
                    className="flex items-center gap-2.5 text-[14px] font-semibold"
                    style={{ color: C.navy }}
                >
                    <span style={{ color: C.teal }}>{icon}</span>
                    {title}
                </h2>

                <div className="min-w-0">{children}</div>
            </div>
        </section>
    );
}

/**
 * 賞の中身。
 *
 * 1 行目を前置き、2 行目以降を大きく出す。
 * 1 行しか書かれていないときは、そのまま大きくする。
 */
function PrizeDetail({ detail }: { detail: string }) {
    const lines = detail.split("\n").filter((line) => line.trim().length > 0);

    if (lines.length <= 1) {
        return (
            <p
                className="mt-2 text-[22px] font-semibold leading-snug"
                style={{ color: C.navy }}
            >
                {detail}
            </p>
        );
    }

    return (
        <>
            <p className="mt-2 text-[12px]" style={{ color: C.body }}>
                {lines[0]}
            </p>
            <p
                className="mt-0.5 text-[24px] font-semibold leading-snug"
                style={{ color: C.navy }}
            >
                {lines.slice(1).join(" ")}
            </p>
        </>
    );
}

/** 応募条件の 1 項目。左に見出し、右に中身 */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div
            className="flex overflow-hidden rounded-md border"
            style={{ borderColor: C.line }}
        >
            <span
                className="w-[7em] shrink-0 px-3 py-2.5 text-[11px]"
                style={{ background: C.label, color: C.navy }}
            >
                {label}
            </span>
            <span
                className="min-w-0 flex-1 bg-surface px-3 py-2.5 text-[12px] leading-relaxed"
                style={{ color: C.body }}
            >
                {children}
            </span>
        </div>
    );
}

/** 畳んでおく囲み。規約は長いので、開きたい人だけが開く */
function Accordion({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div>
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 border-b px-5 py-3 text-left hover:opacity-80"
                style={{ borderColor: C.line, background: C.tint }}
            >
                <span
                    className="min-w-0 flex-1 text-[12px]"
                    style={{ color: C.navy }}
                >
                    {title}
                </span>
                <span
                    className="shrink-0 transition-transform"
                    style={{
                        color: C.dim,
                        transform: isOpen ? "rotate(180deg)" : undefined,
                    }}
                    aria-hidden="true"
                >
                    <ChevronIcon />
                </span>
            </button>

            {isOpen && (
                <div className="thin-scroll max-h-80 overflow-y-auto px-5 py-4">
                    {children}
                </div>
            )}
        </div>
    );
}

function Chip({
    children,
    isStrong = false,
}: {
    children: React.ReactNode;
    /** いちばん見せたいもの。賞金など */
    isStrong?: boolean;
}) {
    return (
        <li
            className="rounded-full border px-3.5 py-1 text-[11px]"
            style={
                isStrong
                    ? {
                          borderColor: C.teal,
                          background: C.teal,
                          color: "#ffffff",
                          fontWeight: 600,
                      }
                    : { borderColor: C.line, background: C.tint, color: C.navy }
            }
        >
            {children}
        </li>
    );
}

/**
 * 応募規約を、見出しで分ける。
 *
 * 長い文をひとつの箱に入れると、開いた瞬間に圧倒される。
 * 見出しごとに分ければ、要る所だけ開ける。
 *
 * 見出しは行頭の「■」「【】」「#」で見分ける。
 * 1 つも無ければ、全部をひとつにまとめる。
 */
function splitTerms(terms: string): { title: string; body: string }[] {
    const text = (terms ?? "").trim();
    if (!text) return [];

    const lines = text.split("\n");
    const parts: { title: string; body: string[] }[] = [];

    for (const line of lines) {
        const heading = line.match(/^\s*(?:[■#]+\s*|【(.+?)】)(.*)$/);

        if (heading) {
            parts.push({
                title: (heading[1] ?? heading[2] ?? "").trim() || "規約",
                body: [],
            });
            continue;
        }

        if (parts.length === 0) {
            parts.push({ title: "応募規約（必ずお読みください）", body: [] });
        }

        parts[parts.length - 1].body.push(line);
    }

    return parts.map((part) => ({
        title: part.title,
        body: part.body.join("\n").trim(),
    }));
}

/**
 * 賞金の総額を出す。
 *
 * 賞は自由に書ける欄なので、金額は書き方がまちまち。
 *   ¥30,000 / 30,000円 / 3万円
 * どれも拾えるようにして、足し合わせる。
 *
 * 1 つも拾えなければ null。無いものを 0 円と出さない。
 */
function sumPrize(prizes: { detail?: string; label?: string }[]): string | null {
    let total = 0;

    for (const prize of prizes) {
        const label = prize.label ?? "";
        const detail = prize.detail ?? "";

        /*
         * 1 人あたりの金額。
         *
         * 「3万円」「¥30,000」「5000円」のどれでも拾う。
         * 万の書き方を先に見る。「3万」を「3」と読むと桁が狂う。
         */
        let each = 0;

        const man = detail.match(/([\d.]+)\s*万/);
        if (man) {
            each = Number(man[1]) * 10000;
        } else {
            const yen = detail.match(/[¥￥]?\s*([\d,]{3,})\s*円?/);
            if (yen) each = Number(yen[1].replace(/,/g, ""));
        }

        if (each === 0) continue;

        /*
         * 人数。
         *
         * 「優秀賞（6名）」のように、賞の名前に書かれる。
         * 掛けないと、6 人ぶんが 1 人ぶんになる。
         * 書かれていなければ 1 人とみなす。
         */
        const count = label.match(/([\d]+)\s*(?:名|人)/);
        total += each * (count ? Number(count[1]) : 1);
    }

    if (total === 0) return null;

    return total >= 10000
        ? `${total / 10000}万円`
        : `${total.toLocaleString()}円`;
}

/**
 * 題名から表紙の色を決める。
 * 同じ題名なら必ず同じ色になる。
 */
function coverOf(text: string): string {
    let value = 0;
    for (let index = 0; index < text.length; index += 1) {
        value = (value * 131 + text.charCodeAt(index)) % 4096;
    }
    const hue = Math.round(value * 137.508) % 360;
    return `linear-gradient(155deg, hsl(${hue} 26% 62%), hsl(${(hue + 24) % 360} 28% 42%))`;
}

/** 「2026年8月10日（月）12:00」の形 */
function formatLongDate(text: string): string {
    if (!text) return "未定";

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;

    const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    const stamp = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${week}）`;

    /* 時刻が入っていなければ日付だけ */
    if (!text.includes("T") && !text.includes(":")) return stamp;

    const time = `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
    ).padStart(2, "0")}`;
    return `${stamp} ${time}`;
}

/**
 * ============================================================
 * 図案
 * ============================================================
 */

function stroke(width = 1.8) {
    return {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: width,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };
}

function QuillIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M4 20c0-7 4-12 12-14 1 8-3 13-9 13H4Z" />
            <path d="M4 20c2-3 5-5 8-6.5" />
        </svg>
    );
}

function TrophyIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
            <path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3" />
            <path d="M12 14v3.5M8.5 20.5h7" />
        </svg>
    );
}

function CalendarIcon({ large = false }: { large?: boolean }) {
    const size = large ? 16 : 13;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke()}>
            <rect x="3.5" y="5" width="17" height="15" rx="2" />
            <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
        </svg>
    );
}

function MegaphoneIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" {...stroke()}>
            <path d="M3.5 10.5v3a1.5 1.5 0 0 0 1.5 1.5h1.5l7 4.5v-16l-7 4.5H5a1.5 1.5 0 0 0-1.5 1.5Z" />
            <path d="M17 9.5a3.5 3.5 0 0 1 0 5" />
        </svg>
    );
}

function ListIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M9 6.5h11M9 12h11M9 17.5h11" />
            <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
        </svg>
    );
}

function PenIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M4.5 19.5h3.6L19.4 8.2a2.6 2.6 0 0 0-3.6-3.6L4.5 15.9Z" />
            <path d="m14.6 5.8 3.6 3.6" />
        </svg>
    );
}

function DocIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M13.5 3.5H7a1.8 1.8 0 0 0-1.8 1.8v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V8.8Z" />
            <path d="M13.5 3.5v5.3h5.3" />
        </svg>
    );
}

/**
 * 手順ごとの図案。
 *
 * 出す → 選ぶ → 終わり、の 3 つ。
 * 手順がそれより多い部屋のために、4 つ目からは出さない。
 */
function StepIcon({ index }: { index: number }) {
    if (index === 0) {
        return (
            <svg width="22" height="22" viewBox="0 0 24 24" {...stroke(1.6)}>
                <path d="M7 18.5h10a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6-1A3.75 3.75 0 0 0 7 18.5Z" />
                <path d="M12 15V9.5M9.5 11.5 12 9l2.5 2.5" />
            </svg>
        );
    }
    if (index === 1) {
        return (
            <svg width="22" height="22" viewBox="0 0 24 24" {...stroke(1.6)}>
                <path d="M13.5 3.5H7a1.8 1.8 0 0 0-1.8 1.8v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V8.8Z" />
                <path d="M13.5 3.5v5.3h5.3M8.5 13h7M8.5 16.5h4" />
            </svg>
        );
    }
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...stroke(1.6)}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="m8 12.3 2.6 2.7L16 9.5" />
        </svg>
    );
}

function GiftIcon() {
    return (
        <svg width="34" height="34" viewBox="0 0 24 24" {...stroke(1.5)}>
            <rect x="3.5" y="9" width="17" height="11.5" rx="1.5" />
            <path d="M2.5 9h19v3.5h-19zM12 9v11.5" />
            <path d="M12 9C10 9 8 8 8 6.2A2.2 2.2 0 0 1 12 5a2.2 2.2 0 0 1 4 1.2C16 8 14 9 12 9Z" />
        </svg>
    );
}

function ChevronIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" {...stroke(2)}>
            <path d="m6 9.5 6 6 6-6" />
        </svg>
    );
}
