/**
 * ============================================================
 * 原石航路 Studio
 * EpisodePostList — 話ごとの投稿
 *
 * 言葉を分ける。
 *   公開 … 作品そのもの（下書き・限定公開・公開）
 *   投稿 … 話を 1 つずつ外へ出すこと
 *
 * 話を一覧にして、その場で出したり下げたりできるようにする。
 * 執筆画面から離れて、まとめて見渡す場所が要る。
 * ============================================================
 */

"use client";

import { useState } from "react";

import { formatNumber } from "@/lib/utils/text";
import type { Episode } from "@/types";

interface Props {
    episodes: Episode[];
    /** 作品が公開されているか。下書きなら投稿しても読まれない */
    isWorkPublic: boolean;
    onChange: (
        episodeId: string,
        patch: { is_published?: boolean; publish_at?: string | null },
    ) => Promise<void>;
}

export default function EpisodePostList({
    episodes,
    isWorkPublic,
    onChange,
}: Props) {
    /** いま投稿の仕方を選んでいる話 */
    const [openFor, setOpenFor] = useState<string | null>(null);
    const [at, setAt] = useState("");
    const [error, setError] = useState("");

    const posted = episodes.filter((row) => row.is_published).length;

    async function post(episodeId: string) {
        await onChange(episodeId, { is_published: true, publish_at: null });
        setOpenFor(null);
    }

    async function schedule(episodeId: string) {
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
        await onChange(episodeId, {
            is_published: false,
            publish_at: when.toISOString(),
        });
        setOpenFor(null);
        setAt("");
    }

    return (
        <div className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-6 py-5">
                <h2 className="text-base font-medium text-ink">話の投稿</h2>
                <p className="mt-1 text-sm text-muted">
                    話を1つずつ投稿します。
                    {episodes.length > 0 && (
                        <span className="ml-1">
                            {posted} / {episodes.length}話が投稿済みです。
                        </span>
                    )}
                </p>

                {!isWorkPublic && episodes.length > 0 && (
                    <p className="mt-3 rounded-md bg-[var(--color-amber-tint)] px-3.5 py-2.5 text-xs leading-relaxed text-ink">
                        作品が公開されていません。
                        投稿しても、まだ読者には見えません。
                        上の「作品の公開設定」で公開にしてください。
                    </p>
                )}
            </div>

            {episodes.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-faint">
                    まだ話がありません。
                </p>
            ) : (
                <ul className="divide-y divide-line">
                    {episodes.map((episode) => {
                        const isScheduled =
                            Boolean(episode.publish_at) && !episode.is_published;

                        return (
                            <li key={episode.id} className="px-6 py-3.5">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="w-10 shrink-0 text-xs text-faint">
                                        {/* 番号は出さない */}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm text-ink">
                                            {episode.title || "（題名なし）"}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] text-faint">
                                            {formatNumber(episode.char_count)}字
                                            {isScheduled &&
                                                `　${formatAt(episode.publish_at)}に投稿`}
                                        </span>
                                    </span>

                                    {/* いまの状態 */}
                                    <span
                                        className={[
                                            "shrink-0 rounded px-2 py-0.5 text-[11px]",
                                            episode.is_published
                                                ? "bg-forest-tint text-forest"
                                                : isScheduled
                                                  ? "bg-[var(--color-amber-tint)] text-[var(--color-amber)]"
                                                  : "bg-canvas text-faint",
                                        ].join(" ")}
                                    >
                                        {episode.is_published
                                            ? "投稿済み"
                                            : isScheduled
                                              ? "予約中"
                                              : "未投稿"}
                                    </span>

                                    {/* 操作 */}
                                    {episode.is_published || isScheduled ? (
                                        <div className="flex shrink-0 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOpenFor(
                                                        openFor === episode.id
                                                            ? null
                                                            : episode.id,
                                                    );
                                                    setAt(
                                                        episode.publish_at?.slice(0, 16) ??
                                                            "",
                                                    );
                                                }}
                                                className="rounded-md border border-line px-3 py-1.5 text-xs text-ink hover:border-forest-line hover:text-forest"
                                            >
                                                変更
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void onChange(episode.id, {
                                                        is_published: false,
                                                        publish_at: null,
                                                    })
                                                }
                                                className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                                            >
                                                非公開
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setOpenFor(
                                                    openFor === episode.id
                                                        ? null
                                                        : episode.id,
                                                )
                                            }
                                            className="shrink-0 rounded-md bg-forest px-4 py-1.5 text-xs text-white hover:bg-forest-dark"
                                        >
                                            投稿する
                                        </button>
                                    )}
                                </div>

                                {/* いつ投稿するか */}
                                {openFor === episode.id && (
                                    <div className="mt-3 rounded-md border border-line bg-canvas px-4 py-3">
                                        <p className="text-xs text-ink">
                                            いつ投稿しますか
                                        </p>

                                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void post(episode.id)}
                                                className="rounded-md bg-forest px-4 py-2 text-xs text-white hover:bg-forest-dark"
                                            >
                                                すぐ投稿する
                                            </button>

                                            <span className="text-xs text-faint">
                                                または
                                            </span>

                                            <input
                                                type="datetime-local"
                                                value={at}
                                                onChange={(e) => setAt(e.target.value)}
                                                aria-label="投稿する日時"
                                                className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-forest"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => void schedule(episode.id)}
                                                className="rounded-md border border-forest-line px-4 py-2 text-xs text-forest hover:bg-forest-tint"
                                            >
                                                予約する
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setOpenFor(null)}
                                                className="ml-auto text-xs text-faint hover:text-ink"
                                            >
                                                やめる
                                            </button>
                                        </div>

                                        {error && (
                                            <p className="mt-2 text-[11px] text-[var(--color-danger)]">
                                                {error}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
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
