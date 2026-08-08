/**
 * ============================================================
 * 原石航路 Studio
 * PostPanel — 話を投稿する
 *
 * 言葉を分ける。
 *   公開 … 作品そのもの（下書き・限定公開・公開）。設定で決める
 *   投稿 … 話を 1 つずつ外へ出すこと。ここで行う
 *
 * 混ぜると「公開したのに読めない」が起きる。
 * ============================================================
 */

"use client";

import { useState } from "react";

import type { Episode } from "@/types";

interface Props {
    episode: Episode | null;
    /** 作品が公開されているか。下書きなら投稿しても読まれない */
    isWorkPublic: boolean;
    onChange: (patch: {
        is_published?: boolean;
        publish_at?: string | null;
    }) => void;
}

export default function PostPanel({ episode, isWorkPublic, onChange }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [at, setAt] = useState("");
    const [error, setError] = useState("");

    if (!episode) return null;

    const isScheduled = Boolean(episode.publish_at) && !episode.is_published;

    function schedule() {
        if (!at) {
            setError("投稿する日時を選んでください。");
            return;
        }

        const when = new Date(at);
        if (Number.isNaN(when.getTime())) {
            setError("日時の形が正しくありません。");
            return;
        }
        if (when.getTime() < Date.now()) {
            setError("過ぎた時刻は選べません。");
            return;
        }

        setError("");
        onChange({ is_published: false, publish_at: when.toISOString() });
        setIsOpen(false);
    }

    return (
        <div className="border-t border-line px-3 py-3">
            {/* いまの状態 */}
            <div className="flex items-center gap-2">
                <span
                    className={[
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        episode.is_published
                            ? "bg-forest"
                            : isScheduled
                              ? "bg-[var(--color-amber)]"
                              : "bg-faint",
                    ].join(" ")}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                    {episode.title || `第${episode.ep_number}話`}
                    <span className="ml-1.5 text-ink">
                        {episode.is_published
                            ? "投稿済み"
                            : isScheduled
                              ? "予約中"
                              : "未投稿"}
                    </span>
                </span>
            </div>

            {isScheduled && (
                <p className="mt-1 pl-3.5 text-[10px] text-faint">
                    {formatAt(episode.publish_at)}に投稿されます
                </p>
            )}

            {/* 操作 */}
            {episode.is_published ? (
                <button
                    type="button"
                    onClick={() => onChange({ is_published: false, publish_at: null })}
                    className="mt-2.5 w-full rounded-md border border-line py-2 text-[11px] text-muted hover:border-forest-line hover:text-ink"
                >
                    投稿を取り下げる
                </button>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={() => onChange({ is_published: true, publish_at: null })}
                        className="mt-2.5 w-full rounded-md bg-forest py-2 text-[11px] font-medium text-white hover:bg-forest-dark"
                    >
                        この話を投稿する
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsOpen((open) => !open)}
                        className="mt-1.5 w-full py-1 text-[10px] text-faint hover:text-forest"
                    >
                        {isScheduled ? "予約を変える" : "時刻を決めて投稿"}
                    </button>
                </>
            )}

            {isOpen && !episode.is_published && (
                <div className="mt-2 rounded-md border border-line px-2.5 py-2">
                    <input
                        type="datetime-local"
                        value={at}
                        onChange={(e) => setAt(e.target.value)}
                        aria-label="投稿する日時"
                        className="w-full rounded border border-line px-2 py-1 text-[11px] outline-none focus:border-forest"
                    />

                    {error && (
                        <p className="mt-1 text-[10px] text-[var(--color-danger)]">
                            {error}
                        </p>
                    )}

                    <div className="mt-1.5 flex gap-1.5">
                        <button
                            type="button"
                            onClick={schedule}
                            className="flex-1 rounded border border-forest-line py-1 text-[10px] text-forest hover:bg-forest-tint"
                        >
                            予約する
                        </button>

                        {isScheduled && (
                            <button
                                type="button"
                                onClick={() => {
                                    onChange({ publish_at: null });
                                    setIsOpen(false);
                                }}
                                className="rounded border border-line px-2.5 py-1 text-[10px] text-muted hover:text-ink"
                            >
                                取り消す
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/*
             * 作品が下書きなら、投稿しても読まれない。
             * 押したのに何も起きない、と思われないよう先に伝える。
             */}
            {!isWorkPublic && (
                <p className="mt-2 rounded bg-[var(--color-amber-tint)] px-2.5 py-1.5 text-[10px] leading-relaxed text-ink">
                    作品が下書きのままです。
                    投稿しても、まだ読者には見えません。
                </p>
            )}
        </div>
    );
}

function formatAt(iso: string | null | undefined): string {
    if (!iso) return "";
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${at.getMonth() + 1}月${at.getDate()}日 ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
