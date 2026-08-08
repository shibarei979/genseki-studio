/**
 * ============================================================
 * 原石航路 Studio
 * AvatarSprite — 人の姿
 *
 * 小さくても人だと分かる形にする。
 * 見分けがつくのは、輪郭・髪・服の色。
 * 顔の作り込みは、この大きさでは効かない。
 *
 * 服の色は本人が選ぶ（テーマカラー）。同じ部屋では被らない。
 * 遠目に人を見分けるとき、いちばん効くのが服の色だから、
 * そこだけは持ち主が決められるようにしてある。
 *
 * 髪型・髪の色・肌は名前から決まる。
 * 同じ名前なら必ず同じ姿になるので、色が変わっても同じ人だと分かる。
 * ============================================================
 */

"use client";

import { colorOf } from "@/lib/room/avatar-colors";
import type { Headwear } from "@/lib/room/avatar-colors";

const HAIR = [
    "#33323a", "#4a3728", "#7a5a3a", "#a89a92",
    "#5f4a70", "#7a3f42", "#3f5266", "#4f6046",
];

const SKIN = ["#d7e3ec", "#c5d8e4", "#d9b189", "#c49a72"];

/** 髪型。前髪の形と長さで分ける */
type HairStyle = "short" | "bob" | "long" | "tied" | "wavy" | "bun";
const STYLES: HairStyle[] = ["short", "bob", "long", "tied", "wavy", "bun"];

interface Props {
    seed: string;
    size?: number;
    isWriting?: boolean;
    /** テーマカラーの番号。渡さなければ名前から決める */
    colorId?: number;
    /** 歩いている最中か。足と腕が交互に動く */
    isWalking?: boolean;
}

export default function AvatarSprite({
    seed,
    size = 34,
    isWriting = false,
    colorId,
    isWalking = false,
}: Props) {
    const hash = hashOf(seed);
    const theme = colorOf(colorId ?? hash);
    const hair = HAIR[hash % HAIR.length];
    const cloth = theme.base;
    const skin = SKIN[(hash >> 6) % SKIN.length];

    /*
     * 被り物。
     * 色を選んでいない人（一覧の見本など）は髪のまま出す。
     */
    const headwear: Headwear = colorId === undefined ? "bare" : theme.headwear;
    const style = STYLES[(hash >> 9) % STYLES.length];

    const hairDark = shade(hair, -22);
    const hairLight = shade(hair, 26);
    const clothDark = shade(cloth, -20);
    const clothLight = shade(cloth, 16);

    return (
        <svg
            width={size}
            height={size * 1.45}
            viewBox="0 0 20 29"
            shapeRendering="crispEdges"
            className={[
                "pointer-events-none block",
                isWalking ? "avatar-walking" : "",
            ].join(" ")}
            aria-hidden="true"
        >
            {/* 影 */}
            <ellipse cx="10" cy="27.6" rx="5.4" ry="1.4" fill="#000" opacity="0.24" />

            {/* ---- 体 ---- */}
            {/* 足。歩くときは交互に上がる */}
            <g className="avatar-step-a">
                <rect x="7" y="24" width="2.6" height="3.4" fill="#3a352e" />
                <rect x="7" y="26.6" width="2.6" height="0.8" fill="#524a3f" />
            </g>
            <g className="avatar-step-b">
                <rect x="10.4" y="24" width="2.6" height="3.4" fill="#2f2b25" />
                <rect x="10.4" y="26.6" width="2.6" height="0.8" fill="#463f36" />
            </g>

            {/* 胴 */}
            <rect x="5.6" y="15" width="8.8" height="9.4" rx="0.6" fill={cloth} />
            {/* 肩の照り */}
            <rect x="5.6" y="15" width="8.8" height="1.4" fill={clothLight} />
            {/* 裾の陰 */}
            <rect x="5.6" y="22.6" width="8.8" height="1.8" fill={clothDark} />
            {/* 前立て */}
            <rect x="9.6" y="16.4" width="0.8" height="6.2" fill={clothDark} opacity="0.7" />

            {/*
             * 腕。足と逆の位相で振る。
             * 同じ側の手足が同時に出ると、歩きではなく行進に見える。
             */}
            <g className="avatar-step-b">
                <rect x="3.8" y="15.8" width="2" height="6.4" rx="0.8" fill={clothDark} />
                <rect x="3.8" y="21.6" width="2" height="1.8" rx="0.8" fill={skin} />
            </g>
            <g className="avatar-step-a">
                <rect x="14.2" y="15.8" width="2" height="6.4" rx="0.8" fill={clothDark} />
                <rect x="14.2" y="21.6" width="2" height="1.8" rx="0.8" fill={skin} />
            </g>

            {/* 襟 */}
            <rect x="7.6" y="14.6" width="4.8" height="1.4" fill={clothLight} />

            {/* ---- 頭。書いているときは少し下げる ---- */}
            <g
                className="avatar-bob"
                transform={isWriting ? "translate(0 0.8)" : ""}
            >
                {/* 首 */}
                <rect x="8.8" y="13.2" width="2.4" height="1.8" fill={shade(skin, -22)} />

                {/* 顔 */}
                <rect x="5.8" y="5.6" width="8.4" height="8.4" rx="1.6" fill={skin} />
                {/* 頬の陰 */}
                <rect x="5.8" y="12" width="8.4" height="2" fill={shade(skin, -12)} opacity="0.5" />

                {/* 髪、または被り物 */}
                {headwear === "bare" ? (
                    <HairShape
                        style={style}
                        hair={hair}
                        dark={hairDark}
                        light={hairLight}
                    />
                ) : (
                    <HeadwearShape
                        kind={headwear}
                        cloth={cloth}
                        hair={hair}
                        dark={clothDark}
                        light={clothLight}
                    />
                )}

                {/* 目 */}
                {isWriting ? (
                    <>
                        <rect x="7.4" y="10" width="1.8" height="0.8" fill="#3a3630" />
                        <rect x="10.8" y="10" width="1.8" height="0.8" fill="#3a3630" />
                    </>
                ) : (
                    <>
                        <rect x="7.4" y="9.4" width="1.8" height="2" rx="0.4" fill="#3a3630" />
                        <rect x="10.8" y="9.4" width="1.8" height="2" rx="0.4" fill="#3a3630" />
                        {/* 光 */}
                        <rect x="7.8" y="9.8" width="0.7" height="0.7" fill="#fff" opacity="0.85" />
                        <rect x="11.2" y="9.8" width="0.7" height="0.7" fill="#fff" opacity="0.85" />
                    </>
                )}

                {/* 口 */}
                <rect x="9.4" y="12" width="1.2" height="0.6" rx="0.3" fill={shade(skin, -46)} opacity="0.7" />
            </g>
        </svg>
    );
}

/**
 * 被り物。
 *
 * 服と同じ色にして、上着の一部に見えるようにする。
 * 髪とは別の色を使うと、頭だけ切り離されて見える。
 *
 * 髪は少しだけ覗かせる。
 * 完全に隠すと、どの被り物も同じ丸い頭になる。
 */
function HeadwearShape({
    kind,
    cloth,
    hair,
    dark,
    light,
}: {
    kind: Exclude<Headwear, "bare">;
    cloth: string;
    hair: string;
    dark: string;
    light: string;
}) {
    if (kind === "beanie") {
        return (
            <g>
                {/* 横から覗く髪 */}
                <rect x="5.4" y="7.6" width="1.6" height="2.2" fill={hair} />
                <rect x="13" y="7.6" width="1.6" height="2.2" fill={hair} />
                {/* 帽子本体 */}
                <rect x="5.4" y="3.2" width="9.2" height="4.6" rx="2.2" fill={cloth} />
                {/* 折り返し */}
                <rect x="5.2" y="6.6" width="9.6" height="1.8" rx="0.6" fill={light} />
                <rect x="5.2" y="7.8" width="9.6" height="0.6" fill={dark} opacity="0.5" />
                {/* 玉 */}
                <circle cx="10" cy="2.4" r="1.2" fill={light} />
            </g>
        );
    }

    if (kind === "cap") {
        return (
            <g>
                <rect x="5.4" y="7.4" width="1.6" height="2.2" fill={hair} />
                <rect x="13" y="7.4" width="1.6" height="2.2" fill={hair} />
                {/* 山 */}
                <rect x="5.4" y="3.4" width="9.2" height="4.2" rx="2" fill={cloth} />
                <rect x="6.6" y="4" width="4.2" height="0.9" rx="0.4" fill={light} opacity="0.6" />
                {/* つば。前へ長く出す */}
                <rect x="4.6" y="7.4" width="10.8" height="1.3" rx="0.6" fill={dark} />
            </g>
        );
    }

    /* hood */
    return (
        <g>
            {/* 頭を包む形。顔だけ開ける */}
            <rect x="4.2" y="3" width="11.6" height="11.4" rx="3.4" fill={cloth} />
            <rect x="6" y="5.4" width="8" height="8.6" rx="1.6" fill="none" />
            {/* 内側の陰 */}
            <rect x="5.4" y="4.6" width="9.2" height="1.6" rx="0.8" fill={dark} opacity="0.55" />
            {/* 肩へ落ちる布 */}
            <rect x="4.2" y="12" width="2" height="3.4" rx="0.8" fill={dark} />
            <rect x="13.8" y="12" width="2" height="3.4" rx="0.8" fill={dark} />
            {/* 覗く前髪 */}
            <rect x="6.6" y="5.6" width="6.8" height="1.4" fill={hair} />
            {/* 顔の面を出す */}
            <rect x="6" y="7" width="8" height="6.6" rx="1.4" fill="none" />
        </g>
    );
}

/**
 * 髪型。
 * 顔の輪郭に被せる形を変えるだけで、遠目にも見分けがつく。
 */
function HairShape({
    style,
    hair,
    dark,
    light,
}: {
    style: HairStyle;
    hair: string;
    dark: string;
    light: string;
}) {
    /** どの髪型でも共通の、頭の上の部分 */
    const crown = (
        <>
            <rect x="5.4" y="3.6" width="9.2" height="4.4" rx="2" fill={hair} />
            {/* 照り */}
            <rect x="6.6" y="4.2" width="4.4" height="1" rx="0.5" fill={light} opacity="0.55" />
        </>
    );

    if (style === "short") {
        return (
            <g>
                {crown}
                <rect x="5.4" y="6.2" width="1.6" height="2.6" fill={hair} />
                <rect x="13" y="6.2" width="1.6" height="2.6" fill={hair} />
                {/* 前髪 */}
                <rect x="6.4" y="6" width="7.2" height="1.8" fill={hair} />
                <rect x="9.6" y="6" width="2.4" height="2.6" fill={dark} />
            </g>
        );
    }

    if (style === "bob") {
        return (
            <g>
                {crown}
                <rect x="4.8" y="6" width="2.2" height="6.6" rx="0.8" fill={hair} />
                <rect x="13" y="6" width="2.2" height="6.6" rx="0.8" fill={hair} />
                <rect x="6.4" y="6" width="7.2" height="2.2" fill={hair} />
                <rect x="6.4" y="7.4" width="7.2" height="0.8" fill={dark} opacity="0.6" />
            </g>
        );
    }

    if (style === "long") {
        return (
            <g>
                {crown}
                <rect x="4.6" y="6" width="2.4" height="12" rx="1" fill={hair} />
                <rect x="13" y="6" width="2.4" height="12" rx="1" fill={hair} />
                <rect x="6.4" y="6" width="7.2" height="2" fill={hair} />
                {/* 毛先 */}
                <rect x="4.6" y="16.6" width="2.4" height="1.4" fill={dark} />
                <rect x="13" y="16.6" width="2.4" height="1.4" fill={dark} />
            </g>
        );
    }

    if (style === "tied") {
        return (
            <g>
                {/* 結んだ束 */}
                <rect x="14.6" y="7" width="2.6" height="7.4" rx="1.2" fill={hair} />
                <rect x="14.6" y="12.8" width="2.6" height="1.6" fill={dark} />
                {crown}
                <rect x="5.4" y="6.2" width="1.6" height="2.6" fill={hair} />
                <rect x="13" y="6.2" width="1.6" height="2.6" fill={hair} />
                <rect x="6.4" y="6" width="7.2" height="1.8" fill={hair} />
                {/* 結び目 */}
                <rect x="13.8" y="6.6" width="1.6" height="1.4" fill={dark} />
            </g>
        );
    }

    if (style === "wavy") {
        return (
            <g>
                {crown}
                <rect x="4.6" y="6" width="2.4" height="4" rx="1" fill={hair} />
                <rect x="13" y="6" width="2.4" height="4" rx="1" fill={hair} />
                {/* 波打つ毛先 */}
                <rect x="3.8" y="9.4" width="2.4" height="4" rx="1.2" fill={hair} />
                <rect x="13.8" y="9.4" width="2.4" height="4" rx="1.2" fill={hair} />
                <rect x="4.6" y="12.6" width="2.4" height="3" rx="1.2" fill={dark} />
                <rect x="13" y="12.6" width="2.4" height="3" rx="1.2" fill={dark} />
                <rect x="6.4" y="6" width="7.2" height="2" fill={hair} />
            </g>
        );
    }

    // bun
    return (
        <g>
            {/* 団子 */}
            <circle cx="10" cy="3" r="2.6" fill={hair} />
            <circle cx="9.2" cy="2.4" r="0.9" fill={light} opacity="0.5" />
            {crown}
            <rect x="5.4" y="6.2" width="1.6" height="2.2" fill={hair} />
            <rect x="13" y="6.2" width="1.6" height="2.2" fill={hair} />
            <rect x="6.4" y="6" width="7.2" height="1.6" fill={hair} />
            {/* 後れ毛 */}
            <rect x="5" y="8" width="1.2" height="3" rx="0.5" fill={dark} />
            <rect x="13.8" y="8" width="1.2" height="3" rx="0.5" fill={dark} />
        </g>
    );
}

function hashOf(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function shade(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const clamp = (n: number) => Math.min(255, Math.max(0, n));
    const r = clamp(((num >> 16) & 255) + amount);
    const g = clamp(((num >> 8) & 255) + amount);
    const b = clamp((num & 255) + amount);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
