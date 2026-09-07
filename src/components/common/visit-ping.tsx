/**
 * ============================================================
 * 原石航路 Studio
 * VisitPing — 着いた頁を、1 回だけ控える
 *
 * ★ 画面には何も出さない。
 *
 * ★ 同じ頁は、1 回の訪問につき 1 回だけ数える。
 *   戻る・進むで何度も数えると、流れが読めなくなる。
 *
 * ★ 送れなくても、読む邪魔はしない。
 * ============================================================
 */

"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** 住所から、頁の種類と作品・話を読み取る */
function readPath(path: string): {
    kind: string;
    novelId?: string;
    episodeId?: string;
} {
    if (path === "/") return { kind: "home" };
    if (path.startsWith("/search")) return { kind: "search" };
    if (path.startsWith("/ranking")) return { kind: "ranking" };
    if (path.startsWith("/login") || path.startsWith("/welcome")) {
        return { kind: "signup" };
    }

    const parts = path.split("/").filter(Boolean);

    if (parts[0] === "novel" && parts[1]) {
        if (parts[2] === "episode" && parts[3]) {
            return { kind: "episode", novelId: parts[1], episodeId: parts[3] };
        }
        return { kind: "novel", novelId: parts[1] };
    }

    return { kind: "other" };
}

export default function VisitPing() {
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname) return;

        /*
         * 同じ頁は 1 回だけ。
         * 覚えは今回の訪問ぶんだけなので、窓を閉じれば消える。
         */
        const key = `gk-seen:${pathname}`;

        try {
            if (window.sessionStorage.getItem(key)) return;
            window.sessionStorage.setItem(key, "1");
        } catch {
            /* 覚えられない人。毎回数えることになるが、止めはしない */
        }

        const { kind, novelId, episodeId } = readPath(pathname);

        void fetch("/api/visit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, novelId, episodeId }),
            keepalive: true,
        }).catch(() => {});
    }, [pathname]);

    return null;
}
