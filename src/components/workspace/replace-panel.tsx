/**
 * ============================================================
 * 原石航路 Studio
 * ReplacePanel — 一括置換
 *
 * 名前を変えたときに要る。
 * 「律」を「玲」にする、といったことが手作業では追いきれない。
 *
 * 置き換える前に、何件あるかと前後を見せる。
 * 押したら全部変わる、では怖くて使えない。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

interface Props {
    body: string;
    onApply: (next: string) => void;
    onClose: () => void;
    /** その場所へ本文を送る。何行目かを渡す */
    onJump?: (line: number) => void;
}

/** 前後をどれだけ見せるか */
const AROUND = 12;

export default function ReplacePanel({ body, onApply, onClose, onJump }: Props) {
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [matchCase, setMatchCase] = useState(true);
    const [done, setDone] = useState("");

    /** 見つかった場所と、その前後 */
    const hits = useMemo(() => {
        if (!from) return [];

        const found: {
            at: number;
            line: number;
            before: string;
            after: string;
        }[] = [];
        const haystack = matchCase ? body : body.toLowerCase();
        const needle = matchCase ? from : from.toLowerCase();

        let at = 0;
        while (found.length < 200) {
            const next = haystack.indexOf(needle, at);
            if (next === -1) break;

            found.push({
                at: next,
                // 何行目か。飛ぶときに使う
                line: body.slice(0, next).split("\n").length,
                before: body.slice(Math.max(0, next - AROUND), next),
                after: body.slice(next + from.length, next + from.length + AROUND),
            });
            at = next + from.length;
        }
        return found;
    }, [body, from, matchCase]);

    /** この 1 件だけ置き換える */
    function applyOne(at: number) {
        const next = body.slice(0, at) + to + body.slice(at + from.length);
        onApply(next);
    }

    function apply() {
        if (!from || hits.length === 0) return;

        /*
         * 後ろから置き換える。
         * 前から替えると、置き換えた長さのぶん
         * 後ろの位置がずれていく。
         */
        let next = body;
        for (const hit of [...hits].reverse()) {
            next = next.slice(0, hit.at) + to + next.slice(hit.at + from.length);
        }

        onApply(next);
        setDone(`${hits.length}件を置き換えました`);
        window.setTimeout(() => setDone(""), 2500);
    }

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                <h2 className="text-[13px] font-medium text-ink">一括置換</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="閉じる"
                    className="text-xs text-faint hover:text-ink"
                >
                    ✕
                </button>
            </div>

            <div className="space-y-3 border-b border-line px-3.5 py-2.5.5">
                <label className="block">
                    <span className="text-xs text-muted">探す文字</span>
                    <input
                        type="text"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className={inputClass}
                    />
                </label>

                <label className="block">
                    <span className="text-xs text-muted">置き換える文字</span>
                    <input
                        type="text"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="空にすると、その文字を消します"
                        className={inputClass}
                    />
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={matchCase}
                        onChange={(e) => setMatchCase(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--color-forest)]"
                    />
                    <span className="text-[11px] text-muted">
                        大文字と小文字を区別する
                    </span>
                </label>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={apply}
                        disabled={hits.length === 0}
                        className="rounded-md bg-forest px-4 py-1.5 text-xs text-white hover:bg-forest-dark disabled:opacity-40"
                    >
                        {hits.length}件を置き換える
                    </button>

                    {done && <span className="text-xs text-forest">{done}</span>}
                </div>
            </div>

            {/* 見つかった場所 */}
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-2.5">
                {!from ? (
                    <p className="py-10 text-center text-[11px] text-faint">
                        探す文字を入れてください。
                    </p>
                ) : hits.length === 0 ? (
                    <p className="py-10 text-center text-[11px] text-faint">
                        見つかりませんでした。
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {hits.slice(0, 60).map((hit) => (
                            <li
                                key={hit.at}
                                className="flex items-start gap-2 rounded border border-line px-2.5 py-2 text-[11px] leading-relaxed hover:border-forest-line"
                            >
                                {/* 押すとその場所へ飛ぶ */}
                                <button
                                    type="button"
                                    onClick={() => onJump?.(hit.line)}
                                    title={`${hit.line}行目へ移動`}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <span className="mb-0.5 block text-[10px] text-faint">
                                        {hit.line}行目
                                    </span>

                                    <span className="text-faint">…{hit.before}</span>
                                    <span className="bg-[var(--color-amber-tint)] text-ink">
                                        {from}
                                    </span>
                                    <span className="text-faint">{hit.after}…</span>
                                </button>

                                {/*
                                 * この 1 件だけ置き換える。
                                 * 全部変えたくない場面があるので、
                                 * 1 つずつ選べるようにする。
                                 */}
                                <button
                                    type="button"
                                    onClick={() => applyOne(hit.at)}
                                    disabled={!to}
                                    title={to ? `「${to}」に置き換える` : "置き換える文字を入れてください"}
                                    className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-muted hover:border-forest hover:text-forest disabled:opacity-30"
                                >
                                    置換
                                </button>
                            </li>
                        ))}

                        {hits.length > 60 && (
                            <li className="py-2 text-center text-[10px] text-faint">
                                ほか {hits.length - 60} 件
                            </li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}

const inputClass =
    "mt-1 w-full rounded-md border border-line px-3 py-1.5 text-[13px] outline-none focus:border-forest";
