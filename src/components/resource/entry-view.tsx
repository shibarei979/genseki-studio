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

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import DeleteButton from "@/components/common/delete-button";
import ProBadge from "@/components/common/pro-badge";
import { useMemberFeatures } from "@/lib/subscription/use-member-features";
import EntryImage from "@/components/common/entry-image";
import CandidateStrip from "@/components/resource/candidate-strip";
import MergePanel from "@/components/resource/merge-panel";
import EntryStartersPanel from "@/components/resource/entry-starters-panel";
import { useAutoMerge } from "@/components/resource/use-auto-merge";
import EntryDetail from "@/components/resource/entry-detail";
import EntryBoard from "@/components/resource/entry-board";
import ResourceIcon from "@/components/resource/resource-icons";
import type { DuplicateGroup } from "@/lib/resource/dedupe";
import { formatNumber } from "@/lib/utils/text";
import { scanMentions } from "@/lib/resource/mention-scan";
import type {
    Episode,
    EntryMention,
    ResourceEntry,
    ResourcePage,
    ResourceRelation,
} from "@/types";
import { formatEpisodeLabel } from "@/types";
import type { ImageQuota } from "@/components/resource/entry-image-panel";

const PER_PAGE = 12;

type ViewMode = "cards" | "grid";

interface Props {
    /** 作品。格子の板の雰囲気（ジャンル）と、選び直した雰囲気を覚えるのに使う */
    workId?: string;
    genre?: string | null;
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
    imageQuota: ImageQuota;
    /**
     * 開いた瞬間に選んでおく項目。
     * 資料の地図から「この人をくわしく」と飛んでくる道のため。
     * 無ければ今までどおり、何も選ばずに開く。
     */
    initialEntryId?: string | null;
    onJump?: (episodeId: string, line: number) => void;
    /** 蛍光ペン。資料と話を決めて、本文を開く */
    onPick?: (entryId: string, episodeId: string) => void;
    onMergeDuplicates: (group: DuplicateGroup) => void;
}

export default function EntryView({
    workId = "",
    genre = null,
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
    imageQuota,
    initialEntryId,
    onJump,
    onPick,
    onMergeDuplicates,
}: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(
        initialEntryId ?? null,
    );
    /*
     * 詳細の入れ物。
     *
     * ★ 携帯では、選んだら詳細まで画面を送る。
     *   詳細は一覧の下に出るので、押しても画面が動かず、出たことに気づきにくかった。
     */
    const detailRef = useRef<HTMLDivElement | null>(null);
    const firstSelect = useRef(true);
    useEffect(() => {
        /* 開いた直後（外から指名されて開いたとき）は送らない */
        if (firstSelect.current) {
            firstSelect.current = false;
            return;
        }
        if (!selectedId || typeof window === "undefined" || window.innerWidth >= 1024) return;
        const timer = window.setTimeout(() => {
            detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
        return () => window.clearTimeout(timer);
    }, [selectedId]);

    /* 「同じ人にまとめる」を開いているか。開くと相手を選ぶ列が出る */
    const [isUniting, setIsUniting] = useState(false);
    const [uniteQuery, setUniteQuery] = useState("");

    /* 地図から別の項目を指されたら、選び直す */
    useEffect(() => {
        if (initialEntryId) setSelectedId(initialEntryId);
    }, [initialEntryId]);
    const [mode, setMode] = useState<ViewMode>("cards");
    /*
     * ★ 図鑑（絵を大きく並べる見方）は Pro。一覧は誰でも。
     *   Pro でないときは、選んでいても一覧で出す。
     */
    const { entryReport: isPro } = useMemberFeatures();
    const isGallery = isPro && mode === "grid";
    const [showProNote, setShowProNote] = useState(false);
    /* 図鑑の板は Esc で閉じる */
    useEffect(() => {
        if (!isGallery || !selectedId) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setSelectedId(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isGallery, selectedId]);
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

    /*
     * 本文に出てくる回数。
     *
     * ★ 詳細の「本文での登場」と同じ数え方にする。
     *   前は保存しておいた記録（mentions）を数えていたので、
     *   詳細では「2話に3回」なのに、一覧の上では「本文に登場 0件」と食い違っていた。
     *   詳細と同じく、いまの本文を読んで数える。
     */
    const liveCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const entry of confirmed) {
            if (!entry.name) continue;
            map.set(entry.id, scanMentions(entry, episodes).length);
        }
        return map;
    }, [confirmed, episodes]);

    /*
     * その人らしい台詞をひとつ（格子の札に添える）。
     *
     * ★ 話し手で拾う。名前が「」のすぐ前にある台詞だけ。
     *   「エバは笑った。「また星を見てたの？」」→ エバの台詞。
     *   その行に名前が出ているだけで拾うと、ほかの人の台詞が札に出てしまった。
     * ★ 短すぎず長すぎないものを、前から探す。格子のときだけ数える。
     */
    const speechById = useMemo(() => {
        const map = new Map<string, string>();
        if (mode !== "grid") return map;

        /* 呼び名 → 誰。長い名前から当てる（「リオ・アルセイン」を「リオ」より先に） */
        const callers: { word: string; id: string }[] = [];
        for (const entry of confirmed) {
            for (const word of [entry.name, ...(entry.aliases ?? [])]) {
                if (word && word.trim()) callers.push({ word: word.trim(), id: entry.id });
            }
        }
        callers.sort((a, b) => b.word.length - a.word.length);
        if (callers.length === 0) return map;

        const fits = (line: string) => line.length >= 4 && line.length <= 28;
        for (const episode of episodes) {
            const text = episode.body ?? "";
            for (const hit of Array.from(text.matchAll(/「([^」\n]{2,40})」/g))) {
                const at = hit.index ?? 0;
                /* 「 の前 16 字（別の台詞と行はまたがない）で、いちばん近くに出てくる名前が話し手 */
                const lineStart = text.lastIndexOf("\n", at - 1) + 1;
                const lastClose = text.lastIndexOf("」", at - 1);
                const from = Math.max(lineStart, lastClose + 1, at - 16);
                const before = text.slice(from, at);
                let speaker: string | null = null;
                let nearest = -1;
                for (const caller of callers) {
                    const found = before.lastIndexOf(caller.word);
                    if (found === -1) continue;
                    const end = found + caller.word.length;
                    if (end > nearest) {
                        nearest = end;
                        speaker = caller.id;
                    }
                }
                if (!speaker) continue;
                const line = hit[1].trim();
                const current = map.get(speaker);
                if (!current || (!fits(current) && fits(line))) map.set(speaker, line);
            }
        }
        for (const [id, line] of Array.from(map.entries())) {
            if (line.length > 32) map.set(id, `${line.slice(0, 32)}…`);
        }
        return map;
    }, [mode, confirmed, episodes]);
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
            sorted.sort((a, b) => (liveCounts.get(b.id) ?? 0) - (liveCounts.get(a.id) ?? 0));
        }
        return sorted;
    }, [confirmed, keyword, typeFilter, sourceFilter, typeField, sort, liveCounts]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const current = Math.min(pageIndex, pageCount - 1);
    const shown = filtered.slice(current * PER_PAGE, (current + 1) * PER_PAGE);

    const selected = confirmed.find((entry) => entry.id === selectedId) ?? null;
    const fromBody = confirmed.filter((entry) => entry.candidate_source).length;
    const linkedCount = Array.from(liveCounts.values()).filter((n) => n > 0).length;
    const liveTotal = Array.from(liveCounts.values()).reduce((sum, n) => sum + n, 0);
    const relationTotal = relations.filter(
        (relation) =>
            confirmed.some((entry) => entry.id === relation.from_entry_id) ||
            confirmed.some((entry) => entry.id === relation.to_entry_id),
    ).length;

    /*
     * 詳細（と「同じ人にまとめる」）。
     * 一覧では右（携帯では下）に、図鑑では横から出る板の中に出す。
     */
    const detailBody = selected ? (
        <>
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
                imageQuota={imageQuota}
                onGenerateImage={(hint, era) => onGenerateImage(selected, hint, era)}
                onJump={onJump}
                onPick={onPick}
                onChange={(patch) => onUpdate(selected.id, patch)}
                onSelectEntry={setSelectedId}
                onClose={() => setSelectedId(null)}
            />

            {/*
              * 同じ人にまとめる。
              * ★ 詳細の下に置く。
              *   前は詳細のいちばん上に大きな押し具で出ていた。使う回数は少ないので、読む邪魔にならない所へ。
              * ★ ただし、字だけの小さな印では何ができるのか分からなかった。
              *   「どんなときに使うか」「押すとどうなるか」を一言添え、押し具も枠付きにする。
              */}
            <div className="mt-4 rounded-lg border border-dashed border-line bg-canvas/60 p-3">
                {!isUniting ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-medium text-ink">
                                同じ{page.label === "人物" ? "人" : "もの"}が、別の名前で登録されていませんか？
                            </p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                                あだ名や名字だけの呼び方が、別の{page.label}として並んでいるときに使います。
                                まとめると、名前は「{selected.name}」のまま、もう一方は呼び名として残ります。
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setIsUniting(true);
                                setUniteQuery("");
                            }}
                            className="shrink-0 self-start rounded-md border border-forest-line bg-surface px-3 py-1.5 text-[12px] text-forest hover:bg-forest-tint sm:self-center"
                        >
                            まとめる相手を選ぶ
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-medium text-ink">
                                「{selected.name}」にまとめる相手を選んでください
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
                                                /*
                                                 * ★ 確認を出さない。
                                                 *
                                                 *   「同じものかもしれない」と
                                                 *   出ている時点で、
                                                 *   合体させるかどうかは
                                                 *   もう決まっている。
                                                 *
                                                 *   間違えたら、
                                                 *   分けて作り直せばよい。
                                                 *   一件ずつ確認を挟むと、
                                                 *   数が多いときに手間が勝つ。
                                                 */
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
                {isUniting && selected.aliases.length > 0 && (
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
        </>
    ) : null;

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

            {/*
              * 数字のまとめ。
              *
              * ★ 3 つを 1 枚の帯に、区切り線で分けて並べる。
              *   大きな札 3 枚は場所を取りすぎ、1 行の文にすると数字と説明が混ざって読みにくかった。
              *   見出し → 数字 → 補足、の順に縦に置き、どの数字が何かを目で拾えるようにする。
              */}
            <div className="flex divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface">
                <Stat
                    label="登録"
                    value={confirmed.length}
                    note={`本文から${fromBody}・手で${confirmed.length - fromBody}`}
                />
                <Stat label="関係" value={relationTotal} note="関係図の線" />
                <Stat label="本文に登場" value={linkedCount} note={`のべ${liveTotal}回`} />
            </div>

            <div className="overflow-hidden rounded-lg border border-line bg-surface">
                {/*
                 * 同じものかもしれない項目を、一覧の上に出す。
                 *
                 * これまでは、本文から拾ったその瞬間にだけ尋ねていた。
                 * 一度「いいえ」と答えると二度と出てこないので、
                 * あとから見直す場所がどこにも無かった。
                 * 「統合する方法がない」と言われたのは、そのため。
                 *
                 * 似たものが無いときは、この帯そのものが出ない。
                 */}
                <MergePanel entries={confirmed} onMerge={onMerge} />

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
                        {(["cards", "grid"] as ViewMode[]).map((key) => {
                            const isOn = key === "cards" ? !isGallery : isGallery;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        if (key === "grid" && !isPro) {
                                            setShowProNote((on) => !on);
                                            return;
                                        }
                                        setShowProNote(false);
                                        setMode(key);
                                    }}
                                    aria-pressed={isOn}
                                    aria-label={key === "cards" ? "一覧で見る" : "格子で見る"}
                                    className={[
                                        "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs",
                                        isOn ? "bg-forest text-white" : "text-muted hover:text-ink",
                                    ].join(" ")}
                                >
                                    {key === "cards" ? "一覧" : "格子"}
                                    {key === "grid" && <ProBadge />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {showProNote && !isPro && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas px-4 py-2.5 text-[12px] text-muted">
                        <span>
                            格子は、カードを並べて一度に見渡せる見方です。
                            <ProBadge className="mx-0.5" />
                            の機能です。サブスクに入ると使えます。
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowProNote(false)}
                            className="ml-auto text-[11px] text-faint hover:text-ink"
                        >
                            閉じる
                        </button>
                    </div>
                )}

                {/* 一覧と詳細 */}
                {/*
                 * 開いているときは、詳細のほうを広く取る。
                 * 資料は読み書きする場所なので、一覧より広い場所が要る。
                 * 一覧は「どれを開くか」が分かれば足りるので細くてよい。
                 */}
                <div
                    className={[
                        "grid gap-0",
                        selected && !isGallery ? "lg:grid-cols-[300px_minmax(0,1fr)]" : "",
                    ].join(" ")}
                >
                    <div
                        className={[
                            "min-w-0 border-line lg:border-r",
                            /*
                             * ★ 高さの上限は付けない。
                             *   前は開いているとき 70vh で切っていたので、一覧の下が途中で切れて見えていた。
                             */
                            "",
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
                            isGallery ? (
                                /*
                                 * ★ 格子。絵を中心に、名前をその下に。
                                 *   選んでも並びは崩さず、詳細は横から出る板に出す。
                                 */
                                <EntryBoard
                                    title={page.label}
                                    entries={shown}
                                    workId={workId || page.work_id}
                                    genre={genre}
                                    isWide={page.image_style === "map"}
                                    selectedId={selectedId}
                                    relationCountById={relationCountById}
                                    bodyCountById={liveCounts}
                                    speechById={speechById}
                                    labelOf={(entry) =>
                                        (typeField ? String(entry.values[typeField.key] ?? "") : "") ||
                                        String(entry.values.role ?? "")
                                    }
                                    onSelect={setSelectedId}
                                />
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
                                            mode="cards"
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

                                {/* ★ 下の「＋新規追加」は外した。右上の「＋追加」と同じことをしていた */}
                            </ul>
                            )
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

                    {selected && !isGallery && (
                        <div ref={detailRef} className="min-w-0 scroll-mt-3 p-4">
                            {detailBody}
                        </div>
                    )}
                </div>
            </div>

            {/*
              * 図鑑で選んだときの板。
              * ★ パソコンは右から、携帯は画面いっぱいに出す。後ろを押すか × で閉じる。
              */}
            {/*
              * ★ body の直下へ出す。
              *   親に transform があると、fixed が画面ではなく親に合わせて置かれ、上がずれていた。
              */}
            {selected && isGallery && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[450]" aria-modal="true">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedId(null)} />
                    <div
                        className="thin-scroll absolute inset-y-0 right-0 w-full overflow-y-auto bg-surface shadow-2xl sm:w-[min(640px,92vw)]"
                        style={{ maxWidth: "none" }}
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur">
                            <p className="truncate text-[13px] text-muted">
                                {page.label}
                            </p>
                            <button
                                type="button"
                                onClick={() => setSelectedId(null)}
                                aria-label="閉じる"
                                className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-muted hover:bg-canvas"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4">{detailBody}</div>
                    </div>
                </div>,
                document.body,
            )}
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

/**
 * 数字のまとめの 1 つぶん。見出し・数字・補足。
 * ★ 見出しを数字の上に、はっきりした字で置く。数字は大きく、色を付けて目に入りやすく。
 *   補足は薄くしすぎず、携帯でも切らずに折り返す。
 */
function Stat({ label, value, note }: { label: string; value: number; note: string }) {
    return (
        <div className="min-w-0 flex-1 px-3 py-3 sm:px-5">
            <p className="text-[12px] font-medium text-muted">{label}</p>
            <p className="mt-1 flex items-baseline gap-0.5 leading-none">
                <span className="text-[26px] font-semibold tabular-nums text-forest">{formatNumber(value)}</span>
                <span className="text-[12px] text-muted">件</span>
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">{note}</p>
        </div>
    );
}
