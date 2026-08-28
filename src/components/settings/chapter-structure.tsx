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
 *   第一部          ← 部
 *     第一章  話 3
 *     第二章  話 5
 *
 * 部かどうかは is_part の印で決める。
 *
 * 子の数で決めていたころは、中の章がすべて出ていくと
 * 部が消えてただの章に戻った。
 * 作者にとって部は入れ物であって、
 * 中身が空になった瞬間に消えるものではない。
 *
 * この画面でできること。
 *
 *   部    作る／名前を変える／消す／並べ替える／たたむ
 *   章    作る／名前を変える／消す／並べ替える／部を移す
 *
 * 前の作りは「部に入れる・入れない」しかできず、
 * しかも押し具が字だけで、触れるものだと分からなかった。
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

    /* たたんでいる部 */
    const [closed, setClosed] = useState<string[]>([]);

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

    /** 途中で失敗しても、理由を画面に出して読み直す */
    async function run(what: string, job: () => Promise<void>) {
        setBusy(true);
        setFailure(null);
        try {
            await job();
        } catch (error) {
            setFailure(
                `${what}に失敗しました。${
                    error instanceof Error
                        ? error.message
                        : "もう一度お試しください。"
                }`,
            );
        } finally {
            await reload();
            setBusy(false);
        }
    }

    const childrenOf = (parentId: string) =>
        chapters.filter((c) => c.parent_id === parentId);

    /*
     * 部かどうかは印で決める。
     *
     * 印を持たない古い章のために、子がいれば部として扱う。
     * SQL を流す前でも画面が壊れない。
     */
    const isPart = (chapter: Chapter) =>
        chapter.is_part === true || childrenOf(chapter.id).length > 0;

    const parts = chapters.filter((c) => !c.parent_id && isPart(c));
    const loose = chapters.filter((c) => !c.parent_id && !isPart(c));

    const countOf = (chapterId: string) =>
        episodes.filter((e) => e.chapter_id === chapterId).length;

    /** 部の話数。中の章まで合わせる */
    const totalOf = (parent: Chapter) =>
        countOf(parent.id) +
        childrenOf(parent.id).reduce((sum, c) => sum + countOf(c.id), 0);

    const chapterCount = chapters.filter((c) => !isPart(c)).length;

    /* ---------------- 手を動かすところ ---------------- */

    /** 新しい部を作る。中が空でも作れる */
    function createPart() {
        void run("部を作るの", async () => {
            const repository = getRepository();
            const created = await repository.createChapter(workId, "");
            await repository.updateChapter(created.id, { is_part: true });
            setDraft("");
            setEditingId(created.id);
        });
    }

    /** 新しい章を作る。parentId を渡すと、その部の中に作る */
    function createChapter(parentId: string | null) {
        void run("章を作るの", async () => {
            const repository = getRepository();
            const created = await repository.createChapter(workId, "");
            if (parentId) {
                await repository.updateChapter(created.id, {
                    parent_id: parentId,
                });
            }
            setDraft("");
            setEditingId(created.id);
        });
    }

    /** 章を、別の部へ移す（NONE ならどの部にも入れない） */
    function moveTo(chapter: Chapter, targetId: string) {
        const to = targetId === NONE ? null : targetId;
        if ((chapter.parent_id ?? null) === to) return;

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

    /** 部を消す。中の章は残し、どの部にも入っていない所へ戻す */
    function removePart(parent: Chapter) {
        const children = childrenOf(parent.id);
        if (
            !window.confirm(
                `「${parent.title || "この部"}」を消します。\n` +
                    (children.length > 0
                        ? `中の${children.length}つの章と話は残り、どの部にも入っていない所へ戻ります。`
                        : "中に章はありません。"),
            )
        ) {
            return;
        }

        void run("部を消すの", async () => {
            const repository = getRepository();

            /* 先に子を出してから、器を消す */
            for (const child of children) {
                await repository.updateChapter(child.id, { parent_id: null });
            }
            await repository.deleteChapter(parent.id);
        });
    }

    /** 章を消す。中の話は残す */
    function removeChapter(chapter: Chapter) {
        const count = countOf(chapter.id);
        if (
            !window.confirm(
                `「${chapter.title || "この章"}」を消します。\n` +
                    (count > 0
                        ? `中の${count}話は消えません。「章に入れていない」へ戻ります。`
                        : "中に話はありません。"),
            )
        ) {
            return;
        }

        void run("章を消すの", async () => {
            await getRepository().deleteChapter(chapter.id);
        });
    }

    /** 名前を確定する */
    function commitName(chapter: Chapter) {
        const title = draft.trim();
        setEditingId(null);
        if (title === (chapter.title ?? "")) return;

        void run("名前を変えるの", async () => {
            await getRepository().updateChapter(chapter.id, { title });
        });
    }

    /** 並べ替え。同じ段の中で、上下に 1 つ動かす */
    function move(chapter: Chapter, to: -1 | 1) {
        const siblings = chapter.parent_id
            ? childrenOf(chapter.parent_id)
            : chapters.filter((c) => !c.parent_id);

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

    /* ---------------- 見せるところ ---------------- */

    if (isLoading) {
        return (
            <p className="py-10 text-center text-sm text-faint">
                読み込んでいます
            </p>
        );
    }

    /** 名前を直す入力。部にも章にも使う */
    function NameField({
        chapter,
        placeholder,
        big,
    }: {
        chapter: Chapter;
        placeholder: string;
        big?: boolean;
    }) {
        return (
            <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitName(chapter)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") commitName(chapter);
                    if (e.key === "Escape") setEditingId(null);
                }}
                placeholder={placeholder}
                className={[
                    "min-w-0 flex-1 rounded border border-forest bg-canvas px-2 py-1 text-ink outline-none",
                    big ? "text-sm font-semibold" : "text-[13px]",
                ].join(" ")}
            />
        );
    }

    /** 章 1 行。部の中でも外でも同じ形で出す */
    function ChapterRow({ chapter }: { chapter: Chapter }) {
        const editing = editingId === chapter.id;

        return (
            <li className="rounded-lg border border-line bg-canvas px-3 py-2.5">
                <div className="flex items-center gap-2">
                    {editing ? (
                        <NameField chapter={chapter} placeholder="章の名前" />
                    ) : (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                setDraft(chapter.title ?? "");
                                setEditingId(chapter.id);
                            }}
                            title="押すと名前を直せます"
                            className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-[13px] text-ink hover:bg-forest-tint/40 disabled:opacity-40"
                        >
                            {chapter.title || (
                                <span className="text-faint">
                                    名前のない章（押して付ける）
                                </span>
                            )}
                            <span className="ml-2 text-[11px] text-faint">
                                {countOf(chapter.id)}話
                            </span>
                        </button>
                    )}

                    {!editing && (
                        <>
                            <MoveButtons
                                onUp={() => move(chapter, -1)}
                                onDown={() => move(chapter, 1)}
                                busy={busy}
                            />
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => removeChapter(chapter)}
                                title="この章を消す"
                                className="shrink-0 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-40"
                            >
                                消す
                            </button>
                        </>
                    )}
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
                        className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-[12px] text-ink disabled:opacity-40"
                    >
                        <option value={NONE}>どの部にも入れない</option>
                        {parts.map((part, at) => (
                            <option key={part.id} value={part.id}>
                                第{at + 1}部
                                {part.title ? `　${part.title}` : ""}
                            </option>
                        ))}
                    </select>
                </div>
            </li>
        );
    }

    /** 「章を作る」の押し具 */
    function AddChapter({ parentId }: { parentId: string | null }) {
        return (
            <button
                type="button"
                disabled={busy}
                onClick={() => createChapter(parentId)}
                className="mt-2 w-full rounded-lg border border-dashed border-line py-2 text-[11px] text-muted hover:border-forest hover:text-forest disabled:opacity-40"
            >
                ＋ ここに章を作る
            </button>
        );
    }

    return (
        <div className="space-y-4">
            {/* いまの形を、数で一目に */}
            <div className="rounded-xl border border-line bg-surface px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                    <Stat label="部" value={parts.length} />
                    <Stat label="章" value={chapterCount} />
                    <Stat label="話" value={episodes.length} />
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
                    章を束ねて「部」にまとめられます。
                    「第一部 → 第一章」のように 2 段で分けたいときに使います。
                    <br />
                    名前は押すとその場で直せます。各章の「入れる部」で、あとからでも移せます。
                </p>
            </div>

            {failure && (
                <p className="rounded-lg border border-[var(--color-danger)] bg-surface px-4 py-3 text-[12px] text-[var(--color-danger)]">
                    {failure}
                </p>
            )}

            {chapters.length === 0 && (
                <p className="rounded-lg border border-line bg-surface px-5 py-8 text-center text-[12px] leading-relaxed text-faint">
                    まだ章がありません。
                    <br />
                    下の「新しい部を作る」か、執筆画面から章を作れます。
                </p>
            )}

            {/* 部 */}
            {parts.map((parent, at) => {
                const editing = editingId === parent.id;
                const children = childrenOf(parent.id);
                const isClosed = closed.includes(parent.id);

                return (
                    <div
                        key={parent.id}
                        className="overflow-hidden rounded-xl border border-forest-line bg-surface"
                    >
                        {/* 部の帯。章の行と見分けが付くように色を敷く */}
                        <div className="flex items-center gap-2 bg-forest-tint px-3 py-2.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white">
                                {at + 1}
                            </span>

                            {editing ? (
                                <NameField
                                    chapter={parent}
                                    placeholder="部の名前（例：第一部　旅立ち）"
                                    big
                                />
                            ) : (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                        setDraft(parent.title ?? "");
                                        setEditingId(parent.id);
                                    }}
                                    title="押すと名前を直せます"
                                    className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-sm font-semibold text-ink hover:bg-canvas/60 disabled:opacity-40"
                                >
                                    {parent.title || (
                                        <span className="font-normal text-muted">
                                            名前のない部（押して付ける）
                                        </span>
                                    )}
                                    <span className="ml-2 text-[11px] font-normal text-muted">
                                        {children.length}章 / {totalOf(parent)}話
                                    </span>
                                </button>
                            )}

                            {!editing && (
                                <>
                                    <MoveButtons
                                        onUp={() => move(parent, -1)}
                                        onDown={() => move(parent, 1)}
                                        busy={busy}
                                    />
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => removePart(parent)}
                                        title="この部を消す"
                                        className="shrink-0 rounded border border-line bg-canvas px-2 py-1 text-[11px] text-muted hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-40"
                                    >
                                        消す
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setClosed((list) =>
                                                list.includes(parent.id)
                                                    ? list.filter(
                                                          (x) => x !== parent.id,
                                                      )
                                                    : [...list, parent.id],
                                            )
                                        }
                                        aria-expanded={!isClosed}
                                        title={isClosed ? "開く" : "たたむ"}
                                        className="shrink-0 rounded border border-line bg-canvas px-2 py-1 text-[11px] text-muted hover:border-forest hover:text-forest"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="inline-block transition-transform"
                                            style={{
                                                transform: isClosed
                                                    ? "rotate(-90deg)"
                                                    : "none",
                                            }}
                                        >
                                            ▾
                                        </span>
                                    </button>
                                </>
                            )}
                        </div>

                        {!isClosed && (
                            <div className="px-3 py-3">
                                {children.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-faint">
                                        まだ章がありません。
                                        <br />
                                        下から作るか、他の章の「入れる部」でここを選びます。
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {children.map((child) => (
                                            <ChapterRow
                                                key={child.id}
                                                chapter={child}
                                            />
                                        ))}
                                    </ul>
                                )}
                                <AddChapter parentId={parent.id} />
                            </div>
                        )}
                    </div>
                );
            })}

            {/* どの部にも入っていない章 */}
            {(loose.length > 0 || parts.length > 0) && (
                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                    <div className="flex items-center gap-2 bg-canvas px-3 py-2.5">
                        <span className="text-[12px] font-medium text-ink">
                            どの部にも入っていない章
                        </span>
                        <span className="text-[11px] text-faint">
                            {loose.length}章
                        </span>
                    </div>

                    <div className="px-3 py-3">
                        {loose.length === 0 ? (
                            <p className="py-2 text-center text-[11px] text-faint">
                                すべての章が、どれかの部に入っています。
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {loose.map((chapter) => (
                                    <ChapterRow
                                        key={chapter.id}
                                        chapter={chapter}
                                    />
                                ))}
                            </ul>
                        )}
                        <AddChapter parentId={null} />
                    </div>
                </div>
            )}

            {/*
             * 新しい部。
             *
             * 中が空でも作れる。
             * 先に器を並べてから章を入れていく人がいる。
             */}
            <button
                type="button"
                disabled={busy}
                onClick={createPart}
                className="w-full rounded-xl border border-dashed border-forest-line py-3.5 text-[12px] font-medium text-forest hover:bg-forest-tint/40 disabled:opacity-40"
            >
                ＋ 新しい部を作る
            </button>

            {busy && (
                <p className="text-center text-[11px] text-faint">
                    保存しています…
                </p>
            )}
        </div>
    );
}

/** まとめの数字 */
function Stat({ label, value }: { label: string; value: number }) {
    return (
        <span className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-ink">{value}</span>
            <span className="text-[11px] text-faint">{label}</span>
        </span>
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
