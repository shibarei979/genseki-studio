"use client";

import { useEffect, useRef, useState } from "react";

import { getRepository } from "@/lib/repository";
import type { Chapter, Episode } from "@/types";

/**
 * ============================================================
 * 原石航路 Studio
 * ChapterStructure — 章の構成
 *
 *   第一部          ← 部
 *     第一章  話 3
 *     第二章  話 5
 *
 * 部かどうかは is_part の印で決める。
 * 子の数で決めていたころは、中の章が空になると
 * 部が消えてただの章に戻った。
 * 部は入れ物なので、空でも部のまま残す。
 *
 * ★ 部品は、必ずこのファイルの一番外で定義する。
 *
 *   画面の部品の中で部品を定義すると、
 *   描き直すたびに「別の部品」と見なされ、
 *   入力欄が作り直される。
 *   日本語を組み立てている途中で欄が消えるので、
 *   「は」を打とうとすると「hあ」になる。
 *
 * ★ 移す先は、1 行ごとに置かない。
 *
 *   章の 1 行ごとに選ぶ所を付けていたが、
 *   同じ文字が何行も並んで読みにくく、
 *   10 章を移すのに 10 回選ぶことになった。
 *   選んでから、まとめて移す形にしている。
 * ============================================================
 */

/* ------------------------------------------------------------
 * 部品
 * ---------------------------------------------------------- */

/**
 * 名前を直す入力欄。
 *
 * ★ React に文字を持たせない。
 *
 *   value と useState で持たせると、1 文字ごとに
 *   React が入力欄へ文字を書き戻す。
 *   日本語は「h」→「は」と組み立ててから確定するので、
 *   組み立ての途中で書き戻されると崩れて「hあ」になる。
 *   スマホの日本語入力で特に起きやすい。
 *
 *   defaultValue にして、React は最初の一度だけ渡す。
 *   打っている間、React はこの欄に触らない。
 *   決めるとき（外れる・Enter）に、欄から読み取る。
 */
function NameField({
    initial,
    placeholder,
    big,
    onCommit,
    onCancel,
}: {
    initial: string;
    placeholder: string;
    big?: boolean;
    onCommit: (title: string) => void;
    onCancel: () => void;
}) {
    const field = useRef<HTMLInputElement>(null);

    /*
     * 変換中かどうか。
     *
     * 変換を決める Enter と、名前を決める Enter は同じキー。
     * 見分けないと、変換した時点で名前が確定する。
     */
    const composing = useRef(false);

    /* 決めるのは一度きり。Enter のあと外れると二重になる */
    const settled = useRef(false);

    function finish(commit: boolean) {
        if (settled.current) return;
        settled.current = true;
        if (commit) onCommit(field.current?.value ?? initial);
        else onCancel();
    }

    return (
        <input
            ref={field}
            autoFocus
            defaultValue={initial}
            placeholder={placeholder}
            onCompositionStart={() => {
                composing.current = true;
            }}
            onCompositionEnd={() => {
                composing.current = false;
            }}
            onBlur={() => finish(true)}
            onKeyDown={(e) => {
                if (composing.current || e.nativeEvent.isComposing) return;
                if (e.key === "Enter") finish(true);
                if (e.key === "Escape") finish(false);
            }}
            className={[
                "min-w-0 flex-1 rounded border border-forest bg-canvas px-2 py-1 text-ink outline-none",
                big ? "text-sm font-semibold" : "text-[13px]",
            ].join(" ")}
        />
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

/** まとめの数字 */
function Stat({ label, value }: { label: string; value: number }) {
    return (
        <span className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-ink">{value}</span>
            <span className="text-[11px] text-faint">{label}</span>
        </span>
    );
}

/**
 * 章 1 行。
 *
 * 左の四角で選ぶ。選んだ章は、上の帯からまとめて移す。
 */
function ChapterRow({
    chapter,
    count,
    busy,
    editing,
    selected,
    onToggle,
    onStartEdit,
    onCommitName,
    onCancelEdit,
    onMoveUp,
    onMoveDown,
    onRemove,
}: {
    chapter: Chapter;
    count: number;
    busy: boolean;
    editing: boolean;
    selected: boolean;
    onToggle: () => void;
    onStartEdit: () => void;
    onCommitName: (title: string) => void;
    onCancelEdit: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
}) {
    return (
        <li
            className={[
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                selected
                    ? "border-forest bg-forest-tint/50"
                    : "border-line bg-canvas",
            ].join(" ")}
        >
            <input
                type="checkbox"
                checked={selected}
                onChange={onToggle}
                disabled={busy}
                aria-label="この章を選ぶ"
                className="h-4 w-4 shrink-0"
            />

            {editing ? (
                <NameField
                    initial={chapter.title ?? ""}
                    placeholder="章の名前"
                    onCommit={onCommitName}
                    onCancel={onCancelEdit}
                />
            ) : (
                <button
                    type="button"
                    disabled={busy}
                    onClick={onStartEdit}
                    title="押すと名前を直せます"
                    className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-[13px] text-ink hover:bg-forest-tint/40 disabled:opacity-40"
                >
                    {chapter.title || (
                        <span className="text-faint">
                            名前のない章（押して付ける）
                        </span>
                    )}
                    <span className="ml-2 text-[11px] text-faint">
                        {count}話
                    </span>
                </button>
            )}

            {!editing && (
                <>
                    <MoveButtons
                        onUp={onMoveUp}
                        onDown={onMoveDown}
                        busy={busy}
                    />
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onRemove}
                        title="この章を消す"
                        className="shrink-0 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-40"
                    >
                        消す
                    </button>
                </>
            )}
        </li>
    );
}

/* ------------------------------------------------------------
 * 画面
 * ---------------------------------------------------------- */

export default function ChapterStructure({ workId }: { workId: string }) {
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    /* 失敗を黙って飲まない。理由を画面に出す */
    const [failure, setFailure] = useState<string | null>(null);

    /* 名前を直している章 */
    const [editingId, setEditingId] = useState<string | null>(null);

    /* たたんでいる部 */
    const [closed, setClosed] = useState<string[]>([]);

    /* 選んでいる章。まとめて移すために使う */
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
     * 印を持たない古い章のために、子がいれば部として扱う。
     */
    const isPart = (chapter: Chapter) =>
        chapter.is_part === true || childrenOf(chapter.id).length > 0;

    const parts = chapters.filter((c) => !c.parent_id && isPart(c));
    const loose = chapters.filter((c) => !c.parent_id && !isPart(c));

    const countOf = (chapterId: string) =>
        episodes.filter((e) => e.chapter_id === chapterId).length;

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
            setEditingId(created.id);
        });
    }

    /** 選んだ章を、まとめて移す */
    function movePicked(targetId: string) {
        const to = targetId === "" ? null : targetId;
        const ids = picked.filter((id) => {
            const chapter = chapters.find((c) => c.id === id);
            return chapter && (chapter.parent_id ?? null) !== to;
        });
        if (ids.length === 0) {
            setPicked([]);
            return;
        }

        void run("章を移すの", async () => {
            const repository = getRepository();

            /*
             * 並び順は、移した先の一番下へ順に。
             *
             * もとの番号のまま移すと、行き先の章のあいだに
             * 割り込んで、思っていない場所に入る。
             */
            let last = chapters.reduce(
                (max, c) => Math.max(max, c.sort_order ?? 0),
                -1,
            );

            for (const id of ids) {
                last += 1;
                await repository.updateChapter(id, {
                    parent_id: to,
                    sort_order: last,
                });
            }

            setPicked([]);
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
    function commitName(chapter: Chapter, next: string) {
        const title = next.trim();
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

    function toggle(id: string) {
        setPicked((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    }

    /** その束の章を、まとめて選ぶ／外す */
    function toggleAll(ids: string[]) {
        const allPicked = ids.every((id) => picked.includes(id));
        setPicked((prev) =>
            allPicked
                ? prev.filter((id) => !ids.includes(id))
                : Array.from(new Set([...prev, ...ids])),
        );
    }

    function rowProps(chapter: Chapter) {
        return {
            chapter,
            count: countOf(chapter.id),
            busy,
            editing: editingId === chapter.id,
            selected: picked.includes(chapter.id),
            onToggle: () => toggle(chapter.id),
            onStartEdit: () => setEditingId(chapter.id),
            onCommitName: (title: string) => commitName(chapter, title),
            onCancelEdit: () => setEditingId(null),
            onMoveUp: () => move(chapter, -1),
            onMoveDown: () => move(chapter, 1),
            onRemove: () => removeChapter(chapter),
        };
    }

    /* ---------------- 見せるところ ---------------- */

    if (isLoading) {
        return (
            <p className="py-10 text-center text-sm text-faint">
                読み込んでいます
            </p>
        );
    }

    return (
        <div className="space-y-3">
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
                    名前は押すとその場で直せます。
                    章の左の四角で選ぶと、まとめて移せます。
                </p>
            </div>

            {/*
             * 作る押し具は上に置く。
             *
             * 章が増えるほど下へ流れて、探すことになる。
             */}
            <div className="flex gap-2">
                <button
                    type="button"
                    disabled={busy}
                    onClick={createPart}
                    className="flex-1 rounded-lg border border-dashed border-forest-line py-2.5 text-[12px] font-medium text-forest hover:bg-forest-tint/40 disabled:opacity-40"
                >
                    ＋ 新しい部
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => createChapter(null)}
                    className="flex-1 rounded-lg border border-dashed border-line py-2.5 text-[12px] font-medium text-muted hover:border-forest hover:text-forest disabled:opacity-40"
                >
                    ＋ 新しい章
                </button>
            </div>

            {/*
             * 選んだ章をまとめて移す帯。
             *
             * 選んでいる間だけ出す。
             * 上に貼り付けて、下まで送っても見えるようにする。
             */}
            {picked.length > 0 && (
                <div className="sticky top-0 z-10 rounded-xl border-2 border-forest bg-forest-tint px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-ink">
                            {picked.length}つの章を選んでいます
                        </span>
                        <button
                            type="button"
                            onClick={() => setPicked([])}
                            className="text-[11px] text-muted underline hover:text-ink"
                        >
                            選ぶのをやめる
                        </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                        <span className="shrink-0 text-[11px] text-muted">
                            移す先
                        </span>
                        <select
                            defaultValue=""
                            disabled={busy}
                            onChange={(e) => {
                                movePicked(e.target.value);
                                e.currentTarget.value = "";
                            }}
                            className="min-w-0 flex-1 rounded border border-forest bg-canvas px-2 py-1.5 text-[12px] text-ink disabled:opacity-40"
                        >
                            <option value="" disabled>
                                選ぶとすぐ移ります
                            </option>
                            {parts.map((part, at) => (
                                <option key={part.id} value={part.id}>
                                    第{at + 1}部
                                    {part.title ? `　${part.title}` : ""}
                                </option>
                            ))}
                            <option value="">どの部にも入れない</option>
                        </select>
                    </div>
                </div>
            )}

            {failure && (
                <p className="rounded-lg border border-[var(--color-danger)] bg-surface px-4 py-3 text-[12px] text-[var(--color-danger)]">
                    {failure}
                </p>
            )}

            {chapters.length === 0 && (
                <p className="rounded-lg border border-line bg-surface px-5 py-8 text-center text-[12px] leading-relaxed text-faint">
                    まだ章がありません。
                    <br />
                    上の「＋ 新しい部」か「＋ 新しい章」から作れます。
                </p>
            )}

            {/* 部 */}
            {parts.map((parent, at) => {
                const editing = editingId === parent.id;
                const children = childrenOf(parent.id);
                const ids = children.map((c) => c.id);
                const isClosed = closed.includes(parent.id);
                const allPicked =
                    ids.length > 0 && ids.every((id) => picked.includes(id));

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
                                    initial={parent.title ?? ""}
                                    placeholder="部の名前（例：旅立ち）"
                                    big
                                    onCommit={(title) =>
                                        commitName(parent, title)
                                    }
                                    onCancel={() => setEditingId(null)}
                                />
                            ) : (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => setEditingId(parent.id)}
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
                                <div className="mb-2 flex items-center gap-3">
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => createChapter(parent.id)}
                                        className="flex-1 rounded-lg border border-dashed border-line py-2 text-[11px] text-muted hover:border-forest hover:text-forest disabled:opacity-40"
                                    >
                                        ＋ この部に章を作る
                                    </button>
                                    {ids.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => toggleAll(ids)}
                                            className="shrink-0 text-[11px] text-muted underline hover:text-forest"
                                        >
                                            {allPicked
                                                ? "選択を外す"
                                                : "全部選ぶ"}
                                        </button>
                                    )}
                                </div>

                                {children.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-faint">
                                        まだ章がありません。
                                        <br />
                                        上から作るか、他の章を選んでここへ移します。
                                    </p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {children.map((child) => (
                                            <ChapterRow
                                                key={child.id}
                                                {...rowProps(child)}
                                            />
                                        ))}
                                    </ul>
                                )}
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
                        <span className="flex-1" />
                        {loose.length > 0 && (
                            <button
                                type="button"
                                onClick={() =>
                                    toggleAll(loose.map((c) => c.id))
                                }
                                className="shrink-0 text-[11px] text-muted underline hover:text-forest"
                            >
                                {loose.every((c) => picked.includes(c.id))
                                    ? "選択を外す"
                                    : "全部選ぶ"}
                            </button>
                        )}
                    </div>

                    <div className="px-3 py-3">
                        {loose.length === 0 ? (
                            <p className="py-2 text-center text-[11px] text-faint">
                                すべての章が、どれかの部に入っています。
                            </p>
                        ) : (
                            <ul className="space-y-1.5">
                                {loose.map((chapter) => (
                                    <ChapterRow
                                        key={chapter.id}
                                        {...rowProps(chapter)}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {busy && (
                <p className="text-center text-[11px] text-faint">
                    保存しています…
                </p>
            )}
        </div>
    );
}
