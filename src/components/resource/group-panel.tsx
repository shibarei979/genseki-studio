"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * 組の一覧と、組の作り直し（関係図の右の欄）
 *
 * ★ 組は、作者が決める。
 *
 *   関係の言葉や家族から当てた組は、外れることがある。
 *   「クマさん→エバ」「エバ—アル」から「エバ」「エバの家族」と囲んだが、
 *   作者が思っていたのは「律とアルのタッグ」だった。
 *
 *   当てたものは「候補」として下に出すだけにする。
 *   押すと、名前と顔ぶれが作る欄に入る。
 *   名前を直してから作れる。
 *
 * ★ 組の置き場所は、組織・グループの資料。
 *
 *   ここで作ると、組織・グループの資料に項目が一つ増える。
 *   中にいる人は、その項目の「所属する人」に入る。
 *   資料の画面から直しても、同じ組が変わる。
 *
 *   人物の資料の「所属」で組織を選んでも、その組に入る。
 *
 * ★ 何も選んでいないときの右の欄に置く。
 *   前は「図や一覧から関係を選ぶと、ここに詳しく出ます。」
 *   とだけ出ていて、ずっと空いていた。
 * ============================================================
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
    AUTHORED,
    GROUP_COLORS,
    SUGGESTED,
    assignColors,
    findGroups,
    type FoundGroup,
} from "@/lib/resource/graph-groups";
import { groupOf } from "@/components/resource/relation-graph";

import type { ResourceEntry, ResourcePage, ResourceRelation } from "@/types";

interface Props {
    entries: ResourceEntry[];
    relations: ResourceRelation[];
    pages: ResourcePage[];
    onCreate: (name: string, memberIds: string[]) => Promise<void>;
    onRename: (groupId: string, name: string) => Promise<void>;
    onSetMember: (groupId: string, entryId: string, on: boolean) => Promise<void>;
    onDissolve: (groupId: string) => Promise<void>;
    /** 組の色を選ぶ。null で「おまかせ」に戻す */
    onSetColor: (groupId: string, color: string | null) => Promise<void>;
}

const FROM_LABEL: Record<string, string> = {
    text: "資料の文章から",
    relation: "関係の言葉から",
    family: "家族の関係から",
};

export default function GroupPanel({
    entries,
    relations,
    pages,
    onCreate,
    onRename,
    onSetMember,
    onDissolve,
    onSetColor,
}: Props) {
    const nameOf = useMemo(
        () => new Map(entries.map((entry) => [entry.id, entry.name])),
        [entries],
    );

    /*
     * 図に出ている人。
     *
     * ★ 組に入れられるのは、図に出ている人だけにする。
     *   資料の全員を並べると、場所や道具まで混ざって選びにくい。
     */
    const onGraph = useMemo(() => {
        const ids = new Set<string>();

        for (const relation of relations) {
            ids.add(relation.from_entry_id);
            ids.add(relation.to_entry_id);
        }

        return entries.filter((entry) => ids.has(entry.id));
    }, [entries, relations]);

    const onGraphIds = useMemo(
        () => new Set(onGraph.map((entry) => entry.id)),
        [onGraph],
    );

    /* 作者が決めた組。まだ誰もいない組も並べる */
    const authored = useMemo(
        () =>
            findGroups(entries, relations, {
                pages,
                use: AUTHORED,
                keepSmall: true,
            }).sort((a, b) => a.name.localeCompare(b.name, "ja")),
        [entries, relations, pages],
    );

    /* 図と同じ決め方で色を出す */
    const colors = useMemo(() => assignColors(authored), [authored]);

    /* 色を選んでいる組 */
    const [painting, setPainting] = useState<string | null>(null);

    /*
     * 候補。
     *
     * ★ もう組になっている顔ぶれは出さない。
     *   同じ人たちの組が、決めた組と候補の両方に並ぶと紛らわしい。
     */
    const suggested = useMemo(() => {
        const taken = authored.map((group) => new Set(group.ids));
        const names = new Set(authored.map((group) => group.name));

        return findGroups(entries, relations, {
            pages,
            use: SUGGESTED,
            isFamily: (label) => groupOf(label).key === "family",
        })
            .map((group) => ({
                ...group,
                ids: group.ids.filter((id) => onGraphIds.has(id)),
            }))
            .filter((group) => group.ids.length >= 2)
            .filter((group) => !names.has(group.name))
            .filter(
                (group) =>
                    !taken.some((set) => group.ids.every((id) => set.has(id))),
            );
    }, [entries, relations, pages, authored, onGraphIds]);

    /* 新しい組の欄 */
    const [draftName, setDraftName] = useState("");
    const [draftIds, setDraftIds] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const nameBox = useRef<HTMLInputElement>(null);

    /* 人を足す欄を開いている組 */
    const [addingTo, setAddingTo] = useState<string | null>(null);

    /* 解くかどうか確かめている組 */
    const [asking, setAsking] = useState<string | null>(null);

    /* 失敗したとき */
    const [error, setError] = useState("");

    useEffect(() => {
        setError("");
    }, [entries]);

    async function run(task: () => Promise<void>) {
        setBusy(true);
        setError("");

        try {
            await task();
        } catch (err) {
            setError(
                err instanceof Error && err.message
                    ? err.message
                    : "うまくいきませんでした。もう一度お試しください。",
            );
        } finally {
            setBusy(false);
        }
    }

    function takeSuggestion(group: FoundGroup) {
        setDraftName(group.name);
        setDraftIds(group.ids);
        nameBox.current?.focus();
        nameBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    const canCreate = draftName.trim().length > 0 && draftIds.length > 0 && !busy;

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-sm font-medium text-ink">組</h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-faint">
                    図の囲みになります。人物の資料の「所属」や、組織・グループの資料の「所属する人」と同じものです。
                </p>
            </div>

            {error && (
                <p className="rounded border border-[var(--color-danger)] px-2 py-1.5 text-[11px] text-[var(--color-danger)]">
                    {error}
                </p>
            )}

            {/* ---------------------------------------------- 決めた組 */}
            {authored.length === 0 ? (
                <p className="rounded border border-dashed border-line px-3 py-3 text-[11px] leading-relaxed text-muted">
                    まだ組がありません。下の「新しい組」から作れます。
                </p>
            ) : (
                <ul className="space-y-2">
                    {authored.map((group) => {
                        const ink = colors.get(group.key) ?? GROUP_COLORS[0].value;
                        const members = group.ids.filter((id) => id !== group.key);
                        const addable = onGraph.filter(
                            (entry) =>
                                entry.id !== group.key && !members.includes(entry.id),
                        );

                        return (
                            <li
                                key={group.key}
                                className="rounded-md border px-2.5 py-2"
                                style={{
                                    borderColor: ink,
                                    borderLeftWidth: 4,
                                    background: `${ink}14`,
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    {/*
                                      * 色。押すと色を選べる。
                                      *
                                      * ★ 図の囲みと同じ色。
                                      *   どの組がどの囲みか、色で結びつく。
                                      */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPainting(painting === group.key ? null : group.key)
                                        }
                                        aria-label={`${group.name}の色を選ぶ`}
                                        title="色を選ぶ"
                                        className="h-5 w-5 shrink-0 rounded border-2 border-white shadow"
                                        style={{ background: ink }}
                                    />
                                    <input
                                        type="text"
                                        defaultValue={group.name}
                                        key={`${group.key}:${group.name}`}
                                        aria-label="組の名前"
                                        onBlur={(e) => {
                                            const next = e.target.value.trim();
                                            if (next && next !== group.name) {
                                                void run(() => onRename(group.key, next));
                                            }
                                        }}
                                        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-medium outline-none hover:border-line focus:border-forest focus:bg-surface"
                                        style={{ color: ink }}
                                    />
                                    <span className="shrink-0 text-[10.5px] text-faint">
                                        {members.length}人
                                    </span>
                                </div>

                                {painting === group.key && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                        {GROUP_COLORS.map((one) => (
                                            <button
                                                key={one.value}
                                                type="button"
                                                disabled={busy}
                                                onClick={() => {
                                                    setPainting(null);
                                                    void run(() => onSetColor(group.key, one.value));
                                                }}
                                                aria-label={one.label}
                                                aria-pressed={group.color === one.value}
                                                title={one.label}
                                                className={
                                                    group.color === one.value
                                                        ? "h-6 w-6 rounded border-2 border-ink"
                                                        : "h-6 w-6 rounded border-2 border-white shadow hover:scale-110"
                                                }
                                                style={{ background: one.value }}
                                            />
                                        ))}
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                                setPainting(null);
                                                void run(() => onSetColor(group.key, null));
                                            }}
                                            className="ml-1 rounded border border-line px-1.5 py-0.5 text-[10.5px] text-muted hover:text-ink"
                                        >
                                            おまかせ
                                        </button>
                                    </div>
                                )}

                                {/* 中にいる人。× で外す */}
                                <ul className="mt-1.5 flex flex-wrap gap-1">
                                    {members.map((id) => (
                                        <li key={id}>
                                            <span className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface py-0.5 pl-2 pr-0.5 text-[11px] text-ink">
                                                {nameOf.get(id) ?? "?"}
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        void run(() =>
                                                            onSetMember(group.key, id, false),
                                                        )
                                                    }
                                                    aria-label={`${nameOf.get(id) ?? ""}を外す`}
                                                    className="rounded-full px-1 text-faint hover:text-[var(--color-danger)]"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        </li>
                                    ))}

                                    <li>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAddingTo(
                                                    addingTo === group.key ? null : group.key,
                                                )
                                            }
                                            className="rounded-full border border-dashed border-forest-line px-2 py-0.5 text-[11px] text-forest hover:bg-forest-tint"
                                        >
                                            {addingTo === group.key ? "閉じる" : "＋ 人を足す"}
                                        </button>
                                    </li>
                                </ul>

                                {addingTo === group.key && (
                                    <div className="mt-1.5 border-t border-line pt-1.5">
                                        {addable.length === 0 ? (
                                            <p className="text-[10.5px] text-faint">
                                                図に出ている人は、もう全員入っています。
                                            </p>
                                        ) : (
                                            <ul className="flex flex-wrap gap-1">
                                                {addable.map((entry) => (
                                                    <li key={entry.id}>
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void run(() =>
                                                                    onSetMember(
                                                                        group.key,
                                                                        entry.id,
                                                                        true,
                                                                    ),
                                                                )
                                                            }
                                                            className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                                                        >
                                                            ＋ {entry.name}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                {/*
                                  * 解く。
                                  *
                                  * ★ 資料の項目は消さない。中にいる人を空にするだけ。
                                  *   組織の資料に書いた説明まで消えると取り返せない。
                                  */}
                                <div className="mt-1.5 flex justify-end">
                                    {asking === group.key ? (
                                        <span className="flex items-center gap-1.5 text-[10.5px]">
                                            <span className="text-muted">
                                                中の人を外します（資料の項目は残ります）
                                            </span>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => {
                                                    setAsking(null);
                                                    void run(() => onDissolve(group.key));
                                                }}
                                                className="rounded border border-[var(--color-danger)] px-1.5 py-0.5 text-[var(--color-danger)]"
                                            >
                                                解く
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAsking(null)}
                                                className="rounded border border-line px-1.5 py-0.5 text-muted"
                                            >
                                                やめる
                                            </button>
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setAsking(group.key)}
                                            className="text-[10.5px] text-faint hover:text-[var(--color-danger)]"
                                        >
                                            組を解く
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* ---------------------------------------------- 新しい組 */}
            <div className="rounded-md border border-line px-2.5 py-2">
                <p className="text-[12px] font-medium text-ink">新しい組</p>

                <input
                    ref={nameBox}
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="組の名前（例：律とアルのタッグ、警視庁）"
                    aria-label="新しい組の名前"
                    className="mt-1.5 w-full rounded border border-line bg-surface px-2 py-1 text-[12px] outline-none focus:border-forest"
                />

                {onGraph.length === 0 ? (
                    <p className="mt-1.5 text-[10.5px] text-faint">
                        関係を結んだ人がいると、ここから選べます。
                    </p>
                ) : (
                    <ul className="thin-scroll mt-1.5 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                        {onGraph.map((entry) => {
                            const isOn = draftIds.includes(entry.id);

                            return (
                                <li key={entry.id}>
                                    <button
                                        type="button"
                                        aria-pressed={isOn}
                                        onClick={() =>
                                            setDraftIds((list) =>
                                                isOn
                                                    ? list.filter((id) => id !== entry.id)
                                                    : [...list, entry.id],
                                            )
                                        }
                                        className={
                                            isOn
                                                ? "rounded-full border border-forest bg-forest-tint px-2 py-0.5 text-[11px] text-forest"
                                                : "rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                                        }
                                    >
                                        {entry.name}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-faint">
                        {draftIds.length > 0 ? `${draftIds.length}人を選んでいます` : "人を選んでください"}
                    </span>
                    <button
                        type="button"
                        disabled={!canCreate}
                        onClick={() =>
                            void run(async () => {
                                await onCreate(draftName.trim(), draftIds);
                                setDraftName("");
                                setDraftIds([]);
                            })
                        }
                        className="rounded-md bg-forest px-3 py-1 text-[11px] font-medium text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        組を作る
                    </button>
                </div>
            </div>

            {/* ---------------------------------------------- 候補 */}
            {suggested.length > 0 && (
                <div>
                    <p className="text-[12px] font-medium text-ink">候補</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-faint">
                        資料や関係から見つけた組です。外れていることもあるので、押すと上の欄に入ります。名前を直してから作ってください。
                    </p>

                    <ul className="mt-1.5 space-y-1">
                        {suggested.map((group) => (
                            <li key={group.key}>
                                <button
                                    type="button"
                                    onClick={() => takeSuggestion(group)}
                                    className="w-full rounded border border-dashed border-line px-2 py-1.5 text-left hover:border-forest-line hover:bg-forest-tint/40"
                                >
                                    <span className="flex items-baseline justify-between gap-2">
                                        <span className="truncate text-[12px] text-ink">
                                            {group.name}
                                        </span>
                                        <span className="shrink-0 text-[10px] text-faint">
                                            {FROM_LABEL[group.from ?? ""] ?? ""}
                                        </span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-[10.5px] text-muted">
                                        {group.ids
                                            .map((id) => nameOf.get(id) ?? "?")
                                            .join("・")}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
