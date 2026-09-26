"use client";

import { useEffect, useState } from "react";

/**
 * ============================================================
 * 原石航路 Studio
 * 会員だけが使えるものを、画面から聞く
 *
 * ★ 決めるのはサーバー。ここは聞くだけ。
 *
 *   上から「使ってよい」と渡せる口は作らない。
 *   渡せるようにすると、どの画面からでも入れてしまえる。
 *
 * ★ 一度だけ聞く。
 *
 *   関係図と右の欄が、それぞれ聞いていた。
 *   同じ画面で同じことを二度聞かないよう、答えを取っておく。
 *
 * ★ 答えが返るまでと、聞けなかったときは、無料の見た目。
 *   困るのは、入っていない人に出てしまうほう。
 * ============================================================
 */

export interface MemberFeatures {
    graphGroup: boolean;
    entryReport: boolean;
    noAds: boolean;
    aiCheck: boolean;
    versionKeep: number;
    operator: boolean;
}

const NONE: MemberFeatures = {
    graphGroup: false,
    entryReport: false,
    noAds: false,
    aiCheck: false,
    versionKeep: 30,
    operator: false,
};

let asking: Promise<MemberFeatures> | null = null;

function ask(): Promise<MemberFeatures> {
    if (!asking) {
        asking = fetch("/api/member/features")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => ({
                graphGroup: data?.graphGroup === true,
                entryReport: data?.entryReport === true,
                noAds: data?.noAds === true,
                aiCheck: data?.aiCheck === true,
                versionKeep:
                    typeof data?.versionKeep === "number" && data.versionKeep > 0
                        ? data.versionKeep
                        : 30,
                operator: data?.operator === true,
            }))
            .catch(() => {
                /* 聞けなかったら、次に開いたときにもう一度聞く */
                asking = null;
                return NONE;
            });
    }

    return asking;
}

export function useMemberFeatures(): MemberFeatures {
    const [features, setFeatures] = useState<MemberFeatures>(NONE);

    useEffect(() => {
        let alive = true;

        void ask().then((answer) => {
            if (alive) setFeatures(answer);
        });

        return () => {
            alive = false;
        };
    }, []);

    return features;
}
