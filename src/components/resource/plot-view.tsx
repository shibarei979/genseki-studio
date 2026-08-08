/**
 * ============================================================
 * 原石航路 Studio
 * PlotView — プロット・構成
 *
 * 段を柱、場面を横木としてボードに並べる。
 * 段だけだと「導入」「転機」という大枠しか置けず、
 * 実際に書くときに手が動かない。
 *
 * 決まった段（導入・旅立ち・試練…）は用意しない。
 * あれはファンタジーの型であって、物語一般の型ではない。
 *
 * このページでは AI補助を使わない。骨格を決めるのは作者の仕事。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import DeleteButton from "@/components/common/delete-button";
import ResourceIcon from "@/components/resource/resource-icons";
import type { PlotTemplate } from "@/lib/resource/plot-templates";
import { PLOT_TEMPLATES } from "@/lib/resource/plot-templates";
import type { PlotScene, PlotStage, ResourceEntry } from "@/types";

/** 段ごとの色。ボードで柱を見分けるためだけに使う */
const STAGE_TONES = [
    { bar: "#4a8c62", bg: "#f0f7f2", text: "#3d7553" },
    { bar: "#c99a2e", bg: "#fdf8ec", text: "#a97c1a" },
    { bar: "#6b7fbf", bg: "#f1f3fa", text: "#5566a6" },
    { bar: "#9b7bb8", bg: "#f6f1fa", text: "#7d5f99" },
    { bar: "#c98a5e", bg: "#fdf4ee", text: "#a86f47" },
];

type ViewMode = "board" | "outline";

interface Props {
    stages: PlotStage[];
    scenes: PlotScene[];
    entries: ResourceEntry[];
    onCreateStage: () => void;
    /** 見本から段と場面をまとめて作る */
    onApplyTemplate?: (template: PlotTemplate) => void;
    onUpdateStage: (stageId: string, patch: Partial<PlotStage>) => void;
    onDeleteStage: (stage: PlotStage) => void;
    onReorderStages: (orderedIds: string[]) => void;
    onCreateScene: (stageId: string) => void;
    onUpdateScene: (sceneId: string, patch: Partial<PlotScene>) => void;
    onDeleteScene: (scene: PlotScene) => void;
}

export default function PlotView({
    stages,
    scenes,
    entries,
    onCreateStage,
    onApplyTemplate,
    onUpdateStage,
    onDeleteStage,
    onReorderStages,
    onCreateScene,
    onUpdateScene,
    onDeleteScene,
}: Props) {
    const [mode, setMode] = useState<ViewMode>("board");
    const [draggingId, setDraggingId] = useState<string | null>(null);

    const scenesByStage = useMemo(() => {
        const map = new Map<string, PlotScene[]>();
        for (const scene of scenes) {
            const list = map.get(scene.stage_id) ?? [];
            list.push(scene);
            map.set(scene.stage_id, list);
        }
        return map;
    }, [scenes]);

    const doneCount = scenes.filter((scene) => scene.is_done).length;
    const progress = scenes.length === 0 ? 0 : Math.round((doneCount / scenes.length) * 100);

    function handleDrop(targetId: string) {
        if (!draggingId || draggingId === targetId) {
            setDraggingId(null);
            return;
        }
        const ids = stages.map((stage) => stage.id);
        const from = ids.indexOf(draggingId);
        const to = ids.indexOf(targetId);
        ids.splice(from, 1);
        ids.splice(to, 0, draggingId);
        onReorderStages(ids);
        setDraggingId(null);
    }

    return (
        <div className="space-y-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-xl font-medium text-ink">
                        <span className="text-forest">
                            <ResourceIcon builtinKey="plot" size={22} />
                        </span>
                        プロット・構成
                    </h1>
                    <p className="mt-1 text-sm text-muted">
                        物語の骨格を整理し、展開の流れや各パートの目的を見える形にします。
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex gap-0.5 rounded-md border border-line p-0.5">
                        {(["board", "outline"] as ViewMode[]).map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setMode(key)}
                                aria-pressed={mode === key}
                                className={[
                                    "rounded px-3 py-1 text-xs",
                                    mode === key
                                        ? "bg-forest text-white"
                                        : "text-muted hover:text-ink",
                                ].join(" ")}
                            >
                                {key === "board" ? "ボード表示" : "アウトライン表示"}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={onCreateStage}
                        className="rounded-md bg-forest px-4 py-2 text-sm text-white hover:bg-forest-dark"
                    >
                        ＋ ステージを追加
                    </button>
                </div>
            </header>

            <div className="rounded-md border border-line bg-canvas px-4 py-2.5">
                <p className="text-xs text-muted">
                    AIはプロットを自動生成しません。このページは、あなたの構想を整理し、
                    書きやすくするための場所です。
                </p>
            </div>

            {/*
             * まだ何も無いとき、見本を出す。
             *
             * 白紙から始めると、何を書けばよいか分からない。
             * 型を選べば、埋めるだけで組み立てが進む。
             */}
            {stages.length === 0 && (
                <section className="rounded-lg border border-line bg-surface px-5 py-5">
                    <h2 className="text-sm font-medium text-ink">
                        型を選んで始める
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                        段と場面の見出しだけが入ります。中身は空なので、
                        埋めながら自分の物語に直していけます。
                    </p>

                    <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                        {PLOT_TEMPLATES.map((template) => (
                            <li key={template.key}>
                                <button
                                    type="button"
                                    onClick={() => onApplyTemplate?.(template)}
                                    className="w-full rounded-lg border border-line px-4 py-3.5 text-left hover:border-forest-line hover:bg-canvas"
                                >
                                    <span className="flex items-baseline gap-2">
                                        <span className="text-[13px] font-medium text-ink">
                                            {template.label}
                                        </span>
                                        <span className="text-[10px] text-faint">
                                            {template.stages.length}段
                                        </span>
                                    </span>
                                    <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                                        {template.note}
                                    </span>

                                    {/* 段の名前を並べて、形を見せる */}
                                    <span className="mt-2 flex flex-wrap gap-1">
                                        {template.stages.map((stage) => (
                                            <span
                                                key={stage.title}
                                                className="rounded bg-canvas px-2 py-0.5 text-[10px] text-muted"
                                            >
                                                {stage.title}
                                            </span>
                                        ))}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>

                    <button
                        type="button"
                        onClick={onCreateStage}
                        className="mt-3 w-full py-2 text-[11px] text-muted hover:text-forest"
                    >
                        型を使わず、自分で組み立てる
                    </button>
                </section>
            )}

            {/* 進み具合 */}
            {stages.length > 0 && (
                <div className="rounded-lg border border-line bg-surface px-5 py-4">
                    <div className="flex items-baseline justify-between">
                        <p className="text-sm text-ink">全体の進捗</p>
                        <p className="text-sm text-muted">
                            完了度 <span className="text-lg text-forest">{progress}</span>%
                        </p>
                    </div>

                    <div className="mt-3 flex gap-1">
                        {stages.map((stage, index) => {
                            const own = scenesByStage.get(stage.id) ?? [];
                            const done = own.filter((scene) => scene.is_done).length;
                            const tone = STAGE_TONES[index % STAGE_TONES.length];
                            return (
                                <div key={stage.id} className="min-w-0 flex-1">
                                    <div className="h-1 overflow-hidden rounded-full bg-canvas">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width:
                                                    own.length === 0
                                                        ? "0%"
                                                        : `${(done / own.length) * 100}%`,
                                                background: tone.bar,
                                            }}
                                        />
                                    </div>
                                    <p className="mt-1.5 truncate text-center text-xs text-ink">
                                        {stage.title || "名前のない段"}
                                    </p>
                                    <p className="text-center text-[11px] text-faint">
                                        {done} / {own.length} シーン
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {stages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line py-20 text-center">
                    <p className="text-sm text-ink">まだ段がありません。</p>
                    <p className="mt-1 text-sm text-muted">
                        「起・承・転・結」でも「一日目・二日目」でも、
                        作品に合う区切りを自由に作れます。
                    </p>
                    <button
                        type="button"
                        onClick={onCreateStage}
                        className="mt-5 rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark"
                    >
                        最初のステージを作る
                    </button>
                </div>
            ) : mode === "board" ? (
                <div className="thin-scroll flex gap-3 overflow-x-auto pb-2">
                    {stages.map((stage, index) => {
                        const tone = STAGE_TONES[index % STAGE_TONES.length];
                        const own = scenesByStage.get(stage.id) ?? [];
                        const done = own.filter((scene) => scene.is_done).length;

                        return (
                            <div
                                key={stage.id}
                                draggable
                                onDragStart={() => setDraggingId(stage.id)}
                                onDragEnd={() => setDraggingId(null)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(stage.id)}
                                className={[
                                    "flex w-[340px] shrink-0 flex-col",
                                    draggingId === stage.id ? "opacity-40" : "",
                                ].join(" ")}
                            >
                                {/*
                                 * 段の見出し。
                                 * ここだけ色を持たせ、下の場面は白にする。
                                 * 全部に色を敷くと、どこが区切りか分からない。
                                 */}
                                <div
                                    className="flex items-start gap-2 rounded-t-lg border border-line px-3 py-2.5"
                                    style={{ background: tone.bg }}
                                >
                                    <span className="cursor-grab select-none pt-1 text-xs text-faint">
                                        ⠿
                                    </span>
                                    <input
                                        type="text"
                                        defaultValue={stage.title}
                                        onBlur={(e) =>
                                            onUpdateStage(stage.id, { title: e.target.value })
                                        }
                                        placeholder="段の名前"
                                        aria-label="段の名前"
                                        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-semibold outline-none hover:border-line focus:border-forest"
                                        style={{ color: tone.text }}
                                    />
                                    <span className="shrink-0 rounded bg-surface/70 px-1.5 py-0.5 text-[10px] text-muted">
                                        {done} / {own.length}
                                    </span>
                                    <DeleteButton
                                        label={stage.title || "この段"}
                                        note="段の中のシーンもすべて削除します。"
                                        onDelete={() => onDeleteStage(stage)}
                                        size="small"
                                    />
                                </div>

                                <div
                                    className="border-x border-b border-line px-3 pb-3"
                                    style={{ background: tone.bg }}
                                >
                                    <textarea
                                        defaultValue={stage.description}
                                        onBlur={(e) =>
                                            onUpdateStage(stage.id, {
                                                description: e.target.value,
                                            })
                                        }
                                        rows={3}
                                        placeholder="この段で何が起きるか"
                                        aria-label="段の説明"
                                        className="w-full resize-y rounded border border-transparent bg-surface/70 px-2.5 py-2 text-[12px] leading-relaxed text-ink outline-none hover:border-line focus:border-forest"
                                    />
                                </div>

                                {/*
                                 * 場面。
                                 * 左に点を置き、縦線で繋ぐ。
                                 * 順に起きていくことが目で分かる。
                                 */}
                                <ul className="mt-3 space-y-0">
                                    {own.map((scene, sceneIndex) => (
                                        <li key={scene.id} className="flex gap-2.5">
                                            <span className="relative flex w-3 shrink-0 justify-center">
                                                <span
                                                    className="mt-3.5 h-2 w-2 shrink-0 rounded-full border-2"
                                                    style={{
                                                        borderColor: tone.text,
                                                        background: scene.is_done
                                                            ? tone.text
                                                            : "var(--color-surface)",
                                                    }}
                                                />
                                                {sceneIndex < own.length - 1 && (
                                                    <span
                                                        aria-hidden="true"
                                                        className="absolute left-1/2 top-5 h-full w-px -translate-x-1/2 bg-line"
                                                    />
                                                )}
                                            </span>

                                            <span className="min-w-0 flex-1 pb-2.5">
                                            <SceneCard
                                                scene={scene}
                                                index={sceneIndex + 1}
                                                entries={entries}
                                                onUpdate={(patch) =>
                                                    onUpdateScene(scene.id, patch)
                                                }
                                                onDelete={() => onDeleteScene(scene)}
                                            />
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    type="button"
                                    onClick={() => onCreateScene(stage.id)}
                                    className="ml-[22px] rounded-md border border-dashed border-line px-3 py-2.5 text-xs text-muted hover:border-forest-line hover:text-forest"
                                >
                                    ＋ 場面を追加
                                </button>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={onCreateStage}
                        className="flex w-[220px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center hover:border-forest-line hover:bg-canvas"
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-forest">
                            ＋
                        </span>
                        <span className="text-sm text-ink">ステージを追加</span>
                        <span className="text-xs text-muted">
                            物語の流れに合わせて、新しいステージを作れます。
                        </span>
                    </button>
                </div>
            ) : (
                <ol className="space-y-3">
                    {stages.map((stage, index) => {
                        const own = scenesByStage.get(stage.id) ?? [];
                        const tone = STAGE_TONES[index % STAGE_TONES.length];
                        return (
                            <li
                                key={stage.id}
                                className="rounded-lg border border-line bg-surface p-4"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className="h-3 w-1 rounded-full"
                                        style={{ background: tone.bar }}
                                    />
                                    <span className="text-sm font-medium text-ink">
                                        {stage.title || "名前のない段"}
                                    </span>
                                    <span className="text-xs text-faint">
                                        {stage.episode_range}
                                    </span>
                                </div>
                                {stage.description && (
                                    <p className="mt-1 text-xs text-muted">{stage.description}</p>
                                )}
                                <ol className="mt-2 space-y-1">
                                    {own.map((scene, sceneIndex) => (
                                        <li
                                            key={scene.id}
                                            className="flex items-center gap-2 text-xs"
                                        >
                                            <span className="w-5 text-right text-faint">
                                                {sceneIndex + 1}
                                            </span>
                                            <span
                                                className={[
                                                    "min-w-0 flex-1 truncate",
                                                    scene.is_done
                                                        ? "text-faint line-through"
                                                        : "text-ink",
                                                ].join(" ")}
                                            >
                                                {scene.title || "（名前のないシーン）"}
                                            </span>
                                            <span className="shrink-0 text-faint">
                                                {scene.episode_range}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

/**
 * ============================================================
 * シーン
 * ============================================================
 */

function SceneCard({
    scene,
    index,
    entries,
    onUpdate,
    onDelete,
}: {
    scene: PlotScene;
    index: number;
    entries: ResourceEntry[];
    onUpdate: (patch: Partial<PlotScene>) => void;
    onDelete: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const linked = entries.filter((entry) => scene.entry_ids.includes(entry.id));

    return (
        <div className="group rounded-lg border border-line bg-surface px-3.5 py-3">
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    onClick={() => onUpdate({ is_done: !scene.is_done })}
                    aria-pressed={scene.is_done}
                    aria-label="書き終わった"
                    className={[
                        "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border",
                        scene.is_done
                            ? "border-forest bg-forest"
                            : "border-[var(--color-line)]",
                    ].join(" ")}
                />
                <span className="mt-0.5 shrink-0 text-xs text-faint">{index}.</span>
                <input
                    type="text"
                    defaultValue={scene.title}
                    onBlur={(e) => onUpdate({ title: e.target.value })}
                    placeholder="場面の名前"
                    aria-label="場面の名前"
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-medium text-ink outline-none hover:border-line focus:border-forest"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen((open) => !open)}
                    aria-label="詳しく"
                    className="shrink-0 px-1 text-xs text-faint hover:text-ink"
                >
                    {isOpen ? "▴" : "▾"}
                </button>
                <DeleteButton
                    label={scene.title || "この場面"}
                    onDelete={onDelete}
                    isFloating
                    size="small"
                />
            </div>

            {/*
             * 閉じているときも内容を出す。
             *
             * プロットは「何が起きるか」を並べるもの。
             * 名前だけ並べても、話の流れが見えない。
             */}
            {!isOpen && scene.description && (
                <p className="mt-1.5 line-clamp-4 pl-[26px] text-[12px] leading-relaxed text-ink">
                    {scene.description}
                </p>
            )}

            {isOpen && (
                <div className="mt-2 space-y-2 pl-7">
                    <textarea
                        defaultValue={scene.description}
                        onBlur={(e) => onUpdate({ description: e.target.value })}
                        rows={4}
                        placeholder="この場面で何が起きるか"
                        aria-label="シーンの説明"
                        className="w-full resize-y rounded border border-line px-2 py-1 text-[11px] leading-relaxed outline-none focus:border-forest"
                    />
                    <input
                        type="text"
                        defaultValue={scene.episode_range}
                        onBlur={(e) => onUpdate({ episode_range: e.target.value })}
                        placeholder="1〜2話"
                        aria-label="対応する話"
                        className="w-full rounded border border-line px-2 py-1 text-[11px] outline-none focus:border-forest"
                    />

                    {entries.length > 0 && (
                        <div>
                            <p className="text-[10px] text-muted">関わる資料</p>
                            <ul className="thin-scroll mt-1 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                                {entries.slice(0, 30).map((entry) => {
                                    const isOn = scene.entry_ids.includes(entry.id);
                                    return (
                                        <li key={entry.id}>
                                            <button
                                                type="button"
                                                aria-pressed={isOn}
                                                onClick={() =>
                                                    onUpdate({
                                                        entry_ids: isOn
                                                            ? scene.entry_ids.filter(
                                                                  (id) => id !== entry.id,
                                                              )
                                                            : [...scene.entry_ids, entry.id],
                                                    })
                                                }
                                                className={[
                                                    "rounded-full border px-2 py-0.5 text-[10px]",
                                                    isOn
                                                        ? "border-forest bg-forest-tint text-forest"
                                                        : "border-line text-muted",
                                                ].join(" ")}
                                            >
                                                {entry.name || "（名前未設定）"}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {!isOpen && (scene.episode_range || linked.length > 0) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-7">
                    {scene.episode_range && (
                        <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
                            {scene.episode_range}
                        </span>
                    )}
                    {linked.slice(0, 3).map((entry) => (
                        <span
                            key={entry.id}
                            className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted"
                        >
                            {entry.name}
                        </span>
                    ))}
                    {linked.length > 3 && (
                        <span className="text-[10px] text-faint">+{linked.length - 3}</span>
                    )}
                </div>
            )}
        </div>
    );
}
