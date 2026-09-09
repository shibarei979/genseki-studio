/**
 * ============================================================
 * 原石航路 Studio
 * useEpisodes — 1 作品ぶんの話の取得と操作
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getRepository } from "@/lib/repository";
import type { Episode, EpisodeUpdateInput } from "@/types";

export function useEpisodes(workId: string) {
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        const rows = await getRepository().listEpisodes(workId);
        setEpisodes(rows);
        setIsLoading(false);
    }, [workId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const createEpisode = useCallback(async () => {
        const episode = await getRepository().createEpisode(workId);
        await reload();
        return episode;
    }, [workId, reload]);

    /**
     * 話を更新する。
     * 入力のたびに再取得すると重いので、一覧の該当行だけを差し替える。
     */
    const updateEpisode = useCallback(async (episodeId: string, patch: EpisodeUpdateInput) => {
        const updated = await getRepository().updateEpisode(episodeId, patch);
        setEpisodes((prev) => prev.map((ep) => (ep.id === episodeId ? updated : ep)));
        return updated;
    }, []);

    const deleteEpisode = useCallback(
        async (episodeId: string) => {
            await getRepository().deleteEpisode(episodeId);
            await reload();
        },
        [reload],
    );

    /*
     * 並べ替えを、順番待ちにする。
     *
     * ★ 同時に 2 つ走ると、番号がぶつかる。
     *
     *   並べ替えは「大きい番号へ逃がす → 1 から振り直す」の
     *   2 段構え。2 つが重なると、片方の 1 段目が
     *   もう片方の 2 段目の途中に割り込む。
     *   そこで同じ番号ができ、表に弾かれる。
     *
     *   数話まとめて章に入れたときに出ていた
     *   「同じものがすでにあります」は、これだった。
     */
    const queueRef = useRef<Promise<unknown>>(Promise.resolve());

    const reorderEpisodes = useCallback(
        async (orderedIds: string[]) => {
            // 先に画面を並べ替えてから保存する（ドラッグの手応えを優先）
            setEpisodes((prev) => {
                const byId = new Map(prev.map((ep) => [ep.id, ep]));
                return orderedIds
                    .map((id, i) => {
                        const ep = byId.get(id);
                        return ep ? { ...ep, ep_number: i + 1 } : null;
                    })
                    .filter((ep): ep is Episode => ep !== null);
            });
            /*
             * 保存に失敗したら、画面を元に戻す。
             *
             * 先に並べ替えて手応えを出しているので、
             * 黙って失敗すると「並べ替えた」と思ったまま
             * 読み直したときに戻る。原因が分からない。
             */
            try {
                /* 前の並べ替えが終わってから始める */
                const run = queueRef.current
                    .catch(() => undefined)
                    .then(() => getRepository().reorderEpisodes(workId, orderedIds));
                queueRef.current = run;
                await run;
            } catch (error) {
                window.alert(
                    `並べ替えを保存できませんでした。\n${
                        error instanceof Error ? error.message : ""
                    }`,
                );
                await reload();
            }
        },
        [workId, reload],
    );

    return {
        episodes,
        isLoading,
        reload,
        createEpisode,
        updateEpisode,
        deleteEpisode,
        reorderEpisodes,
    };
}
