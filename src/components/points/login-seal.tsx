/**
 * ============================================================
 * 原石航路 Studio
 * 乗船印帳のハンコの絵
 *
 *   Seal        丸いハンコ（柄・日付）
 *   SquareSeal  四角いハンコ（「宝」「満」）
 *   InkDefs     インクのかすれ（1 画面に 1 つ置く）
 *   HankoTool   押す道具（木の持ち手）
 *
 * ★ 絵は全部ここで描く（画像ファイルは使わない）。
 * ============================================================
 */

import type { Motif } from "@/lib/login-card";

/** インクのかすれ。同じ id が 2 つあっても中身は同じなので困らない */
export function InkDefs() {
    return (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
            <defs>
                <filter id="gk-ink" x="-10%" y="-10%" width="120%" height="120%">
                    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={3} result="n" />
                    <feDisplacementMap in="SourceGraphic" in2="n" scale={2.2} result="d" />
                    <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves={1} seed={8} result="s" />
                    <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.75" result="m" />
                    <feComposite in="d" in2="m" operator="in" />
                </filter>
            </defs>
        </svg>
    );
}

/** 柄（-16〜16 の中に描く） */
function MotifArt({ motif }: { motif: Motif }) {
    switch (motif) {
        case "anchor":
            return (
                <>
                    <circle cx="0" cy="-10" r="3.2" fill="none" strokeWidth="2.4" />
                    <path d="M0 -6.8V11M-7 -3H7M-11 3q3 9 11 9q8 0 11 -9" fill="none" strokeWidth="2.6" strokeLinecap="round" />
                    <path d="M-13 1l2 4 3-3zM13 1l-2 4-3-3z" strokeWidth="1" />
                </>
            );
        case "ship":
            return (
                <>
                    <path d="M0 -13V6" strokeWidth="2" />
                    <path d="M1.5 -12L11 3H1.5zM-1.5 -8L-9 3H-1.5z" />
                    <path d="M-13 6H13L9 12H-9z" />
                </>
            );
        case "light":
            return (
                <>
                    <path d="M-5 12L-3 -6H3L5 12z" />
                    <rect x="-4.5" y="-12" width="9" height="5" rx="1" />
                    <path d="M-6 -12L0 -16L6 -12z" />
                    <path d="M-13 -11L-7 -9.5M13 -11L7 -9.5M-13 -7L-7 -8M13 -7L7 -8" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M-13 13H13" strokeWidth="2.4" />
                </>
            );
        case "gem":
            return (
                <>
                    <path d="M-7 -10H7L13 -3L0 13L-13 -3z" fill="none" strokeWidth="2.4" strokeLinejoin="round" />
                    <path d="M-13 -3H13M-7 -10L-4 -3L0 13L4 -3L7 -10" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
                </>
            );
        case "compass":
            return (
                <>
                    <circle r="13" fill="none" strokeWidth="1.8" />
                    <path d="M0 -12L3 -3L12 0L3 3L0 12L-3 3L-12 0L-3 -3z" />
                    <circle r="2" fill="#fff" stroke="none" />
                </>
            );
        case "wave":
            return (
                <path
                    d="M-13 -6q3.2-5 6.5 0t6.5 0t6.5 0t6.5 0M-13 1q3.2-5 6.5 0t6.5 0t6.5 0t6.5 0M-13 8q3.2-5 6.5 0t6.5 0t6.5 0t6.5 0"
                    fill="none"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                />
            );
        case "star":
            return (
                <>
                    <path d="M-3 -12a11 11 0 1 0 12 16a9 9 0 1 1 -12 -16z" />
                    <path d="M7 -12l1.6 3.4 3.6.4-2.7 2.4.8 3.6L7 -4l-3.3 1.8.8-3.6L1.8 -8.2l3.6-.4z" />
                </>
            );
    }
}

/** 丸いハンコ */
export function Seal({
    motif,
    day,
    color,
    tilt = 0,
    ghost = false,
    className,
}: {
    motif: Motif;
    day: number;
    color: string;
    tilt?: number;
    /** うっすら（明日の印） */
    ghost?: boolean;
    className?: string;
}) {
    return (
        <svg className={className} viewBox="-32 -32 64 64" aria-hidden="true">
            <g
                filter={ghost ? undefined : "url(#gk-ink)"}
                transform={`rotate(${tilt})`}
                fill={color}
                stroke={color}
                opacity={ghost ? 0.2 : 0.92}
            >
                <circle r="28" fill="none" strokeWidth="3.2" />
                <circle r="24.5" fill="none" strokeWidth="1" />
                <g transform="translate(0,-3) scale(.95)">
                    <MotifArt motif={motif} />
                </g>
                <text y="21" textAnchor="middle" fontSize="7.5" fontWeight="900" stroke="none" fontFamily="serif">
                    {day}
                </text>
            </g>
        </svg>
    );
}

/** 四角いハンコ（「宝」「満」） */
export function SquareSeal({ text, color, tilt = -4, className }: { text: string; color: string; tilt?: number; className?: string }) {
    return (
        <svg className={className} viewBox="-40 -40 80 80" aria-hidden="true">
            <g filter="url(#gk-ink)" transform={`rotate(${tilt})`} fill={color} stroke={color} opacity={0.92}>
                <rect x="-30" y="-30" width="60" height="60" rx="4" fill="none" strokeWidth="3.6" />
                <rect x="-25.5" y="-25.5" width="51" height="51" rx="2" fill="none" strokeWidth="1.1" />
                <text y="14" textAnchor="middle" fontSize="40" fontWeight="900" stroke="none" fontFamily="serif">
                    {text}
                </text>
            </g>
        </svg>
    );
}

/** 押す道具（木の持ち手と、朱の面） */
export function HankoTool({ color }: { color: string }) {
    return (
        <svg viewBox="0 0 130 180" width="130" height="180" aria-hidden="true">
            <defs>
                <linearGradient id="gk-wood" x1="0" x2="1">
                    <stop offset="0" stopColor="#6e4020" />
                    <stop offset=".3" stopColor="#c8905a" />
                    <stop offset=".55" stopColor="#a86b35" />
                    <stop offset="1" stopColor="#57310f" />
                </linearGradient>
            </defs>
            <ellipse cx="65" cy="22" rx="20" ry="18" fill="url(#gk-wood)" />
            <rect x="54" y="34" width="22" height="26" fill="url(#gk-wood)" />
            <path d="M34 60 Q65 50 96 60 L110 150 H20z" fill="url(#gk-wood)" />
            <rect x="4" y="148" width="122" height="14" rx="4" fill="#57310f" />
            <rect x="4" y="160" width="122" height="9" rx="3" fill={color} />
            <path d="M42 70 L32 140" stroke="rgba(255,255,255,.28)" strokeWidth="5" strokeLinecap="round" />
        </svg>
    );
}
