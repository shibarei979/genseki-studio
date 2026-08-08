/**
 * ============================================================
 * 原石航路 Studio
 * TimelineView — 出来事・時系列
 *
 * 「年表」から名前を変えている。
 * 年月日でしか並べられないと、歴史ものとファンタジーしか使えない。
 * 表し方を切り替えれば、ミステリーのアリバイにも、
 * 恋愛の思い出にも、日常作品の一週間にも使える。
 *
 * 出来事の「間隔」を線の上に出すのが要点。
 * 並んでいるだけでは、次の出来事までが一日なのか十年なのか分からない。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import DeleteButton from "@/components/common/delete-button";
import CandidateStrip from "@/components/resource/candidate-strip";
import EntryStartersPanel from "@/components/resource/entry-starters-panel";
import { describeGap, readTime } from "@/lib/resource/timeline-scale";
import { useAutoMerge } from "@/components/resource/use-auto-merge";
import ResourceIcon from "@/components/resource/resource-icons";
import type { DuplicateGroup } from "@/lib/resource/dedupe";
import type { Episode, ResourceEntry, ResourcePage, TimelineMode } from "@/types";
import { TIMELINE_MODE_LABEL, TIMELINE_MODE_PLACEHOLDER } from "@/types";

const IMPORTANCE = ["高", "中", "低"] as const;

const IMPORTANCE_STYLE: Record<string, string> = {
    高: "border-[#c0705e] bg-[#fbeeea] text-[#a5503c]",
    中: "border-[#c99a2e] bg-[#fdf8ec] text-[#a97c1a]",
    低: "border-line bg-canvas text-muted",
};

interface Props {
    page: ResourcePage;
    entries: ResourceEntry[];
    episodes: Episode[];
    allEntries: ResourceEntry[];
    /** 名前を渡すと、その名前で作る */
    onCreate: (name?: string) => void;
    /** 話を開く。出来事から本文へ戻るために使う */
    onOpenEpisode?: (episodeId: string) => void;
    onUpdate: (entryId: string, patch: Partial<ResourceEntry>) => void;
    onDelete: (entry: ResourceEntry) => void;
    onChangeMode: (mode: TimelineMode) => void;
    onMergeDuplicates: (group: DuplicateGroup) => void;
}

export default function TimelineView({
    page,
    entries,
    episodes,
    allEntries,
    onCreate,
    onOpenEpisode,
    onUpdate,
    onDelete,
    onChangeMode,
    onMergeDuplicates,
}: Props) {
    const [openId, setOpenId] = useState<string | null>(null);
    const [importanceFilter, setImportanceFilter] = useState("all");

    /*
     * 誰の出来事かで絞る。
     *
     * 「リオに何が起きたか」だけを追いたいことがある。
     * 全部が並んでいると、その人の筋が見えない。
     */
    const [personFilter, setPersonFilter] = useState<string | null>(null);

    const events = entries.filter((entry) => entry.candidate_status === "none");

    /*
     * 同じ名前のものは、見つけたら黙ってまとめる。
     * 尋ねても、中身を見比べる人はいない。
     */
    useAutoMerge(events, onMergeDuplicates);

    /*
     * 本文から拾った候補。
     * ここに承認の欄が無いと、拾われても画面に出ないまま埋もれる。
     */
    const pending = entries.filter((entry) => entry.candidate_status === "pending");
    const mode = page.timeline_mode;

    const filtered = useMemo(() => {
        let rows = events;

        if (importanceFilter !== "all") {
            rows = rows.filter(
                (event) => String(event.values.importance ?? "") === importanceFilter,
            );
        }

        if (personFilter) {
            rows = rows.filter((event) => {
                const people = Array.isArray(event.values.people)
                    ? event.values.people
                    : [];
                return people.map(String).includes(personFilter);
            });
        }

        return rows;
    }, [events, importanceFilter, personFilter]);

    /*
     * 時間で並べ替える。
     *
     * 「いつ」を数に直せたものは、その順に。
     * 読めなかったものは、書いた順のまま後ろへ回す。
     *
     * 順番だけの表し方では並べ替えない。
     * 書き手が置いた順が、そのまま意味を持つ。
     */
    const shown = useMemo(() => {
        if (mode === "order") return filtered;

        const withTime = filtered.map((event, index) => ({
            event,
            index,
            time: readTime(String(event.values.when ?? ""), mode),
        }));

        return [...withTime]
            .sort((a, b) => {
                if (a.time.value === null && b.time.value === null) {
                    return a.index - b.index;
                }
                /* 読めなかったものは後ろ */
                if (a.time.value === null) return 1;
                if (b.time.value === null) return -1;

                return a.time.value - b.time.value;
            })
            .map((row) => row.event);
    }, [filtered, mode]);

    const episodeById = useMemo(
        () => new Map(episodes.map((episode) => [episode.id, episode])),
        [episodes],
    );
    const entryById = useMemo(
        () => new Map(allEntries.map((entry) => [entry.id, entry])),
        [allEntries],
    );

    /*
     * 出来事に出てくる人物。
     * 多い順に並べる。主役ほど前に来る。
     */
    const peopleInEvents = useMemo(() => {
        const counts = new Map<string, number>();

        for (const event of events) {
            const people = Array.isArray(event.values.people)
                ? event.values.people
                : [];

            for (const id of people) {
                const key = String(id);
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }

        const rows: { id: string; name: string; count: number }[] = [];
        counts.forEach((count, id) => {
            rows.push({ id, name: entryById.get(id)?.name ?? "", count });
        });

        return rows
            .map((row) => ({
                ...row,
            }))
            .filter((row) => row.name)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
    }, [events, entryById]);

    const first = events[0];
    const last = events[events.length - 1];

    /**
     * ひとつ前との間を言葉にする。
     *
     * 「3日あいた」と分かると、物語の速さが見える。
     * 読めなかったものや、順番だけの表し方では出さない。
     */
    function gapBefore(index: number): string {
        if (mode === "order" || index === 0) return "";

        const now = readTime(String(shown[index].values.when ?? ""), mode);
        const before = readTime(String(shown[index - 1].values.when ?? ""), mode);
        if (now.value === null || before.value === null) return "";

        return describeGap(before.value, now.value, mode);
    }

    return (
        <div className="space-y-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-xl font-medium text-ink">
                        <span className="text-forest">
                            <ResourceIcon builtinKey="timeline" size={22} />
                        </span>
                        {page.label}
                    </h1>
                    <p className="mt-1 text-sm text-muted">
                        物語の出来事を時系列で整理します。前後関係や間隔を見える形にできます。
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onCreate()}
                    className="rounded-md bg-forest px-4 py-2 text-sm text-white hover:bg-forest-dark"
                >
                    ＋ 出来事を追加
                </button>
            </header>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                {/* 時間の表し方 */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.5">
                    <span className="mr-1 text-xs text-muted">時間の表し方</span>
                    {(Object.keys(TIMELINE_MODE_LABEL) as TimelineMode[]).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onChangeMode(key)}
                            aria-pressed={mode === key}
                            className={[
                                "rounded-full border px-3 py-1 text-xs",
                                mode === key
                                    ? "border-forest bg-forest-tint text-forest"
                                    : "border-line text-muted hover:bg-canvas",
                            ].join(" ")}
                        >
                            {TIMELINE_MODE_LABEL[key]}
                        </button>
                    ))}
                </div>

                {/* まとめ */}
                <div className="rounded-lg border border-forest-line bg-forest-tint/40 px-4 py-3">
                    <p className="text-xs text-forest">全体サマリー</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                            <p className="text-muted">登録済み</p>
                            <p className="text-base text-ink">
                                {events.length}
                                <span className="ml-0.5 text-[10px] text-muted">件</span>
                            </p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-muted">最初</p>
                            <p className="truncate text-ink">{first?.name || "—"}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-muted">最後</p>
                            <p className="truncate text-ink">{last?.name || "—"}</p>
                        </div>
                    </div>
                    {mode !== "order" && first && last && (
                        <p className="mt-2 text-xs text-muted">
                            {String(first.values.when ?? "—")} 〜 {String(last.values.when ?? "—")}
                        </p>
                    )}
                </div>
            </div>

            {pending.length > 0 && (
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
                        onReject={(entry) =>
                            onUpdate(entry.id, { candidate_status: "rejected" })
                        }
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
                </div>
            )}


            {/*
             * 誰の出来事かで絞る。
             * その人物の筋だけを追える。
             */}
            {events.length > 0 && peopleInEvents.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] text-faint">誰の</span>

                    <button
                        type="button"
                        onClick={() => setPersonFilter(null)}
                        aria-pressed={personFilter === null}
                        className={[
                            "rounded-full border px-3 py-1 text-xs",
                            personFilter === null
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line text-muted hover:bg-canvas",
                        ].join(" ")}
                    >
                        全員
                    </button>

                    {peopleInEvents.map(({ id, name, count }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() =>
                                setPersonFilter(personFilter === id ? null : id)
                            }
                            aria-pressed={personFilter === id}
                            className={[
                                "rounded-full border px-3 py-1 text-xs",
                                personFilter === id
                                    ? "border-forest bg-forest-tint text-forest"
                                    : "border-line text-muted hover:bg-canvas",
                            ].join(" ")}
                        >
                            {name} {count}
                        </button>
                    ))}
                </div>
            )}

            {/* 重要度の絞り込み */}
            {events.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setImportanceFilter("all")}
                        aria-pressed={importanceFilter === "all"}
                        className={[
                            "rounded-full border px-3 py-1 text-xs",
                            importanceFilter === "all"
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line text-muted hover:bg-canvas",
                        ].join(" ")}
                    >
                        すべて {events.length}
                    </button>
                    {IMPORTANCE.map((level) => {
                        const count = events.filter(
                            (event) => String(event.values.importance ?? "") === level,
                        ).length;
                        return (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setImportanceFilter(level)}
                                aria-pressed={importanceFilter === level}
                                className={[
                                    "rounded-full border px-3 py-1 text-xs",
                                    importanceFilter === level
                                        ? "border-forest bg-forest-tint text-forest"
                                        : "border-line text-muted hover:bg-canvas",
                                ].join(" ")}
                            >
                                重要度 {level} {count}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 絞り込みで何も出ないとき */}
            {events.length > 0 && shown.length === 0 && (
                <div className="rounded-lg border border-dashed border-line py-14 text-center">
                    <p className="text-sm text-faint">
                        この絞り込みに当てはまる出来事はありません。
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setPersonFilter(null);
                            setImportanceFilter("all");
                        }}
                        className="mt-2 text-xs text-forest hover:underline"
                    >
                        絞り込みを外す
                    </button>
                </div>
            )}

            {events.length === 0 ? (
                <EntryStartersPanel
                    builtinKey={page.builtin_key}
                    label={page.label}
                    description="物語で起きたことを、順に並べていく場所です。本文から拾うこともできます。"
                    onCreate={(name) => onCreate(name)}
                    onCreateEmpty={() => onCreate()}
                />
            ) : shown.length > 0 ? (
                <ol className="rounded-lg border border-line bg-surface px-5 py-5">
                    {shown.map((event, index) => {
                        const isOpen = openId === event.id;
                        const importance = String(event.values.importance ?? "");
                        const people = Array.isArray(event.values.people)
                            ? event.values.people
                            : [];
                        const linkedEpisodes = Array.isArray(event.values.episodes)
                            ? event.values.episodes
                            : [];

                        return (
                            <li key={event.id} className="group relative flex gap-4">
                                {/* 時間の欄 */}
                                {mode !== "order" && (
                                    <div className="w-24 shrink-0 pt-3 text-right">
                                        <input
                                            type="text"
                                            defaultValue={String(event.values.when ?? "")}
                                            onBlur={(e) =>
                                                onUpdate(event.id, {
                                                    values: {
                                                        ...event.values,
                                                        when: e.target.value,
                                                    },
                                                })
                                            }
                                            placeholder={TIMELINE_MODE_PLACEHOLDER[mode]}
                                            aria-label="いつ"
                                            title={
                                                readTime(
                                                    String(event.values.when ?? ""),
                                                    mode,
                                                ).value === null &&
                                                String(event.values.when ?? "").trim()
                                                    ? "この書き方では順番を読み取れません"
                                                    : undefined
                                            }
                                            /*
                                             * 読み取れた「いつ」は濃く、
                                             * 読めなかったものは薄く出す。
                                             * 並べ替えに効いているかが目で分かる。
                                             */
                                            className={[
                                                "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs outline-none hover:border-line focus:border-forest",
                                                readTime(
                                                    String(event.values.when ?? ""),
                                                    mode,
                                                ).value === null
                                                    ? "text-faint"
                                                    : "text-forest",
                                            ].join(" ")}
                                        />
                                    </div>
                                )}

                                {/* 線と点 */}
                                <div className="flex w-4 shrink-0 flex-col items-center">
                                    <span
                                        className={[
                                            "mt-4 h-3 w-3 shrink-0 rounded-full border-2",
                                            importance === "高"
                                                ? "border-[#c0705e] bg-[#c0705e]"
                                                : importance === "中"
                                                  ? "border-forest bg-forest"
                                                  : importance === "低"
                                                    ? "border-forest-line bg-forest-tint"
                                                    : "border-[var(--color-line)] bg-surface",
                                        ].join(" ")}
                                    />
                                    {index < shown.length - 1 && (
                                        <span className="w-px flex-1 bg-[var(--color-line)]" />
                                    )}
                                </div>

                                {/* 中身 */}
                                <div className="min-w-0 flex-1 pb-5">
                                    {/*
                                     * ひとつ前との間。
                                     * 「3日あいた」と分かると、物語の速さが見える。
                                     */}
                                    {gapBefore(index) && (
                                        <p className="mb-1.5 flex items-center gap-2 text-[10px] text-faint">
                                            <span className="h-px w-4 bg-line" />
                                            {gapBefore(index)}あいだが空く
                                        </p>
                                    )}

                                    <div className="rounded-lg border border-line bg-surface px-4 py-3.5 hover:border-forest-line">
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <input
                                                    type="text"
                                                    defaultValue={event.name}
                                                    onBlur={(e) =>
                                                        onUpdate(event.id, {
                                                            name: e.target.value,
                                                        })
                                                    }
                                                    placeholder="出来事の名前"
                                                    aria-label="出来事の名前"
                                                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[14px] font-medium text-ink outline-none hover:border-line focus:border-forest"
                                                />
                                                <textarea
                                                    defaultValue={String(
                                                        event.values.detail ?? "",
                                                    )}
                                                    onBlur={(e) =>
                                                        onUpdate(event.id, {
                                                            values: {
                                                                ...event.values,
                                                                detail: e.target.value,
                                                            },
                                                        })
                                                    }
                                                    rows={3}
                                                    placeholder="何が起きたか"
                                                    aria-label="内容"
                                                    /*
                                                     * 内容を主役にする。
                                                     * 名前だけ並べても、年表にならない。
                                                     */
                                                    className="mt-1 w-full resize-y rounded border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] leading-relaxed text-ink outline-none hover:border-line focus:border-forest"
                                                />
                                            </div>

                                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                                                <select
                                                    value={importance}
                                                    onChange={(e) =>
                                                        onUpdate(event.id, {
                                                            values: {
                                                                ...event.values,
                                                                importance: e.target.value,
                                                            },
                                                            /*
                                                             * 重要度と「大事な出来事」の印を
                                                             * 揃える。別々に持つと、
                                                             * どちらを見ればよいのか分からない。
                                                             */
                                                            is_major:
                                                                e.target.value === "高" ||
                                                                e.target.value === "中",
                                                        })
                                                    }
                                                    aria-label="重要度"
                                                    className={[
                                                        "rounded-full border px-2 py-0.5 text-[10px] outline-none",
                                                        IMPORTANCE_STYLE[importance] ??
                                                            IMPORTANCE_STYLE["低"],
                                                    ].join(" ")}
                                                >
                                                    <option value="">重要度</option>
                                                    {IMPORTANCE.map((level) => (
                                                        <option key={level} value={level}>
                                                            {level}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setOpenId(isOpen ? null : event.id)
                                                    }
                                                    className="text-[10px] text-faint hover:text-ink"
                                                >
                                                    {isOpen ? "閉じる" : "紐づけ"}
                                                </button>
                                                <DeleteButton
                                                    label={event.name || "この出来事"}
                                                    onDelete={() => onDelete(event)}
                                                    isFloating
                                                    size="small"
                                                />
                                            </div>
                                        </div>

                                        {/* 紐づいているもの */}
                                        {!isOpen &&
                                            (people.length > 0 || linkedEpisodes.length > 0) && (
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                    {people.map((id) => (
                                                        <span
                                                            key={String(id)}
                                                            className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted"
                                                        >
                                                            {entryById.get(String(id))?.name ??
                                                                "?"}
                                                        </span>
                                                    ))}
                                                    {linkedEpisodes.map((id) => {
                                                        const episode = episodeById.get(
                                                            String(id),
                                                        );
                                                        if (!episode) return null;
                                                        return (
                                                            /*
                                                             * 押すとその話へ飛ぶ。
                                                             * 出来事から本文へ戻れる。
                                                             */
                                                            <button
                                                                key={String(id)}
                                                                type="button"
                                                                onClick={() =>
                                                                    onOpenEpisode?.(
                                                                        String(id),
                                                                    )
                                                                }
                                                                title="この話を開く"
                                                                className="rounded bg-forest-tint px-1.5 py-0.5 text-[10px] text-forest hover:underline"
                                                            >
                                                                第{episode.ep_number}話
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                        {isOpen && (
                                            <div className="mt-3 space-y-3 border-t border-line pt-3">
                                                <Picker
                                                    label="関わる人・もの"
                                                    options={allEntries
                                                        .filter(
                                                            (row) =>
                                                                row.page_id !== event.page_id &&
                                                                row.candidate_status === "none",
                                                        )
                                                        .map((row) => ({
                                                            id: row.id,
                                                            label: row.name || "（名前未設定）",
                                                        }))}
                                                    selected={people.map(String)}
                                                    onChange={(next) =>
                                                        onUpdate(event.id, {
                                                            values: {
                                                                ...event.values,
                                                                people: next,
                                                            },
                                                        })
                                                    }
                                                />
                                                <Picker
                                                    label="関連エピソード"
                                                    options={episodes.map((episode) => ({
                                                        id: episode.id,
                                                        label: `第${episode.ep_number}話`,
                                                    }))}
                                                    selected={linkedEpisodes.map(String)}
                                                    onChange={(next) =>
                                                        onUpdate(event.id, {
                                                            values: {
                                                                ...event.values,
                                                                episodes: next,
                                                            },
                                                        })
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* 次の出来事までの間隔 */}
                                    {mode !== "order" && index < shown.length - 1 && (
                                        <p className="mt-2 pl-1 text-[11px] text-faint">
                                            ↓ {String(shown[index + 1].values.when ?? "次の出来事")}
                                            まで
                                        </p>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            ) : null}

            {mode === "order" && shown.length > 1 && (
                <p className="text-xs text-faint">
                    「順番だけ」では、追加した順に並びます。日時を書く必要がないときに使います。
                </p>
            )}
        </div>
    );
}

function Picker({
    label,
    options,
    selected,
    onChange,
}: {
    label: string;
    options: { id: string; label: string }[];
    selected: string[];
    onChange: (next: string[]) => void;
}) {
    if (options.length === 0) {
        return (
            <div>
                <p className="text-[10px] text-muted">{label}</p>
                <p className="mt-1 text-[10px] text-faint">結びつけられるものがありません。</p>
            </div>
        );
    }

    return (
        <div>
            <p className="text-[10px] text-muted">{label}</p>
            <ul className="thin-scroll mt-1 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {options.map((option) => {
                    const isOn = selected.includes(option.id);
                    return (
                        <li key={option.id}>
                            <button
                                type="button"
                                aria-pressed={isOn}
                                onClick={() =>
                                    onChange(
                                        isOn
                                            ? selected.filter((id) => id !== option.id)
                                            : [...selected, option.id],
                                    )
                                }
                                className={[
                                    "rounded-full border px-2 py-0.5 text-[10px]",
                                    isOn
                                        ? "border-forest bg-forest-tint text-forest"
                                        : "border-line text-muted",
                                ].join(" ")}
                            >
                                {option.label}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
