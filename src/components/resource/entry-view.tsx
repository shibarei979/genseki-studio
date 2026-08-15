/**
 * ============================================================
 * 原石航路 Studio
 * EntryView — 資料ページ（人物・場所・組織・用語など）
 *
 * 上から
 *   1. 見出しと説明
 *   2. 数え上げ 3 枚
 *   3. 本文から拾った候補 / 表記ゆれの提案
 *   4. 検索・絞り込み・並び替え・見せ方
 *   5. 一覧（左）と詳細（右）
 *
 * 一覧と詳細を左右に並べる。
 * 資料は「探して確かめる」場所なので、
 * 選んだ瞬間に中身が出るほうが往復が減る。
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import DeleteButton from "@/components/common/delete-button";
import EntryImage from "@/components/common/entry-image";
import CandidateStrip from "@/components/resource/candidate-strip";
import EntryStartersPanel from "@/components/resource/entry-starters-panel";
import { useAutoMerge } from "@/components/resource/use-auto-merge";
import EntryDetail from "@/components/resource/entry-detail";
import ResourceIcon from "@/components/resource/resource-icons";
import type { DuplicateGroup } from "@/lib/resource/dedupe";
import { formatNumber } from "@/lib/utils/text";
import type {
    Episode,
    EntryMention,
    ResourceEntry,
    ResourcePage,
    ResourceRelation,
} from "@/types";
import { formatEpisodeLabel } from "@/types";

const PER_PAGE = 12;

type ViewMode = "cards" | "grid";

interface Props {
    page: ResourcePage;
    pages: ResourcePage[];
    entries: ResourceEntry[];
    allEntries: ResourceEntry[];
    episodes: Episode[];
    relations: ResourceRelation[];
    mentions: EntryMention[];
    /** 名前を渡すと、その名前で作る */
    onCreate: (name?: string) => void;
    onUpdate: (entryId: string, patch: Partial<ResourceEntry>) => void;
    onDelete: (entry: ResourceEntry) => void;
    onMerge: (keepId: string, mergeId: string) => Promise<void>;
    onGenerateImage: (
        entry: ResourceEntry,
        hint: string,
        era: string,
    ) => Promise<void>;
    canGenerateImage: boolean;
    /** その作品でこれまでに作った図案の数 */
    imageUsedCount: number;
    /**
     * 開いた瞬間に選んでおく項目。
     * 資料の地図から「この人をくわしく」と飛んでくる道のため。
     * 無ければ今までどおり、何も選ばずに開く。
     */
    initialEntryId?: string | null;
    onJump?: (episodeId: string, line: number) => void;
    onMergeDuplicates: (group: DuplicateGroup) => void;
}

export default function EntryView({
    page,
    pages,
    entries,
    allEntries,
    episodes,
    relations,
    mentions,
    onCreate,
    onUpdate,
    onDelete,
    onMerge,
    onGenerateImage,
    canGenerateImage,
    imageUsedCount,
    initialEntryId,
    onJump,
    onMergeDuplicates,
}: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(
        initialEntryId ?? null,
    );
    /* 「同じ人にまとめる」を開いているか。開くと相手を選ぶ列が出る */
    const [isUniting, setIsUniting] = useState(false);
    const [uniteQuery, setUniteQuery] = useState("");

    /* 地図から別の項目を指されたら、選び直す */
    useEffect(() => {
        if (initialEntryId) setSelectedId(initialEntryId);
    }, [initialEntryId]);
    const [mode, setMode] = useState<ViewMode>("cards");
    const [keyword, setKeyword] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState<"all" | "body" | "manual">("all");
    const [sort, setSort] = useState<"created" | "name" | "mentions">("created");
    const [pageIndex, setPageIndex] = useState(0);

    const confirmed = entries.filter((entry) => entry.candidate_status === "none");

    /*
     * 同じ名前のものは、見つけたら黙ってまとめる。
     * 尋ねても、中身を見比べる人はいない。
     */
    useAutoMerge(confirmed, onMergeDuplicates);

    const pending = entries.filter((entry) => entry.candidate_status === "pending");

    /** 絞り込みに使う欄 */
    const typeField = page.fields.find(
        (field) => field.type === "select" || field.key === "type" || field.key === "category",
    );

    const typeValues = useMemo(() => {
        if (!typeField) return [];
        const counts = new Map<string, number>();
        for (const entry of confirmed) {
            const value = entry.values[typeField.key];
            if (typeof value !== "string" || !value) continue;
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [confirmed, typeField]);

    const relationCountById = useMemo(() => {
        const counts = new Map<string, number>();
        for (const relation of relations) {
            counts.set(relation.from_entry_id, (counts.get(relation.from_entry_id) ?? 0) + 1);
            counts.set(relation.to_entry_id, (counts.get(relation.to_entry_id) ?? 0) + 1);
        }
        return counts;
    }, [relations]);

    const mentionsById = useMemo(() => {
        const map = new Map<string, EntryMention[]>();
        for (const mention of mentions) {
            const list = map.get(mention.entry_id) ?? [];
            list.push(mention);
            map.set(mention.entry_id, list);
        }
        return map;
    }, [mentions]);

    const episodeById = useMemo(
        () => new Map(episodes.map((episode) => [episode.id, episode])),
        [episodes],
    );

    const filtered = useMemo(() => {
        const word = keyword.trim();
        let rows = confirmed;

        if (typeField && typeFilter !== "all") {
            rows = rows.filter((entry) => entry.values[typeField.key] === typeFilter);
        }
        if (sourceFilter === "body") rows = rows.filter((entry) => entry.candidate_source);
        if (sourceFilter === "manual") rows = rows.filter((entry) => !entry.candidate_source);
        if (word) {
            rows = rows.filter(
                (entry) =>
                    entry.name.includes(word) ||
                    entry.summary.includes(word) ||
                    (entry.aliases ?? []).some((alias) => alias.includes(word)),
            );
        }

        const sorted = [...rows];
        if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ja"));
        else if (sort === "mentions") {
            sorted.sort(
                (a, b) =>
                    (mentionsById.get(b.id)?.length ?? 0) -
                    (mentionsById.get(a.id)?.length ?? 0),
            );
        }
        return sorted;
    }, [confirmed, keyword, typeFilter, sourceFilter, typeField, sort, mentionsById]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const current = Math.min(pageIndex, pageCount - 1);
    const shown = filtered.slice(current * PER_PAGE, (current + 1) * PER_PAGE);

    const selected = confirmed.find((entry) => entry.id === selectedId) ?? null;
    const fromBody = confirmed.filter((entry) => entry.candidate_source).length;
    const missingImages = page.image_style
        ? confirmed.filter((entry) => !entry.image_url && entry.name).length
        : 0;
    const linkedCount = confirmed.filter((entry) => mentionsById.has(entry.id)).length;
    const relationTotal = relations.filter(
        (relation) =>
            confirmed.some((entry) => entry.id === relation.from_entry_id) ||
            confirmed.some((entry) => entry.id === relation.to_entry_id),
    ).length;

    return (
        <div className="space-y-4">
            <header className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-xl font-medium text-ink">
                        <span className="text-forest">
                            <ResourceIcon builtinKey={page.builtin_key} size={22} />
                        </span>
                        {page.label}
                    </h1>
                    <p className="mt-1 text-sm text-muted">{page.description}</p>
                </div>
                <button
                    type="button"
                    onClick={() => onCreate()}
                    className="shrink-0 rounded-md bg-forest px-4 py-2 text-sm text-white hover:bg-forest-dark"
                >
                    ＋ {page.label}を追加
                </button>
            </header>

            <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                    label={`登録済みの${page.label}`}
                    value={confirmed.length}
                    unit="件"
                    detail={`本文から ${fromBody}件 ／ 手で追加 ${confirmed.length - fromBody}件`}
                />
                <Stat
                    label="関係の総数"
                    value={relationTotal}
                    unit="件"
                    detail="所属・対立・協力など"
                />
                <Stat
                    label="本文に登場"
                    value={linkedCount}
                    unit="件"
                    detail={`のべ登場 ${mentions.length}回`}
                />
            </div>

            {/* 図案がまだ無いものへの案内 */}
            {page.image_style && canGenerateImage && missingImages > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-forest-line bg-forest-tint/40 px-4 py-3">
                    <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink">
                        図案のない{page.label}が{missingImages}件あります。
                        {page.image_style === "map"
                            ? "地図は名前から作れます。違っていれば作り直せます。"
                            : "項目を選ぶと、右側の「図案を作る」から作れます。"}
                    </p>
                </div>
            )}

            <div className="overflow-hidden rounded-lg border border-line bg-surface">
                <CandidateStrip
                    candidates={pending}
                    fields={page.fields}
                    onApprove={(entry, name, summary, values) =>
                        onUpdate(entry.id, {
                            name,
                            summary,
                            ...(values ? { values } : {}),
                            candidate_status: "none",
                        })
                    }
                    onReject={(entry) => onUpdate(entry.id, { candidate_status: "rejected" })}
                    onApproveAll={(rows) => {
                        for (const row of rows) {
                            onUpdate(row.id, { candidate_status: "none" });
                        }
                    }}
                    onRejectAll={(rows) => {
                        for (const row of rows) {
                            onUpdate(row.id, { candidate_status: "rejected" });
                        }
                    }}
                />



                {/* 絞り込み */}
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                    <input
                        type="search"
                        value={keyword}
                        onChange={(e) => {
                            setKeyword(e.target.value);
                            setPageIndex(0);
                        }}
                        placeholder={`${page.label}名・説明で検索`}
                        aria-label="検索"
                        className="min-w-[180px] flex-1 rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-forest"
                    />

                    {typeValues.length > 0 && (
                        <select
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setPageIndex(0);
                            }}
                            aria-label="種別で絞り込む"
                            className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-forest"
                        >
                            <option value="all">すべての種別</option>
                            {typeValues.map(([value, count]) => (
                                <option key={value} value={value}>
                                    {value}（{count}）
                                </option>
                            ))}
                        </select>
                    )}

                    <select
                        value={sourceFilter}
                        onChange={(e) => {
                            setSourceFilter(e.target.value as typeof sourceFilter);
                            setPageIndex(0);
                        }}
                        aria-label="出典で絞り込む"
                        className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-forest"
                    >
                        <option value="all">すべての出典</option>
                        <option value="body">本文から追加</option>
                        <option value="manual">手で追加</option>
                    </select>

                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as typeof sort)}
                        aria-label="並び替え"
                        className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-forest"
                    >
                        <option value="created">登場順</option>
                        <option value="name">名前順</option>
                        <option value="mentions">関連の多い順</option>
                    </select>

                    {(keyword || typeFilter !== "all" || sourceFilter !== "all") && (
                        <button
                            type="button"
                            onClick={() => {
                                setKeyword("");
                                setTypeFilter("all");
                                setSourceFilter("all");
                                setPageIndex(0);
                            }}
                            className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink"
                        >
                            リセット
                        </button>
                    )}

                    <div className="ml-auto flex gap-0.5 rounded-md border border-line p-0.5">
                        {(["cards", "grid"] as ViewMode[]).map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setMode(key)}
                                aria-pressed={mode === key}
                                aria-label={key === "cards" ? "一覧表示" : "格子表示"}
                                className={[
                                    "rounded px-2.5 py-1 text-xs",
                                    mode === key
                                        ? "bg-forest text-white"
                                        : "text-muted hover:text-ink",
                                ].join(" ")}
                            >
                                {key === "cards" ? "一覧" : "格子"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 一覧と詳細 */}
                {/*
                 * 開いているときは、詳細のほうを広く取る。
                 * 資料は読み書きする場所なので、一覧より広い場所が要る。
                 * 一覧は「どれを開くか」が分かれば足りるので細くてよい。
                 */}
                <div
                    className={[
                        "grid gap-0",
                        selected ? "lg:grid-cols-[300px_minmax(0,1fr)]" : "",
                    ].join(" ")}
                >
                    <div
                        className={[
                            "min-w-0 border-line lg:border-r",
                            // 開いているときは一覧を縦に伸ばし、選び直しやすくする
                            selected ? "thin-scroll max-h-[70vh] overflow-y-auto" : "",
                        ].join(" ")}
                    >
                        {shown.length === 0 ? (
                            confirmed.length === 0 ? (
                                /*
                                 * まだ何も無いとき。
                                 * 押せるものを出す。白紙より手が動く。
                                 */
                                <div className="p-4">
                                    <EntryStartersPanel
                                        builtinKey={page.builtin_key}
                                        label={page.label}
                                        description={
                                            page.description ||
                                            "本文を書けば、AI補助が候補をここへ運んできます。"
                                        }
                                        onCreate={(name) => onCreate(name)}
                                        onCreateEmpty={() => onCreate()}
                                    />
                                </div>
                            ) : (
                                <p className="px-6 py-20 text-center text-sm text-faint">
                                    条件に合う項目がありません。
                                </p>
                            )
                        ) : (
                            <ul
                                className={[
                                    "gap-3 p-4",
                                    mode === "grid"
                                        ? selected
                                            ? "flex flex-col"
                                            : "grid grid-cols-2 xl:grid-cols-3"
                                        : "flex flex-col",
                                ].join(" ")}
                            >
                                {shown.map((entry) => (
                                    <li key={entry.id}>
                                        <EntryCard
                                            entry={entry}
                                            mode={mode}
                                            isWide={page.image_style === "map"}
                                            isSelected={entry.id === selectedId}
                                            relationCount={relationCountById.get(entry.id) ?? 0}
                                            episodes={(mentionsById.get(entry.id) ?? [])
                                                .map((mention) =>
                                                    episodeById.get(mention.episode_id),
                                                )
                                                .filter((row): row is Episode => Boolean(row))}
                                            typeValue={
                                                typeField
                                                    ? String(entry.values[typeField.key] ?? "")
                                                    : ""
                                            }
                                            onSelect={() => setSelectedId(entry.id)}
                                            onDelete={() => onDelete(entry)}
                                        />
                                    </li>
                                ))}

                                <li className={mode === "grid" ? "" : "mt-1"}>
                                    <button
                                        type="button"
                                        onClick={() => onCreate()}
                                        className="flex h-full w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-4 text-sm text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        ＋ {page.label}を新規追加
                                    </button>
                                </li>
                            </ul>
                        )}

                        {filtered.length > PER_PAGE && (
                            <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
                                <span>
                                    {filtered.length}件中 {current * PER_PAGE + 1}〜
                                    {Math.min((current + 1) * PER_PAGE, filtered.length)}件を表示
                                </span>
                                <div className="flex items-center gap-1">
                                    <Pager
                                        label="‹"
                                        disabled={current === 0}
                                        onClick={() => setPageIndex(current - 1)}
                                    />
                                    {Array.from({ length: pageCount }, (_, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => setPageIndex(index)}
                                            aria-current={index === current ? "page" : undefined}
                                            className={[
                                                "min-w-7 rounded px-2 py-1",
                                                index === current
                                                    ? "bg-forest text-white"
                                                    : "hover:bg-canvas",
                                            ].join(" ")}
                                        >
                                            {index + 1}
                                        </button>
                                    ))}
                                    <Pager
                                        label="›"
                                        disabled={current >= pageCount - 1}
                                        onClick={() => setPageIndex(current + 1)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {selected && (
                        <div className="min-w-0 p-4">
                            {/*
                             * 同じ人にまとめる。
                             *
                             * 別名は本文の読み取りでも見ているので、
                             * ここでまとめておけば、以後その呼び名が
                             * 本文に出ても同じ人として数えられる。
                             * 二度と同じことを訊かれない。
                             */}
                            <div className="mb-3 rounded-lg border border-line bg-canvas p-3">
                                {!isUniting ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsUniting(true);
                                            setUniteQuery("");
                                        }}
                                        className="text-[12px] text-muted hover:text-forest"
                                    >
                                        別の呼び名を「{selected.name}」と同じ
                                        {page.label === "人物" ? "人" : "もの"}
                                        にまとめる
                                    </button>
                                ) : (
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[12px] font-medium text-ink">
                                                {selected.name} と同じにするもの
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setIsUniting(false)
                                                }
                                                className="shrink-0 text-[11px] text-faint hover:text-ink"
                                            >
                                                やめる
                                            </button>
                                        </div>

                                        <input
                                            type="text"
                                            value={uniteQuery}
                                            onChange={(e) =>
                                                setUniteQuery(e.target.value)
                                            }
                                            placeholder="呼び名で探す"
                                            className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-forest-line"
                                        />

                                        <ul className="thin-scroll mt-2 max-h-44 space-y-1 overflow-y-auto">
                                            {entries
                                                .filter(
                                                    (row) =>
                                                        row.id !== selected.id &&
                                                        (!uniteQuery.trim() ||
                                                            [
                                                                row.name,
                                                                ...row.aliases,
                                                            ]
                                                                .join(" ")
                                                                .toLowerCase()
                                                                .includes(
                                                                    uniteQuery
                                                                        .trim()
                                                                        .toLowerCase(),
                                                                )),
                                                )
                                                .slice(0, 12)
                                                .map((row) => (
                                                    <li key={row.id}>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (
                                                                    !window.confirm(
                                                                        `「${row.name}」を「${selected.name}」と同じものにまとめますか？\n\n` +
                                                                            `「${row.name}」は ${selected.name} の別名として残ります。\n` +
                                                                            `以後、本文に「${row.name}」が出てきても ${selected.name} として数えられます。`,
                                                                    )
                                                                ) {
                                                                    return;
                                                                }
                                                                await onMerge(
                                                                    selected.id,
                                                                    row.id,
                                                                );
                                                                setIsUniting(
                                                                    false,
                                                                );
                                                            }}
                                                            className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left hover:border-forest-line"
                                                        >
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-[12px] text-ink">
                                                                    {row.name}
                                                                </span>
                                                                {row.summary && (
                                                                    <span className="block truncate text-[10px] text-faint">
                                                                        {
                                                                            row.summary
                                                                        }
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <span className="shrink-0 text-[11px] text-forest">
                                                                まとめる
                                                            </span>
                                                        </button>
                                                    </li>
                                                ))}
                                        </ul>
                                    </div>
                                )}

                                {/* いま何と同じ扱いになっているか */}
                                {selected.aliases.length > 0 && (
                                    <p className="mt-2 flex flex-wrap items-center gap-1">
                                        <span className="text-[10px] text-faint">
                                            同じ扱い：
                                        </span>
                                        {selected.aliases.map((alias) => (
                                            <span
                                                key={alias}
                                                className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted"
                                            >
                                                {alias}
                                            </span>
                                        ))}
                                    </p>
                                )}
                            </div>

                            <EntryDetail
                                key={selected.id}
                                page={page}
                                pages={pages}
                                entry={selected}
                                allEntries={allEntries}
                                episodes={episodes}
                                relations={relations}
                                mentions={mentions}
                                canGenerateImage={canGenerateImage}
                                imageUsedCount={imageUsedCount}
                                onGenerateImage={(hint, era) => onGenerateImage(selected, hint, era)}
                                onJump={onJump}
                                onChange={(patch) => onUpdate(selected.id, patch)}
                                onSelectEntry={setSelectedId}
                                onClose={() => setSelectedId(null)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

function EntryCard({
    entry,
    mode,
    isWide,
    isSelected,
    relationCount,
    episodes,
    typeValue,
    onSelect,
    onDelete,
}: {
    entry: ResourceEntry;
    mode: ViewMode;
    /** 地図のように横長の図案を持つページ */
    isWide: boolean;
    isSelected: boolean;
    relationCount: number;
    episodes: Episode[];
    typeValue: string;
    onSelect: () => void;
    onDelete: () => void;
}) {
    const unique = Array.from(new Map(episodes.map((e) => [e.id, e])).values());

    return (
        <div className="group relative">
            <button
                type="button"
                onClick={onSelect}
                className={[
                    "flex w-full gap-3 rounded-lg border p-3 text-left",
                    mode === "grid" || isWide ? "flex-col" : "flex-row items-start",
                    isSelected
                        ? "border-forest bg-forest-tint/50"
                        : "border-line hover:border-forest-line hover:bg-canvas",
                ].join(" ")}
            >
                <Thumb
                    entry={entry}
                    size={mode === "grid" ? 0 : 56}
                    fill={mode === "grid"}
                    isWide={isWide}
                />

                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                        {typeValue && (
                            <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
                                {typeValue}
                            </span>
                        )}
                        <span className="truncate text-sm font-medium text-ink">
                            {entry.name || "（名前未設定）"}
                        </span>
                        {entry.candidate_source && (
                            <span className="rounded bg-forest-tint px-1.5 py-0.5 text-[10px] text-forest">
                                本文から追加
                            </span>
                        )}
                        {entry.is_major && (
                            <span className="rounded bg-forest px-1.5 py-0.5 text-[10px] text-white">
                                主要
                            </span>
                        )}
                    </span>

                    <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted">
                        {entry.summary || "説明はまだありません"}
                    </span>

                    <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                        <span>関係 {relationCount}件</span>
                        {unique.length > 0 && (
                            <span className="flex items-center gap-1">
                                <span className="text-faint">関連エピソード</span>
                                {unique.slice(0, 3).map((episode) => (
                                    <span
                                        key={episode.id}
                                        className="rounded bg-canvas px-1.5 py-0.5 text-[10px]"
                                    >
                                        {formatEpisodeLabel(episode).split("　")[0]}
                                    </span>
                                ))}
                                {unique.length > 3 && (
                                    <span className="text-faint">+{unique.length - 3}</span>
                                )}
                            </span>
                        )}
                    </span>
                </span>
            </button>

            <div className="absolute right-2 top-2">
                <DeleteButton
                    label={entry.name || "この項目"}
                    onDelete={onDelete}
                    isFloating
                    size="small"
                />
            </div>
        </div>
    );
}

function Thumb({
    entry,
    size,
    fill,
    isWide = false,
}: {
    entry: ResourceEntry;
    size: number;
    fill: boolean;
    isWide?: boolean;
}) {
    const ratio = isWide ? "aspect-[3/2]" : "aspect-[4/3]";

    if (fill || isWide) {
        return (
            <EntryImage
                src={entry.image_url}
                fallback={Array.from(entry.name)[0] ?? "?"}
                className={`${ratio} w-full rounded-md object-cover`}
            />
        );
    }

    return (
        <span style={{ width: size, height: size }} className="shrink-0">
            <EntryImage
                src={entry.image_url}
                fallback={Array.from(entry.name)[0] ?? "?"}
                className="h-full w-full rounded-md object-cover"
            />
        </span>
    );
}

function Stat({
    label,
    value,
    unit,
    detail,
}: {
    label: string;
    value: number;
    unit: string;
    detail: string;
}) {
    return (
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-0.5 text-xl text-ink">
                {formatNumber(value)}
                <span className="ml-1 text-xs text-muted">{unit}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-faint">{detail}</p>
        </div>
    );
}

function Pager({
    label,
    disabled,
    onClick,
}: {
    label: string;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="rounded px-2 py-1 hover:bg-canvas disabled:opacity-30"
        >
            {label}
        </button>
    );
}
