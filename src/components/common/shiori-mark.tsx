/**
 * ============================================================
 * 原石航路 Studio
 * ShioriMark — 栞の絵
 *
 * ★ 1 か所にまとめる。
 *
 *   栞は 4 か所に出る。
 *     パソコンの縦書き / 横書き
 *     携帯の縦書き / 横書き
 *
 *   それぞれに絵を書くと、直すとき片方だけ古くなる。
 *   実際、これまで出す所を見落として何度も直した。
 * ============================================================
 */

/** 選べる色 */
export const SHIORI_COLORS = {
    yellow: { label: "山吹", paper: "#f8e08e", line: "#8a5a25", leaf: "#e0714b" },
    sakura: { label: "桜", paper: "#f7d3d8", line: "#8a3f4d", leaf: "#d9576b" },
    wakaba: { label: "若草", paper: "#d6e8b0", line: "#4e6b2c", leaf: "#7aa53f" },
    sora: { label: "空", paper: "#cfe2f3", line: "#2f5878", leaf: "#4f8fc0" },
    fuji: { label: "藤", paper: "#ded3ef", line: "#54417a", leaf: "#8d72c4" },
} as const;

export type ShioriColor = keyof typeof SHIORI_COLORS;

export default function ShioriMark({
    color = "yellow",
    size = 22,
}: {
    color?: string;
    size?: number;
}) {
    const c =
        SHIORI_COLORS[(color as ShioriColor) in SHIORI_COLORS ? (color as ShioriColor) : "yellow"];

    return (
        <svg
            width={size}
            height={size * 1.4}
            viewBox="0 0 40 56"
            fill="none"
            style={{
                display: "block",
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,.2))",
            }}
        >
            {/*
              * 房（ふさ）。
              * 上から垂れる糸束。これがあると栞に見える。
              */}
            <path
                d="M27 3l4 2-1 4 3-1 1 4-4 2-5-6z"
                fill={c.leaf}
                stroke={c.line}
                strokeWidth="2"
                strokeLinejoin="round"
            />
            <path
                d="M26 4l1 9"
                stroke={c.line}
                strokeWidth="2"
                strokeLinecap="round"
            />

            {/* 札。少し傾けて手作りらしく */}
            <rect
                x="7"
                y="12"
                width="24"
                height="40"
                rx="1.5"
                transform="rotate(-6 19 32)"
                fill={c.paper}
                stroke={c.line}
                strokeWidth="2.4"
            />

            {/* 糸を通す穴 */}
            <circle
                cx="25"
                cy="16"
                r="2.2"
                fill="none"
                stroke={c.line}
                strokeWidth="2"
            />

            {/*
              * 葉。
              * 5 枚に切れた形。細かく描いても小さくて潰れるので、
              * 輪郭だけ残す。
              */}
            <path
                d="M17 34l-1.5 5-4.5-1 3 4-4 2 5 1-1 4 4-2.5 1 4.5 1.5-4.5 4 2.5-1-4 5-1-4-2 3-4-4.5 1z"
                transform="translate(1 2) rotate(-6 18 40)"
                fill={c.leaf}
                stroke={c.line}
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
        </svg>
    );
}
