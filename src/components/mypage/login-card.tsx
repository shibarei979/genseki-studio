"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * LoginCard — 乗船印帳（マイページのミッション）
 *
 *   7 マス × 4 行。来た日に朱色のハンコ。行の右に「宝」の角印。
 *   明日押される柄がうっすら見える。続いた日数も出す。
 *
 * ★ 押す（ポイントを配る）のは DailyBonus。ここは見せるだけ。
 *   押されたら「gk-login-stamp」の知らせが来るので、読み直す。
 * ============================================================
 */

import { useEffect, useState } from "react";

import {
    CARD_CELLS,
    FULL_BONUS,
    GOLD_INK,
    MOTIF_NAME,
    ROW_BONUS,
    ROW_CELLS,
    inkOf,
    motifOf,
    pointsInBook,
    tiltOf,
    type LoginCardState,
} from "@/lib/login-card";
import { InkDefs, Seal, SquareSeal } from "@/components/points/login-seal";

export const LOGIN_STAMP_EVENT = "gk-login-stamp";

export default function LoginCard({ initial = null }: { initial?: LoginCardState | null } = {}) {
    const [state, setState] = useState<LoginCardState | null>(initial);

    useEffect(() => {
        let alive = true;
        /*
         * ★ その日はじめてマイページを開いたときは、読むのと押すのが同時に走る。
         *   押した知らせ（新しい姿）が先に来たら、あとから届いた古い姿では上書きしない。
         */
        let stamped = false;
        const load = async () => {
            try {
                const response = await fetch("/api/points/daily");
                if (!response.ok) return;
                const data = (await response.json()) as { state?: LoginCardState };
                if (alive && !stamped && data.state) setState(data.state);
            } catch {
                /* 読めなくても、ミッションは出す */
            }
        };
        void load();
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

    if (!state) return null;

    const ink = inkOf(state.book);
    const next = state.filled < CARD_CELLS ? state.filled + 1 : 0;
    const left = CARD_CELLS - state.filled;

    return (
        <section className="lcard" aria-label="ログインスタンプ">
            <InkDefs />
            <header className="lcard-h">
                <b>ログインスタンプ</b>
                <small>{state.book}枚目</small>
                {state.streak > 0 && (
                    <span className="lcard-streak">
                        連続 <strong>{state.streak}</strong> 日
                    </span>
                )}
                <span className="lcard-cnt" style={{ color: ink }}>
                    <strong>{state.filled}</strong> / {CARD_CELLS}
                </span>
            </header>

            <div className="lcard-rows">
                {Array.from({ length: CARD_CELLS / ROW_CELLS }, (_, r) => {
                    const rowDone = state.filled >= (r + 1) * ROW_CELLS;
                    return (
                        <div className="lcard-row" key={r}>
                            {Array.from({ length: ROW_CELLS }, (_, c) => {
                                const n = r * ROW_CELLS + c + 1;
                                const day = state.days[n - 1];
                                const isDone = n <= state.filled;
                                const isToday = isDone && n === state.filled && state.todayDone;
                                const isNext = n === next;
                                return (
                                    <div
                                        key={n}
                                        className={`lcard-cell${isToday ? " is-today" : ""}${isNext ? " is-next" : ""}`}
                                        title={isDone ? `${n}日目　${MOTIF_NAME[motifOf(n)]}のスタンプ` : undefined}
                                    >
                                        <span className="lcard-slot" />
                                        {isDone ? (
                                            <>
                                                <Seal
                                                    className="lcard-seal"
                                                    motif={motifOf(n)}
                                                    day={n}
                                                    color={day?.gold ? GOLD_INK : ink}
                                                    tilt={tiltOf(n)}
                                                />
                                                {day?.gold && <span className="lcard-kin">金</span>}
                                            </>
                                        ) : isNext && state.todayDone ? (
                                            <>
                                                <Seal className="lcard-seal" motif={motifOf(n)} day={n} color={ink} ghost />
                                                <span className="lcard-tag">明日</span>
                                            </>
                                        ) : (
                                            <span className="lcard-n">{n}</span>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="lcard-tre">
                                <span className="lcard-slot" />
                                {rowDone ? (
                                    <SquareSeal className="lcard-seal" text="宝" color={ink} />
                                ) : (
                                    <>
                                        <span className="lcard-tre-t">宝</span>
                                        <span className="lcard-tre-p">+{ROW_BONUS}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <footer className="lcard-f">
                <span>このカードで {pointsInBook(state)} pt</span>
                <span className="lcard-left">
                    {left > 0 ? (
                        <>
                            全部うまるまで あと <b style={{ color: ink }}>{left}</b>　全部で +{FULL_BONUS}
                        </>
                    ) : (
                        <>全部うまりました！ 次に来た日から {state.book + 1}枚目（スタンプの色が変わります）</>
                    )}
                </span>
            </footer>
        </section>
    );
}
