"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * PageViewPing — 話の閲覧を 1 回だけ記録する
 *
 * ★ 画面が開いて、見えている状態で少したってから送る。
 *   頁を取っていくだけの機械（画面を動かさないもの）は、ここまで来ないので数に入らない。
 *   前はサーバーで頁を組み立てた時点で数えていて、未ログインの閲覧の 9 割以上が機械だった。
 * ★ 裏のタブで開いただけのときは、表に出てから数える。
 * ★ 何を記録するかの判断（作者か・機械か・同じ日の二度目か）は、受け口（/api/page-view）でする。
 * ============================================================
 */

import { useEffect, useRef } from "react";

/** 見えてから送るまでの間（すぐ閉じた・通り過ぎただけは数えない） */
const WAIT_MS = 1500;

export default function PageViewPing({
    novelId,
    episodeId,
    source,
}: {
    novelId: string;
    episodeId: string;
    source: string;
}) {
    const sentRef = useRef<string | null>(null);

    useEffect(() => {
        if (sentRef.current === episodeId) return;
        let timer: number | undefined;

        function send() {
            if (sentRef.current === episodeId) return;
            sentRef.current = episodeId;
            void fetch("/api/page-view", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ novel_id: novelId, episode_id: episodeId, source }),
                keepalive: true,
            }).catch(() => {
                /* 記録できなくても、読むのは止めない */
            });
        }

        function arm() {
            window.clearTimeout(timer);
            if (document.visibilityState === "visible") timer = window.setTimeout(send, WAIT_MS);
        }

        arm();
        document.addEventListener("visibilitychange", arm);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener("visibilitychange", arm);
        };
    }, [novelId, episodeId, source]);

    return null;
}
