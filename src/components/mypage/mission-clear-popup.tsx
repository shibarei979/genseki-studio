"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * MissionClearPopup — ミッションをクリアしたときの小窓（紙吹雪つき）
 *
 *   紙吹雪が降る → 真ん中に「ミッションクリア！」とミッション名 → もらったポイント
 *
 * ★ 体の直下に出す（祖先の枠に縛られず、画面いっぱいに出すため）。
 * ★ 動きを減らす設定の人には、紙吹雪を出さない。
 * ============================================================
 */

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

const COLORS = ["#e9b949", "#1f4e6b", "#4a7fa5", "#e25b45", "#35a45d", "#f3d27a", "#c6b0f2"];

export default function MissionClearPopup({
    label,
    earned,
    onClose,
}: {
    label: string;
    earned: number;
    onClose: () => void;
}) {
    /* 紙吹雪 1 枚ずつの位置・色・速さ（開くたびに少し違う） */
    const pieces = useMemo(
        () =>
            Array.from({ length: 46 }, (_, i) => ({
                left: Math.random() * 100,
                delay: Math.random() * 0.5,
                duration: 1.8 + Math.random() * 1.4,
                drift: (Math.random() - 0.5) * 140,
                spin: 360 + Math.random() * 540,
                color: COLORS[i % COLORS.length],
                w: 6 + Math.random() * 6,
                h: 9 + Math.random() * 8,
                round: i % 5 === 0,
            })),
        [],
    );

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="mcl-dim" onClick={onClose}>
            <div className="mcl-confetti" aria-hidden="true">
                {pieces.map((one, i) => (
                    <i
                        key={i}
                        style={
                            {
                                left: `${one.left}%`,
                                width: one.w,
                                height: one.round ? one.w : one.h,
                                borderRadius: one.round ? "50%" : 2,
                                background: one.color,
                                animationDelay: `${one.delay}s`,
                                animationDuration: `${one.duration}s`,
                                "--dx": `${one.drift}px`,
                                "--spin": `${one.spin}deg`,
                            } as React.CSSProperties
                        }
                    />
                ))}
            </div>
            <div
                className="mcl"
                role="dialog"
                aria-modal="true"
                aria-label="ミッションクリア"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mcl-badge" aria-hidden="true">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </div>
                <h3>ミッションクリア！</h3>
                <p className="mcl-name">{label}</p>
                {earned > 0 && (
                    <p className="mcl-pt">
                        <span className="mcl-coin">P</span>+{earned}
                        <small>無料ポイント</small>
                    </p>
                )}
                <button type="button" className="mcl-close" onClick={onClose}>
                    とじる
                </button>
            </div>
        </div>,
        document.body,
    );
}
