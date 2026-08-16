/**
 * ============================================================
 * 原石航路 Studio
 * EpisodePublish — 話の公開
 *
 * 作品全体の公開範囲とは別に、話ごとに決める。
 *
 * 「作品は公開しているが、第5話はまだ下書き」
 * ということが普通にある。
 * 予約もここに置く。作品ごとではなく話ごとのもの。
 * ============================================================
 */

"use client";

import { useState } from "react";

import type { Episode } from "@/types";

interface Props {
    episode: Episode;
    onChange: (patch: {
        is_published?: boolean;
        publish_at?: string | null;
    }) => void;
    onClose: () => void;
}

export default function EpisodePublish({ episode, onChange, onClose }: Props) {
    const [at, setAt] = useState(toLocalInput(episode.publish_at));
    const [error, setError] = useState("");

    const isScheduled = Boolean(episode.publish_at) && !episode.is_published;

    function schedule() {
        if (!at) {
            setError("公開する日時を選んでください。");
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
        onChange({
            is_published: false,
            publish_at: floorTo5Min(when).toISOString(),
        });
    }

    return (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-line bg-surface p-4 shadow-lg">
            <div className="flex items-baseline justify-between">
                <p className="text-[13px] font-medium text-ink">この話の公開</p>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="閉じる"
                    className="text-xs text-faint hover:text-ink"
                >
                    ✕
                </button>
            </div>

            {/* いまの状態 */}
            <p className="mt-2 rounded-md bg-canvas px-3 py-2 text-[11px] text-muted">
                {episode.is_published
                    ? "この話は公開されています。"
                    : isScheduled
                      ? `${formatAt(episode.publish_at)}に公開されます。`
                      : "この話はまだ下書きです。"}
            </p>

            <div className="mt-3 space-y-2">
                {episode.is_published ? (
                    <button
                        type="button"
                        onClick={() =>
                            onChange({ is_published: false, publish_at: null })
                        }
                        className="w-full rounded-lg border border-line py-2.5 text-xs text-muted hover:border-forest-line hover:text-ink"
                    >
                        下書きに戻す
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() =>
                            onChange({ is_published: true, publish_at: null })
                        }
                        className="w-full rounded-lg bg-forest py-2.5 text-xs font-medium text-white hover:bg-forest-dark"
                    >
                        いま公開する
                    </button>
                )}

                {/* 予約 */}
                <div className="rounded-lg border border-line px-3 py-2.5">
                    <p className="text-[11px] text-ink">時刻を決めて公開</p>

                    <input
                        type="datetime-local"
                        /*
                         * 5 分刻み。
                         *
                         * 公開の見回りが 5 分ごとなので、
                         * 1 分単位で選べても、その間は待つことになる。
                         * 選べる時刻と実際に出る時刻を揃える。
                         */
                        step={300}
                        value={at}
                        onChange={(e) => setAt(e.target.value)}
                        className="mt-1.5 w-full rounded-md border border-line px-2.5 py-1.5 text-xs outline-none focus:border-forest"
                    />

                    {error && (
                        <p className="mt-1.5 text-[10px] text-[var(--color-danger)]">
                            {error}
                        </p>
                    )}

                    <div className="mt-2 flex gap-1.5">
                        <button
                            type="button"
                            onClick={schedule}
                            className="flex-1 rounded-md border border-forest-line py-1.5 text-[11px] text-forest hover:bg-forest-tint"
                        >
                            予約する
                        </button>

                        {isScheduled && (
                            <button
                                type="button"
                                onClick={() => {
                                    setAt("");
                                    onChange({ publish_at: null });
                                }}
                                className="rounded-md border border-line px-3 py-1.5 text-[11px] text-muted hover:text-ink"
                            >
                                取り消す
                            </button>
                        )}
                    </div>
                </div>
            </div>
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

/**
 * 保存された時刻を、日時の入力欄に入る形にする。
 *
 * 表には世界標準時で入っている（…T04:27:00Z）。
 * これをそのまま切り出すと、日本時間の欄に 04:27 と出て、
 * 13:27 に予約したはずが 9 時間ずれて見える。
 *
 * 端末の時刻に直してから組み立てる。
 */
function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return "";
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/**
 * 時刻を 5 分単位に丸める。
 *
 * 公開の見回りが 5 分ごとなので、7 分や 13 分を選べても
 * 実際に出るのは次の見回りのとき。
 * 選んだ時刻と出る時刻を合わせるため、切り捨てて揃える。
 * （切り上げにすると、選んだ時刻より後になって驚く）
 */
function floorTo5Min(date: Date): Date {
    const at = new Date(date);
    at.setMinutes(Math.floor(at.getMinutes() / 5) * 5, 0, 0);
    return at;
}
