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
import type { DisplaySettings, Episode } from "@/types";
import { WRITING_MODE_LABEL } from "@/types";

interface Props {
    episode: Episode;
    settings: DisplaySettings;
    /** 資料から飛んできたときの行番号。1 から数える */
    jumpToLine?: number | null;
    onJumped?: () => void;
    onSave: (patch: { title: string; body: string }) => Promise<void>;
    onToggleWritingMode: () => void;
    onOpenHistory: () => void;
    isHistoryOpen: boolean;
    onOpenMentions: () => void;
    isMentionsOpen: boolean;
    onSelectionChange: (selected: string) => void;
    onOpenProofread: () => void;
    isProofreadOpen: boolean;
    onOpenRead: () => void;
    isReadOpen: boolean;
    /** 推敲パネルからの一括修正を受け取るための橋渡し */
    onRegisterBody: (body: string, apply: (next: string) => void) => void;
}

export default function EpisodeEditor({
    episode,
    settings,
    onSave,
    jumpToLine,
    onJumped,
    onToggleWritingMode,
    onOpenHistory,
    isHistoryOpen,
    onOpenMentions,
    isMentionsOpen,
    onSelectionChange,
    onOpenProofread,
    isProofreadOpen,
    onOpenRead,
    isReadOpen,
    onRegisterBody,
}: Props) {
    const [title, setTitle] = useState(episode.title);
    const [body, setBody] = useState(episode.body);
    /** 縦書き整形の直前の本文。取り消し用に 1 手ぶんだけ持つ */
    const [beforeNormalize, setBeforeNormalize] = useState<string | null>(null);

    /*
     * ほかの道具を開いているか。
     *
     * 狭い画面でだけ使う。
     * 全部並べると 2 段になり、書く場所がそのぶん減る。
     */
    const [isToolsOpen, setIsToolsOpen] = useState(false);
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

    const { state, savedAt } = useAutosave({
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

    function handleNormalize() {
        /*
         * いまの書き方に合わせて直す。
         *
         * 縦書きで打った文を横書きにしても、全角のままだと読みにくい。
         * 逆も同じ。書き方を切り替えたら、揃え直せるようにする。
         */
        const result =
            settings.writing_mode === "vertical"
                ? normalizeForVertical(body)
                : normalizeForHorizontal(body);
        if (result.changeCount === 0) {
            setNotice("直すところはありませんでした");
            window.setTimeout(() => setNotice(""), 2500);
            return;
        }
        setBeforeNormalize(body);
        setBody(result.text);
        setNotice(`${result.changeCount}行を整えました`);
        window.setTimeout(() => setNotice(""), 6000);
    }

    function handleUndoNormalize() {
        if (beforeNormalize === null) return;
        setBody(beforeNormalize);
        setBeforeNormalize(null);
        setNotice("元に戻しました");
        window.setTimeout(() => setNotice(""), 2500);
    }

    // 推敲パネルへ、いまの本文と差し替え口を渡す
    useEffect(() => {
        onRegisterBody(body, setBody);
    }, [body, onRegisterBody]);

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
            {/*
             * 上の帯。
             *
             * 狭い画面では 2 段にする。
             * 1 段に詰めると、右のボタンが画面の外へ出る。
             */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-3 py-2 sm:flex-nowrap sm:gap-2.5 sm:px-5 sm:py-2.5">
                <span className="shrink-0 text-[13px] font-medium text-ink">
                    第{episode.ep_number}話
                </span>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    aria-label="話のタイトル"
                    placeholder="タイトル"
                    className="min-w-0 flex-1 border-b border-transparent bg-transparent text-[14px] font-medium text-ink outline-none focus:border-forest-line"
                />

                <div className="thin-scroll flex w-full shrink-0 items-center gap-2 overflow-x-auto text-[11px] text-muted sm:w-auto sm:gap-2.5">
                    <SaveIndicator state={state} savedAt={savedAt} />
                    <span>{formatNumber(countChars(body))}文字</span>
                    <button
                        type="button"
                        onClick={onOpenRead}
                        aria-pressed={isReadOpen}
                        className={[
                            "shrink-0 rounded border px-2 py-0.5",
                            isReadOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        通し読み
                    </button>
                    <button
                        type="button"
                        onClick={onOpenProofread}
                        aria-pressed={isProofreadOpen}
                        className={[
                            "shrink-0 rounded border px-2 py-0.5",
                            isProofreadOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        推敲
                    </button>
                    <button
                        type="button"
                        onClick={onOpenMentions}
                        aria-pressed={isMentionsOpen}
                        className={[
                            "shrink-0 rounded border px-2 py-0.5",
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
                            "shrink-0 rounded border px-2 py-0.5",
                            isHistoryOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        履歴
                    </button>
                </div>
            </div>

            {/*
             * 道具の並び。
             *
             * 狭い画面では「…」に畳む。
             * 全部並べると 2 段になり、書く場所がそのぶん減る。
             *
             * よく使う「縦横」と「行番号」だけは外に出す。
             */}
            <div className="relative flex items-center gap-1.5 border-b border-line bg-canvas px-3 py-1.5 text-[11px] sm:px-5">
                <button
                    type="button"
                    onClick={onToggleWritingMode}
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    {WRITING_MODE_LABEL[otherMode]}にする
                </button>

                <button
                    type="button"
                    onClick={() => setShowLineNumbers((show) => !show)}
                    aria-pressed={showLineNumbers}
                    title="10行ごとに行番号を出します"
                    className={[
                        "shrink-0 rounded border px-2 py-0.5",
                        showLineNumbers
                            ? "border-forest bg-forest-tint text-forest"
                            : "border-line bg-surface text-muted hover:border-forest-line hover:text-forest",
                    ].join(" ")}
                >
                    行番号
                </button>

                {/* ここから先は、狭い画面では「…」の中 */}
                <div
                    className={[
                        "flex items-center gap-2",
                        isToolsOpen
                            ? "absolute left-0 right-0 top-full z-20 flex-wrap border-b border-line bg-canvas px-3 py-2 shadow-sm"
                            : "hidden",
                        "sm:static sm:flex sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none",
                    ].join(" ")}
                >
                <button
                    type="button"
                    onClick={handleRuby}
                    title="選んだ文字にルビを振ります（｜親文字《ルビ》）"
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    ルビ
                </button>

                <button
                    type="button"
                    onClick={handleEmphasis}
                    title="選んだ文字に傍点をつけます（《《文字》》）"
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    傍点
                </button>

                <button
                    type="button"
                    onClick={handleNormalize}
                    title={
                        settings.writing_mode === "vertical"
                            ? "半角英数字を全角に、... を …… に直し、段落の頭を字下げします"
                            : "全角英数字を半角に、…… を ... に直します"
                    }
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    {settings.writing_mode === "vertical"
                        ? "縦書き用に整える"
                        : "横書き用に整える"}
                </button>

                {beforeNormalize !== null && (
                    <button
                        type="button"
                        onClick={handleUndoNormalize}
                        className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:text-ink"
                    >
                        整形を取り消す
                    </button>
                )}

                </div>

                {/* 「…」。狭い画面だけ */}
                <button
                    type="button"
                    onClick={() => setIsToolsOpen(!isToolsOpen)}
                    aria-expanded={isToolsOpen}
                    title="ほかの道具"
                    className={[
                        "ml-auto shrink-0 rounded border px-2 py-0.5 sm:hidden",
                        isToolsOpen
                            ? "border-forest bg-forest-tint text-forest"
                            : "border-line bg-surface text-muted",
                    ].join(" ")}
                >
                    ⋯
                </button>

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

function SaveIndicator({ state, savedAt }: { state: string; savedAt: string | null }) {
    if (state === "saving") return <span>保存中</span>;
    if (state === "pending") return <span className="text-faint">未保存の変更</span>;
    if (state === "saved" && savedAt) return <span>自動保存済み {formatTime(savedAt)}</span>;
    return <span className="text-faint">自動保存</span>;
}
