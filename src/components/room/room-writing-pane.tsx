/**
 * ============================================================
 * 原石航路 Studio
 * RoomWritingPane — 部屋にいながら書く
 *
 * 執筆室に来ても書けないのでは意味がない。
 * 作品と話を選んで、そのまま本文を書ける。
 * 保存は執筆画面と同じ仕組みを通すので、
 * ここで書いたものはそのまま原稿になる。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { useAutosave } from "@/hooks/use-autosave";
import { getRepository } from "@/lib/repository";
import { countChars, formatNumber, formatTime } from "@/lib/utils/text";
import type { DisplaySettings, Episode, WorkWithStats } from "@/types";
import { formatEpisodeLabel, LINE_HEIGHT_VALUE } from "@/types";

interface Props {
    /** 書いた文字数が変わったら知らせる。部屋の表示に使う */
    onCharsChanged: (total: number) => void;
    /** 書き始めたら知らせる。状態を「執筆中」にするため */
    onWritingStarted: () => void;
}

export default function RoomWritingPane({ onCharsChanged, onWritingStarted }: Props) {
    const [works, setWorks] = useState<WorkWithStats[]>([]);
    const [workId, setWorkId] = useState("");
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [episodeId, setEpisodeId] = useState("");
    const [settings, setSettings] = useState<DisplaySettings | null>(null);
    const [body, setBody] = useState("");
    /** この部屋に入ってから書いた分 */
    const [startedAt, setStartedAt] = useState(0);

    useEffect(() => {
        void (async () => {
            const rows = await getRepository().listWorks();
            setWorks(rows);
            if (rows.length > 0) setWorkId(rows[0].id);
        })();
    }, []);

    useEffect(() => {
        if (!workId) return;
        void (async () => {
            const repository = getRepository();
            const rows = await repository.listEpisodes(workId);
            setEpisodes(rows);
            setSettings(await repository.getDisplaySettings(workId));
            setEpisodeId(rows[0]?.id ?? "");
        })();
    }, [workId]);

    useEffect(() => {
        if (!episodeId) {
            setBody("");
            return;
        }
        void (async () => {
            const episode = await getRepository().getEpisode(episodeId);
            setBody(episode?.body ?? "");
            setStartedAt(countChars(episode?.body ?? ""));
        })();
    }, [episodeId]);

    const handleSave = useCallback(
        async (value: string) => {
            if (!episodeId) return;
            await getRepository().updateEpisode(episodeId, { body: value });
        },
        [episodeId],
    );

    const { state, savedAt } = useAutosave({ value: body, onSave: handleSave, enabled: Boolean(episodeId) });

    // 書いた量が変わったら部屋へ伝える
    useEffect(() => {
        const written = Math.max(0, countChars(body) - startedAt);
        onCharsChanged(written);
    }, [body, startedAt, onCharsChanged]);

    if (works.length === 0) {
        return (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line bg-surface">
                <p className="px-6 text-center text-sm leading-relaxed text-faint">
                    まだ作品がありません。
                    <br />
                    作品を作ると、ここで書けるようになります。
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                <select
                    value={workId}
                    onChange={(e) => setWorkId(e.target.value)}
                    aria-label="作品を選ぶ"
                    className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-forest"
                >
                    {works.map((work) => (
                        <option key={work.id} value={work.id}>
                            {work.title}
                        </option>
                    ))}
                </select>

                <select
                    value={episodeId}
                    onChange={(e) => setEpisodeId(e.target.value)}
                    aria-label="話を選ぶ"
                    disabled={episodes.length === 0}
                    className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-forest"
                >
                    {episodes.length === 0 ? (
                        <option value="">話がありません</option>
                    ) : (
                        episodes.map((episode) => (
                            <option key={episode.id} value={episode.id}>
                                {formatEpisodeLabel(episode)}
                            </option>
                        ))
                    )}
                </select>
            </div>

            <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[10px] text-muted">
                <span>
                    {state === "saving"
                        ? "保存中"
                        : state === "pending"
                          ? "未保存の変更"
                          : savedAt
                            ? `自動保存済み ${formatTime(savedAt)}`
                            : "自動保存"}
                </span>
                <span>
                    {formatNumber(countChars(body))}文字
                    <span className="ml-2 text-forest">
                        +{formatNumber(Math.max(0, countChars(body) - startedAt))}
                    </span>
                </span>
            </div>

            {episodeId ? (
                <textarea
                    value={body}
                    onChange={(e) => {
                        setBody(e.target.value);
                        onWritingStarted();
                    }}
                    placeholder="ここに本文を書きます。"
                    aria-label="本文"
                    spellCheck={false}
                    style={{
                        fontSize: `${settings?.font_size ?? 16}px`,
                        lineHeight: LINE_HEIGHT_VALUE[settings?.line_height ?? "relaxed"],
                    }}
                    className="manuscript thin-scroll min-h-0 flex-1 resize-none bg-transparent px-5 py-4 outline-none placeholder:text-faint"
                />
            ) : (
                <p className="flex-1 px-6 py-16 text-center text-sm text-faint">
                    書く話を選んでください。
                </p>
            )}
        </div>
    );
}
