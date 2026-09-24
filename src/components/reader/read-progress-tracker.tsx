/**
 * ============================================================
 * 原石航路 Studio
 * ReadProgressTracker — どこまで読んだかを控える
 *
 * ★ 画面には何も出さない。読む邪魔は一切しない。
 *
 * ★ 1 回の読書に、1 つの札を配る。
 *   同じ札で書き替えるので、行が増え続けない。
 *   頁を開き直せば、別の読書として数える。
 *
 * ★ 送るのは 3 つのとき。
 *   ・1 割ぶん進んだとき（ただし 5 秒に 1 回まで）
 *   ・30 秒ごと
 *   ・離れるとき（窓を閉じる・他の頁へ・裏に回す）
 *
 *   離れるときは sendBeacon で送る。
 *   ふつうの fetch は、頁が消えると途中で切られる。
 *
 * ★ 縦書きでも数えられる。
 *   縦と横、進んだほうを見る。
 *
 * ★ 頁送りで読む人は、巻物のように動かない。
 *   そのときは reportReadProgress() で外から教えてもらう。
 * ============================================================
 */

"use client";

import { useEffect, useRef } from "react";

/** 外から教えてもらった進み具合。頁送りで読むときに使う */
let outerPct = 0;

/**
 * 頁送りで読んでいるときに、進み具合を教える。
 *
 * @param pct 0〜100
 */
export function reportReadProgress(pct: number) {
    if (!Number.isFinite(pct)) return;
    const value = Math.max(0, Math.min(100, pct));
    if (value > outerPct) outerPct = value;
}

/** 進み具合の覚えを消す。別の話に移ったとき */
function resetReported() {
    outerPct = 0;
}

function makeKey(): string {
    try {
        return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    } catch {
        return (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 32);
    }
}

/** その機械の札。visitor.ts が置いたものを、そのまま借りる */
function visitorKey(): string | null {
    try {
        return window.localStorage.getItem("gk-visitor");
    } catch {
        return null;
    }
}

export default function ReadProgressTracker({
    episodeId,
    enabled = true,
}: {
    episodeId: string;
    /** 下読みや編集の画面では止める */
    enabled?: boolean;
}) {
    const sentPct = useRef(0);
    const sentAt = useRef(0);

    useEffect(() => {
        if (!enabled || !episodeId) return;

        resetReported();

        const sessionKey = makeKey();
        const visitor = visitorKey();
        const referrer = typeof document !== "undefined" ? document.referrer : "";

        let seconds = 0;
        let maxPct = 0;
        let closed = false;

        sentPct.current = -1;
        sentAt.current = 0;

        /** 今どこまで読んだか */
        function readPct(): number {
            const doc = document.documentElement;

            const downRoom = doc.scrollHeight - window.innerHeight;
            const sideRoom = doc.scrollWidth - window.innerWidth;

            /*
             * 動かせる幅が無いときは、はじめから全部見えている。
             * 短い話をいつまでも「1 割で離脱」と数えないため。
             */
            const down = downRoom > 50 ? (window.scrollY / downRoom) * 100 : 100;
            const side = sideRoom > 50 ? (Math.abs(window.scrollX) / sideRoom) * 100 : 0;

            return Math.min(100, Math.max(down, side, outerPct));
        }

        function send(useBeacon: boolean) {
            if (closed && !useBeacon) return;

            const body = JSON.stringify({
                session_key: sessionKey,
                episode_id: episodeId,
                max_pct: Math.round(maxPct),
                read_seconds: seconds,
                visitor_key: visitor,
                referrer,
            });

            sentPct.current = maxPct;
            sentAt.current = Date.now();

            if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
                try {
                    navigator.sendBeacon("/api/read-progress", new Blob([body], { type: "text/plain" }));
                    return;
                } catch {
                    /* 送れなければ、下のふつうの送り方に落ちる */
                }
            }

            void fetch("/api/read-progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
                keepalive: true,
            }).catch(() => {});
        }

        function update() {
            const pct = readPct();
            if (pct > maxPct) maxPct = pct;

            /* 1 割ぶん進んだら送る。ただし 5 秒に 1 回まで */
            const grew = maxPct - sentPct.current >= 10;
            const waited = Date.now() - sentAt.current >= 5000;
            if (grew && waited) send(false);
        }

        /* 時間は、画面が見えている間だけ数える */
        const timer = window.setInterval(() => {
            if (document.visibilityState !== "visible") return;
            seconds += 1;
            update();
            if (seconds % 30 === 0) send(false);
        }, 1000);

        function onScroll() {
            update();
        }

        function onHide() {
            if (document.visibilityState === "hidden") {
                update();
                send(true);
            }
        }

        function onLeave() {
            update();
            send(true);
        }

        /* 開いた時点で一度。短い話や、すぐ閉じられた話も残す */
        update();
        send(false);

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", onLeave);

        return () => {
            closed = true;
            window.clearInterval(timer);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("pagehide", onLeave);

            /* 別の話へ移るときにも、最後の姿を残す */
            update();
            send(true);
            resetReported();
        };
    }, [episodeId, enabled]);

    return null;
}
