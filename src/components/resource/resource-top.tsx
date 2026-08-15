/**
 * ============================================================
 * 原石航路 Studio
 * ResourceTop — 資料の地図
 *
 * 「整った一覧」ではなく「育っていく世界」に見せる。
 *
 *   核        真ん中は作品の核。題名を抱いて息をしている
 *   断片      分類の丸は件数が増えるほど大きくなり、
 *             1 つずつ拍をずらして呼吸する。空のページは点線
 *   入れ子    丸を押すと、世界がその丸へ吸い込まれてズームし、
 *             中の項目たちがまた同じように飛び出してくる。
 *             どの分類でも同じ。核を押せば世界へ戻る
 *   発見      丸に手をかざすと、最近の項目が衛星になって浮かぶ
 *   育ち      「この7日で 人物2・場所1 が増えました」と核の下で
 *             世界が語る。今週増えた丸には芽の印
 *   糸        線は開いた瞬間に中央から伸びて描かれる。
 *             分類同士にも薄い糸を張り、メニューではなく網に見せる
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useState } from "react";

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
    /** 項目を選んだ状態で一覧を開く。「この人をくわしく」の道 */
    onOpenEntry: (pageId: string, entryId: string) => void;
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
 * 狭い画面での置き場所。
 *
 * 広い画面の配置をそのまま縮めると、丸どうしが重なる。
 * 横は狭く縦に長いので、円ではなく縦長の楕円に並べ、
 * 左右の端まで使い切る。中ほど（核の左右）には置かない。
 */
const NARROW_SLOTS: { x: number; y: number }[] = [
    { x: 50, y: 8 },
    { x: 84, y: 20 },
    { x: 88, y: 42 },
    { x: 80, y: 66 },
    { x: 50, y: 78 },
    { x: 20, y: 66 },
    { x: 12, y: 42 },
    { x: 16, y: 20 },
    { x: 50, y: 92 },
    { x: 84, y: 88 },
    { x: 16, y: 88 },
    { x: 50, y: 30 },
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
    onOpenEntry,
    onOpenAdd,
}: Props) {
    const [isSpread, setIsSpread] = useState(false);

    /*
     * 狭い画面かどうか。
     * 丸の置き場所と大きさを変えるのに使う。
     * 決め打ちの配置のままだと、狭い幅では丸が重なる。
     */
    const [isNarrow, setIsNarrow] = useState(false);

    useEffect(() => {
        const measure = () => setIsNarrow(window.innerWidth < 768);
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [panelQuery, setPanelQuery] = useState("");

    /*
     * 中へ入っている分類。
     * 押した丸へ地図ごとズームし、その中の項目たちが
     * また同じように飛び出してくる。世界の入れ子。
     */
    const [focusedId, setFocusedId] = useState<string | null>(null);
    /*
     * ズームの吸い込まれる先（%）。
     * 出るときも同じ点へ戻るよう、離れたあとも覚えておく。
     */
    const [focusOrigin, setFocusOrigin] = useState({ x: 50, y: 47 });
    /* 中の項目たちを飛び出させる合図。入った一拍あとに立てる */
    const [isInnerSpread, setIsInnerSpread] = useState(false);
    /* 札を開いている項目。丸のすぐ下（下の段は上）に情報が出る */
    const [openItemId, setOpenItemId] = useState<string | null>(null);

    /*
     * 頁に来た瞬間、世界がひとりでに開く。
     * 一拍(0.2秒)置くのは、畳んだ状態から広がる動きを
     * 目に見せるため。最初から開いていると、ただの配置になる。
     * 核を押せば畳める。静かに眺めたい人の道も残す。
     */
    useEffect(() => {
        const timer = window.setTimeout(() => setIsSpread(true), 200);
        return () => window.clearTimeout(timer);
    }, []);

    /* 中に入ったら、一拍おいて項目たちを飛び出させる */
    useEffect(() => {
        if (!focusedId) {
            setIsInnerSpread(false);
            return;
        }
        const timer = window.setTimeout(() => setIsInnerSpread(true), 180);
        return () => window.clearTimeout(timer);
    }, [focusedId]);

    function focusPage(pageId: string, slot: { x: number; y: number }) {
        setFocusOrigin(slot);
        setFocusedId(pageId);
        setPanelQuery("");
        setHoveredId(null);
        setOpenItemId(null);
    }

    function slotOf(index: number) {
        const table = isNarrow ? NARROW_SLOTS : SLOTS;
        return table[index % table.length];
    }

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

    const focused = pages.find((row) => row.id === focusedId) ?? null;

    function entryNameOf(entryId: string): string {
        return entries.find((row) => row.id === entryId)?.name ?? "？";
    }

    /*
     * 中で見せる項目。分類ごとに形が違う。
     *   関係図    誰×誰と、その間柄
     *   プロット  段の題と、話の範囲
     *   その他    項目の名前と一言説明
     */
    const focusedItems = useMemo(() => {
        if (!focused) return [];
        const needle = panelQuery.trim().toLowerCase();

        let items: {
            id: string;
            name: string;
            sub: string;
            entry?: ResourceEntry;
            relation?: ResourceRelation;
            stage?: PlotStage;
        }[];

        if (focused.builtin_key === "relation") {
            items = relations.map((row) => ({
                id: row.id,
                name: `${entryNameOf(row.from_entry_id)} × ${entryNameOf(row.to_entry_id)}`,
                sub: row.label,
                relation: row,
            }));
        } else if (focused.builtin_key === "plot") {
            items = stages.map((row) => ({
                id: row.id,
                name: row.title,
                sub: row.episode_range,
                stage: row,
            }));
        } else {
            items = entries
                .filter(
                    (row) =>
                        row.page_id === focused.id &&
                        row.candidate_status !== "pending",
                )
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((row) => ({
                    id: row.id,
                    name: row.name,
                    sub: row.summary,
                    entry: row,
                }));
        }

        if (needle) {
            items = items.filter((row) =>
                `${row.name} ${row.sub}`.toLowerCase().includes(needle),
            );
        }
        return items;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focused, entries, relations, stages, panelQuery]);

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

    function pageOf(entry: ResourceEntry): ResourcePage | undefined {
        return pages.find((row) => row.id === entry.page_id);
    }

    /* 件数で丸が育つ。0件=88px、増えるほど最大132pxまで */
    function sizeOf(count: number): number {
        /* 狭い画面では一回り小さく。並べる余地が無い */
        const base = isNarrow ? 74 : 88;
        const grow = isNarrow ? 26 : 44;
        return base + Math.min(grow, Math.round(Math.log2(count + 1) * 11));
    }

    /* 分類同士の糸。両方のページがあるときだけ */
    const threads = THREADS.flatMap(([a, b]) => {
        const ia = pages.findIndex((row) => row.builtin_key === a);
        const ib = pages.findIndex((row) => row.builtin_key === b);
        if (ia < 0 || ib < 0) return [];
        return [{ from: slotOf(ia), to: slotOf(ib), key: `${a}-${b}` }];
    });

    /* 中で並べる項目は 11 個まで。残りは「他◯件」の丸に */
    const shownItems = focusedItems.slice(0, 11);
    const restCount = focusedItems.length - shownItems.length;

    return (
        <div className="relative overflow-hidden">
            {/* 狭い画面は縦に並べるので、その分の高さを取る */}
            <div className="relative min-h-[620px] sm:min-h-[540px] lg:min-h-[620px]">
                {/* ================= 外の世界 ================= */}
                <div
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                        /*
                         * ズームは世界ごと。押した丸の場所を
                         * 起点にして拡大しながら薄れると、
                         * その丸へ吸い込まれたように見える。
                         */
                        transformOrigin: `${focusOrigin.x}% ${focusOrigin.y}%`,
                        transform: focused ? "scale(2.1)" : "scale(1)",
                        opacity: focused ? 0 : 1,
                        pointerEvents: focused ? "none" : "auto",
                    }}
                >
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

                    <svg
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
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
                                    opacity={
                                        isSpread ? (isHovered ? 0.95 : 0.55) : 0
                                    }
                                />
                            );
                        })}
                    </svg>

                    {/* ---- 核 ---- */}
                    <div
                        className="absolute left-1/2 top-[47%] z-10 -translate-x-1/2 -translate-y-1/2 text-center"
                        style={{ width: isNarrow ? 190 : 230 }}
                    >
                        {/* 狭い画面では核も一回り小さく。丸と重ならないように */}
                        <div
                            className={[
                                "relative mx-auto",
                                isNarrow ? "h-28 w-28" : "h-36 w-36",
                            ].join(" ")}
                        >
                            <span
                                aria-hidden="true"
                                className="core-halo absolute -inset-5 rounded-full"
                                style={{
                                    background:
                                        "radial-gradient(circle, rgba(31,78,107,0.14) 0%, rgba(31,78,107,0) 70%)",
                                }}
                            />
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
                                    setQuery("");
                                }}
                                aria-expanded={isSpread}
                                className={[
                                    "core-breathe relative flex flex-col items-center justify-center rounded-full border border-forest-line/70 text-forest shadow-[0_14px_36px_-14px_rgba(31,78,107,0.4)] transition-transform duration-200 hover:scale-[1.04]",
                                    isNarrow ? "h-28 w-28" : "h-36 w-36",
                                ].join(" ")}
                                style={{
                                    background:
                                        "radial-gradient(circle at 50% 36%, #ffffff 0%, #f2f7fb 68%, #e6eef5 100%)",
                                }}
                            >
                                <BrainIcon />
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

                        <p className="mt-1.5 text-[11px] text-faint">
                            {growthWords
                                ? `この7日で ${growthWords} が増えました`
                                : "本文を書くほど、ここに世界が集まります"}
                        </p>

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
                                        const index = page
                                            ? pages.findIndex(
                                                  (row) => row.id === page.id,
                                              )
                                            : 0;
                                        return (
                                            <li key={entry.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        page &&
                                                        focusPage(
                                                            page.id,
                                                            slotOf(index),
                                                        )
                                                    }
                                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-canvas"
                                                >
                                                    <span
                                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                                                        style={{
                                                            background:
                                                                accent.tint,
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
                        const satellites = isHovered
                            ? satellitesOf(page.id)
                            : [];

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
                                {/*
                                 * 呼吸の層。
                                 * 位置決め(外)・呼吸(ここ)・押した拡大(内)を
                                 * 別の箱に分ける。1 つの箱に重ねると
                                 * transform が奪い合って動きが消える。
                                 */}
                                <div
                                    className="node-breathe"
                                    style={{
                                        animationDuration: `${4 + (index % 3) * 0.8}s`,
                                        animationDelay: `${(index * 0.53) % 3}s`,
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            focusPage(page.id, slot)
                                        }
                                        tabIndex={isSpread ? 0 : -1}
                                        className="relative flex flex-col items-center justify-center rounded-full text-center shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md"
                                        style={{
                                            width: size,
                                            height: size,
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
                                            {count > 0
                                                ? `${count}件`
                                                : "まだ白紙"}
                                        </span>
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
                                </div>

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
                                            onClick={() =>
                                                focusPage(page.id, slot)
                                            }
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

                    {/* ページを追加 */}
                    <button
                        type="button"
                        onClick={onOpenAdd}
                        tabIndex={isSpread ? 0 : -1}
                        className="absolute flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-line bg-surface/70 text-muted transition-all duration-300 hover:border-forest-line hover:text-forest"
                        style={{
                            left: "50%",
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

                {/* ================= 分類の中 ================= */}
                <div
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                        transform: focused ? "scale(1)" : "scale(0.55)",
                        opacity: focused ? 1 : 0,
                        pointerEvents: focused ? "auto" : "none",
                        transitionDelay: focused ? "120ms" : "0ms",
                    }}
                >
                    {focused && (
                        <>
                            {/* 世界へ戻る道。迷子にしない */}
                            <button
                                type="button"
                                onClick={() => setFocusedId(null)}
                                className="absolute left-1 top-1 z-20 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-muted shadow-sm hover:border-forest-line hover:text-forest"
                            >
                                ← {workTitle || "作品"}の世界へ
                            </button>

                            {/* 中の糸 */}
                            <svg
                                className="pointer-events-none absolute inset-0 h-full w-full"
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                aria-hidden="true"
                            >
                                {shownItems.map((item, index) => {
                                    const slot = slotOf(index);
                                    const bend = index % 2 === 0 ? 3 : -3;
                                    return (
                                        <path
                                            key={item.id}
                                            d={`M 50 47 Q ${(50 + slot.x) / 2 + bend} ${
                                                (47 + slot.y) / 2 + bend
                                            } ${slot.x} ${slot.y}`}
                                            fill="none"
                                            pathLength={1}
                                            strokeDasharray="1"
                                            stroke={accentOf(focused).line}
                                            strokeWidth="1"
                                            vectorEffect="non-scaling-stroke"
                                            style={{
                                                strokeDashoffset: isInnerSpread
                                                    ? 0
                                                    : 1,
                                                transition: `stroke-dashoffset 450ms ease ${index * 40}ms, opacity 300ms`,
                                            }}
                                            opacity={isInnerSpread ? 0.5 : 0}
                                        />
                                    );
                                })}
                            </svg>

                            {/* 分類の核。押すと世界へ戻る */}
                            <div
                                className="absolute left-1/2 top-[47%] z-10 -translate-x-1/2 -translate-y-1/2 text-center"
                                style={{ width: 220 }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setFocusedId(null)}
                                    title="世界へ戻ります"
                                    className="core-breathe mx-auto flex h-32 w-32 flex-col items-center justify-center rounded-full border shadow-[0_14px_36px_-14px_rgba(31,78,107,0.35)] transition-transform duration-200 hover:scale-[1.04]"
                                    style={{
                                        borderColor: accentOf(focused).line,
                                        color: accentOf(focused).ink,
                                        background: `radial-gradient(circle at 50% 36%, #ffffff 0%, ${accentOf(focused).tint} 100%)`,
                                    }}
                                >
                                    <ResourceIcon
                                        builtinKey={focused.builtin_key}
                                        size={26}
                                    />
                                    <span className="mt-1 px-2 text-[12px] font-semibold text-ink">
                                        {focused.label}
                                    </span>
                                    <span className="text-[10px] text-muted">
                                        {countOf(focused)}件
                                    </span>
                                </button>

                                <div className="mt-3">
                                    <input
                                        type="text"
                                        value={panelQuery}
                                        onChange={(e) =>
                                            setPanelQuery(e.target.value)
                                        }
                                        placeholder={`${focused.label}の中を探す`}
                                        className="w-full rounded-full border border-line bg-surface px-4 py-2 text-center text-[12px] text-ink outline-none placeholder:text-faint focus:border-forest-line"
                                    />
                                </div>

                                <div className="mt-2 flex items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onOpen(focused.id)}
                                        className="rounded-full bg-forest-dark px-4 py-1.5 text-[11px] font-medium text-white hover:opacity-90"
                                    >
                                        一覧を開く
                                    </button>
                                    {pendingOf(focused) > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => onOpen(focused.id)}
                                            className="rounded-full bg-amber-tint px-3 py-1.5 text-[11px] text-amber"
                                        >
                                            未整理 {pendingOf(focused)}件
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 中の項目たち。世界と同じ作法で飛び出す */}
                            {shownItems.map((item, index) => {
                                const slot = slotOf(index);
                                const accent = accentOf(focused);
                                return (
                                    <div
                                        key={item.id}
                                        className="absolute transition-all duration-300"
                                        style={{
                                            zIndex:
                                                openItemId === item.id ? 30 : 1,
                                            left: isInnerSpread
                                                ? `${slot.x}%`
                                                : "50%",
                                            top: isInnerSpread
                                                ? `${slot.y}%`
                                                : "47%",
                                            transform: `translate(-50%, -50%) scale(${isInnerSpread ? 1 : 0.2})`,
                                            opacity: isInnerSpread ? 1 : 0,
                                            pointerEvents: isInnerSpread
                                                ? "auto"
                                                : "none",
                                            transitionDelay: isInnerSpread
                                                ? `${index * 28}ms`
                                                : "0ms",
                                        }}
                                    >
                                        <div
                                            className="node-breathe"
                                            style={{
                                                animationDuration: `${4 + (index % 3) * 0.8}s`,
                                                animationDelay: `${(index * 0.61) % 3}s`,
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setOpenItemId((current) =>
                                                        current === item.id
                                                            ? null
                                                            : item.id,
                                                    )
                                                }
                                                title={
                                                    item.sub || item.name
                                                }
                                                aria-expanded={
                                                    openItemId === item.id
                                                }
                                                className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full border bg-surface px-2 text-center shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md"
                                                style={{
                                                    borderColor:
                                                        openItemId === item.id
                                                            ? accent.ink
                                                            : accent.line,
                                                    background: `radial-gradient(circle at 50% 30%, #ffffff 0%, ${accent.tint} 100%)`,
                                                }}
                                            >
                                                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink">
                                                    {item.name}
                                                </span>
                                                {item.sub && (
                                                    <span className="mt-0.5 line-clamp-1 text-[9px] text-faint">
                                                        {item.sub}
                                                    </span>
                                                )}
                                            </button>
                                        </div>

                                        {/*
                                         * 情報の札。押した丸のすぐ下に開く。
                                         * 下の段（y が深い）の丸は、画面から
                                         * はみ出すので上に開く。
                                         */}
                                        {openItemId === item.id && (
                                            <div
                                                className="satellite absolute left-1/2 z-30 w-[230px] -translate-x-1/2 rounded-xl border bg-surface p-3 text-left shadow-xl"
                                                style={{
                                                    borderColor: accent.line,
                                                    ...(slot.y > 58
                                                        ? { bottom: "calc(50% + 54px)" }
                                                        : { top: "calc(50% + 54px)" }),
                                                }}
                                            >
                                                <ItemCard
                                                    item={item}
                                                    page={focused}
                                                    onOpenList={() =>
                                                        /*
                                                         * 項目(人物など)は、その項目を
                                                         * 選んだ状態で一覧を開く。
                                                         * 関係とプロットには項目の頁が
                                                         * 無いので、一覧の入口へ。
                                                         */
                                                        item.entry
                                                            ? onOpenEntry(
                                                                  focused.id,
                                                                  item.id,
                                                              )
                                                            : onOpen(focused.id)
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* あふれたぶん */}
                            {restCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onOpen(focused.id)}
                                    className="absolute flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full border-2 border-dashed border-line bg-surface/70 text-muted transition-all duration-300 hover:border-forest-line hover:text-forest"
                                    style={{
                                        left: `${slotOf(11).x}%`,
                                        top: `${slotOf(11).y}%`,
                                        transform: `translate(-50%, -50%) scale(${isInnerSpread ? 1 : 0.2})`,
                                        opacity: isInnerSpread ? 1 : 0,
                                        transitionDelay: `${shownItems.length * 28}ms`,
                                    }}
                                >
                                    <span className="text-[11px]">
                                        他{restCount}件
                                    </span>
                                    <span className="text-[9px]">一覧へ</span>
                                </button>
                            )}

                            {/* まだ何も無い分類 */}
                            {focusedItems.length === 0 && (
                                <p className="absolute left-1/2 top-[76%] -translate-x-1/2 text-[11px] text-faint">
                                    {panelQuery.trim()
                                        ? "見つかりませんでした"
                                        : "まだ何もいません。一覧から書き足せます"}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>

            <p className="mt-2 text-center text-[11px] text-faint">
                この14日で本文が +{formatNumber(grew)} 文字育ちました
                {pendingTotal > 0 && (
                    <span className="text-amber">
                        （未整理 {pendingTotal} 件）
                    </span>
                )}
            </p>
        </div>
    );
}

/**
 * 項目の情報の札。
 *
 * 持ち物は分類で違う。
 *   項目      一言説明・欄の値(3つまで)・別名・主要の印
 *   関係      間柄と、そのおぼえがき
 *   プロット  話の範囲と、あらまし
 * 全部は出さない。ここは立ち読み。深くは「くわしく開く」。
 */
function ItemCard({
    item,
    page,
    onOpenList,
}: {
    item: {
        name: string;
        sub: string;
        entry?: ResourceEntry;
        relation?: ResourceRelation;
        stage?: PlotStage;
    };
    page: ResourcePage;
    onOpenList: () => void;
}) {
    const entry = item.entry;

    /* 欄の値。書いてあるものだけ、3つまで */
    const filled = entry
        ? page.fields
              .map((field) => {
                  const value = entry.values[field.key];
                  const text = Array.isArray(value)
                      ? value.join("、")
                      : value === true
                        ? "はい"
                        : value === false || value == null
                          ? ""
                          : String(value);
                  return { label: field.label, text: text.trim() };
              })
              .filter((row) => row.text)
              .slice(0, 3)
        : [];

    return (
        <div>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                {item.name}
                {entry?.is_major && (
                    <span className="rounded bg-forest-tint px-1 text-[9px] font-medium text-forest">
                        主要
                    </span>
                )}
            </p>

            {item.sub && (
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                    {item.sub}
                </p>
            )}

            {filled.length > 0 && (
                <dl className="mt-2 space-y-1">
                    {filled.map((row) => (
                        <div key={row.label} className="flex gap-2 text-[10px]">
                            <dt className="shrink-0 text-faint">{row.label}</dt>
                            <dd className="min-w-0 flex-1 truncate text-ink">
                                {row.text}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}

            {entry && entry.aliases.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1">
                    {entry.aliases.slice(0, 4).map((alias) => (
                        <span
                            key={alias}
                            className="rounded-full bg-canvas px-2 py-0.5 text-[9px] text-muted"
                        >
                            {alias}
                        </span>
                    ))}
                </p>
            )}

            {item.relation?.note && (
                <p className="mt-2 text-[10px] leading-relaxed text-muted">
                    {item.relation.note}
                </p>
            )}

            {item.stage?.description && (
                <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-muted">
                    {item.stage.description}
                </p>
            )}

            <button
                type="button"
                onClick={onOpenList}
                className="mt-2.5 w-full rounded-lg bg-forest-dark py-1.5 text-[11px] font-medium text-white hover:opacity-90"
            >
                くわしく開く
            </button>
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
