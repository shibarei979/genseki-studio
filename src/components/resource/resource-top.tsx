/**
 * ============================================================
 * 原石航路 Studio
 * ResourceTop — 資料の地図
 *
 * 「整った一覧」ではなく「育っていく世界」に見せる。
 *
 *   核        真ん中は押しボタンではなく、作品の核。
 *             題名を抱いて、ゆっくり息をしている。
 *             まわりを小さな星が静かに巡る
 *   断片      分類の丸は、件数が増えるほど大きくなる。
 *             空のページは点線の「まだ白紙」の地
 *   発見      丸に手をかざすと、最近の項目が衛星になって
 *             浮かび出る。押せばそのまま掘れる
 *   育ち      「この7日で 人物2・場所1 が増えました」と
 *             核の下で世界が語る。今週増えた丸には芽の印
 *   糸        線は開いた瞬間に中央から伸びて描かれる。
 *             人物と関係図、場所と出来事の間にも薄い糸を張り、
 *             メニューではなく網に見せる
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

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
    /** 作品の題名。核に抱かせる */
    workTitle: string;
    pages: ResourcePage[];
    entries: ResourceEntry[];
    relations: ResourceRelation[];
    stages: PlotStage[];
    logs: WritingLog[];
    onOpen: (pageId: string) => void;
    onOpenAdd: () => void;
}

/*
 * 分類ごとの淡い色。
 * 彩度は低く。派手にすると資料ではなく玩具に見える。
 */
const ACCENTS: Record<string, { line: string; tint: string; ink: string }> = {
    character: { line: "#b9cfe8", tint: "#f3f7fc", ink: "#4a6b96" },
    place: { line: "#bcd8c2", tint: "#f2f9f4", ink: "#4d7a58" },
    relation: { line: "#cfc4e4", tint: "#f7f4fc", ink: "#6d5a96" },
    event: { line: "#d9c8e0", tint: "#faf5fc", ink: "#7d5a8c" },
    plot: { line: "#e4c4c4", tint: "#fcf4f4", ink: "#96585a" },
    memo: { line: "#c8dcd8", tint: "#f4faf9", ink: "#527a72" },
    term: { line: "#e2d4b4", tint: "#fbf7ec", ink: "#8a713a" },
    organization: { line: "#b9cfe0", tint: "#f3f8fb", ink: "#4a7089" },
};

const DEFAULT_ACCENT = { line: "#c6ccd4", tint: "#f5f6f8", ink: "#5a6672" };

function accentOf(page: ResourcePage) {
    return (page.builtin_key && ACCENTS[page.builtin_key]) || DEFAULT_ACCENT;
}

/*
 * 丸の置き場所（%）。
 * 完全な正円にはしない。少し崩すと知識が広がって見える。
 */
const SLOTS: { x: number; y: number }[] = [
    { x: 50, y: 14 },
    { x: 72, y: 21 },
    { x: 86, y: 45 },
    { x: 77, y: 74 },
    { x: 57, y: 87 },
    { x: 33, y: 81 },
    { x: 14, y: 60 },
    { x: 12, y: 31 },
    { x: 30, y: 16 },
    { x: 92, y: 22 },
    { x: 35, y: 44 },
    { x: 65, y: 58 },
];

/*
 * 分類同士の糸。世界は放射ではなく網でつながっている。
 * 実在するページ同士のときだけ張る。
 */
const THREADS: [string, string][] = [
    ["character", "relation"],
    ["character", "organization"],
    ["place", "event"],
    ["event", "plot"],
    ["term", "memo"],
];

/* 背景で漂う塵。世界に空気を入れる */
const DUST: { x: number; y: number; delay: number }[] = [
    { x: 22, y: 24, delay: 0 },
    { x: 62, y: 12, delay: 1.4 },
    { x: 88, y: 34, delay: 2.6 },
    { x: 80, y: 62, delay: 0.8 },
    { x: 44, y: 76, delay: 2.1 },
    { x: 12, y: 46, delay: 3.2 },
    { x: 56, y: 40, delay: 1.0 },
];

/** 今日から数えて n 日以内か */
function withinDays(iso: string, days: number): boolean {
    const then = new Date(iso).getTime();
    return Number.isFinite(then) && Date.now() - then <= days * 24 * 60 * 60 * 1000;
}

export default function ResourceTop({
    workTitle,
    pages,
    entries,
    relations,
    stages,
    logs,
    onOpen,
    onOpenAdd,
}: Props) {
    const [isSpread, setIsSpread] = useState(false);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [panelQuery, setPanelQuery] = useState("");

    function countOf(page: ResourcePage): number {
        if (page.builtin_key === "relation") return relations.length;
        if (page.builtin_key === "plot") return stages.length;

        return entries.filter(
            (row) => row.page_id === page.id && row.candidate_status !== "pending",
        ).length;
    }

    function pendingOf(page: ResourcePage): number {
        return entries.filter(
            (row) => row.page_id === page.id && row.candidate_status === "pending",
        ).length;
    }

    /* この7日で増えたもの。世界が語る材料 */
    function newOf(page: ResourcePage): number {
        return entries.filter(
            (row) =>
                row.page_id === page.id &&
                row.candidate_status !== "pending" &&
                withinDays(row.created_at, 7),
        ).length;
    }

    const growthWords = useMemo(() => {
        const grown = pages
            .map((page) => ({ label: page.label, added: newOf(page) }))
            .filter((row) => row.added > 0)
            .sort((a, b) => b.added - a.added)
            .slice(0, 3);

        if (grown.length === 0) return null;
        return grown.map((row) => `${row.label}${row.added}`).join("・");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pages, entries]);

    const grew = useMemo(() => {
        let sum = 0;
        for (let i = 13; i >= 0; i -= 1) {
            const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);
            const log = logs.find((row) => row.date === day);
            if (log) sum += Math.max(0, log.delta);
        }
        return sum;
    }, [logs]);

    const pendingTotal = entries.filter(
        (row) => row.candidate_status === "pending",
    ).length;

    /* 横断検索。名前・別名・一言説明を全分類またいで */
    const found = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return [];

        return entries
            .filter((row) =>
                [row.name, row.summary, ...row.aliases]
                    .join(" ")
                    .toLowerCase()
                    .includes(needle),
            )
            .slice(0, 10);
    }, [entries, query]);

    const selected = pages.find((row) => row.id === selectedId) ?? null;

    const selectedEntries = useMemo(() => {
        if (!selected) return [];
        const needle = panelQuery.trim().toLowerCase();

        return entries
            .filter(
                (row) =>
                    row.page_id === selected.id &&
                    row.candidate_status !== "pending" &&
                    (!needle ||
                        [row.name, row.summary, ...row.aliases]
                            .join(" ")
                            .toLowerCase()
                            .includes(needle)),
            )
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 8);
    }, [entries, selected, panelQuery]);

    function pageOf(entry: ResourceEntry): ResourcePage | undefined {
        return pages.find((row) => row.id === entry.page_id);
    }

    /** かざした丸の衛星。最近の項目 3 つ */
    function satellitesOf(pageId: string): ResourceEntry[] {
        return entries
            .filter(
                (row) =>
                    row.page_id === pageId &&
                    row.candidate_status !== "pending",
            )
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 3);
    }

    /* 件数で丸が育つ。0件=88px、増えるほど最大132pxまで */
    function sizeOf(count: number): number {
        return 88 + Math.min(44, Math.round(Math.log2(count + 1) * 11));
    }

    function slotOf(index: number) {
        return SLOTS[index % SLOTS.length];
    }

    /* 分類同士の糸。両方のページがあるときだけ */
    const threads = THREADS.flatMap(([a, b]) => {
        const ia = pages.findIndex((row) => row.builtin_key === a);
        const ib = pages.findIndex((row) => row.builtin_key === b);
        if (ia < 0 || ib < 0) return [];
        return [{ from: slotOf(ia), to: slotOf(ib), key: `${a}-${b}` }];
    });

    return (
        <div className="relative overflow-hidden">
            <div className="relative min-h-[540px] lg:min-h-[620px]">
                {/* 背景で漂う塵。動きはごく小さく */}
                {DUST.map((dust, index) => (
                    <span
                        key={index}
                        aria-hidden="true"
                        className="map-drift absolute h-1.5 w-1.5 rounded-full bg-forest-line/50"
                        style={{
                            left: `${dust.x}%`,
                            top: `${dust.y}%`,
                            animationDelay: `${dust.delay}s`,
                        }}
                    />
                ))}

                {/* ---- 糸 ---- */}
                <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    {/* 分類同士の薄い糸。網に見せる */}
                    {threads.map((thread) => (
                        <path
                            key={thread.key}
                            d={`M ${thread.from.x} ${thread.from.y} Q ${
                                (thread.from.x + thread.to.x) / 2 + 3
                            } ${(thread.from.y + thread.to.y) / 2 - 3} ${
                                thread.to.x
                            } ${thread.to.y}`}
                            fill="none"
                            stroke="#c9d4dc"
                            strokeWidth="1"
                            strokeDasharray="2 5"
                            vectorEffect="non-scaling-stroke"
                            className="transition-opacity duration-700"
                            opacity={isSpread ? 0.35 : 0}
                        />
                    ))}

                    {/*
                     * 中央からの糸。開いた瞬間、中央から先へ
                     * 伸びて「描かれる」。少し曲げて生き物らしく。
                     */}
                    {pages.map((page, index) => {
                        const slot = slotOf(index);
                        const isHovered = hoveredId === page.id;
                        const bend = index % 2 === 0 ? 3.5 : -3.5;
                        return (
                            <path
                                key={page.id}
                                d={`M 50 47 Q ${(50 + slot.x) / 2 + bend} ${
                                    (47 + slot.y) / 2 + bend
                                } ${slot.x} ${slot.y}`}
                                fill="none"
                                pathLength={1}
                                strokeDasharray="1"
                                stroke={
                                    isHovered
                                        ? "var(--color-forest)"
                                        : accentOf(page).line
                                }
                                strokeWidth={isHovered ? 1.6 : 1}
                                vectorEffect="non-scaling-stroke"
                                style={{
                                    strokeDashoffset: isSpread ? 0 : 1,
                                    transition: `stroke-dashoffset 500ms ease ${index * 45}ms, opacity 300ms, stroke 200ms`,
                                }}
                                opacity={isSpread ? (isHovered ? 0.95 : 0.55) : 0}
                            />
                        );
                    })}
                </svg>

                {/* ---- 核 ---- */}
                <div
                    className="absolute left-1/2 top-[47%] z-10 -translate-x-1/2 -translate-y-1/2 text-center"
                    style={{ width: 230 }}
                >
                    <div className="relative mx-auto h-36 w-36">
                        {/* 暈。核が静かに灯っている */}
                        <span
                            aria-hidden="true"
                            className="core-halo absolute -inset-5 rounded-full"
                            style={{
                                background:
                                    "radial-gradient(circle, rgba(31,78,107,0.14) 0%, rgba(31,78,107,0) 70%)",
                            }}
                        />

                        {/* 巡る星。世界に時間が流れている */}
                        <span
                            aria-hidden="true"
                            className="core-orbit absolute -inset-3 rounded-full border border-forest-line/25"
                        >
                            <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest/50" />
                            <span className="absolute right-[7%] top-[72%] h-1 w-1 rounded-full bg-forest/35" />
                            <span className="absolute left-[4%] top-[38%] h-1 w-1 rounded-full bg-forest-line" />
                        </span>

                        <button
                            type="button"
                            onClick={() => {
                                setIsSpread((on) => !on);
                                setSelectedId(null);
                                setQuery("");
                            }}
                            aria-expanded={isSpread}
                            className="core-breathe relative flex h-36 w-36 flex-col items-center justify-center rounded-full border border-forest-line/70 text-forest shadow-[0_14px_36px_-14px_rgba(31,78,107,0.4)] transition-transform duration-200 hover:scale-[1.04]"
                            style={{
                                background:
                                    "radial-gradient(circle at 50% 36%, #ffffff 0%, #f2f7fb 68%, #e6eef5 100%)",
                            }}
                        >
                            <BrainIcon />
                            {/* 核は記号ではなく、この作品そのもの */}
                            <span className="mt-1 max-w-[112px] truncate px-1 text-[11px] font-medium text-ink">
                                {workTitle || "無題の世界"}
                            </span>
                        </button>
                    </div>

                    {!isSpread ? (
                        <p className="mt-3 text-[12px] text-muted">
                            作品世界を探索する
                        </p>
                    ) : (
                        <div className="mt-3">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="何を探しますか？"
                                className="w-full rounded-full border border-line bg-surface px-4 py-2 text-center text-[12px] text-ink outline-none placeholder:text-faint focus:border-forest-line"
                            />
                        </div>
                    )}

                    {/* 世界が語る。この7日で何が増えたか */}
                    <p className="mt-1.5 text-[11px] text-faint">
                        {growthWords
                            ? `この7日で ${growthWords} が増えました`
                            : "本文を書くほど、ここに世界が集まります"}
                    </p>

                    {/* 横断検索の答え */}
                    {isSpread && query.trim() && (
                        <ul className="relative z-10 mt-2 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 text-left shadow-lg">
                            {found.length === 0 ? (
                                <li className="px-3 py-2 text-[11px] text-faint">
                                    見つかりませんでした
                                </li>
                            ) : (
                                found.map((entry) => {
                                    const page = pageOf(entry);
                                    const accent = page
                                        ? accentOf(page)
                                        : DEFAULT_ACCENT;
                                    return (
                                        <li key={entry.id}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    page && onOpen(page.id)
                                                }
                                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-canvas"
                                            >
                                                <span
                                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                                                    style={{
                                                        background: accent.tint,
                                                        color: accent.ink,
                                                    }}
                                                >
                                                    <ResourceIcon
                                                        builtinKey={
                                                            page?.builtin_key ??
                                                            null
                                                        }
                                                        size={12}
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[12px] text-ink">
                                                        {entry.name}
                                                        {entry.candidate_status ===
                                                            "pending" && (
                                                            <span className="ml-1 text-[10px] text-amber">
                                                                候補
                                                            </span>
                                                        )}
                                                    </span>
                                                    {entry.summary && (
                                                        <span className="block truncate text-[10px] text-faint">
                                                            {entry.summary}
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    )}
                </div>

                {/* ---- 分類の丸 ---- */}
                {pages.map((page, index) => {
                    const slot = slotOf(index);
                    const accent = accentOf(page);
                    const count = countOf(page);
                    const pending = pendingOf(page);
                    const added = newOf(page);
                    const size = sizeOf(count);
                    const isHovered = hoveredId === page.id;
                    const satellites = isHovered ? satellitesOf(page.id) : [];

                    return (
                        <div
                            key={page.id}
                            onMouseEnter={() => setHoveredId(page.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className="absolute transition-all duration-300"
                            style={{
                                left: isSpread ? `${slot.x}%` : "50%",
                                top: isSpread ? `${slot.y}%` : "47%",
                                transform: `translate(-50%, -50%) scale(${isSpread ? 1 : 0.2})`,
                                opacity: isSpread ? 1 : 0,
                                pointerEvents: isSpread ? "auto" : "none",
                                transitionDelay: isSpread
                                    ? `${index * 30}ms`
                                    : "0ms",
                                zIndex: isHovered ? 20 : 1,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedId(page.id);
                                    setPanelQuery("");
                                }}
                                tabIndex={isSpread ? 0 : -1}
                                className="flex flex-col items-center justify-center rounded-full text-center shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md"
                                style={{
                                    width: size,
                                    height: size,
                                    /* 白紙の地は点線。まだ誰も踏み入れていない */
                                    border: `${count === 0 ? "1.5px dashed" : "1px solid"} ${accent.line}`,
                                    background: `radial-gradient(circle at 50% 30%, #ffffff 0%, ${accent.tint} 100%)`,
                                }}
                            >
                                <span style={{ color: accent.ink }}>
                                    <ResourceIcon
                                        builtinKey={page.builtin_key}
                                        size={19}
                                    />
                                </span>
                                <span className="mt-0.5 px-2 text-[12px] font-medium leading-tight text-ink">
                                    {page.label}
                                </span>
                                <span className="text-[10px] text-muted">
                                    {count > 0 ? `${count}件` : "まだ白紙"}
                                </span>
                                {/* 今週の芽 */}
                                {added > 0 && (
                                    <span className="mt-0.5 rounded-full bg-forest-tint px-1.5 text-[9px] font-medium text-forest">
                                        今週 +{added}
                                    </span>
                                )}

                                {pending > 0 && (
                                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-medium text-white">
                                        {pending}
                                    </span>
                                )}
                            </button>

                            {/*
                             * 衛星。かざした分類の最近の項目が浮かび出る。
                             * 探索の「発見」はここで起きる。
                             */}
                            {satellites.map((entry, i) => {
                                const spots = [
                                    { x: 0, y: -(size / 2 + 26) },
                                    { x: size / 2 + 34, y: -(size / 4) },
                                    { x: -(size / 2 + 34), y: -(size / 4) },
                                ];
                                const spot = spots[i];
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedId(page.id);
                                            setPanelQuery("");
                                        }}
                                        className="satellite absolute left-1/2 top-1/2 max-w-[104px] truncate rounded-full border bg-surface px-2.5 py-1 text-[10px] text-ink shadow-md"
                                        style={{
                                            borderColor: accent.line,
                                            transform: `translate(calc(-50% + ${spot.x}px), calc(-50% + ${spot.y}px))`,
                                            animationDelay: `${i * 60}ms`,
                                        }}
                                    >
                                        {entry.name}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}

                {/* ページを追加。点線の丸で、地図の一員として */}
                <button
                    type="button"
                    onClick={onOpenAdd}
                    tabIndex={isSpread ? 0 : -1}
                    className="absolute flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-line bg-surface/70 text-muted transition-all duration-300 hover:border-forest-line hover:text-forest"
                    style={{
                        left: isSpread ? "50%" : "50%",
                        top: isSpread ? "94%" : "47%",
                        transform: `translate(-50%, -50%) scale(${isSpread ? 1 : 0.2})`,
                        opacity: isSpread ? 1 : 0,
                        pointerEvents: isSpread ? "auto" : "none",
                        transitionDelay: isSpread
                            ? `${pages.length * 30}ms`
                            : "0ms",
                    }}
                    title="資料ページを追加します"
                >
                    <span className="text-xl font-light" aria-hidden="true">
                        +
                    </span>
                </button>
            </div>

            <p className="mt-2 text-center text-[11px] text-faint">
                この14日で本文が +{formatNumber(grew)} 文字育ちました
                {pendingTotal > 0 && (
                    <span className="text-amber">
                        （未整理 {pendingTotal} 件）
                    </span>
                )}
            </p>

            {/* ---- 右の引き出し ---- */}
            <div
                className={[
                    "absolute inset-y-0 right-0 z-30 w-[290px] border-l border-line bg-surface shadow-xl transition-transform duration-300",
                    selected ? "translate-x-0" : "translate-x-full",
                ].join(" ")}
            >
                {selected && (
                    <div className="flex h-full flex-col p-4">
                        <div className="flex items-center gap-2.5">
                            <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                                style={{
                                    background: accentOf(selected).tint,
                                    color: accentOf(selected).ink,
                                }}
                            >
                                <ResourceIcon
                                    builtinKey={selected.builtin_key}
                                    size={16}
                                />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-ink">
                                    {selected.label}
                                </p>
                                <p className="text-[10px] text-muted">
                                    {countOf(selected)}件
                                    {pendingOf(selected) > 0 &&
                                        ` ・ 未整理 ${pendingOf(selected)}件`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedId(null)}
                                aria-label="閉じる"
                                className="shrink-0 rounded p-1 text-faint hover:text-ink"
                            >
                                ✕
                            </button>
                        </div>

                        <input
                            type="text"
                            value={panelQuery}
                            onChange={(e) => setPanelQuery(e.target.value)}
                            placeholder={`${selected.label}の中を探す`}
                            className="mt-3 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-forest-line"
                        />

                        <p className="mt-3 text-[10px] font-medium text-faint">
                            {panelQuery.trim() ? "見つかったもの" : "最近の項目"}
                        </p>

                        <ul className="thin-scroll mt-1.5 min-h-0 flex-1 space-y-1 overflow-y-auto">
                            {selectedEntries.length === 0 ? (
                                <li className="py-3 text-[11px] text-faint">
                                    {panelQuery.trim()
                                        ? "見つかりませんでした"
                                        : "まだ項目がありません"}
                                </li>
                            ) : (
                                selectedEntries.map((entry) => (
                                    <li key={entry.id}>
                                        <button
                                            type="button"
                                            onClick={() => onOpen(selected.id)}
                                            className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-canvas"
                                        >
                                            <span className="block truncate text-[12px] text-ink">
                                                {entry.name}
                                            </span>
                                            {entry.summary && (
                                                <span className="block truncate text-[10px] text-faint">
                                                    {entry.summary}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>

                        <button
                            type="button"
                            onClick={() => onOpen(selected.id)}
                            className="mt-3 w-full rounded-lg bg-forest-dark py-2.5 text-[12px] font-medium text-white hover:opacity-90"
                        >
                            一覧を開く
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/** 脳の印。細い線画。知識の網の入口 */
function BrainIcon() {
    return (
        <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M9.5 3.5a2.6 2.6 0 0 0-2.6 2.6c-1.5.3-2.6 1.5-2.6 3 0 .7.2 1.3.6 1.8-.6.5-1 1.3-1 2.2 0 1.4 1 2.6 2.4 2.9.2 1.7 1.6 3 3.3 3 .7 0 1.4-.3 1.9-.7V4.6c-.5-.7-1.2-1.1-2-1.1Z" />
            <path d="M14.5 3.5a2.6 2.6 0 0 1 2.6 2.6c1.5.3 2.6 1.5 2.6 3 0 .7-.2 1.3-.6 1.8.6.5 1 1.3 1 2.2 0 1.4-1 2.6-2.4 2.9-.2 1.7-1.6 3-3.3 3-.7 0-1.4-.3-1.9-.7V4.6c.5-.7 1.2-1.1 2-1.1Z" />
            <path d="M12 4.5v15" strokeWidth="1" opacity="0.55" />
            <path d="M7 9.2h2.6M7.4 13.4h2.2M14.4 7.6h2.4M14.4 11.8h2.8" strokeWidth="1" opacity="0.55" />
        </svg>
    );
}
