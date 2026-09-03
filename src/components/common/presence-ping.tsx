/**
 * ============================================================
 * 原石航路 Studio
 * PresencePing — 「まだ見ています」を送る
 *
 * ★ 30 秒ごとに 1 回だけ。
 *   運営が「いま何人開いているか」を見るためだけに使う。
 *
 * ★ 画面が裏に回っているあいだは送らない。
 *   別の窓を見ている人まで数えると、数が実態より膨らむ。
 *
 * ★ 札は画面ごとに作る。誰かは持たない。
 *   同じ人が 2 枚開けば 2 と数える。それが「開いている画面の数」。
 * ============================================================
 */

"use client";

import { useEffect } from "react";

/** 送る間隔 */
const EVERY_MS = 30_000;

export default function PresencePing() {
    useEffect(() => {
        /* この画面ぶんの札。閉じれば消える */
        const key =
            Math.random().toString(36).slice(2) +
            Date.now().toString(36);

        let alive = true;

        const send = () => {
            if (!alive) return;
            if (typeof document !== "undefined" && document.hidden) return;

            void fetch("/api/presence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key }),
                keepalive: true,
            }).catch(() => {});
        };

        send();
        const timer = window.setInterval(send, EVERY_MS);

        /* 裏から戻ってきたら、すぐ 1 回送る */
        const onVisible = () => {
            if (!document.hidden) send();
        };
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            alive = false;
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, []);

    return null;
}
