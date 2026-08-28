"use client";

import { useEffect, useState } from "react";

import { getRepository } from "@/lib/repository";
import type { Chapter, Episode } from "@/types";

/**
 * ============================================================
 * 原石航路 Studio
 * ChapterStructure — 章の構成
 *
 * 章を 2 段にする。
 *
 *   第一部          ← 大きい章
 *     第一章  話 3
 *     第二章  話 5
 *
 * 前の作りでは、できることが少なすぎた。
 *
 *   ・すでにある部へ、あとから章を足せない
 *   ・部の中の章を、別の部へ移せない
 *   ・章 1 つでは部にできない
 *   ・部に話数も番号も出ない
 *   ・名前の入力が、画面の上に出る小さな窓
 *
 * そのうえ押し具が薄く、触れることに気づけなかった。
 * 「操作できないもの」に見えていた。
 *
 * ここでは、できることを全部その場に出す。
 * 章の 1 行ごとに「移す先」を置き、
 * どこへでも動かせるようにする。
 *
 * 空の部は作れない。
 * 部かどうかは「子を持つか」だけで決めているので、
 * 中身の無い部は、ただの章と区別が付かない。
 * だから部を作るときは、入れる章を選んでもらう。
 * （1 つでよい）
 * ============================================================
 */

/** 部に入れていないことを表す目印。章の id と混ざらないようにする */
const NONE = "__none__";

export default function ChapterStructure({ workId }: { workId: string }) {
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    /*
     * 失敗を黙って飲まない。
     *
     * 「動かせない」と言われても理由が分からない、
     * という事故が実際に起きている。
     */
    const [failure, setFailure] = useState<string | null>(null);

    /* 名前を直している章。画面の中で直す（小さな窓は使わない） */
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState("");

    /* 部を作っている最中だけ立つ */
    const [creating, setCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [picked, setPicked] = useState<string[]>([]);

    async function reload() {
        const repository = getRepository();
        const [chapterRows, episodeRows] = await Promise.all([
            repository.listChapters(workId),
            repository.listEpisodes(workId),
        ]);

        setChapters(chapterRows);
        setEpisodes(episodeRows);
        setIsLoading(false);
    }

    useEffect(() => {
        void reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workId]);

    /** 途中で失敗しても、理由を画面に出して元の状態へ戻す */
    async function run(what: string, job: () => Promise<void>) {
        setBusy(true);
        setFailure(null);
        try {
            await job();
            await reload();
        } catch (error) {
            setFailure(
                `${what}に失敗しました。${
                    error instanceof Error ? error.message : "もう一度お試しください。"
                }`,
            );
            await reload();
        } finally {
            setBusy(false);
        }
    }

    const childrenOf = (parentId: string) =>
        chapters.filter((c) => c.parent_id === parentId);

    /* 部＝子を持つ章。子を持たない親なしの章は、ただの章 */
    const parts = chapters.filter(
        (c) => !c.parent_id && childrenOf(c.id).length > 0,
    );
    const loose = chapters.filter(
        (c) => !c.parent_id && childrenOf(c.id).length === 0,
    );

    const countOf = (chapterId: string) =>
        episodes.filter((e) => e.chapter_id === chapterId).length;

    /** 部の話数。中の章まで合わせる */
    const totalOf = (parent: Chapter) =>
        countOf(parent.id) +
        childrenOf(parent.id).reduce((sum, c) => sum + countOf(c.id), 0);

    /** 章を、別の部へ移す（NONE ならどの部にも入れない） */
    function moveTo(chapter: Chapter, targetId: string) {
        const to = targetId === NONE ? null : targetId;
        if ((chapter.parent_id ?? null) === to) return;

        /*
         * もとの部から出ると、その部の子が 0 になることがある。
         * 子が 0 の部は、ただの章に戻る。
         * 黙って戻ると驚くので、先に伝える。
         */
        const from = chapter.parent_id;
        if (from) {
            const rest = childrenOf(from).filter((c) => c.id !== chapter.id);
            if (rest.length === 0) {
                const name =
                    chapters.find((c) => c.id === from)?.title || "もとの部";
                if (
                    !window.confirm(
                        `「${name}」の中が空になります。\n空になった部は、ただの章に戻ります。\n続けますか。`,
                    )
                ) {
                    return;
                }
            }
        }

        void run("章を移すの", async () => {
            /*
             * 並び順は、移した先の一番下。
             *
             * もとの番号のまま移すと、行き先の章のあいだに
             * 割り込んで、思っていない場所に入る。
             */
            const last = chapters.reduce(
                (max, c) => Math.max(max, c.sort_order ?? 0),
                -1,
            );
            await getRepository().updateChapter(chapter.id, {
                parent_id: to,
                sort_order: last + 1,
            });
        });
    }

    /** 選んだ章で、新しい部を作る */
    function createPart() {
        const title = newTitle.trim();
        if (title.length === 0 || picked.length === 0) return;

        void run("部を作るの", async () => {
            const repository = getRepository();

            /*
             * 先に器を作り、それから中身を移す。
             *
             * 逆にすると、行き先の無い章ができる。
             */
            const parent = await repository.createChapter(workId, title);
            for (const id of picked) {
                await repository.updateChapter(id, { parent_id: parent.id });
            }

            setCreating(false);
            setNewTitle("");
            setPicked([]);
        });
    }

    /** まとめを解く。中の章は残し、束ねだけ外す */
    function ungroup(parent: Chapter) {
        const children = childrenOf(parent.id);
        if (
            !window.confirm(
                `「${parent.title || "この部"}」のまとめを解きます。\n中の${children.length}つの章と話は残ります。`,
            )
        ) {
            return;
        }

        void run("まとめを解くの", async () => {
            const repository = getRepository();

            /* 先に子を出してから、器を消す */
            for (const child of children) {
                await repository.updateChapter(child.id, { parent_id: null });
            }
            await repository.deleteChapter(parent.id);
        });
    }

    /** 名前を確定する */
    function commitName(chapter: Chapter) {
        const title = draft.trim();
        setEditingId(null);
        if (title === chapter.title) return;

        void run("名前を変えるの", async () => {
            await getRepository().updateChapter(chapter.id, { title });
        });
    }

    /** 並べ替え。同じ段の中で、上下に 1 つ動かす */
    function move(chapter: Chapter, to: -1 | 1) {
        const siblings = chapter.parent_id
            ? childrenOf(chapter.parent_id)
            : [...parts, ...loose].sort(
                  (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
              );

        const at = siblings.findIndex((c) => c.id === chapter.id);
        const next = at + to;
        if (next < 0 || next >= siblings.length) return;

        void run("並べ替えるの", async () => {
            const repository = getRepository();
            await repository.updateChapter(chapter.id, {
                sort_order: siblings[next].sort_order,
            });
            await repository.updateChapter(siblings[next].id, {
                sort_order: chapter.sort_order,
            });
        });
    }

    /* ------------------------------------------------------------ */

    if (isLoading) {
        return (
            <p className="py-10 text-center text-sm text-faint">
                読み込んでいます
            </p>
        );
    }

    if (chapters.length === 0) {
        return (
            <p className="rounded-lg border border-line bg-surface px-5 py-10 text-center text-sm text-faint">
                まだ章がありません。
                <br />
                執筆画面で章を作ると、ここでまとめられます。
            </p>
        );
    }

    /** 章 1 行。部の中でも外でも同じ形で出す */
    function ChapterRow({ chapter }: { chapter: Chapter }) {
        const isEditing = editingId === chapter.id;

        return (
            <li className="rounded-md border border-line bg-surface px-3 py-2.5">
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commitName(chapter)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commitName(chapter);
                                if (e.key === "Escape") setEditingId(null);
                            }}
                            placeholder="章の名前"
                            className="min-w-0 flex-1 rounded border border-forest bg-canvas px-2 py-1 text-[13px] text-ink outline-none"
                        />
                    ) : (
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                            {chapter.title || (
                                <span className="text-faint">名前のない章</span>
                            )}
                            <span className="ml-2 text-[11px] text-faint">
                                {countOf(chapter.id)}話
                            </span>
                        </span>
                    )}

                    {!isEditing && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                setDraft(chapter.title ?? "");
                                setEditingId(chapter.id);
                            }}
                            className="shrink-0 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-forest hover:text-forest disabled:opacity-40"
                        >
                            名前を変える
                        </button>
                    )}

                    <MoveButtons
                        onUp={() => move(chapter, -1)}
                        onDown={() => move(chapter, 1)}
                        busy={busy}
                    />
                </div>

                {/*
                 * 移す先。
                 *
                 * 前の作りでは、一度まとめると動かせなかった。
                 * 章の 1 行ごとに置けば、どこへでも動かせる。
                 */}
                <div className="mt-2 flex items-center gap-2">
                    <span className="shrink-0 text-[11px] text-faint">
                        入れる部
                    </span>
                    <select
                        value={chapter.parent_id ?? NONE}
                        disabled={busy}
                        onChange={(e) => moveTo(chapter, e.target.value)}
                        className="min-w-0 flex-1 rounded border border-line bg-canvas px-2 py-1 text-[12px] text-ink disabled:opacity-40"
                    >
                        <option value={NONE}>どの部にも入れない</option>
                        {parts.map((part, at) => (
                            <option key={part.id} value={part.id}>
                                {part.title || `第${at + 1}部`}
                            </option>
                        ))}
                    </select>
                </div>
            </li>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-line bg-surface px-4 py-3">
                <p className="text-xs leading-relaxed text-muted">
                    章をいくつか束ねて、「部」にまとめられます。
                    <br />
                    「第一部 → 第一章」のように、2段で分けたいときに使います。
                    <br />
                    各章の「入れる部」を変えると、あとからでも移せます。
                </p>
            </div>

            {failure && (
                <p className="rounded-lg border border-[var(--color-danger)] bg-surface px-4 py-3 text-[12px] text-[var(--color-danger)]">
                    {failure}
                </p>
            )}

            {busy && (
                <p className="text-[11px] text-faint">保存しています…</p>
            )}

            {/* 部 */}
            {parts.map((parent, at) => (
                <div
                    key={parent.id}
                    className="rounded-lg border-2 border-forest-line bg-forest-tint/20 px-4 py-3"
                >
                    <div className="flex items-center gap-2">
                        {editingId === parent.id ? (
                            <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => commitName(parent)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") commitName(parent);
                                    if (e.key === "Escape") setEditingId(null);
                                }}
                                placeholder="部の名前"
                                className="min-w-0 flex-1 rounded border border-forest bg-canvas px-2 py-1 text-sm text-ink outline-none"
                            />
                        ) : (
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                                {/*
                                 * 番号を出す。
                                 * 名前を付けていない部を、順番で見分けられる。
                                 */}
                                <span className="mr-2 text-[11px] font-normal text-forest">
                                    第{at + 1}部
                                </span>
                                {parent.title || (
                                    <span className="font-normal text-faint">
                                        名前のない部
                                    </span>
                                )}
                                <span className="ml-2 text-[11px] font-normal text-faint">
                                    {childrenOf(parent.id).length}章 /{" "}
                                    {totalOf(parent)}話
                                </span>
                            </span>
                        )}

                        {editingId !== parent.id && (
                            <>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                        setDraft(parent.title ?? "");
                                        setEditingId(parent.id);
                                    }}
                                    className="shrink-0 rounded border border-line bg-canvas px-2 py-1 text-[11px] text-muted hover:border-forest hover:text-forest disabled:opacity-40"
                                >
                                    名前を変える
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => ungroup(parent)}
                                    className="shrink-0 rounded border border-line bg-canvas px-2 py-1 text-[11px] text-muted hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-40"
                                >
                                    まとめを解く
                                </button>
                                <MoveButtons
                                    onUp={() => move(parent, -1)}
                                    onDown={() => move(parent, 1)}
                                    busy={busy}
                                />
                            </>
                        )}
                    </div>

                    <ul className="mt-2.5 space-y-2">
                        {childrenOf(parent.id).map((child) => (
                            <ChapterRow key={child.id} chapter={child} />
                        ))}
                    </ul>
                </div>
            ))}

            {/* どの部にも入っていない章 */}
            {loose.length > 0 && (
                <div className="rounded-lg border border-line bg-surface px-4 py-3">
                    <p className="text-[12px] font-medium text-ink">
                        どの部にも入っていない章
                        <span className="ml-2 text-[11px] font-normal text-faint">
                            {loose.length}章
                        </span>
                    </p>

                    <ul className="mt-2.5 space-y-2">
                        {loose.map((chapter) => (
                            <ChapterRow key={chapter.id} chapter={chapter} />
                        ))}
                    </ul>
                </div>
            )}

            {/* 新しい部を作る */}
            {!creating ? (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                        setCreating(true);
                        setNewTitle("");
                        setPicked([]);
                    }}
                    className="w-full rounded-lg border border-dashed border-forest-line py-3 text-[12px] font-medium text-forest hover:bg-forest-tint/30 disabled:opacity-40"
                >
                    ＋ 新しい部を作る
                </button>
            ) : (
                <div className="rounded-lg border-2 border-forest bg-surface px-4 py-3">
                    <p className="text-[12px] font-medium text-ink">
                        新しい部を作る
                    </p>

                    <input
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="部の名前（例：第一部　旅立ち）"
                        className="mt-2.5 w-full rounded border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
                    />

                    <p className="mt-3 text-[11px] text-muted">
                        入れる章を選びます。1つでも作れます。
                        <br />
                        あとから足すことも、別の部へ移すこともできます。
                    </p>

                    <ul className="mt-2 space-y-1.5">
                        {chapters
                            .filter((c) => childrenOf(c.id).length === 0)
                            .map((chapter) => (
                                <li key={chapter.id}>
                                    <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={picked.includes(chapter.id)}
                                            onChange={() =>
                                                setPicked((prev) =>
                                                    prev.includes(chapter.id)
                                                        ? prev.filter(
                                                              (x) => x !== chapter.id,
                                                          )
                                                        : [...prev, chapter.id],
                                                )
                                            }
                                            className="h-3.5 w-3.5 shrink-0"
                                        />
                                        <span className="min-w-0 truncate text-[13px] text-ink">
                                            {chapter.title || "名前のない章"}
                                            <span className="ml-2 text-[11px] text-faint">
                                                {countOf(chapter.id)}話
                                            </span>
                                        </span>
                                    </label>
                                </li>
                            ))}
                    </ul>

                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            disabled={
                                busy ||
                                newTitle.trim().length === 0 ||
                                picked.length === 0
                            }
                            onClick={createPart}
                            className="flex-1 rounded-md bg-forest py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
                        >
                            {picked.length === 0
                                ? "入れる章を選んでください"
                                : newTitle.trim().length === 0
                                  ? "部の名前を入れてください"
                                  : `選んだ${picked.length}つで部を作る`}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setCreating(false)}
                            className="rounded-md border border-line px-4 py-2 text-[12px] text-muted hover:text-ink disabled:opacity-40"
                        >
                            やめる
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** 上下に動かす押し具。枠を付けて、押せることが分かるようにする */
function MoveButtons({
    onUp,
    onDown,
    busy,
}: {
    onUp: () => void;
    onDown: () => void;
    busy: boolean;
}) {
    return (
        <span className="flex shrink-0 items-center overflow-hidden rounded border border-line bg-canvas">
            <button
                type="button"
                onClick={onUp}
                disabled={busy}
                aria-label="上へ"
                className="px-2 py-1 text-[11px] text-muted hover:bg-forest-tint hover:text-forest disabled:opacity-40"
            >
                ▲
            </button>
            <span className="h-4 w-px bg-line" />
            <button
                type="button"
                onClick={onDown}
                disabled={busy}
                aria-label="下へ"
                className="px-2 py-1 text-[11px] text-muted hover:bg-forest-tint hover:text-forest disabled:opacity-40"
            >
                ▼
            </button>
        </span>
    );
}
