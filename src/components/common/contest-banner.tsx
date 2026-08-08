/**
 * ============================================================
 * 原石航路 Studio
 * ContestBanner — コンテストの画像
 *
 * 横長（16:9）で出す。カードの上に敷く帯。
 * 元の絵をそのまま入れると狙った所が切れるので、
 * 切り取り方を運営側で決められるようにする。
 *
 * 画像そのものは IndexedDB にあり、ここには目印しか無い。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

import { getImage } from "@/lib/storage/image-store";
import type { Contest } from "@/types";

interface Props {
    contest: Pick<Contest, "banner_url" | "banner_fit" | "banner_x" | "banner_y" | "banner_zoom">;
    className?: string;
    /** 画像が無いときに出す文字 */
    fallback?: string;
}

export default function ContestBanner({ contest, className, fallback }: Props) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        let isAlive = true;
        if (!contest.banner_url) {
            setSrc(null);
            return;
        }
        void (async () => {
            const value = await getImage(contest.banner_url as string);
            if (isAlive) setSrc(value);
        })();
        return () => {
            isAlive = false;
        };
    }, [contest.banner_url]);

    if (!src) {
        return (
            <span
                className={[
                    className,
                    "flex items-center justify-center bg-canvas text-[11px] text-faint",
                ].join(" ")}
            >
                {fallback ?? ""}
            </span>
        );
    }

    return (
        <span
            className={[className, "block overflow-hidden bg-canvas"].join(" ")}
            style={{
                backgroundImage: `url(${src})`,
                /*
                 * cover は枠いっぱいに広げて切る。
                 * contain は全体を見せ、余りを地色で埋める。
                 */
                backgroundSize:
                    contest.banner_fit === "contain"
                        ? "contain"
                        : `${contest.banner_zoom}% auto`,
                backgroundPosition: `${contest.banner_x}% ${contest.banner_y}%`,
                backgroundRepeat: "no-repeat",
            }}
        />
    );
}
