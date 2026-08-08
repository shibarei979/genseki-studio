/**
 * ============================================================
 * 原石航路 Studio
 * AdminNgWordsClient — 使わない言葉
 *
 * 推敲チェックで知らせる言葉を集める。
 *
 * 書けなくするのではなく、気づかせるだけにする。
 * 言葉を禁じると、書き手は書きたいものを書けなくなる。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import AdminShell from "@/components/admin/admin-shell";
import { getRepository } from "@/lib/repository";
import type { NgWord } from "@/types";

export default function AdminNgWordsClient() {
    const [words, setWords] = useState<NgWord[]>([]);
    const [draft, setDraft] = useState("");
    const [keyword, setKeyword] = useState("");

    const reload = useCallback(async () => {
        setWords(await getRepository().listNgWords());
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    async function add() {
        const word = draft.trim();
        if (!word) return;
        // 同じ言葉を二度入れない
        if (words.some((row) => row.word === word)) {
            setDraft("");
            return;
        }
        await getRepository().createNgWord(word);
        setDraft("");
        await reload();
    }

    const shown = keyword
        ? words.filter((row) => row.word.includes(keyword))
        : words;

    return (
        <AdminShell
            title="使わない言葉"
            description="推敲チェックで知らせます。書けなくはしません。"
        >
            {/* 足す */}
            <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={draft}
                        maxLength={30}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                void add();
                            }
                        }}
                        placeholder="気をつけたい言葉"
                        aria-label="言葉を追加"
                        className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest"
                    />
                    <button
                        type="button"
                        onClick={() => void add()}
                        disabled={draft.trim().length === 0}
                        className="shrink-0 rounded-md bg-forest px-5 text-xs text-white disabled:opacity-40"
                    >
                        追加
                    </button>
                </div>
            </div>

            {words.length > 0 && (
                <input
                    type="search"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="絞り込む"
                    aria-label="絞り込む"
                    className="mt-3 w-56 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm outline-none focus:border-forest"
                />
            )}

            {shown.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-line py-16 text-center text-sm text-faint">
                    {words.length === 0
                        ? "まだ登録がありません。"
                        : "見つかりませんでした。"}
                </p>
            ) : (
                <ul className="mt-3 space-y-1.5">
                    {shown.map((row) => (
                        <li
                            key={row.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5"
                        >
                            <span className="w-32 shrink-0 text-[13px] font-medium text-ink">
                                {row.word}
                            </span>

                            <input
                                type="text"
                                defaultValue={row.reason}
                                onBlur={(e) =>
                                    void getRepository()
                                        .updateNgWord(row.id, {
                                            reason: e.target.value.trim(),
                                        })
                                        .then(reload)
                                }
                                placeholder="なぜ避けるか"
                                aria-label={`${row.word}の理由`}
                                className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-xs outline-none hover:border-line focus:border-forest"
                            />

                            <input
                                type="text"
                                defaultValue={row.suggestion}
                                onBlur={(e) =>
                                    void getRepository()
                                        .updateNgWord(row.id, {
                                            suggestion: e.target.value.trim(),
                                        })
                                        .then(reload)
                                }
                                placeholder="言い換えの案"
                                aria-label={`${row.word}の言い換え`}
                                className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-xs outline-none hover:border-line focus:border-forest"
                            />

                            <button
                                type="button"
                                onClick={async () => {
                                    await getRepository().deleteNgWord(row.id);
                                    await reload();
                                }}
                                aria-label={`${row.word}を削除`}
                                className="shrink-0 px-1.5 text-xs text-faint hover:text-[var(--color-danger)]"
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <p className="mt-4 text-[11px] text-faint">
                {words.length}語。推敲チェックの「使わない言葉」で使われます。
            </p>
        </AdminShell>
    );
}
