/**
 * ============================================================
 * 原石航路 Studio
 * RoomScene — 部屋の絵
 *
 * 上から見た間取り図ではなく、横から見た室内にした。
 * 間取り図は「どこに座るか」は分かるが、
 * そこが居たい場所かどうかが伝わらない。
 *
 * 時刻で光が変わる。朝は白く、夕方は橙、夜は暗く灯りが点く。
 * 開くたびに同じ絵では、通う場所にならない。
 * ============================================================
 */

"use client";

import type { RoomTheme } from "@/types";

/** 時間帯。窓の外と光の色が変わる */
export type TimeOfDay = "morning" | "day" | "evening" | "night";

export function currentTimeOfDay(date = new Date()): TimeOfDay {
    const hour = date.getHours();
    if (hour < 9) return "morning";
    if (hour < 16) return "day";
    if (hour < 19) return "evening";
    return "night";
}

/** 時間帯ごとの色。窓の外・壁・床・灯り */
const PALETTE: Record<
    TimeOfDay,
    { sky: string[]; wall: string; floor: string; light: string; glow: number }
> = {
    morning: {
        sky: ["#dfeaf0", "#f2f0e6"],
        wall: "#f0ece1",
        floor: "#dccdb4",
        light: "#fff8e8",
        glow: 0.15,
    },
    day: {
        sky: ["#cfe0ea", "#eef2ec"],
        wall: "#efeadf",
        floor: "#d8c8ae",
        light: "#fffdf6",
        glow: 0.1,
    },
    evening: {
        sky: ["#e8c9a6", "#f0d9c0"],
        wall: "#e9ddcd",
        floor: "#cbb695",
        light: "#ffe9c4",
        glow: 0.32,
    },
    night: {
        sky: ["#2c3a4a", "#3d4a5a"],
        wall: "#3a3730",
        floor: "#332e27",
        light: "#ffdfa4",
        glow: 0.55,
    },
};

interface Props {
    theme: RoomTheme;
    timeOfDay: TimeOfDay;
}

export default function RoomScene({ theme, timeOfDay }: Props) {
    const palette = PALETTE[timeOfDay];
    const isDark = timeOfDay === "night";

    return (
        <svg
            viewBox="0 0 160 90"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="room-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.sky[0]} />
                    <stop offset="100%" stopColor={palette.sky[1]} />
                </linearGradient>

                {/* 窓から差す光。斜めに伸ばして床に落とす */}
                <linearGradient id="room-beam" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={palette.light} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={palette.light} stopOpacity="0" />
                </linearGradient>

                <radialGradient id="room-lamp">
                    <stop offset="0%" stopColor={palette.light} stopOpacity="0.9" />
                    <stop offset="100%" stopColor={palette.light} stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* 壁と床 */}
            <rect width="160" height="90" fill={palette.wall} />
            <rect y="62" width="160" height="28" fill={palette.floor} />
            <line
                x1="0"
                y1="62"
                x2="160"
                y2="62"
                stroke="#000"
                strokeOpacity="0.08"
                strokeWidth="0.6"
            />

            {/* 床板の目 */}
            {Array.from({ length: 9 }, (_, index) => (
                <line
                    key={index}
                    x1={index * 20 - 10}
                    y1="90"
                    x2={index * 20 + 12}
                    y2="62"
                    stroke="#000"
                    strokeOpacity="0.05"
                    strokeWidth="0.5"
                />
            ))}

            {/* 窓 */}
            <g>
                <rect x="96" y="12" width="52" height="42" rx="1.5" fill="url(#room-sky)" />
                <rect
                    x="96"
                    y="12"
                    width="52"
                    height="42"
                    rx="1.5"
                    fill="none"
                    stroke={isDark ? "#5a5348" : "#b8ac97"}
                    strokeWidth="1.4"
                />
                <line
                    x1="122"
                    y1="12"
                    x2="122"
                    y2="54"
                    stroke={isDark ? "#5a5348" : "#b8ac97"}
                    strokeWidth="1"
                />
                <line
                    x1="96"
                    y1="33"
                    x2="148"
                    y2="33"
                    stroke={isDark ? "#5a5348" : "#b8ac97"}
                    strokeWidth="1"
                />

                {/* 外の景色。夜は星、昼は木 */}
                {isDark ? (
                    <g fill="#fff" opacity="0.7">
                        <circle cx="106" cy="20" r="0.5" />
                        <circle cx="118" cy="26" r="0.4" />
                        <circle cx="132" cy="18" r="0.5" />
                        <circle cx="141" cy="28" r="0.4" />
                        <circle cx="127" cy="42" r="0.35" />
                    </g>
                ) : (
                    <g opacity="0.5">
                        <ellipse cx="108" cy="46" rx="9" ry="7" fill="#9fb894" />
                        <ellipse cx="136" cy="48" rx="7" ry="5.5" fill="#a8bf9c" />
                        <rect x="107" y="48" width="1.6" height="6" fill="#8a7f68" />
                    </g>
                )}

                {/* 差し込む光 */}
                <path d="M96 20 L148 20 L120 62 L56 62 Z" fill="url(#room-beam)" />
            </g>

            {/* 内装。作風で置くものを変える */}
            {theme === "library" && <LibraryProps isDark={isDark} />}
            {theme === "cafe" && <CafeProps isDark={isDark} />}
            {theme === "study" && <StudyProps isDark={isDark} />}

            {/* 灯り */}
            {palette.glow > 0.2 && (
                <>
                    <circle
                        cx="26"
                        cy="44"
                        r="26"
                        fill="url(#room-lamp)"
                        opacity={palette.glow}
                    />
                    <circle
                        cx="72"
                        cy="50"
                        r="20"
                        fill="url(#room-lamp)"
                        opacity={palette.glow * 0.7}
                    />
                </>
            )}

            {/* 全体を少し暗く沈める。人のアイコンを前に出すため */}
            <rect
                width="160"
                height="90"
                fill={isDark ? "#1a2028" : "#ffffff"}
                opacity={isDark ? 0.22 : 0.3}
            />
        </svg>
    );
}

/**
 * ============================================================
 * 内装
 *
 * 家具は背景として置く。細かく描くと人のアイコンが埋もれる。
 * ============================================================
 */

function LibraryProps({ isDark }: { isDark: boolean }) {
    return (
        <g>
            {/* 本棚 */}
            <rect x="4" y="16" width="40" height="46" fill={isDark ? "#453a2f" : "#a5906f"} />
            {[0, 1, 2, 3].map((row) => (
                <g key={row}>
                    <rect
                        x="5"
                        y={18 + row * 11}
                        width="38"
                        height="9.5"
                        fill={isDark ? "#2f281f" : "#8d7a5c"}
                    />
                    {Array.from({ length: 11 }, (_, index) => (
                        <rect
                            key={index}
                            x={6 + index * 3.4}
                            y={19 + row * 11 + (index % 3)}
                            width="2.6"
                            height={8 - (index % 3)}
                            fill={BOOK_COLORS[(row * 11 + index) % BOOK_COLORS.length]}
                            opacity={isDark ? 0.6 : 0.85}
                        />
                    ))}
                </g>
            ))}
            {/* 長机 */}
            <rect x="52" y="56" width="40" height="2.4" rx="0.6" fill={isDark ? "#584a3a" : "#b39a76"} />
            <rect x="55" y="58" width="1.8" height="6" fill={isDark ? "#4a3e30" : "#9c8a68"} />
            <rect x="87" y="58" width="1.8" height="6" fill={isDark ? "#4a3e30" : "#9c8a68"} />
        </g>
    );
}

function CafeProps({ isDark }: { isDark: boolean }) {
    return (
        <g>
            {/* カウンター */}
            <rect x="4" y="40" width="46" height="22" fill={isDark ? "#4a3b30" : "#b09a78"} />
            <rect x="4" y="38" width="46" height="3" rx="0.8" fill={isDark ? "#5c4a3a" : "#c4a883"} />
            {/* 棚のカップ */}
            <rect x="8" y="18" width="38" height="1.6" fill={isDark ? "#463a2e" : "#a89a86"} />
            {Array.from({ length: 6 }, (_, index) => (
                <circle
                    key={index}
                    cx={11 + index * 6.5}
                    cy="15.5"
                    r="2.2"
                    fill={isDark ? "#6b5f52" : "#e6ded0"}
                />
            ))}
            {/* 丸机 */}
            <ellipse cx="72" cy="57" rx="12" ry="3" fill={isDark ? "#57493a" : "#b8a07d"} />
            <rect x="71" y="58" width="2" height="6" fill={isDark ? "#4a3e30" : "#9c8a6a"} />
            {/* 観葉植物 */}
            <path
                d="M154 62 q-5 -12 -1 -20 q4 8 1 20 M154 62 q5 -10 10 -14 q-4 8 -10 14"
                fill="none"
                stroke={isDark ? "#4d6b4a" : "#7d9a72"}
                strokeWidth="1.6"
            />
        </g>
    );
}

function StudyProps({ isDark }: { isDark: boolean }) {
    return (
        <g>
            {/* 書き物机 */}
            <rect x="10" y="46" width="44" height="2.6" rx="0.6" fill={isDark ? "#5a4a38" : "#b5966d"} />
            <rect x="13" y="48" width="2" height="14" fill={isDark ? "#4a3d2e" : "#9a7f5c"} />
            <rect x="49" y="48" width="2" height="14" fill={isDark ? "#4a3d2e" : "#9a7f5c"} />
            {/* 卓上ランプ */}
            <rect x="17" y="40" width="1.2" height="6" fill={isDark ? "#6b6055" : "#8a8074"} />
            <path d="M14 40 l4.5 -5 l4.5 5 Z" fill={isDark ? "#7d6a4a" : "#a89a86"} />
            {/* 積んだ本 */}
            <rect x="38" y="42" width="10" height="1.6" fill="#8d6f57" />
            <rect x="39" y="40.4" width="8.5" height="1.6" fill="#6f7d8d" />
            <rect x="38.5" y="38.8" width="9.5" height="1.6" fill="#7d8d6f" />
            {/* 額縁 */}
            <rect
                x="66"
                y="20"
                width="18"
                height="14"
                rx="0.6"
                fill="none"
                stroke={isDark ? "#5a5045" : "#a8988a"}
                strokeWidth="1.4"
            />
            <path d="M68 32 l5 -7 l4 5 l3 -3 l2 5 Z" fill={isDark ? "#4d5a4a" : "#a8b89c"} />
        </g>
    );
}

const BOOK_COLORS = [
    "#8d6f57", "#6f7d8d", "#7d8d6f", "#8d6f6f", "#6f8d85", "#856f8d",
];
