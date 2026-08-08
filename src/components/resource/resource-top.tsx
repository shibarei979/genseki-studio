/**
 * ============================================================
 * 原石航路 Studio
 * ResourceTop — 資料トップ
 *
 * 上に「いまどうなっているか」、中にページ、下に足す道。
 *
 * 数を並べるだけにしない。
 * 未整理の候補だけは色を変えて前に出す。
 * 拾ったものに気づかないと、集める意味が無い。
 * ============================================================
 */

"use client";

import ResourceIcon from "@/components/resource/resource-icons";
import { formatNumber } from "@/lib/utils/text";
import type {
    PlotStage,
    ResourceEntry,
    ResourcePage,
    ResourceRelation,
    WritingLog,
} from "@/types";

interface Props {
    pages: ResourcePage[];
    entries: ResourceEntry[];
    relations: ResourceRelation[];
    stages: PlotStage[];
    logs: WritingLog[];
    onOpen: (pageId: string) => void;
    onOpenAdd: () => void;
    onAddBuiltin: (builtinKey: string) => void;
}

/** 足せるページの見本 */
const TEMPLATES = [
    {
        key: "organization",
        label: "組織・グループ",
        note: "国、会社、学校、部活、家族、サークル、犯罪組織などをまとめます。",
    },
    {
        key: "item",
        label: "アイテム・小道具",
        note: "凶器、手紙、指輪、鍵、写真、研究資料など。",
    },
    {
        key: "case",
        label: "事件・謎",
        note: "事件、証拠、証言、容疑者、矛盾、未解決のことを紐づけます。",
    },
];

export default function ResourceTop({
    pages,
    entries,
    relations,
    stages,
    logs,
    onOpen,
    onOpenAdd,
    onAddBuiltin,
}: Props) {
    function countOf(page: ResourcePage): number {
        if (page.builtin_key === "relation") return relations.length;
        if (page.builtin_key === "plot") return stages.length;

        return entries.filter(
            (row) => row.page_id === page.id && row.candidate_status !== "pending",
        ).length;
    }

    /* 承認を待っているもの */
    const pending = entries.filter((row) => row.candidate_status === "pending");

    /*
     * 直近 14 日に増えた文字。
     * 資料そのものではなく、本文がどれだけ育ったか。
     */
    /*
     * 日ごとに並べ直す。
     *
     * 書かなかった日も 0 として置く。
     * 抜けたまま繋ぐと、休んだ日が無かったことになる。
     */
    const daily: number[] = [];
    for (let i = 13; i >= 0; i -= 1) {
        const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

        const log = logs.find((row) => row.date === day);
        daily.push(log ? Math.max(0, log.delta) : 0);
    }

    const grew = daily.reduce((sum, value) => sum + value, 0);

    /* 本文から入ったもの */
    const fromBody = entries.filter((row) => row.candidate_source);

    function fromBodyCount(key: string): number {
        const page = pages.find((row) => row.builtin_key === key);
        if (!page) return 0;
        return fromBody.filter((row) => row.page_id === page.id).length;
    }

    return (
        <div>
            <h1 className="text-xl font-semibold tracking-wide text-ink">
                資料トップ
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
                物語に登場する人・場所・出来事・関係・アイデアをまとめて管理する場所です。
                <br />
                本文を書き進めるほど、作品世界が育っていきます。
            </p>

            {/* ---- 上段：いまどうなっているか ---- */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {/*
                 * 4 枚とも同じ形にする。
                 * 1 枚だけ組みが違うと、目がそこで止まる。
                 */}
                <div className="flex flex-col rounded-xl border border-line bg-surface px-5 py-4">
                    <p className="text-[12px] font-medium text-muted">
                        作品世界の成長
                    </p>

                    <p className="mt-2">
                        <span className="text-[24px] font-semibold leading-none text-ink">
                            +{formatNumber(grew)}
                        </span>
                        <span className="ml-1 text-[11px] text-muted">文字</span>
                    </p>

                    {/* 日ごとの伸び。形が見えると、続いているかが分かる */}
                    <div className="mt-auto pt-3">
                        <GrowthChart values={daily} />
                        <p className="mt-1.5 text-right text-[10px] text-faint">
                            過去14日間
                        </p>
                    </div>
                </div>

                <StatCard
                    label="本文から追加された項目"
                    value={fromBody.length}
                    unit="件"
                    note={`人物 ${fromBodyCount("character")} / 場所 ${fromBodyCount("place")} / 用語・設定 ${fromBodyCount("term")}`}
                />

                <StatCard
                    label="資料ページ数"
                    value={pages.length}
                    unit="ページ"
                    note="作成済みの資料ページ"
                />

                {/*
                 * 未整理の候補。
                 * ここだけ色を変える。埋もれると気づかれない。
                 */}
                <div
                    className="flex flex-col rounded-xl border px-5 py-4"
                    style={{
                        borderColor:
                            pending.length > 0
                                ? "var(--color-amber)"
                                : "var(--color-line)",
                        background:
                            pending.length > 0
                                ? "var(--color-amber-tint)"
                                : "var(--color-surface)",
                    }}
                >
                    <p className="text-[12px] font-medium text-muted">
                        未整理の候補
                    </p>

                    <p className="mt-2">
                        <span className="text-[24px] font-semibold leading-none text-ink">
                            {formatNumber(pending.length)}
                        </span>
                        <span className="ml-1 text-[11px] text-muted">件</span>
                    </p>

                    {pending.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => {
                                const first = pages.find((page) =>
                                    pending.some((row) => row.page_id === page.id),
                                );
                                if (first) onOpen(first.id);
                            }}
                            className="mt-auto flex items-center gap-1 pt-3 text-[11px] text-forest hover:underline"
                        >
                            候補を確認する
                            <Chevron />
                        </button>
                    ) : (
                        <p className="mt-auto pt-3 text-[11px] text-faint">
                            待っているものはありません
                        </p>
                    )}
                </div>
            </div>

            {/* ---- 中段：ページ ---- */}
            <h2 className="mt-10 text-[14px] font-medium text-ink">作品の資料</h2>

            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pages.map((page) => {
                    const count = countOf(page);
                    const own = pending.filter(
                        (row) => row.page_id === page.id,
                    ).length;

                    return (
                        <li key={page.id}>
                            <button
                                type="button"
                                onClick={() => onOpen(page.id)}
                                className="flex h-full w-full flex-col rounded-xl border border-line bg-surface px-5 py-5 text-left transition-colors hover:border-forest-line hover:bg-canvas/40"
                            >
                                <span className="flex w-full items-start gap-2.5">
                                    <span className="mt-0.5 shrink-0 text-muted">
                                        <ResourceIcon
                                            builtinKey={page.builtin_key}
                                            size={18}
                                        />
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[14px] font-medium text-ink">
                                            {page.label}
                                        </span>
                                    </span>

                                    {own > 0 && (
                                        <span className="shrink-0 rounded-full bg-[var(--color-amber)] px-2 py-0.5 text-[10px] text-white">
                                            {own}
                                        </span>
                                    )}

                                    <span className="mt-0.5 shrink-0 text-faint">
                                        <Chevron />
                                    </span>
                                </span>

                                {/* 数を主役に。ここを見に来る */}
                                <span className="mt-2.5 block">
                                    {count === 0 ? (
                                        <span className="text-[13px] text-faint">
                                            まだありません
                                        </span>
                                    ) : (
                                        <>
                                            <span className="text-[22px] font-semibold leading-none text-ink">
                                                {formatNumber(count)}
                                            </span>
                                            <span className="ml-1 text-[11px] text-muted">
                                                件
                                            </span>
                                        </>
                                    )}
                                </span>

                                {page.description && (
                                    <span className="mt-auto block pt-3 text-[11px] leading-relaxed text-muted">
                                        {page.description}
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>

            {/* ---- 下段：ページを足す ---- */}
            <section className="mt-10">
                <h2 className="text-[14px] font-medium text-ink">
                    作品に合わせてページを足す
                </h2>
                <p className="mt-1 text-[12px] text-muted">
                    必要な情報を自由に追加できます。ジャンルを問わず、物語に合わせて選べます。
                </p>

                <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {TEMPLATES.map((row) => (
                        <li key={row.key}>
                            <button
                                type="button"
                                onClick={() => onAddBuiltin(row.key)}
                                className="flex h-full w-full items-start gap-2.5 rounded-xl border border-line bg-surface px-5 py-4 text-left hover:border-forest-line"
                            >
                                <span className="mt-0.5 shrink-0 text-muted">
                                    <TemplateIcon kind={row.key} />
                                </span>

                                <span className="min-w-0">
                                    <span className="block text-[13px] font-medium text-ink">
                                        {row.label}
                                    </span>
                                    <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                                        {row.note}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}

                </ul>

                <div className="mt-3">
                        <button
                            type="button"
                            onClick={onOpenAdd}
                            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-5 py-4 text-left hover:border-forest-line"
                        >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-muted">
                                ＋
                            </span>

                            <span className="min-w-0">
                                <span className="block text-[13px] font-medium text-ink">
                                    自由に新しいページを作る
                                </span>
                                <span className="mt-0.5 block text-[11px] text-muted">
                                    オリジナルの資料ページ
                                </span>
                            </span>
                        </button>
                </div>
            </section>
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

function StatCard({
    label,
    value,
    unit,
    note,
    prefix = "",
}: {
    label: string;
    value: number;
    unit: string;
    note: string;
    /** 「+」など、数の前に付けるもの */
    prefix?: string;
}) {
    return (
        <div className="flex flex-col rounded-xl border border-line bg-surface px-5 py-4">
            <p className="text-[12px] font-medium text-muted">{label}</p>

            <p className="mt-2">
                <span className="text-[24px] font-semibold leading-none text-ink">
                    {prefix}
                    {formatNumber(value)}
                </span>
                <span className="ml-1 text-[11px] text-muted">{unit}</span>
            </p>

            {/* 高さを揃えるため、註釈は下端に寄せる */}
            <p className="mt-auto pt-3 text-[11px] leading-relaxed text-faint">
                {note}
            </p>
        </div>
    );
}

/** 足せるページの絵 */
function TemplateIcon({ kind }: { kind: string }) {
    const common = {
        width: 18,
        height: 18,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };

    if (kind === "organization") {
        return (
            <svg {...common}>
                <rect x="3.5" y="8" width="7" height="12.5" rx="1" />
                <rect x="13.5" y="3.5" width="7" height="17" rx="1" />
                <path d="M6 11.5h2M6 15h2M16 7h2M16 11h2M16 15h2" />
            </svg>
        );
    }

    if (kind === "item") {
        return (
            <svg {...common}>
                <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16V8Z" />
                <path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" />
            </svg>
        );
    }

    return (
        <svg {...common}>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 4.5 4.5" />
        </svg>
    );
}

function Chevron() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m9 5 7 7-7 7" />
        </svg>
    );
}

/**
 * 日ごとの伸びを折れ線で出す。
 *
 * 数字を見せるための添え物なので、
 * 目盛りも軸も置かない。形だけ分かればよい。
 */
function GrowthChart({ values }: { values: number[] }) {
    const width = 200;
    const height = 34;

    const max = Math.max(...values, 1);

    /* 点を並べる */
    const points = values.map((value, index) => {
        const x = (index / Math.max(1, values.length - 1)) * width;
        const y = height - (value / max) * height;
        return [x, y] as const;
    });

    const line = points
        .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
        .join(" ");

    /* 下を塗るための閉じた形 */
    const area = `${line} L${width} ${height} L0 ${height} Z`;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[34px] w-full"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <path d={area} fill="var(--color-forest-tint)" opacity="0.7" />
            <path
                d={line}
                fill="none"
                stroke="var(--color-forest)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
