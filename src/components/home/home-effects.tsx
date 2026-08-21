"use client";

import { useCallback, useEffect } from "react";
import Script from "next/script";

import type { HomeBook } from "@/types/home";

interface HomePools {
    pickupPool: HomeBook[];
    newReleasePool: HomeBook[];
}

declare global {
    interface Window {
        HomeV2?: {
            init: (data: HomePools) => void;
            teardown: () => void;
        };
    }
}

/**
 * トップページの挙動を起動する。
 *
 * - /home/home.js（デザイン home_10 の挙動スクリプト群）を読み込み、
 *   マウント毎に HomeV2.init / アンマウント時に teardown を呼ぶ
 * - 「更新」ボタン用の候補プール（Pick Up! / New Release!）を
 *   サーバーから受け取り home.js 側の WorksRefresh に渡す
 */
export default function HomeEffects({ pools }: { pools: HomePools }) {
    const boot = useCallback(() => {
        window.HomeV2?.init(pools);
    }, [pools]);

    useEffect(() => {
        boot(); // スクリプト読込済みでの再マウント（クライアント遷移で戻ってきた場合）
        return () => {
            window.HomeV2?.teardown();
        };
    }, [boot]);

    // onReady はスクリプト読込完了時と、読込済みでの再マウント時の両方で発火する
    return <Script src="/home/home.js" strategy="afterInteractive" onReady={boot} />;
}
