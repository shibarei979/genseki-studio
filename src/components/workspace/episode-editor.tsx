/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeEditor — 本文の執筆欄
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

import ManuscriptSurface from "@/components/workspace/manuscript-surface";
import { VERSION_AUTO_INTERVAL_MS } from "@/config";
import { useAutosave } from "@/hooks/use-autosave";
import { insertEmphasis, insertRuby } from "@/lib/manuscript/notation";
import { scrollToLine } from "@/lib/manuscript/scroll-to-line";
import { getRepository } from "@/lib/repository";
import { countChars, formatNumber, formatTime } from "@/lib/utils/text";
import {
    normalizeForHorizontal,
    normalizeForVertical,
} from "@/lib/utils/vertical-text";
import type { DisplaySettings, Episode, WritingMode } from "@/types";
import {
    FONT_LABEL,
    FONT_SIZES,
    WRITING_MODE_DESCRIPTION,
    WRITING_MODE_LABEL,
} from "@/types";

interface Props {
    episode: Episode;
    settings: DisplaySettings;
    /** 資料から飛んできたときの行番号。1 から数える */
    jumpToLine?: number | null;
    onJumped?: () => void;
    onSave: (patch: { title: string; body: string }) => Promise<void>;
    onToggleWritingMode: () => void;
    /** 組み方を変える */
    onSetWritingMode?: (mode: WritingMode) => void;
    /** 書体を変える */
    onSetFont?: (font: DisplaySettings["font_family"]) => void;
    /** 文字の大きさを変える */
    onSetFontSize?: (size: number) => void;
    /** この話の公開を変える */
    onOpenHistory: () => void;
    isHistoryOpen: boolean;
    onOpenMentions: () => void;
    isMentionsOpen: boolean;
    onSelectionChange: (selected: string) => void;
    /** 一括置換を開く */
    onOpenReplace: () => void;
    isReplaceOpen: boolean;
    onOpenRead: () => void;
    isReadOpen: boolean;
    /** 置換の欄へ、いまの本文と差し替え口を渡す */
    onRegisterBody: (body: string, apply: (next: string) => void) => void;
}

export default function EpisodeEditor({
    episode,
    settings,
    onSave,
    jumpToLine,
    onJumped,
    onToggleWritingMode,
    onSetWritingMode,
    onSetFont,
    onSetFontSize,
    onOpenHistory,
    isHistoryOpen,
    onOpenMentions,
    isMentionsOpen,
    onSelectionChange,
    onOpenReplace,
    isReplaceOpen,
    onOpenRead,
    isReadOpen,
    onRegisterBody,
}: Props) {
    const [title, setTitle] = useState(episode.title);
    const [body, setBody] = useState(episode.body);
    /** 縦書き整形の直前の本文。取り消し用に 1 手ぶんだけ持つ */
    const [beforeNormalize, setBeforeNormalize] = useState<string | null>(null);
    const [notice, setNotice] = useState("");
    /*
     * 行番号。資料の「第3話 12行目」から場所を探すときに使う。
     * 常に出すと本文の邪魔になるので、切り替えられるようにしておく。
     */
    const [showLineNumbers, setShowLineNumbers] = useState(true);
    /** その行を少しのあいだ光らせる。どこへ来たのか分かるように */
    const [flashLine, setFlashLine] = useState<number | null>(null);
    const surfaceRef = useRef<HTMLDivElement>(null);
    /** 本文の選択位置。ルビを振るときに使う */
    const [range, setRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

    // 別の話に切り替わったら編集中の値を差し替える
    useEffect(() => {
        setTitle(episode.title);
        setBody(episode.body);
        setBeforeNormalize(null);
    }, [episode.id, episode.title, episode.body]);

    const { state, savedAt, save } = useAutosave({
        // 2 つの値をまとめて 1 つの文字列として監視する
        value: JSON.stringify({ title, body }),
        onSave: async (serialized) => {
            const parsed = JSON.parse(serialized) as { title: string; body: string };
            await onSave(parsed);
            await maybeCreateVersion();
        },
    });

    /**
     * 自動保存のたびに履歴を作ると版が増えすぎるので、
     * 前回から一定時間あいたときだけ残す。
     */
    const lastVersionAtRef = useRef<number>(0);
    async function maybeCreateVersion() {
        const elapsed = Date.now() - lastVersionAtRef.current;
        if (elapsed < VERSION_AUTO_INTERVAL_MS) return;
        lastVersionAtRef.current = Date.now();
        await getRepository().createVersion(episode.id, "auto");
    }

    /*
     * 組み方を切り替えたら、自動で整える。
     *
     * 縦書き … 半角の英数字は寝てしまうので全角へ
     * 横書き … 縦書きのために変えたものを戻す
     *
     * 押し忘れる道具にするより、切り替えたときに直す。
     * 元に戻す道は残す。整えすぎたと思うことがある。
     */
    const lastModeRef = useRef(settings.writing_mode);

    useEffect(() => {
        const mode = settings.writing_mode;
        if (mode === lastModeRef.current) return;

        const result =
            mode === "vertical"
                ? normalizeForVertical(body)
                : normalizeForHorizontal(body);

        if (result.changeCount > 0) {
            setBeforeNormalize(body);
            setBody(result.text);
            setNotice(
                `${mode === "vertical" ? "縦書き" : "横書き"}用に${result.changeCount}行を整えました`,
            );
            window.setTimeout(() => setNotice(""), 6000);
        }

        lastModeRef.current = mode;
    }, [settings.writing_mode, body]);


    function handleUndoNormalize() {
        if (beforeNormalize === null) return;
        setBody(beforeNormalize);
        setBeforeNormalize(null);
        setNotice("元に戻しました");
        window.setTimeout(() => setNotice(""), 2500);
    }

    // 置換の欄へ、いまの本文と差し替え口を渡す
    useEffect(() => {
        onRegisterBody(body, setBody);
    }, [body, onRegisterBody]);

    /**
     * いまの位置に文字を差し込む。
     *
     * 選んでいる範囲があれば、それを置き換える。
     * 末尾に足すのではなく、書いている場所に入れる。
     */
    function insertAtCursor(text: string) {
        const next =
            body.slice(0, range.start) + text + body.slice(range.end);
        setBody(next);

        /* 差し込んだ文字の後ろへ、書き口を移す */
        const at = range.start + text.length;
        setRange({ start: at, end: at });
    }

    /**
     * 会話文を除いて、行の頭に全角の空白を入れる。
     *
     * すでに入っている行と、鉤括弧で始まる行は触らない。
     * 会話文は字下げしないのが日本語の組版の慣習。
     */
    function indentNonDialogue() {
        const next = body
            .split("\n")
            .map((line) => {
                const trimmed = line.trimStart();
                if (trimmed === "") return line;
                if (line.startsWith("\u3000")) return line;
                // 「『【 で始まる行は会話や見出し
                if (/^[「『【（]/.test(trimmed)) return line;
                return `\u3000${line}`;
            })
            .join("\n");

        setBody(next);
        setNotice("字下げしました");
        window.setTimeout(() => setNotice(""), 2000);
    }

    function handleRuby() {
        if (range.start === range.end) {
            setNotice("ルビを振る文字を選んでください");
            window.setTimeout(() => setNotice(""), 2500);
            return;
        }
        const base = body.slice(range.start, range.end);
        const ruby = window.prompt(`「${base}」の読みを入れてください`, "");
        if (!ruby?.trim()) return;
        setBody(insertRuby(body, range.start, range.end, ruby.trim()));
    }

    function handleEmphasis() {
        if (range.start === range.end) {
            setNotice("傍点をつける文字を選んでください");
            window.setTimeout(() => setNotice(""), 2500);
            return;
        }
        setBody(insertEmphasis(body, range.start, range.end));
    }

    const otherMode = settings.writing_mode === "vertical" ? "horizontal" : "vertical";

    /*
     * 資料から飛んできたら、その行へ動かして選ぶ。
     * 開いただけで場所が分からないのでは、辿れるうちに入らない。
     */
    useEffect(() => {
        if (!jumpToLine) return;

        /*
         * 描き終わってから測る。
         * 開いた直後は幅も高さもまだ決まっておらず、
         * その時点で測ると折り返しの位置がずれる。
         */
        const timer = window.setTimeout(() => {
            const area = surfaceRef.current?.querySelector("textarea");
            if (!area) return;

            scrollToLine(area, jumpToLine);
            setFlashLine(jumpToLine);
            window.setTimeout(() => setFlashLine(null), 2600);
            onJumped?.();
        }, 60);

        return () => window.clearTimeout(timer);
    }, [jumpToLine, onJumped]);

    return (
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface">
            <div className="flex items-center gap-4 border-b border-line px-6 py-4">
                <span className="shrink-0 text-base font-medium text-ink">
                    第{episode.ep_number}話
                </span>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    aria-label="話のタイトル"
                    placeholder="タイトル"
                    className="min-w-0 flex-1 border-b border-transparent bg-transparent text-base font-medium text-ink outline-none focus:border-forest-line"
                />

                <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
                    {/*
                     * 保存の状態と文字数は別のもの。
                     * 縦線で仕切って、見た目でも分ける。
                     */}
                    <SaveIndicator
                        state={state}
                        savedAt={savedAt}
                        onRetry={() => void save()}
                    />

                    <span className="h-3.5 w-px bg-line" />

                    {/*
                     * 文字数。
                     * 選んでいるあいだは、その長さも出す。
                     * 応募の字数に収めるとき、どこを削るか見当がつく。
                     */}
                    <span className="tabular-nums">
                        {formatNumber(countChars(body))}字
                        {range.end > range.start && (
                            <span className="text-forest">
                                {" / "}
                                {formatNumber(
                                    countChars(body.slice(range.start, range.end)),
                                )}
                                字
                            </span>
                        )}
                    </span>

                    <span className="h-3.5 w-px bg-line" />

                    <button
                        type="button"
                        onClick={onOpenRead}
                        aria-pressed={isReadOpen}
                        className={[
                            "rounded-md border px-2.5 py-1",
                            isReadOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        通し読み
                    </button>
                    <button
                        type="button"
                        onClick={onOpenMentions}
                        aria-pressed={isMentionsOpen}
                        className={[
                            "rounded-md border px-2.5 py-1",
                            isMentionsOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        資料リンク
                    </button>
                    <button
                        type="button"
                        onClick={onOpenHistory}
                        aria-pressed={isHistoryOpen}
                        className={[
                            "rounded-md border px-2.5 py-1",
                            isHistoryOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        履歴
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 border-b border-line bg-canvas px-6 py-2 text-xs">
                {/*
                 * 組み方は 3 つから選ぶ。
                 * 原稿用紙は「縦書き＋マス目」ではなく、
                 * 紙の大きさもページ送りも違う別の見せ方。
                 */}
                {/* 組み方。押すと入れ替わる */}
                <button
                    type="button"
                    onClick={() =>
                        onSetWritingMode?.(
                            settings.writing_mode === "vertical"
                                ? "horizontal"
                                : "vertical",
                        )
                    }
                    className="rounded-md border border-line bg-surface px-2.5 py-1 text-muted hover:border-forest-line hover:text-forest"
                >
                    {WRITING_MODE_LABEL[otherMode]}にする
                </button>

                <button
                    type="button"
                    onClick={() => setShowLineNumbers((show) => !show)}
                    aria-pressed={showLineNumbers}
                    title="10行ごとに行番号を出します"
                    className={[
                        "rounded-md border px-2.5 py-1",
                        showLineNumbers
                            ? "border-forest bg-forest-tint text-forest"
                            : "border-line bg-surface text-muted hover:border-forest-line hover:text-forest",
                    ].join(" ")}
                >
                    行番号
                </button>

                {/* 書体。書きながら変えたくなることがある */}
                {/* 書体 */}
                <select
                    value={settings.font_family}
                    onChange={(e) =>
                        onSetFont?.(e.target.value as typeof settings.font_family)
                    }
                    aria-label="書体"
                    className={selectClass}
                >
                    {(Object.keys(FONT_LABEL) as (keyof typeof FONT_LABEL)[]).map(
                        (key) => (
                            <option key={key} value={key}>
                                {FONT_LABEL[key]}
                            </option>
                        ),
                    )}
                </select>

                {/* 文字の大きさ */}
                <select
                    value={settings.font_size}
                    onChange={(e) => onSetFontSize?.(Number(e.target.value))}
                    aria-label="文字の大きさ"
                    className={selectClass}
                >
                    {FONT_SIZES.map((size) => (
                        <option key={size} value={size}>
                            {size}px
                        </option>
                    ))}
                </select>

                <span className="mx-1 h-4 w-px bg-line" />

                {/* GENSEKIKORO と同じ道具 */}
                <button
                    type="button"
                    onClick={() =>
                        /*
                         * 場面の切れ目。
                         *
                         * 縦書きは 1 行に入る字数が少ないので短く引く。
                         * 横書きと同じ長さだと、線だけで何行も使う。
                         */
                        insertAtCursor(
                            `\n${"─".repeat(
                                settings.writing_mode === "vertical" ? 37 : 81,
                            )}\n`,
                        )
                    }
                    title="場面の切れ目に線を入れます"
                    className={toolClass}
                >
                    区切り線
                </button>

                <button
                    type="button"
                    onClick={indentNonDialogue}
                    title="会話文を除く行の頭に、全角の空白を入れます"
                    className={toolClass}
                >
                    一文字下げ
                </button>

                <button
                    type="button"
                    onClick={() => insertAtCursor("\n\n")}
                    title="1行あけて改行します"
                    className={toolClass}
                >
                    改行
                </button>

                <span className="mx-1 h-4 w-px bg-line" />

                <button
                    type="button"
                    onClick={onOpenReplace}
                    aria-pressed={isReplaceOpen}
                    title="文字をまとめて置き換えます"
                    className={[
                        "rounded-md border px-2.5 py-1",
                        isReplaceOpen
                            ? "border-forest bg-forest-tint text-forest"
                            : "border-line bg-surface text-muted hover:border-forest-line hover:text-forest",
                    ].join(" ")}
                >
                    置換
                </button>

                <button
                    type="button"
                    onClick={handleRuby}
                    title="選んだ文字にルビを振ります（｜親文字《ルビ》）"
                    className="rounded-md border border-line bg-surface px-2.5 py-1 text-muted hover:border-forest-line hover:text-forest"
                >
                    ルビ
                </button>

                <button
                    type="button"
                    onClick={handleEmphasis}
                    title="選んだ文字に傍点をつけます（《《文字》》）"
                    className="rounded-md border border-line bg-surface px-2.5 py-1 text-muted hover:border-forest-line hover:text-forest"
                >
                    傍点
                </button>

                {beforeNormalize !== null && (
                    <button
                        type="button"
                        onClick={handleUndoNormalize}
                        className="rounded-md border border-line bg-surface px-2.5 py-1 text-muted hover:text-ink"
                    >
                        整形を取り消す
                    </button>
                )}

                {notice && <span className="text-forest">{notice}</span>}
            </div>

            <div ref={surfaceRef} className="relative min-h-0 flex-1">
                <ManuscriptSurface
                    settings={settings}
                    value={body}
                    onChange={setBody}
                    showLineNumbers={showLineNumbers}
                    onSelectionChange={onSelectionChange}
                    onRangeChange={setRange}
                    placeholder="ここに本文を書きます。"
                />

                {flashLine !== null && (
                    <p className="pointer-events-none absolute right-4 top-3 rounded-full bg-forest px-3 py-1 text-xs text-white shadow">
                        {flashLine}行目へ移動しました
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * 保存の状態。
 *
 * 「自動保存」とだけ出すと、
 * それが「する仕組みがある」なのか「したところ」なのか分からない。
 * いま何が起きているかを言い切る。
 */
function SaveIndicator({
    state,
    savedAt,
    onRetry,
}: {
    state: string;
    savedAt: string | null;
    onRetry?: () => void;
}) {
    if (state === "saving") {
        return (
            <span className="flex items-center gap-1.5 text-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-amber)]" />
                保存中…
            </span>
        );
    }

    if (state === "error") {
        return (
            <span className="flex items-center gap-2 text-[var(--color-danger)]">
                保存できませんでした
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="rounded border border-[var(--color-danger)] px-2 py-0.5 text-[11px] hover:bg-[var(--color-danger-tint)]"
                    >
                        再試行
                    </button>
                )}
            </span>
        );
    }

    if (state === "pending") {
        return (
            <span className="flex items-center gap-1.5 text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                未保存の変更
            </span>
        );
    }

    if (state === "saved" && savedAt) {
        return (
            <span className="flex items-center gap-1.5 text-forest">
                <CheckIcon />
                保存済み {formatTime(savedAt)}
            </span>
        );
    }

    /*
     * 何も変えていないとき。
     *
     * 開いた時点で保存されているので「保存済み」と言う。
     * 「まだ保存していません」だと、
     * 書いたものが失われるように読める。
     */
    return (
        <span className="flex items-center gap-1.5 text-forest">
            <CheckIcon />
            保存済み
        </span>
    );
}

function CheckIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m4 12.5 5.5 5.5L20 6.5" />
        </svg>
    );
}

/** 道具の並びに置く選択欄。見た目を揃える */
const selectClass =
    "rounded-md border border-line bg-surface px-2 py-1 text-muted outline-none hover:border-forest-line focus:border-forest";

/** 道具の並びのボタン。見た目を揃える */
const toolClass =
    "rounded-md border border-line bg-surface px-2.5 py-1 text-muted hover:border-forest-line hover:text-forest";
