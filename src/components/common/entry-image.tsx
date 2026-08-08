/**
 * ============================================================
 * 原石航路 Studio
 * EntryImage — 資料の画像
 *
 * image_url が「idb:」で始まるときは IndexedDB から引き出す。
 * 画像そのものを持っている場合はそのまま出す。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

import { getImage } from "@/lib/storage/image-store";

interface Props {
    /** 目印か、画像そのもの */
    src: string | null;
    alt?: string;
    className?: string;
    /** 画像が無いときに出す文字 */
    fallback?: string;
}

export default function EntryImage({ src, alt = "", className, fallback }: Props) {
    const [resolved, setResolved] = useState<string | null>(null);

    useEffect(() => {
        let isAlive = true;
        if (!src) {
            setResolved(null);
            return;
        }

        void (async () => {
            const value = await getImage(src);
            if (isAlive) setResolved(value);
        })();

        return () => {
            isAlive = false;
        };
    }, [src]);

    if (!resolved) {
        /*
         * 絵がまだ無いとき。
         *
         * 灰色一色にすると、並んだときに見分けがつかない。
         * 名前から色を決めれば、同じ人はいつも同じ色になり、
         * 一覧の中で目印になる。
         */
        const tone = toneOf(fallback ?? alt);

        return (
            <span
                className={[
                    className,
                    "flex items-center justify-center text-base font-medium",
                ].join(" ")}
                style={{ background: tone.background, color: tone.color }}
            >
                {fallback ?? ""}
            </span>
        );
    }

    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resolved} alt={alt} className={className} />;
}

/**
 * 名前から色を決める。
 *
 * 淡い地に、少し濃い文字。
 * 派手にすると一覧が賑やかになりすぎる。
 */
function toneOf(seed: string): { background: string; color: string } {
    const TONES = [
        { background: "#e7eff6", color: "#2f5f80" }, // 青
        { background: "#e8f1ea", color: "#3d6b4c" }, // 緑
        { background: "#f3edf6", color: "#63508a" }, // 紫
        { background: "#f6f1e8", color: "#7a6440" }, // 金茶
        { background: "#fbeceb", color: "#8a5350" }, // 赤茶
        { background: "#e9f2f4", color: "#356b73" }, // 青緑
        { background: "#f2eff7", color: "#5b5192" }, // 藤
        { background: "#f7f0e6", color: "#7d6234" }, // 砂
    ];

    if (!seed) return TONES[0];

    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }

    return TONES[Math.abs(hash) % TONES.length];
}
