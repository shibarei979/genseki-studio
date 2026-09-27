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

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import DeleteButton from "@/components/common/delete-button";
import CandidateStrip from "@/components/resource/candidate-strip";
import EntryStartersPanel from "@/components/resource/entry-starters-panel";
import { describeGap, readTime } from "@/lib/resource/timeline-scale";
import { useAutoMerge } from "@/components/resource/use-auto-merge";
import ResourceIcon from "@/components/resource/resource-icons";
import type { DuplicateGroup } from "@/lib/resource/dedupe";
import type { Episode, ResourceEntry, ResourcePage, TimelineMode } from "@/types";
import { formatEpisodeLabel, TIMELINE_MODE_LABEL, TIMELINE_MODE_PLACEHOLDER } from "@/types";

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

    /*
     * ★ 話ごとにまとめる。
     *
     *   話が増えると出来事も増え、いちばん新しい出来事まで長くスクロールしないと届かなかった。
     *   出来事を、結んだ話（いちばん前の話）ごとに束ねて、束ごとにたためるようにする。
     *   話と結んでいない出来事は、最後の「話と結んでいない」束へ。
     *
     *   最初は、いちばん新しい束だけを開いておく。
     */
    const episodeOrder = useMemo(
        () => new Map(episodes.map((episode, index) => [episode.id, index])),
        [episodes],
    );
    const groups = useMemo(() => {
        const map = new Map<string, { key: string; label: string; order: number; rows: { event: ResourceEntry; index: number }[] }>();
        shown.forEach((event, index) => {
            const linked = Array.isArray(event.values.episodes) ? event.values.episodes.map(String) : [];
            const known = linked.filter((id) => episodeOrder.has(id));
            const firstId = known.sort((a, b) => (episodeOrder.get(a) ?? 0) - (episodeOrder.get(b) ?? 0))[0];
            const key = firstId ?? "none";
            if (!map.has(key)) {
                const episode = firstId ? episodeById.get(firstId) : undefined;
                map.set(key, {
                    key,
                    label: episode ? formatEpisodeLabel(episode) : "話と結んでいない出来事",
                    order: firstId ? (episodeOrder.get(firstId) ?? 0) : Number.MAX_SAFE_INTEGER,
                    rows: [],
                });
            }
            map.get(key)!.rows.push({ event, index });
        });
        return Array.from(map.values()).sort((a, b) => a.order - b.order);
    }, [shown, episodeOrder, episodeById]);

    /* 話と結んだ出来事が 1 つも無ければ、束ねても意味がない */
    const canGroup = groups.some((group) => group.key !== "none");
    const [isGrouped, setIsGrouped] = useState(true);
    const grouped = canGroup && isGrouped;

    /* 開いている束。最初は、話と結んだ束のうちいちばん新しいものだけ */
    const [openGroups, setOpenGroups] = useState<Set<string> | null>(null);
    useEffect(() => {
        if (openGroups !== null || groups.length === 0) return;
        const linked = groups.filter((group) => group.key !== "none");
        const newest = linked[linked.length - 1] ?? groups[groups.length - 1];
        setOpenGroups(new Set(groups.length <= 3 ? groups.map((group) => group.key) : [newest.key]));
    }, [groups, openGroups]);
    const allOpen = groups.every((group) => openGroups?.has(group.key) ?? true);
    const isGroupOpen = (key: string) => openGroups?.has(key) ?? true;
    function toggleGroup(key: string) {
        setOpenGroups((current) => {
            const next = new Set(current ?? []);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    /*
     * ひと続きで並べるとき、出来事が多ければ前のほうをたたむ。
     * いちばん新しいところがすぐ見えるように、後ろの 15 件だけ出す。
     */
    const FLAT_TAIL = 15;
    const [showAllFlat, setShowAllFlat] = useState(false);
    const flatHidden = !grouped && !showAllFlat ? Math.max(0, shown.length - FLAT_TAIL) : 0;

    /* いちばん新しい出来事へ。束をたたんでいれば開いてから飛ぶ */
    function jumpToLatest() {
        const target = grouped
            ? (groups.filter((group) => group.key !== "none").pop() ?? groups[groups.length - 1])
            : null;
        if (target) {
            setOpenGroups((current) => new Set([...Array.from(current ?? []), target.key]));
        }
        const lastEvent = target ? target.rows[target.rows.length - 1].event : shown[shown.length - 1];
        if (!lastEvent) return;
        window.setTimeout(() => {
            document
                .getElementById(`tl-${lastEvent.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60);
    }

    function renderEvent(event: ResourceEntry, index: number, isLastInList: boolean, groupKey?: string) {
        const isOpen = openId === event.id;
        const importance = String(event.values.importance ?? "");
        const people = Array.isArray(event.values.people)
            ? event.values.people
            : [];
        const linkedEpisodes = Array.isArray(event.values.episodes)
            ? event.values.episodes
            : [];
        /* 話ごとに束ねているときは、束の見出しと同じ話の札は出さない。二重になる */
        const episodeChips = linkedEpisodes.filter((id) => String(id) !== groupKey);

        return (
            <li key={event.id} id={`tl-${event.id}`} className="group relative flex scroll-mt-4 gap-2 sm:gap-4">
                {/* 時間の欄 */}
                {mode !== "order" && (
                    <div className="w-14 shrink-0 pt-3 text-right sm:w-24">
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
                    {!isLastInList && (
                        <span className="w-px flex-1 bg-[var(--color-line)]" />
                    )}
                </div>

                {/* 中身 */}
                <div className="min-w-0 flex-1 pb-3">
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

                    {/*
                      * ★ 中身が無いうちは、低く組む。
                      *   前は空の「何が起きたか」が 3 行ぶんの高さで並び、
                      *   出来事が 3 つでも画面がすかすかに見えた。
                      *   書き始めると（押すと）広がる。
                      */}
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 hover:border-forest-line sm:px-4 sm:py-2.5">
                        {/* 携帯では、重要度・紐づけを下の行へ。横に並べると題名と本文が細くなる */}
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
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
                                    rows={String(event.values.detail ?? "").trim() ? 3 : 1}
                                    onFocus={(e) => {
                                        if (e.currentTarget.rows < 3) e.currentTarget.rows = 3;
                                    }}
                                    placeholder="何が起きたか"
                                    aria-label="内容"
                                    /*
                                     * 内容を主役にする。
                                     * 名前だけ並べても、年表にならない。
                                     */
                                    className="mt-1 w-full resize-y rounded border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] leading-relaxed text-ink outline-none hover:border-line focus:border-forest"
                                />
                            </div>

                            <div className="flex shrink-0 items-center justify-end gap-2">
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
                            (people.length > 0 || episodeChips.length > 0) && (
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
                                    {episodeChips.map((id) => {
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
                                                {episode.title || `${episode.ep_number}話`}
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
                                        label: episode.title || `${episode.ep_number}話`,
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
                    {mode !== "order" && !isLastInList && (
                        <p className="mt-2 hidden pl-1 text-[11px] text-faint sm:block">
                            ↓ {String(shown[index + 1].values.when ?? "次の出来事")}
                            まで
                        </p>
                    )}
                </div>
            </li>
        );
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

            {/*
              * 時間の表し方と、まとめ。
              *
              * ★ 1 本の帯にまとめる。
              *   前は右に「全体サマリー」の箱を別に置いていた。
              *   出来事が少ないうちは「0件 ― ―」だけの箱になり、画面がすかすかに見えた。
              *   まとめは、出来事があるときだけ帯の右に一言で出す。
              */}
            {/*
              * ★ 携帯では、選ぶものを 1 行に並べて横にすべらせる。
              *   折り返すと 2〜3 行に広がり、画面の上半分が押し具で埋まっていた。
              */}
            <div className="flex flex-col gap-y-2 rounded-lg border border-line bg-surface px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                <ScrollRow edge="3" fade="surface">
                    <span className="mr-1 shrink-0 text-xs text-muted">時間の表し方</span>
                    {(Object.keys(TIMELINE_MODE_LABEL) as TimelineMode[]).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onChangeMode(key)}
                            aria-pressed={mode === key}
                            className={[
                                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs",
                                mode === key
                                    ? "border-forest bg-forest-tint text-forest"
                                    : "border-line text-muted hover:bg-canvas",
                            ].join(" ")}
                        >
                            {TIMELINE_MODE_LABEL[key]}
                        </button>
                    ))}
                </ScrollRow>

                {events.length > 0 && (
                    <p className="min-w-0 truncate text-[12px] text-muted sm:ml-auto">
                        <strong className="font-semibold text-ink">{events.length}</strong>件
                        {first && last && first !== last && (
                            <span className="ml-2">
                                <span className="text-ink">{first.name}</span>
                                {mode !== "order" && first.values.when ? `（${String(first.values.when)}）` : ""}
                                <span className="mx-1 text-faint">→</span>
                                <span className="text-ink">{last.name}</span>
                                {mode !== "order" && last.values.when ? `（${String(last.values.when)}）` : ""}
                            </span>
                        )}
                    </p>
                )}
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
                <ScrollRow edge="4" fade="canvas">
                    <span className="mr-1 shrink-0 text-[11px] text-faint">誰の</span>

                    <button
                        type="button"
                        onClick={() => setPersonFilter(null)}
                        aria-pressed={personFilter === null}
                        className={[
                            "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs",
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
                                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs",
                                personFilter === id
                                    ? "border-forest bg-forest-tint text-forest"
                                    : "border-line text-muted hover:bg-canvas",
                            ].join(" ")}
                        >
                            {name} {count}
                        </button>
                    ))}
                </ScrollRow>
            )}

            {/* 重要度の絞り込み */}
            {events.length > 0 && (
                <ScrollRow edge="4" fade="canvas">
                    <button
                        type="button"
                        onClick={() => setImportanceFilter("all")}
                        aria-pressed={importanceFilter === "all"}
                        className={[
                            "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs",
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
                                    "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs",
                                    importanceFilter === level
                                        ? "border-forest bg-forest-tint text-forest"
                                        : "border-line text-muted hover:bg-canvas",
                                ].join(" ")}
                            >
                                重要度 {level} {count}
                            </button>
                        );
                    })}
                </ScrollRow>
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

            {/*
              * 並べ方と、いちばん新しい出来事へ飛ぶ押し具。
              * 出来事が多くなっても、最新まですぐ届くように。
              */}
            {shown.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {canGroup && (
                        <div className="inline-flex shrink-0 rounded-md border border-line bg-surface p-0.5 text-[12px]">
                            {[
                                { value: true, label: "話ごとにまとめる" },
                                { value: false, label: "ひと続き" },
                            ].map((option) => (
                                <button
                                    key={option.label}
                                    type="button"
                                    onClick={() => setIsGrouped(option.value)}
                                    aria-pressed={isGrouped === option.value}
                                    className={[
                                        "whitespace-nowrap rounded px-2.5 py-1",
                                        isGrouped === option.value
                                            ? "bg-forest-tint text-forest"
                                            : "text-muted hover:text-ink",
                                    ].join(" ")}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                    {grouped && groups.length > 1 && (
                        <button
                            type="button"
                            onClick={() =>
                                setOpenGroups(
                                    allOpen ? new Set() : new Set(groups.map((group) => group.key)),
                                )
                            }
                            className="shrink-0 whitespace-nowrap text-[12px] text-muted hover:text-forest"
                        >
                            {allOpen ? "すべてたたむ" : "すべて開く"}
                        </button>
                    )}
                    {shown.length > 5 && (
                        <button
                            type="button"
                            onClick={jumpToLatest}
                            className="ml-auto shrink-0 whitespace-nowrap rounded-md border border-forest-line bg-surface px-3 py-1 text-[12px] text-forest hover:bg-forest-tint"
                        >
                            <span className="sm:hidden">最新へ ↓</span>
                            <span className="hidden sm:inline">いちばん新しい出来事へ ↓</span>
                        </button>
                    )}
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
                grouped ? (
                    <div className="space-y-2">
                        {groups.map((group) => {
                            const isOpen = isGroupOpen(group.key);
                            const major = group.rows.filter(
                                ({ event }) => String(event.values.importance ?? "") === "高",
                            ).length;
                            return (
                                <section
                                    key={group.key}
                                    className="overflow-hidden rounded-lg border border-line bg-surface"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(group.key)}
                                        aria-expanded={isOpen}
                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-canvas sm:px-4"
                                    >
                                        <span
                                            aria-hidden
                                            className={[
                                                "inline-block w-3 shrink-0 text-[10px] text-faint transition-transform",
                                                isOpen ? "rotate-90" : "",
                                            ].join(" ")}
                                        >
                                            ▶
                                        </span>
                                        <span
                                            className={[
                                                "min-w-0 truncate text-[13px] font-medium",
                                                group.key === "none" ? "text-muted" : "text-ink",
                                            ].join(" ")}
                                        >
                                            {group.label}
                                        </span>
                                        <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[10.5px] text-muted">
                                            {group.rows.length}件
                                        </span>
                                        {major > 0 && (
                                            <span className="shrink-0 rounded-full border border-[#c0705e] bg-[#fbeeea] px-1.5 py-0.5 text-[10px] text-[#a5503c]">
                                                重要度高 {major}
                                            </span>
                                        )}
                                        {/* たたんでいるときは、中の出来事の名前を薄く並べる */}
                                        {!isOpen && (
                                            <span className="ml-1 hidden min-w-0 flex-1 truncate text-[11px] text-faint sm:block">
                                                {group.rows.map(({ event }) => event.name || "（名前なし）").join("　・")}
                                            </span>
                                        )}
                                    </button>
                                    {isOpen && (
                                        <ol className="border-t border-line px-3 pb-2 pt-3 sm:px-5">
                                            {group.rows.map(({ event, index }, at) =>
                                                renderEvent(event, index, at === group.rows.length - 1, group.key),
                                            )}
                                        </ol>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-lg border border-line bg-surface px-3 py-4 sm:px-5 sm:py-5">
                        {flatHidden > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowAllFlat(true)}
                                className="mb-3 w-full rounded-md border border-dashed border-line py-2 text-[12px] text-muted hover:border-forest-line hover:text-forest"
                            >
                                前の出来事 {flatHidden}件を見る
                            </button>
                        )}
                        <ol>
                            {shown.map((event, index) =>
                                index < flatHidden
                                    ? null
                                    : renderEvent(event, index, index === shown.length - 1),
                            )}
                        </ol>
                    </div>
                )
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

/**
 * 携帯で横にすべらせる 1 行。
 *
 * ★ 続きが隠れているときは、端に矢印を出す。
 *   矢印が無いと、横に続きがあることに気づけない。
 *   押すと、その向きへ少し送る。端まで来たら、その側の矢印は消える。
 *   パソコンでは折り返して全部見えるので、矢印は出さない。
 */
function ScrollRow({
    children,
    edge,
    fade,
}: {
    children: ReactNode;
    /** 枠の内側の余白（3 = 12px、4 = 16px）。行を画面の端まで伸ばすのに使う */
    edge: "3" | "4";
    /** 矢印の下地の色。置き場所の地の色に合わせる */
    fade: "surface" | "canvas";
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(false);

    useEffect(() => {
        const box = ref.current;
        if (!box) return;
        const update = () => {
            setCanLeft(box.scrollLeft > 2);
            setCanRight(box.scrollLeft + box.clientWidth < box.scrollWidth - 2);
        };
        update();
        box.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        return () => {
            box.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, [children]);

    const move = (direction: 1 | -1) => {
        const box = ref.current;
        if (!box) return;
        box.scrollBy({ left: direction * box.clientWidth * 0.7, behavior: "smooth" });
    };

    const color = fade === "surface" ? "var(--color-surface, #fff)" : "var(--color-canvas, #f5f4f1)";
    const arrow = (side: "left" | "right") => (
        <button
            type="button"
            aria-label={side === "left" ? "前を見る" : "続きを見る"}
            onClick={() => move(side === "left" ? -1 : 1)}
            className={[
                "absolute top-1/2 z-10 flex h-8 w-9 -translate-y-1/2 items-center sm:hidden",
                side === "left" ? "left-0 justify-start pl-0.5" : "right-0 justify-end pr-0.5",
                edge === "3" ? (side === "left" ? "-ml-3" : "-mr-3") : side === "left" ? "-ml-4" : "-mr-4",
            ].join(" ")}
            style={{
                background: `linear-gradient(to ${side === "left" ? "right" : "left"}, ${color} 55%, transparent)`,
            }}
        >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-[13px] leading-none text-muted shadow-sm">
                {side === "left" ? "‹" : "›"}
            </span>
        </button>
    );

    return (
        <div className="relative min-w-0">
            {canLeft && arrow("left")}
            <div
                ref={ref}
                className={[
                    "thin-scroll flex items-center gap-1.5 overflow-x-auto sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0",
                    edge === "3" ? "-mx-3 px-3" : "-mx-4 px-4",
                ].join(" ")}
            >
                {children}
            </div>
            {canRight && arrow("right")}
        </div>
    );
}
