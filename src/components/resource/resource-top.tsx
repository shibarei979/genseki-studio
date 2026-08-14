/**
 * ============================================================
 * 原石航路 Studio
 * ResourceTop — 資料の地図
 *
 * 数字の札を並べる画面をやめ、作品世界を探索する地図にした。
 *
 *   ふだん      真ん中に脳の印。まわりは薄い点だけ
 *   押すと      分類の丸が中央から放射状に広がる（0.25秒）
 *   丸を押すと  右から引き出しが開き、最近の項目・検索・
 *              未整理が見える。頁を離れずに掘っていける
 *   真ん中の下  横断検索。「王都」「リオ」など、名前・別名・
 *              一言説明をまたいで全部の分類から探す
 *
 * 分類の丸は決め打ちにしない。実際にある資料ページから作る。
 * 自作のページも同じ地図に乗る。
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
 *
 * 彩度は低く。派手にすると資料ではなく玩具に見える。
 * 自作のページには既定の青鼠を使う。
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
 *
 * 完全な正円にはしない。少し崩すと「知識が広がっている」
 * 形に見える。ただし読み順（上から時計回り）は保つ。
 * 11 個目からは 2 周目として内側へ。
 */
const SLOTS: { x: number; y: number }[] = [
    { x: 50, y: 15 },
    { x: 72, y: 22 },
    { x: 85, y: 46 },
    { x: 76, y: 74 },
    { x: 56, y: 86 },
    { x: 33, y: 80 },
    { x: 15, y: 60 },
    { x: 13, y: 32 },
    { x: 31, y: 17 },
    { x: 91, y: 22 },
    { x: 35, y: 44 },
    { x: 65, y: 58 },
];

/* 飾りの小さな点。将来「主人公」「最近の人物」などへ育てる足場 */
const DOTS: { x: number; y: number; icon: string }[] = [
    { x: 42, y: 27, icon: "character" },
    { x: 63, y: 33, icon: "term" },
    { x: 68, y: 66, icon: "memo" },
    { x: 40, y: 68, icon: "relation" },
    { x: 24, y: 45, icon: "place" },
    { x: 79, y: 35, icon: "event" },
];

export default function ResourceTop({
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

    /* 育ちの数字。札はやめたが、数字そのものは下に静かに残す */
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

    const fromBody = entries.filter((row) => row.candidate_source).length;
    const pendingTotal = entries.filter(
        (row) => row.candidate_status === "pending",
    ).length;

    /*
     * 横断検索。
     * 名前・別名・一言説明を、全部の分類をまたいで探す。
     * 承認待ちの候補も（印を付けて）出す。拾ったものも世界の一部。
     */
    const found = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return [];

        return entries
            .filter((row) => {
                const haystack = [row.name, row.summary, ...row.aliases]
                    .join(" ")
                    .toLowerCase();
                return haystack.includes(needle);
            })
            .slice(0, 10);
    }, [entries, query]);

    const selected = pages.find((row) => row.id === selectedId) ?? null;

    /* 引き出しの中身。最近のもの・その場の絞り込み */
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

    return (
        <div className="relative overflow-hidden">
            {/* ---- 地図 ---- */}
            <div className="relative min-h-[540px] lg:min-h-[620px]">
                {/*
                 * つなぎの線。丸と同じ %座標で引けば、
                 * 画面の大きさが変わっても丸の中心を外さない。
                 */}
                <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    {pages.map((page, index) => {
                        const slot = SLOTS[index % SLOTS.length];
                        const isHovered = hoveredId === page.id;
                        return (
                            <line
                                key={page.id}
                                x1="50"
                                y1="47"
                                x2={slot.x}
                                y2={slot.y}
                                stroke={
                                    isHovered
                                        ? "var(--color-forest)"
                                        : accentOf(page).line
                                }
                                strokeWidth={isHovered ? 1.6 : 1}
                                vectorEffect="non-scaling-stroke"
                                className="transition-opacity duration-300"
                                opacity={isSpread ? (isHovered ? 0.9 : 0.45) : 0}
                            />
                        );
                    })}
                </svg>

                {/* 飾りの点。ふだんは 2〜3 個だけ薄く見えている */}
                {DOTS.map((dot, index) => (
                    <span
                        key={index}
                        data-seed={dot.icon}
                        aria-hidden="true"
                        className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line/60 bg-surface text-faint shadow-sm transition-all duration-300"
                        style={{
                            left: `${dot.x}%`,
                            top: `${dot.y}%`,
                            opacity: isSpread ? 0.75 : index < 3 ? 0.3 : 0,
                            transform: `translate(-50%, -50%) scale(${isSpread ? 1 : 0.7})`,
                        }}
                    >
                        <ResourceIcon builtinKey={dot.icon} size={14} />
                    </span>
                ))}

                {/* ---- 真ん中の脳 ---- */}
                <div
                    className="absolute left-1/2 top-[47%] -translate-x-1/2 -translate-y-1/2 text-center"
                    style={{ width: 210 }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            setIsSpread((on) => !on);
                            setSelectedId(null);
                            setQuery("");
                        }}
                        aria-expanded={isSpread}
                        className="group mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-forest-line/70 bg-surface text-forest shadow-[0_10px_30px_-12px_rgba(31,78,107,0.35)] transition-transform duration-200 hover:scale-105"
                        style={{
                            background:
                                "radial-gradient(circle at 50% 38%, #ffffff 0%, #f2f7fb 70%, #e8f0f6 100%)",
                        }}
                    >
                        <BrainIcon />
                    </button>

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

                    {/* 横断検索の答え。分類をまたいで、出どころの色付きで */}
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
                    const slot = SLOTS[index % SLOTS.length];
                    const accent = accentOf(page);
                    const count = countOf(page);
                    const pending = pendingOf(page);

                    return (
                        <button
                            key={page.id}
                            type="button"
                            onClick={() => {
                                setSelectedId(page.id);
                                setPanelQuery("");
                            }}
                            onMouseEnter={() => setHoveredId(page.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            tabIndex={isSpread ? 0 : -1}
                            className="absolute flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full border bg-surface text-center shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md lg:h-[118px] lg:w-[118px]"
                            style={{
                                left: `${slot.x}%`,
                                top: `${slot.y}%`,
                                borderColor: accent.line,
                                background: `radial-gradient(circle at 50% 30%, #ffffff 0%, ${accent.tint} 100%)`,
                                /*
                                 * 畳んでいる間は中央に集めて消しておく。
                                 * 開いた瞬間、中央から持ち場へ滑っていく。
                                 */
                                transform: isSpread
                                    ? "translate(-50%, -50%) scale(1)"
                                    : "translate(-50%, -50%) scale(0.2)",
                                ...(isSpread
                                    ? {}
                                    : { left: "50%", top: "47%" }),
                                opacity: isSpread ? 1 : 0,
                                pointerEvents: isSpread ? "auto" : "none",
                                transitionDelay: isSpread
                                    ? `${index * 25}ms`
                                    : "0ms",
                            }}
                        >
                            <span style={{ color: accent.ink }}>
                                <ResourceIcon
                                    builtinKey={page.builtin_key}
                                    size={20}
                                />
                            </span>
                            <span className="mt-1 px-2 text-[12px] font-medium leading-tight text-ink">
                                {page.label}
                            </span>
                            <span className="mt-0.5 text-[10px] text-muted">
                                {count > 0 ? `${count}件` : "まだありません"}
                            </span>

                            {/* 未整理があるものには、気づける印を */}
                            {pending > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-medium text-white">
                                    {pending}
                                </span>
                            )}
                        </button>
                    );
                })}

                {/* ページを追加。地図の一員として、点線の丸で */}
                <button
                    type="button"
                    onClick={onOpenAdd}
                    tabIndex={isSpread ? 0 : -1}
                    className="absolute flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-line bg-surface/70 text-muted transition-all duration-300 hover:border-forest-line hover:text-forest"
                    style={{
                        left: "50%",
                        top: "84%",
                        transform: isSpread
                            ? "translate(-50%, -50%) scale(1)"
                            : "translate(-50%, -50%) scale(0.2)",
                        opacity: isSpread ? 1 : 0,
                        pointerEvents: isSpread ? "auto" : "none",
                        transitionDelay: isSpread
                            ? `${pages.length * 25}ms`
                            : "0ms",
                    }}
                    title="資料ページを追加します"
                >
                    <span className="text-xl font-light" aria-hidden="true">
                        +
                    </span>
                </button>
            </div>

            {/* 育ちの数字。札をやめたぶん、ここに静かに */}
            <p className="mt-2 text-center text-[11px] text-faint">
                この14日で本文が +{formatNumber(grew)} 文字育ちました ・
                本文から拾った項目 {fromBody} 件
                {pendingTotal > 0 && (
                    <span className="text-amber">
                        （未整理 {pendingTotal} 件）
                    </span>
                )}
            </p>

            {/* ---- 右の引き出し ---- */}
            <div
                className={[
                    "absolute inset-y-0 right-0 z-20 w-[290px] border-l border-line bg-surface shadow-xl transition-transform duration-300",
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
            width="52"
            height="52"
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
