"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * LoginStampButton — ログインスタンプの入り口
 *
 *   マイページに小さな札で置く（いま何個たまったか）。
 *   押すと小窓でスタンプカードが開く。
 *
 * ★ カードそのものは小窓の中だけ。ページには大きく出さない。
 * ============================================================
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { CARD_CELLS, GOLD_INK, inkOf, motifOf, type LoginCardState } from "@/lib/login-card";
import { InkDefs, Seal } from "@/components/points/login-seal";
import LoginCard, { LOGIN_STAMP_EVENT } from "@/components/mypage/login-card";

export default function LoginStampButton() {
    const [state, setState] = useState<LoginCardState | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        let alive = true;
        let stamped = false;
        void (async () => {
            try {
                const response = await fetch("/api/points/daily");
                if (!response.ok) return;
                const data = (await response.json()) as { state?: LoginCardState };
                if (alive && !stamped && data.state) setState(data.state);
            } catch {
                /* 読めなくても、ほかは出す */
            }
        })();
        const onStamp = (event: Event) => {
            const next = (event as CustomEvent<LoginCardState>).detail;
            if (next) {
                stamped = true;
                setState(next);
            }
        };
        window.addEventListener(LOGIN_STAMP_EVENT, onStamp);
        return () => {
            alive = false;
            window.removeEventListener(LOGIN_STAMP_EVENT, onStamp);
        };
    }, []);

    /* Esc で閉じる */
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen]);

    /* 古い形（カレンダーにする前）の返事なら、出さない */
    if (!state || !Array.isArray(state.cells)) return null;

    /* いちばん新しく押したマス（まだ無ければ 1 マス目をうすく） */
    let lastIndex = -1;
    state.cells.forEach((c, i) => {
        if (c.stamped) lastIndex = i;
    });
    const last = lastIndex >= 0 ? lastIndex + 1 : 1;
    const ink = lastIndex >= 0 && state.cells[lastIndex].gold ? GOLD_INK : inkOf(state.book);

    return (
        <>
            <button type="button" className="lsb" onClick={() => setIsOpen(true)} aria-haspopup="dialog">
                <InkDefs />
                <span className="lsb-seal">
                    <Seal motif={motifOf(last)} day={last} color={ink} ghost={lastIndex < 0} />
                </span>
                <span className="lsb-t">
                    <b>ログインスタンプ</b>
                    <small>
                        {state.todayDone ? "今日のスタンプ済み" : "今日はまだ"}
                        {state.streak > 0 ? `　連続 ${state.streak} 日` : ""}
                    </small>
                </span>
                <span className="lsb-n">
                    <strong>{state.filled}</strong>/{CARD_CELLS}
                </span>
            </button>

            {isOpen && createPortal(
                <div className="lpop-dim" onClick={() => setIsOpen(false)}>
                    <div
                        className="lsb-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label="ログインスタンプ"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <LoginCard initial={state} />
                        <button type="button" className="lpop-close" onClick={() => setIsOpen(false)}>
                            とじる
                        </button>
                    </div>
                </div>,
                /* ★ 体の直下に出す。祖先に transform 等があると、画面いっぱいに広がらないため */
                document.body,
            )}
        </>
    );
}
