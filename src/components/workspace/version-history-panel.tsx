/**
 * ============================================================
 * 原石航路 Studio
 * VersionHistoryPanel — 話のバージョン履歴
 *
 * 復元は「戻す前の状態も控えてから」行う。
 * 間違えて古い版に戻したときに、書いたものが失われないため。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

import { getRepository } from "@/lib/repository";
import { formatDateTime, formatNumber } from "@/lib/utils/text";
import type { Episode, EpisodeVersion } from "@/types";
import { VERSION_TRIGGER_LABEL } from "@/types";

interface Props {
    episode: Episode;
    onClose: () => void;
    onRestored: (episode: Episode) => void;
}

export default function VersionHistoryPanel({ episode, onClose, onRestored }: Props) {
    const [versions, setVersions] = useState<EpisodeVersion[]>([]);
    const [selected, setSelected] = useState<EpisodeVersion | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    async function reload() {
        const rows = await getRepository().listVersions(episode.id);
        setVersions(rows);
        setSelected((current) => current ?? rows[0] ?? null);
        setIsLoading(false);
    }

    useEffect(() => {
        void reload();
        // episode.id が変わったら読み直す
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [episode.id]);

    async function handleSnapshot() {
        const created = await getRepository().createVersion(episode.id, "manual");
        if (!created) {
            window.alert("前回の保存から本文が変わっていません。");
            return;
        }
        await reload();
    }

    async function handleRestore(version: EpisodeVersion) {
        const confirmed = window.confirm(
            `${version.label}（${formatDateTime(version.created_at)}）の本文に戻します。\n` +
                "いまの本文は履歴に控えるので、あとから戻し直せます。",
        );
        if (!confirmed) return;

        const restored = await getRepository().restoreVersion(version.id);
        onRestored(restored);
        await reload();
    }

    return (
        <div className="flex h-full w-full shrink-0 flex-col rounded-lg border border-line bg-surface lg:w-[380px]">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                <h2 className="text-[13px] font-medium text-ink">履歴</h2>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void handleSnapshot()}
                        className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-forest-line hover:text-forest"
                    >
                        いまの状態を残す
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="履歴を閉じる"
                        className="px-1 text-[13px] text-faint hover:text-ink"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {isLoading ? (
                <p className="py-10 text-center text-[13px] text-faint">読み込んでいます</p>
            ) : versions.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-faint">
                    まだ履歴がありません。
                    <br />
                    執筆中に自動で残るほか、上のボタンでも残せます。
                </p>
            ) : (
                <>
                    <ul className="thin-scroll max-h-[45%] overflow-y-auto border-b border-line">
                        {versions.map((version) => (
                            <li key={version.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelected(version)}
                                    className={[
                                        "flex w-full items-center gap-2.5 px-4 py-2 text-left",
                                        selected?.id === version.id
                                            ? "bg-forest-tint"
                                            : "hover:bg-canvas",
                                    ].join(" ")}
                                >
                                    <span className="w-9 shrink-0 text-xs text-forest">
                                        {version.label}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-xs text-ink">
                                            {formatDateTime(version.created_at)}
                                        </span>
                                        <span className="block text-xs text-faint">
                                            {VERSION_TRIGGER_LABEL[version.trigger]}・
                                            {formatNumber(version.char_count)}文字
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>

                    {selected && (
                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-2.5">
                                <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">
                                    {selected.body.slice(0, 1200) ||
                                        "（この版の本文は空です）"}
                                    {selected.body.length > 1200 && "\n……"}
                                </p>
                            </div>
                            <div className="border-t border-line px-3.5 py-2.5">
                                <button
                                    type="button"
                                    onClick={() => void handleRestore(selected)}
                                    className="w-full rounded-md bg-forest px-4 py-2 text-[13px] text-white hover:bg-forest-dark"
                                >
                                    {selected.label} の本文に戻す
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
