"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * MissionClearPopup — ミッションをクリアしたときの知らせ（紙吹雪つき）
 *
 *   紙吹雪が降る → 下に「ミッションクリア！」とミッション名・もらったポイントの帯
 *
 * ★ 押して閉じる小窓をやめた。
 *   クリアを押すたびに「とじる」も押すことになり、手間が倍になっていた。
 *   帯は画面を塞がず、押せない（下のボタンをそのまま続けて押せる）。
 *   SHOW_MS たつと自分で消える。続けてクリアしたら、新しいほうに入れ替わる。
 *
 * ★ 体の直下に出す（祖先の枠に縛られず、画面いっぱいに出すため）。
 * ★ 動きを減らす設定の人には、紙吹雪を出さない。
 * ============================================================
 */

import { useEffect, useMemo, useState } from "react";

/** 帯を出しておく時間（下の「出さなくていい」を押す間があるように少し長め） */
const SHOW_MS = 3600;

/** 「出さなくていい」を選んだ印（この端末だけ） */
const OFF_KEY = "gk-mission-toast-off";

/** 帯を出さない設定になっているか */
export function missionToastOff(): boolean {
    try {
        return window.localStorage.getItem(OFF_KEY) === "1";
    } catch {
        return false;
    }
}
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

    const [off, setOff] = useState(false);

    function turnOff() {
        try {
            window.localStorage.setItem(OFF_KEY, "1");
        } catch {
            /* 覚えられない端末でも、今は閉じる */
        }
        setOff(true);
        window.setTimeout(onClose, 900);
    }

    /* 時間がたったら自分で消える */
    useEffect(() => {
        const timer = window.setTimeout(onClose, SHOW_MS);
        return () => window.clearTimeout(timer);
    }, [onClose]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="mcl-layer" aria-live="polite">
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
            <div className="mcl-toast" role="status" style={{ animationDuration: `${SHOW_MS}ms` }}>
                <span className="mcl-badge" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </span>
                <span className="mcl-t">
                    <b>ミッションクリア！</b>
                    <small>{label}</small>
                </span>
                {earned > 0 && (
                    <span className="mcl-pt">
                        <span className="mcl-coin">P</span>+{earned}
                    </span>
                )}
            </div>
            {/* ★ この端末では次から出さない。押せるのはここだけ（帯の他は押せない） */}
            <button
                type="button"
                className={`mcl-off${off ? " is-on" : ""}`}
                style={{ animationDuration: `${SHOW_MS}ms` }}
                onClick={turnOff}
                disabled={off}
            >
                <span className="mcl-off-ring" aria-hidden="true">
                    {off && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    )}
                </span>
                {off ? "次から出しません" : "出さなくていい"}
            </button>
        </div>,
        document.body,
    );
}
