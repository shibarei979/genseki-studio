/**
 * ============================================================
 * 原石航路 Studio
 * WorkGrid — 作品一覧
 *
 * 表紙・状態・更新日・あらすじを 1 枚に収める。
 * 下段には「どこまで書いたか」と文字数を置く。
 * 作品を開く前に、続きから書けるかどうかが分かるようにするため。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import DeleteButton from "@/components/common/delete-button";
import { formatDateTime, formatNumber } from "@/lib/utils/text";
import { compareDate } from "@/types";
import type { Episode, WorkWithStats } from "@/types";

type SortKey = "updated" | "created" | "chars" | "title";
/**
 * 見せ方の 3 種類。
 *   detail … 情報量の多いカード
 *   cover  … 表紙と題名だけ。並べて眺めるとき
 *   list   … 一行ずつ
 */
type ViewMode = "detail" | "cover" | "list";

/**
 * 並べる大きさ。
 * 作品が数点の人と数十点の人で、ちょうどいい大きさが違う。
 */
type CardSize = "small" | "medium" | "large";

const SIZE_LABEL: Record<CardSize, string> = {
    small: "小",
    medium: "中",
    large: "大",
};

/** 大きさごとの列数 */
const GRID_COLUMNS: Record<ViewMode, Record<CardSize, string>> = {
    cover: {
        small: "grid-cols-5 sm:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11",
        medium: "grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8",
        large: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
    },
    detail: {
        small: "sm:grid-cols-2 xl:grid-cols-4",
        medium: "sm:grid-cols-2 xl:grid-cols-3",
        large: "xl:grid-cols-2",
    },
    list: { small: "", medium: "", large: "" },
};

const MODE_LABEL: Record<ViewMode, string> = {
    detail: "詳しく",
    cover: "表紙",
    list: "一覧",
};

const SORT_LABEL: Record<SortKey, string> = {
    updated: "更新日が新しい順",
    created: "作成日が新しい順",
    chars: "文字数が多い順",
    title: "タイトル順",
};

interface Props {
    works: WorkWithStats[];
    episodes: Episode[];
    onDelete: (work: WorkWithStats) => void;
}

export default function WorkGrid({ works, episodes, onDelete }: Props) {
    const [keyword, setKeyword] = useState("");
    const [filter, setFilter] = useState<"all" | "draft" | "public">("all");
    const [sort, setSort] = useState<SortKey>("updated");
    const [mode, setMode] = useState<ViewMode>("detail");
    const [size, setSize] = useState<CardSize>("medium");
    const [menuId, setMenuId] = useState<string | null>(null);

    const shown = useMemo(() => {
        const word = keyword.trim();
        let rows = works;

        if (filter === "draft") rows = rows.filter((work) => work.visibility === "draft");
        if (filter === "public") rows = rows.filter((work) => work.visibility !== "draft");
        if (word) {
            rows = rows.filter(
                (work) =>
                    work.title.includes(word) ||
                    (work.summary ?? "").includes(word) ||
                    work.tags.some((tag) => tag.includes(word)),
            );
        }

        const sorted = [...rows];
        if (sort === "created") sorted.sort((a, b) => compareDate(b.created_at, a.created_at));
        else if (sort === "chars")
            sorted.sort((a, b) => b.total_char_count - a.total_char_count);
        else if (sort === "title") sorted.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "ja"));
        else sorted.sort((a, b) => compareDate(b.updated_at, a.updated_at));

        return sorted;
    }, [works, keyword, filter, sort]);

    return (
        <section>
            {/*
             * 見出しの行に、作品を増やす道を並べる。
             * 一覧の中に混ぜると、作品が増えたとき埋もれる。
             */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-wide text-ink">
                    作品一覧
                    {works.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-muted">
                            {works.length}
                        </span>
                    )}
                </h2>

                <div className="flex gap-2">
                    <Link
                        href="/post"
                        className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs text-ink hover:border-forest-line hover:text-forest"
                    >
                        <ImportIcon />
                        原稿を取り込む
                    </Link>
                    <Link
                        href="/post"
                        className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-xs text-white hover:bg-forest-dark"
                    >
                        <PlusIcon />
                        新しい作品
                    </Link>
                </div>
            </div>

            {/* 操作列 */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className="relative">
                    <input
                        type="search"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="作品を検索"
                        aria-label="作品を検索"
                        className="w-56 rounded-lg border border-line bg-surface py-2.5 pl-4 pr-10 text-sm outline-none focus:border-forest"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-faint">
                        <SearchIcon />
                    </span>
                </div>

                <div className="relative">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as typeof filter)}
                        aria-label="絞り込み"
                        className="appearance-none rounded-lg border border-line bg-surface py-2.5 pl-4 pr-10 text-sm outline-none focus:border-forest"
                    >
                        <option value="all">絞り込み</option>
                        <option value="draft">下書きのみ</option>
                        <option value="public">公開・限定公開</option>
                    </select>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-faint">
                        <FilterIcon />
                    </span>
                </div>

                <div className="relative ml-auto">
                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as SortKey)}
                        aria-label="並び替え"
                        className="appearance-none rounded-lg border border-line bg-surface py-2.5 pl-4 pr-9 text-sm outline-none focus:border-forest"
                    >
                        {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                            <option key={key} value={key}>
                                {SORT_LABEL[key]}
                            </option>
                        ))}
                    </select>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-faint">
                        ▾
                    </span>
                </div>

                {/* 大きさ。一覧では効かないので出さない */}
                {mode !== "list" && (
                    <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-1">
                        {(Object.keys(SIZE_LABEL) as CardSize[]).map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setSize(key)}
                                aria-pressed={size === key}
                                aria-label={`${SIZE_LABEL[key]}さく並べる`}
                                className={[
                                    "h-7 w-7 rounded text-[11px]",
                                    size === key
                                        ? "bg-forest-tint font-medium text-forest"
                                        : "text-muted hover:text-ink",
                                ].join(" ")}
                            >
                                {SIZE_LABEL[key]}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
                    {(Object.keys(MODE_LABEL) as ViewMode[]).map((key) => (
                        <ModeButton
                            key={key}
                            label={`${MODE_LABEL[key]}見る`}
                            isActive={mode === key}
                            onClick={() => setMode(key)}
                        >
                            {key === "detail" ? (
                                <DetailIcon />
                            ) : key === "cover" ? (
                                <GridIcon />
                            ) : (
                                <ListIcon />
                            )}
                        </ModeButton>
                    ))}
                </div>
            </div>

            {/* 一覧 */}
            {works.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-line py-20 text-center">
                    <p className="text-sm text-ink">まだ作品がありません。</p>
                    <p className="mt-1 text-sm text-muted">
                        上の「新しい作品を作る」から始められます。
                    </p>
                </div>
            ) : shown.length === 0 ? (
                <p className="mt-5 rounded-xl border border-line bg-surface py-16 text-center text-sm text-faint">
                    条件に合う作品がありません。
                </p>
            ) : mode === "cover" ? (
                <ul className={`mt-5 grid gap-3 ${GRID_COLUMNS.cover[size]}`}>
                    {shown.map((work) => (
                        <li key={work.id}>
                            <Link
                                href={`/workspace/${work.id}`}
                                className="group block"
                            >
                                <span className="block overflow-hidden rounded-lg border border-line transition-shadow group-hover:shadow-md">
                                    <Cover work={work} size="cover" />
                                </span>
                                <span
                                    className={[
                                        "mt-1.5 block truncate font-medium leading-tight text-ink group-hover:text-forest",
                                        size === "large" ? "text-[13px]" : "text-[11px]",
                                    ].join(" ")}
                                >
                                    {work.title}
                                </span>
                                {size !== "small" && (
                                    <span className="mt-0.5 block text-[10px] text-faint">
                                        {formatNumber(work.total_char_count)}字
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : mode === "detail" ? (
                <ul className={`mt-5 grid gap-4 ${GRID_COLUMNS.detail[size]}`}>
                    {shown.map((work) => (
                        <li key={work.id}>
                            <WorkCard
                                work={work}
                                size={size}
                                episodes={episodes}
                                isMenuOpen={menuId === work.id}
                                onToggleMenu={() =>
                                    setMenuId(menuId === work.id ? null : work.id)
                                }
                                onDelete={() => onDelete(work)}
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                    {shown.map((work) => (
                        <li key={work.id} className="flex items-center gap-4 px-5 py-3.5">
                            <Cover work={work} size="small" />
                            <div className="min-w-0 flex-1">
                                <Link
                                    href={`/workspace/${work.id}`}
                                    className="truncate text-[15px] text-ink hover:text-forest"
                                >
                                    {work.title}
                                </Link>
                                <p className="mt-0.5 truncate text-xs text-muted">
                                    {work.summary ?? work.genre}
                                </p>
                            </div>
                            <StatusChip work={work} />
                            <span className="hidden w-28 shrink-0 text-right text-xs text-muted sm:block">
                                {formatNumber(work.total_char_count)} 文字
                            </span>
                            <span className="hidden w-32 shrink-0 text-right text-xs text-faint lg:block">
                                更新：{formatDateTime(work.updated_at).slice(0, 10)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/**
 * ============================================================
 * 作品カード
 * ============================================================
 */

function WorkCard({
    work,
    size,
    episodes,
    isMenuOpen,
    onToggleMenu,
    onDelete,
}: {
    work: WorkWithStats;
    size: CardSize;
    episodes: Episode[];
    isMenuOpen: boolean;
    onToggleMenu: () => void;
    onDelete: () => void;
}) {
    const own = episodes.filter((episode) => episode.work_id === work.id);
    const lastDone = [...own].reverse().find((episode) => episode.status === "done");

    /** どこまで書いたか。話が無いときは資料づくりの段階とみなす */
    const progressLabel =
        own.length === 0
            ? "プロット作成中"
            : lastDone
              ? `第${lastDone.ep_number}話まで`
              : `第${own.length}話 執筆中`;

    return (
        <div className="group relative flex h-full gap-3.5 rounded-xl border border-line bg-surface p-3.5 hover:border-forest-line hover:shadow-sm">
            {/*
             * 表紙を大きく取り、文字は右へまとめる。
             * 状態・日付・あらすじ・話数を縦に散らすと、
             * 1 件ぶんが縦に伸びて一覧が読みにくくなる。
             */}
            <Cover work={work} size={size === "large" ? "xlarge" : "large"} />

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-1">
                    <Link
                        href={`/workspace/${work.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-forest"
                    >
                        {work.title}
                    </Link>
                    <button
                        type="button"
                        onClick={onToggleMenu}
                        aria-label="この作品の操作"
                        aria-expanded={isMenuOpen}
                        className="-mr-1 shrink-0 px-1 leading-none text-faint opacity-0 hover:text-ink group-hover:opacity-100"
                    >
                        ⋮
                    </button>
                </div>

                {/* 状態と数は 1 行にまとめる */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted">
                    <StatusChip work={work} />
                    <span>{progressLabel}</span>
                    <span className="text-faint">·</span>
                    <span>{formatNumber(work.total_char_count)}字</span>
                </div>

                <p className="mt-2 line-clamp-2 flex-1 text-[11px] leading-relaxed text-muted">
                    {work.summary || "あらすじはまだありません"}
                </p>

                <p className="mt-2 text-[10px] text-faint">
                    更新 {formatDateTime(work.updated_at).slice(0, 10)}
                </p>
            </div>

            {isMenuOpen && (
                <div className="absolute right-3 top-11 z-20 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
                    <Link
                        href={`/workspace/${work.id}`}
                        className="block px-4 py-2 text-xs text-ink hover:bg-canvas"
                    >
                        執筆する
                    </Link>
                    <Link
                        href={`/workspace/${work.id}/resource`}
                        className="block px-4 py-2 text-xs text-ink hover:bg-canvas"
                    >
                        資料を開く
                    </Link>
                    <Link
                        href={`/workspace/${work.id}/settings`}
                        className="block px-4 py-2 text-xs text-ink hover:bg-canvas"
                    >
                        設定
                    </Link>
                    <div className="flex items-center justify-between border-t border-line px-4 py-2">
                        <span className="text-xs text-muted">削除する</span>
                        <DeleteButton
                            label={work.title}
                            note="この作品と、中のすべての話・資料を削除します。元に戻せません。"
                            onDelete={onDelete}
                            size="small"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

/**
 * 表紙。画像はまだ持てないので、題名から決まる図を出す。
 * 同じ作品なら必ず同じ絵になり、一覧で見分けがつく。
 */
function Cover({
    work,
    size,
}: {
    work: WorkWithStats;
    size: "small" | "large" | "xlarge" | "cover";
}) {
    const seed = hashOf(work.title);
    const hue = seed % 360;
    /*
     * 表紙の形。縦長の 16:9（＝ 9:16）。
     *
     * 3:4 だと正方形に近く、本に見えない。
     * 縦に長いほうが、書架に並ぶ本らしくなる。
     */
    const box =
        size === "cover"
            ? "block aspect-[9/16] w-full"
            : size === "xlarge"
              ? "h-[176px] w-[99px]"
              : size === "large"
                ? "h-[128px] w-[72px]"
                : "h-12 w-[27px]";

    return (
        <span
            className={`${box} shrink-0 overflow-hidden ${size === "cover" ? "" : "rounded-md"}`}
            style={{ background: `hsl(${hue} 22% 88%)` }}
        >
            <svg
                viewBox="0 0 90 160"
                preserveAspectRatio="none"
                className="h-full w-full"
                aria-hidden="true"
            >
                <rect width="90" height="160" fill={`hsl(${hue} 24% 86%)`} />
                <path
                    d={`M0 ${96 + (seed % 20)} L25 ${64 + (seed % 28)} L48 ${92 + (seed % 18)} L68 ${56 + (seed % 32)} L90 ${86 + (seed % 22)} L90 160 L0 160 Z`}
                    fill={`hsl(${hue} 26% 72%)`}
                />
                <path
                    d={`M0 ${124 + (seed % 14)} L31 ${102 + (seed % 18)} L62 ${120 + (seed % 14)} L90 ${106 + (seed % 18)} L90 160 L0 160 Z`}
                    fill={`hsl(${hue} 28% 60%)`}
                />
                <circle cx={22 + (seed % 46)} cy="36" r="9" fill="#ffffff" opacity="0.7" />
                {size === "cover" && (
                    <text
                        x="45"
                        y="60"
                        textAnchor="middle"
                        fontSize="9"
                        fill={`hsl(${hue} 40% 28%)`}
                        opacity="0.85"
                    >
                        {work.title.slice(0, 8)}
                    </text>
                )}
            </svg>
        </span>
    );
}

function StatusChip({ work }: { work: WorkWithStats }) {
    const isDraft = work.visibility === "draft";
    return (
        <span
            className={[
                "inline-block rounded px-2 py-0.5 text-[10px]",
                isDraft
                    ? "bg-[var(--color-amber-tint)] text-[var(--color-amber)]"
                    : "bg-forest-tint text-forest",
            ].join(" ")}
        >
            {isDraft ? "下書き" : "執筆中"}
        </span>
    );
}

function ModeButton({
    label,
    isActive,
    onClick,
    children,
}: {
    label: string;
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={isActive}
            className={[
                "flex h-8 w-9 items-center justify-center rounded-md",
                isActive ? "bg-forest-tint text-forest" : "text-faint hover:text-ink",
            ].join(" ")}
        >
            {children}
        </button>
    );
}

function hashOf(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
    return Math.abs(hash);
}

function SearchIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    );
}

function FilterIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
    );
}

function DetailIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <rect x="3" y="4" width="7" height="16" rx="1.5" />
            <path d="M13 6h8M13 11h8M13 16h5" />
        </svg>
    );
}

function GridIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
    );
}

function ListIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    );
}

function ImportIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 15V3M8 7l4-4 4 4" />
            <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}
