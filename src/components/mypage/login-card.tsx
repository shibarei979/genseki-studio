"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * LoginCard — 乗船印帳（マイページのミッション）
 *
 *   7 マス × 4 行 ＝ 28 日分のカレンダー。来た日に朱色のハンコ。
 *   来なかった日は空いたまま。1 行 7 日ぜんぶ押すと、行の右に「宝」の角印。
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
    cardDone,
    cardMissed,
    inkOf,
    motifOf,
    pointsInBook,
    rowDone,
    rowMissed,
    shortDate,
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

    /* 古い形（カレンダーにする前）の返事なら、出さない */
    if (!Array.isArray(state.cells) || state.cells.length !== CARD_CELLS) return null;

    const ink = inkOf(state.book);
    const t = state.todayIndex;
    const next = state.todayDone && t + 1 < CARD_CELLS ? t + 1 : -1;
    const done = cardDone(state);

    return (
        <section className="lcard" aria-label="ログインスタンプ">
            <InkDefs />
            <header className="lcard-h">
                <b>ログインスタンプ</b>
                <small>
                    {state.book}枚目　{shortDate(state.start)}〜{shortDate(state.end)}
                </small>
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
                    const isRowDone = rowDone(state, r);
                    const isRowOff = !isRowDone && rowMissed(state, r);
                    return (
                        <div className="lcard-row" key={r}>
                            {Array.from({ length: ROW_CELLS }, (_, c) => {
                                const i = r * ROW_CELLS + c;
                                const n = i + 1;
                                const cell = state.cells[i];
                                const isToday = i === t;
                                const isMiss = !cell.stamped && i < t;
                                const label = shortDate(cell.date);
                                return (
                                    <div
                                        key={n}
                                        className={`lcard-cell${isToday ? " is-today" : ""}${i === next ? " is-next" : ""}${isMiss ? " is-miss" : ""}`}
                                        title={
                                            cell.stamped
                                                ? `${label}　${MOTIF_NAME[motifOf(n)]}のスタンプ`
                                                : isMiss
                                                  ? `${label}　来なかった日`
                                                  : label
                                        }
                                    >
                                        <span className="lcard-slot" />
                                        {cell.stamped ? (
                                            <>
                                                <Seal
                                                    className="lcard-seal"
                                                    motif={motifOf(n)}
                                                    day={n}
                                                    color={cell.gold ? GOLD_INK : ink}
                                                    tilt={tiltOf(n)}
                                                />
                                                {cell.gold && <span className="lcard-kin">金</span>}
                                            </>
                                        ) : i === next ? (
                                            <>
                                                <Seal className="lcard-seal" motif={motifOf(n)} day={n} color={ink} ghost />
                                                <span className="lcard-tag">明日</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="lcard-n">{label}</span>
                                                {isToday && <span className="lcard-tag">今日</span>}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                            <div className={`lcard-tre${isRowOff ? " is-off" : ""}`}>
                                <span className="lcard-slot" />
                                {isRowDone ? (
                                    <SquareSeal className="lcard-seal" text="宝" color={ink} />
                                ) : (
                                    <>
                                        <span className="lcard-tre-t">宝</span>
                                        <span className="lcard-tre-p">{isRowOff ? "—" : `+${ROW_BONUS}`}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="lcard-rule">1 行 7 日連続で「宝」 +{ROW_BONUS}　来なかった日は空いたままです</p>

            <footer className="lcard-f">
                <span>このカードで {pointsInBook(state)} pt</span>
                <span className="lcard-left">
                    {done ? (
                        <>28日連続！ +{FULL_BONUS}　次に来た日から {state.book + 1}枚目</>
                    ) : cardMissed(state) ? (
                        <>{shortDate(state.end)} まで。次のカードで 28日連続 +{FULL_BONUS}</>
                    ) : (
                        <>
                            {shortDate(state.end)} まで毎日で <b style={{ color: ink }}>28日連続</b> +{FULL_BONUS}
                        </>
                    )}
                </span>
            </footer>
        </section>
    );
}
