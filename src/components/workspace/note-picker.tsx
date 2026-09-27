/**
 * ============================================================
 * 原石航路 Studio
 * NotePicker — 注釈を付ける小窓
 *
 * ★ 携帯では、本文の中で言葉を指で選ぶのが難しい。
 *   選ぶ範囲のつまみが小さく、1 字ずれたり、押した拍子に選びが外れたりする。
 *
 * ★ 言葉は「選ぶ」のではなく、本文の中から「探す」。
 *   ・欄に打つと、本文の中でその字を含む言葉を候補に出し、見つかった場所を並べる。
 *   ・どの場所に付けるかは、並んだ場所を押して決める。はじめはカーソルにいちばん近い所。
 *   ・何も打たないうちは、カーソルの行にある言葉を候補に出す。
 *   1 字ずつの札を押して範囲を決める形は、押しにくかったのでやめた。
 *
 * ★ 前に同じ言葉へ注釈を付けていたら、その説明を出して「これを使う」で入れられる。
 *   この話・ほかの話の両方から探す。同じ言葉に毎回同じ説明を打ち直さずにすむ。
 *
 * ★ パソコンで言葉を選んでから押したときは、その選びをそのまま使う。
 *   選んでいなければ、携帯と同じく探して決める。
 *
 * ★ 携帯では画面の上に出す。
 *   下に出すと、説明を打つときのキーボードに隠れる。
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import { findAnnotations } from "@/lib/utils/annotation";

interface Props {
    /** 本文 */
    body: string;
    /** 本文で選んでいた範囲。何も選んでいなければ start === end（カーソルの位置） */
    range: { start: number; end: number };
    /** ほかの話。前に付けた注釈を探すのに使う */
    otherEpisodes?: { title: string; body: string }[];
    onCancel: () => void;
    onSubmit: (start: number, end: number, note: string) => void;
}

const KANJI = /[一-鿿々〆〇ヵヶ]/;
const KATAKANA = /[゠-ヿｦ-ﾟ]/;
const HIRAGANA = /[぀-ゟ]/;
const ALNUM = /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/;

/** 見つかった場所を、はじめにいくつまで並べるか */
const HIT_LIMIT = 8;

function classOf(char: string | undefined): string {
    if (!char) return "";
    if (KANJI.test(char)) return "kanji";
    if (KATAKANA.test(char)) return "kata";
    if (HIRAGANA.test(char)) return "hira";
    if (ALNUM.test(char)) return "alnum";
    return "";
}

/** 注釈の説明やふりがなの中は、探す相手から外す。本文の字ではない */
function hiddenRanges(body: string): [number, number][] {
    const ranges: [number, number][] = findAnnotations(body).map((one) => [one.wordEnd, one.end]);
    const ruby = /《[^》\n]*》/g;
    let hit: RegExpExecArray | null;
    while ((hit = ruby.exec(body)) !== null) ranges.push([hit.index, hit.index + hit[0].length]);
    return ranges;
}

/** 文の中の、言葉らしいまとまり（漢字・カタカナ・英数字の続き） */
function wordsIn(text: string, offset = 0, hidden: [number, number][] = []): { word: string; start: number }[] {
    const rows: { word: string; start: number }[] = [];
    let i = 0;
    while (i < text.length) {
        const kind = classOf(text[i]);
        if (!kind || kind === "hira") {
            i += 1;
            continue;
        }
        let j = i + 1;
        while (j < text.length && classOf(text[j]) === kind) j += 1;
        const word = text.slice(i, j);
        const at = offset + i;
        const isHidden = hidden.some(([from, to]) => at >= from && at < to);
        /* 1 字だけのものは候補にしない。「家」「古」のような字ばかり並んで、探しにくくなる */
        if (!isHidden && word.length >= 2) rows.push({ word, start: at });
        i = j;
    }
    return rows;
}

/** 本文の中で word が出てくる場所を、すべて */
function findAll(body: string, word: string, hidden: [number, number][]): number[] {
    if (!word) return [];
    const hits: number[] = [];
    let at = body.indexOf(word);
    while (at !== -1) {
        if (!hidden.some(([from, to]) => at >= from && at < to)) hits.push(at);
        at = body.indexOf(word, at + 1);
    }
    return hits;
}

/** 記法を外した言葉（ふりがな・｜） */
function plain(word: string): string {
    return word.replace(/《[^》]*》/g, "").replace(/[｜|]/g, "");
}

export default function NotePicker({ body, range, otherEpisodes = [], onCancel, onSubmit }: Props) {
    const cursor = range.start;
    const hidden = useMemo(() => hiddenRanges(body), [body]);

    /* 本文で選んでから開いたか */
    const selectedText = body.slice(range.start, range.end);
    const hasSelection = selectedText.length > 0 && !selectedText.includes("\n");

    /* カーソルのある行 */
    const lineStart = body.lastIndexOf("\n", cursor - 1) + 1;
    const lineEndRaw = body.indexOf("\n", cursor);
    const lineEnd = lineEndRaw === -1 ? body.length : lineEndRaw;

    /* はじめの言葉。選んでいればそれ。無ければカーソルの所の言葉 */
    const initialWord = useMemo(() => {
        if (hasSelection) return selectedText;
        const hit = wordsIn(body.slice(lineStart, lineEnd), lineStart, hidden).find(
            ({ word, start }) => cursor >= start && cursor <= start + word.length,
        );
        return hit?.word ?? "";
    }, [hasSelection, selectedText, body, lineStart, lineEnd, hidden, cursor]);

    const [query, setQuery] = useState(initialWord);
    const word = query.trim();

    /* 本文の中の言葉と、出てくる回数 */
    const allWords = useMemo(() => {
        const counts = new Map<string, number>();
        for (const { word: one } of wordsIn(body, 0, hidden)) counts.set(one, (counts.get(one) ?? 0) + 1);
        return counts;
    }, [body, hidden]);

    /*
     * 候補。
     * 何か打っていれば、本文の中でその字を含む言葉を、多く出てくる順に。
     * 打っていなければ（またはカーソルの言葉のままなら）、カーソルの行の言葉。
     */
    const candidates = useMemo(() => {
        if (word && word !== initialWord) {
            return Array.from(allWords.entries())
                .filter(([one]) => one.includes(word))
                .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
                .slice(0, 12)
                .map(([one]) => one);
        }
        const seen = new Set<string>();
        return wordsIn(body.slice(lineStart, lineEnd), lineStart, hidden)
            .map(({ word: one }) => one)
            .filter((one) => (seen.has(one) ? false : (seen.add(one), true)))
            .slice(0, 16);
    }, [word, initialWord, allWords, body, lineStart, lineEnd, hidden]);

    /* 見つかった場所 */
    const hits = useMemo(() => {
        if (!word || word.includes("\n")) return [];
        return findAll(body, word, hidden);
    }, [body, word, hidden]);

    /*
     * どこに付けるか。
     * 選んでいた言葉のままなら、選んでいた場所。
     * そうでなければ、カーソルにいちばん近い所から始める。
     */
    const defaultAt = useMemo(() => {
        if (hasSelection && word === selectedText) return range.start;
        let best = -1;
        let bestGap = Infinity;
        for (const at of hits) {
            const gap = cursor < at ? at - cursor : cursor > at + word.length ? cursor - (at + word.length) : 0;
            if (gap < bestGap) {
                best = at;
                bestGap = gap;
            }
        }
        return best;
    }, [hasSelection, word, selectedText, range.start, hits, cursor]);
    const [chosenAt, setChosenAt] = useState<number | null>(null);
    /* 言葉が変わったら、選び直し */
    useEffect(() => setChosenAt(null), [word]);
    const at = chosenAt !== null && hits.includes(chosenAt) ? chosenAt : defaultAt;
    const [showAllHits, setShowAllHits] = useState(false);

    /* 前に同じ言葉へ付けた説明（この話・ほかの話） */
    const pastNotes = useMemo(() => {
        const sources = [{ title: "この話", body }, ...otherEpisodes];
        /* 言葉 → 説明 → { どの話で, 何回 } */
        const map = new Map<string, Map<string, { where: string[]; count: number }>>();
        for (const source of sources) {
            for (const one of findAnnotations(source.body)) {
                const key = plain(one.word);
                const byNote = map.get(key) ?? new Map<string, { where: string[]; count: number }>();
                const row = byNote.get(one.note) ?? { where: [], count: 0 };
                const label = source.title.trim() || "題名なし";
                if (!row.where.includes(label)) row.where.push(label);
                row.count += 1;
                byNote.set(one.note, row);
                map.set(key, byNote);
            }
        }
        return map;
    }, [body, otherEpisodes]);
    /* よく使った説明を先に */
    const suggestions = Array.from(pastNotes.get(word)?.entries() ?? []).sort((a, b) => b[1].count - a[1].count);

    const [note, setNote] = useState("");
    const canSubmit = word.length > 0 && at !== -1 && note.trim().length > 0;

    const [isNarrow, setIsNarrow] = useState(false);
    useEffect(() => {
        const check = () => setIsNarrow(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onCancel]);

    function submit() {
        if (!canSubmit) return;
        onSubmit(at, at + word.length, note.trim());
    }

    /* 見つかった場所の、前後の文と行番号 */
    function contextOf(position: number) {
        const rowStart = body.lastIndexOf("\n", position - 1) + 1;
        const rowEndRaw = body.indexOf("\n", position + word.length);
        const rowEnd = rowEndRaw === -1 ? body.length : rowEndRaw;
        const from = Math.max(rowStart, position - 12);
        const to = Math.min(rowEnd, position + word.length + 12);
        return {
            line: body.slice(0, position).split("\n").length,
            before: `${from > rowStart ? "…" : ""}${body.slice(from, position)}`,
            after: `${body.slice(position + word.length, to)}${to < rowEnd ? "…" : ""}`,
        };
    }

    const shownHits = showAllHits ? hits : hits.slice(0, HIT_LIMIT);

    return (
        <div
            onClick={onCancel}
            className="fixed inset-0 z-[400] flex items-start justify-center bg-black/40 p-3 md:items-center md:p-5"
        >
            <div
                role="dialog"
                aria-label="注釈を付ける"
                onClick={(event) => event.stopPropagation()}
                style={{ maxWidth: isNarrow ? "none" : undefined }}
                className="flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg md:w-[min(560px,100%)]"
            >
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <p className="text-[14px] font-medium text-ink">注釈を付ける</p>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="閉じる"
                        className="-mr-1 flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-muted hover:bg-canvas"
                    >
                        ×
                    </button>
                </div>

                <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    {/* ① 言葉を探す */}
                    <p className="text-[12px] font-medium text-ink">
                        <span className="mr-1 text-forest">①</span>注釈を付ける言葉を探す
                    </p>
                    <div className="relative mt-1.5">
                        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-faint">
                            ⌕
                        </span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setShowAllHits(false);
                            }}
                            placeholder="本文の中の言葉を打って探す"
                            className="w-full rounded-md border border-line bg-canvas py-2 pl-8 pr-3 text-[16px] text-ink outline-none focus:border-forest md:text-[14px]"
                        />
                    </div>

                    {candidates.length > 0 && (
                        <>
                            <p className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 text-[11px] text-muted">
                                <span>{word && word !== initialWord ? "本文の中の言葉" : "この行の言葉"}</span>
                                {candidates.some((option) => pastNotes.has(option)) && (
                                    <span className="text-faint">
                                        <span className="font-bold text-forest">※</span>＝前に注釈を付けた言葉
                                    </span>
                                )}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {candidates.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setQuery(option)}
                                        aria-pressed={word === option}
                                        className={[
                                            "min-h-[36px] rounded-full border px-3.5 text-[15px]",
                                            word === option
                                                ? "border-forest bg-forest-tint text-forest"
                                                : "border-line bg-surface text-ink hover:border-forest-line",
                                        ].join(" ")}
                                    >
                                        {option}
                                        {pastNotes.has(option) && (
                                            <span className="ml-1 text-[10px] font-bold text-forest" title="前に注釈を付けた言葉">
                                                ※
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* 見つかった場所。押すとそこに付ける */}
                    {word && (
                        <div className="mt-3">
                            <p className="text-[11px] text-muted">
                                {hits.length > 0
                                    ? `本文で見つかった場所 ${hits.length}件（押した所に付けます）`
                                    : `「${word}」は本文に見つかりません。`}
                            </p>
                            {hits.length > 0 && (
                                <ul className="mt-1 space-y-1">
                                    {shownHits.map((position) => {
                                        const context = contextOf(position);
                                        const isOn = position === at;
                                        return (
                                            <li key={position}>
                                                <button
                                                    type="button"
                                                    onClick={() => setChosenAt(position)}
                                                    aria-pressed={isOn}
                                                    className={[
                                                        "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-[13px] leading-relaxed",
                                                        isOn
                                                            ? "border-forest bg-forest-tint/60"
                                                            : "border-line bg-surface hover:border-forest-line",
                                                    ].join(" ")}
                                                >
                                                    <span
                                                        aria-hidden
                                                        className={[
                                                            "mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                                                            isOn ? "border-forest bg-forest" : "border-line bg-surface",
                                                        ].join(" ")}
                                                    >
                                                        {isOn && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                    </span>
                                                    <span className="min-w-0 flex-1 text-muted">
                                                        {context.before}
                                                        <span className="font-medium text-forest underline decoration-dotted underline-offset-4">
                                                            {word}
                                                        </span>
                                                        {isOn && <span className="text-[10px] font-bold text-forest">※</span>}
                                                        {context.after}
                                                    </span>
                                                    <span className="shrink-0 pt-0.5 text-[10.5px] tabular-nums text-faint">
                                                        {context.line}行目
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {hits.length > shownHits.length && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllHits(true)}
                                    className="mt-1 text-[12px] text-forest hover:underline"
                                >
                                    残り{hits.length - shownHits.length}件も見る
                                </button>
                            )}
                        </div>
                    )}

                    {/* ② 説明を書く */}
                    <p className="mt-4 text-[12px] font-medium text-ink">
                        <span className="mr-1 text-forest">②</span>説明を書く
                    </p>

                    {/*
                      * 前に同じ言葉へ付けた説明。
                      * ★ 読む画面で出る形（言葉 ※ ＋ 説明）に寄せて見せる。
                      *   「どの話で・何回」を添え、押すと下の欄に入ることを一言で言う。
                      */}
                    {suggestions.length > 0 && (
                        <div className="mt-1.5 overflow-hidden rounded-lg border border-forest-line">
                            <div className="flex items-center gap-1.5 bg-forest-tint px-3 py-1.5">
                                <span aria-hidden className="text-[13px] text-forest">↺</span>
                                <p className="text-[12px] font-medium text-forest">
                                    前に「{word}」に付けた説明が{suggestions.length > 1 ? ` ${suggestions.length}つ` : ""}あります
                                </p>
                            </div>
                            <p className="bg-surface px-3 pt-2 text-[11px] text-muted">
                                同じ説明でよければ「この説明を使う」を押してください。下の欄に入ります。入れたあとで直すこともできます。
                            </p>
                            <ul className="space-y-2 bg-surface px-3 pb-3 pt-2">
                                {suggestions.map(([text, info]) => {
                                    const isUsed = note === text;
                                    return (
                                        <li
                                            key={text}
                                            className={[
                                                "rounded-md border px-3 py-2.5",
                                                isUsed ? "border-forest bg-forest-tint/40" : "border-line bg-canvas",
                                            ].join(" ")}
                                        >
                                            {/* 読む人に見える形 */}
                                            <p className="text-[12px] font-medium text-forest">
                                                <span className="underline decoration-dotted underline-offset-4">{word}</span>
                                                <span className="ml-0.5 text-[9px] font-bold">※</span>
                                            </p>
                                            <p className="mt-1 border-l-2 border-forest-line pl-2 text-[13px] leading-relaxed text-ink">
                                                {text}
                                            </p>
                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                                <p className="min-w-0 text-[11px] text-muted">
                                                    {info.where.map((one) => `「${one}」`).join("")}で使用
                                                    <span className="ml-1 text-faint">・{info.count}回</span>
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setNote(text)}
                                                    className={[
                                                        "shrink-0 rounded-md px-3 py-1.5 text-[12px]",
                                                        isUsed
                                                            ? "bg-forest text-white"
                                                            : "border border-forest-line bg-surface text-forest hover:bg-forest-tint",
                                                    ].join(" ")}
                                                >
                                                    {isUsed ? "✓ 入れました" : "この説明を使う"}
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={3}
                        placeholder="読む人が言葉を押すと、この説明が出ます"
                        className="mt-1.5 w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 text-[16px] text-ink outline-none focus:border-forest md:text-[13px]"
                    />
                </div>

                <div className="flex justify-end gap-2 border-t border-line px-4 py-2.5">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-line px-4 py-2 text-[13px] text-muted hover:bg-canvas"
                    >
                        やめる
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit}
                        className="rounded-md bg-forest px-4 py-2 text-[13px] text-white hover:bg-forest-dark disabled:opacity-40"
                    >
                        注釈を付ける
                    </button>
                </div>
            </div>
        </div>
    );
}
