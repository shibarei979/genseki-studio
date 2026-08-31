"use client";

import { useState } from "react";

import { stripRuby } from "@/lib/utils/ruby";

/**
 * ============================================================
 * 原石航路 Studio
 * PickSurface — 蛍光ペンで、本文の文を資料に足す
 *
 * ★ 引用コメントと同じ作り。
 *
 *   本文を文ごとに分けて、1 文ずつ包む。
 *   触れると色が付き、押すと資料に足す。
 *
 * ★ 打ち込む欄（textarea）ではできない。
 *   中に文を包む入れ物を置けないため。
 *   蛍光ペンのあいだだけ、読む形に切り替える。
 *
 * ★ そのあいだ、本文は打てない。
 *   足す作業に来ているので、困らない。
 *   終われば、いつもの欄に戻る。
 * ============================================================
 */

/** 文の切れ目で分ける。引用コメントと同じ決まり */
function splitIntoSentences(text: string): string[] {
    const result: string[] = [];
    let buf = "";

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        buf += ch;

        const isEnder =
            ch === "。" || ch === "！" || ch === "？" || ch === "!" || ch === "?";
        const next = text[i + 1];

        if (ch === "\n") {
            result.push(buf);
            buf = "";
            continue;
        }

        /* 閉じ括弧が続くときは、そこまでを 1 文にする */
        if (isEnder && next !== "」" && next !== "』") {
            result.push(buf);
            buf = "";
        }
    }

    if (buf) result.push(buf);
    return result.filter((s) => s.length > 0);
}

export default function PickSurface({
    body,
    entryName,
    onPick,
    onClose,
}: {
    body: string;
    /** 足す先の資料の名前。何に足しているかを見せる */
    entryName: string;
    /** 文と、その文が何行目かを渡す */
    onPick: (text: string, line: number) => Promise<void>;
    onClose: () => void;
}) {
    const sentences = splitIntoSentences(body);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [doneIdx, setDoneIdx] = useState<Set<number>>(new Set());

    /*
     * 押した文。
     *
     * ★ すぐ足さず、いったん止めて聞く。
     *
     *   読んでいる途中で触れてしまうことがある。
     *   資料は書く人の手控えなので、
     *   知らないうちに増えていると、
     *   あとで何が正しいのか分からなくなる。
     */
    const [asking, setAsking] = useState<{ text: string; idx: number } | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    /*
     * 文が何行目から始まるかを、先に数えておく。
     *
     * 押すたびに数え直すと、長い本文で重くなる。
     */
    const lineOf: number[] = [];
    {
        let line = 1;
        for (const one of sentences) {
            lineOf.push(line);
            line += (one.match(/\n/g) || []).length;
        }
    }

    function ask(raw: string, idx: number) {
        const clean = stripRuby(raw).replace(/\n/g, "").trim();
        if (!clean) return;
        setAsking({ text: clean, idx });
    }

    async function confirm() {
        if (!asking || isBusy) return;

        setIsBusy(true);
        try {
            await onPick(asking.text, lineOf[asking.idx]);
            /* 足した文に印を残す。二度押しを防ぐ */
            setDoneIdx((prev) => new Set(prev).add(asking.idx));
            setAsking(null);
        } catch {
            window.alert("足せませんでした。時間をおいて試してください。");
        }
        setIsBusy(false);
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-surface">
            {/*
              * 上の帯。
              *
              * 何に足しているかと、抜ける道を常に見せる。
              * 打てない状態なので、戻れないと閉じ込めたことになる。
              */}
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-[12px] text-forest">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 5 4 4" />
                        <path d="M13 7 8.5 11.5a2 2 0 0 0-.5 1v3h3a2 2 0 0 0 1-.5L16.5 10.5" />
                        <path d="M5 20h14" />
                    </svg>
                    <span className="truncate">
                        <strong className="font-bold">{entryName}</strong>
                        {" に足す文を押してください"}
                    </span>
                </span>

                <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto shrink-0 rounded-md border border-line px-3 py-1.5 text-[11.5px] text-muted hover:text-ink"
                >
                    終わる
                </button>
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <div className="text-[15px] leading-[2.1] text-ink">
                    {sentences.map((raw, idx) => {
                        if (raw === "\n") return <br key={idx} />;

                        const isHover = hoverIdx === idx;
                        const isDone = doneIdx.has(idx);

                        return (
                            <span
                                key={idx}
                                onMouseEnter={() => setHoverIdx(idx)}
                                onMouseLeave={() =>
                                    setHoverIdx((prev) => (prev === idx ? null : prev))
                                }
                                onClick={() => ask(raw, idx)}
                                style={{
                                    borderRadius: 3,
                                    cursor: "pointer",
                                    transition: "background .15s ease",
                                    background: isDone
                                        ? "color-mix(in srgb, var(--color-forest) 16%, transparent)"
                                        : isHover
                                          ? "color-mix(in srgb, var(--color-brand) 12%, transparent)"
                                          : "transparent",
                                }}
                            >
                                {stripRuby(raw)}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/*
              * 足すかどうかを聞く小窓。
              *
              * ★ 何を足すのかを、そのまま見せる。
              *   文の一部だけを写すと、
              *   本当にその文でよいのか確かめられない。
              */}
            {asking && (
                <div
                    onClick={() => setAsking(null)}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-6"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-[400px] rounded-xl bg-surface p-5 shadow-xl"
                    >
                        <p className="text-[13px] font-bold text-ink">
                            {entryName} に足しますか
                        </p>

                        <p className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-canvas px-3.5 py-3 text-[12.5px] leading-[1.9] text-muted">
                            {asking.text}
                        </p>

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setAsking(null)}
                                className="rounded-lg border border-line px-4 py-2 text-[12.5px] text-muted hover:text-ink"
                            >
                                やめる
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirm()}
                                disabled={isBusy}
                                className="rounded-lg bg-forest px-5 py-2 text-[12.5px] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                                {isBusy ? "足しています…" : "足す"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
