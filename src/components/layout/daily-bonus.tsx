"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * DailyBonus — 毎日ログイン（乗船印帳）のハンコを押す
 *
 *   その日はじめて開いたとき（またはログインしたとき）、裏で /api/points/daily を呼ぶ。
 *   押せたら、真ん中に「本日の乗船印」を出す。
 *   木のハンコが降りてきて、ポンと押す → 今の行に印が入る → もらったポイント → 明日の印。
 *   来なかった日は、今の行でも空いたまま見える。
 *
 * ★ 配るかどうかはサーバーが決める（1 日 1 回まで）。
 *   ここでは、同じ日に何度も頼まないよう、この端末に日付を覚えるだけ。
 *
 * ★ 押したら「gk-login-stamp」を知らせる。マイページの印帳がすぐ新しくなる。
 * ============================================================
 */

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
    CARD_CELLS,
    GOLD_INK,
    MOTIF_NAME,
    FULL_BONUS,
    ROW_BONUS,
    ROW_CELLS,
    cardMissed,
    inkOf,
    motifOf,
    rowMissed,
    shortDate,
    tiltOf,
    type LoginCardState,
    type LoginGrant,
} from "@/lib/login-card";
import { HankoTool, InkDefs, Seal, SquareSeal } from "@/components/points/login-seal";

const KEY = "gk-daily-bonus";
const STAMP_EVENT = "gk-login-stamp";

function jstToday(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type Shown = { grant: LoginGrant; state: LoginCardState };

export default function DailyBonus() {
    const [shown, setShown] = useState<Shown | null>(null);

    useEffect(() => {
        let alive = true;
        /* この画面で、もう頼んだ「日付:人」。同じ知らせが何度も来ても 1 回だけ頼む */
        let asked = "";

        /*
         * ★ 覚える印は「日付:人の id」。
         *   日付だけだと、同じ端末で別の人が入り直したとき、その人の分を頼まなくなる。
         */
        const claim = async (userId: string) => {
            const today = jstToday();
            const mark = `${today}:${userId}`;
            if (asked === mark) return;
            asked = mark;

            try {
                if (window.localStorage.getItem(KEY) === mark) return;
            } catch {
                /* 覚えられない端末でも、サーバーが 1 日 1 回に止める */
            }

            try {
                const response = await fetch("/api/points/daily", { method: "POST" });
                /* うまくいかなかった日は覚えない（次に開いたとき、また頼む） */
                if (!response.ok) {
                    asked = "";
                    return;
                }
                const data = (await response.json()) as {
                    granted?: boolean;
                    grant?: LoginGrant;
                    state?: LoginCardState;
                    today?: string;
                };
                /* サーバーから見て入っていない（granted が無い）ときは、覚えずに次でまた試す */
                if (data.granted === undefined) {
                    asked = "";
                    return;
                }
                try {
                    /* サーバーの日付で覚える（端末の時計が進んでいても、次の日の分を飛ばさない） */
                    window.localStorage.setItem(KEY, data.today ? `${data.today}:${userId}` : mark);
                } catch {
                    /* 覚えられなくてもよい */
                }
                if (data.state) {
                    window.dispatchEvent(new CustomEvent(STAMP_EVENT, { detail: data.state }));
                }
                if (alive && data.granted && data.grant && data.state && Array.isArray(data.state.cells) && data.state.filled > 0) {
                    setShown({ grant: data.grant, state: data.state });
                }
            } catch {
                /* 受け取れなくても、次に開いたときにまた頼む */
                asked = "";
            }
        };

        /*
         * ★ ログインの様子を見張る。
         *   この部品は一番外の枠にあり、画面を移っても作り直されない。
         *   開いたときだけ頼むと、パスワードで入った人（画面は読み直さない）は
         *   次に読み直すまでもらえなかった。入っていない人には何も頼まない。
         */
        let stop = () => {};
        try {
            const { data } = createClient().auth.onAuthStateChange((_event, session) => {
                if (session?.user) void claim(session.user.id);
            });
            stop = () => data.subscription.unsubscribe();
        } catch {
            /* つなぎ先が無い環境でも、ほかは動く */
        }

        return () => {
            alive = false;
            stop();
        };
    }, []);

    /* Esc で閉じる */
    useEffect(() => {
        if (!shown) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setShown(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [shown]);

    if (!shown) return null;
    return <StampPopup shown={shown} onClose={() => setShown(null)} />;
}

/** 本日の乗船印 */
function StampPopup({ shown, onClose }: { shown: Shown; onClose: () => void }) {
    const { grant, state } = shown;
    const ink = inkOf(state.book);
    /* 今日は何マス目か（1 から） */
    const today = state.todayIndex + 1;
    const todayGold = grant.gold > 0;
    const todayInk = todayGold ? GOLD_INK : ink;
    const row = Math.floor(state.todayIndex / ROW_CELLS);
    const rowStart = row * ROW_CELLS;
    const rowEnd = today % ROW_CELLS === 0;
    const rowOff = rowMissed(state, row);
    const rowDoneToday = rowEnd && !rowOff;
    const total = grant.daily + grant.row + grant.full + grant.gold;

    const parts: string[] = [`毎日 ${grant.daily}`];
    if (grant.row) parts.push(`7日連続 ${grant.row}`);
    if (grant.full) parts.push(`28日連続 ${grant.full}`);
    if (grant.gold) parts.push(`金のスタンプ ${grant.gold}`);

    const next = today < CARD_CELLS ? today + 1 : 0;
    const toTreasure = ROW_CELLS - (today % ROW_CELLS);

    /* 明日の一言 */
    let hint: string;
    if (rowEnd) {
        hint = `明日から次の行。7日連続で「宝」のスタンプ +${ROW_BONUS}`;
    } else if (rowOff) {
        hint = `この行は休んだ日があるので「宝」はなし。次の行で7日連続 +${ROW_BONUS}`;
    } else {
        hint = `あと ${toTreasure} 日続けると「宝」のスタンプ +${ROW_BONUS}`;
    }
    if (!cardMissed(state) && next) hint += `。${shortDate(state.end)} まで毎日で 28日連続 +${FULL_BONUS}`;

    return (
        <div className="lpop-dim" onClick={onClose}>
            <div
                className="lpop"
                role="dialog"
                aria-modal="true"
                aria-label="今日のスタンプ"
                onClick={(event) => event.stopPropagation()}
            >
                <InkDefs />
                <h3>今日のスタンプ</h3>
                <p className="lpop-d">
                    {state.book > 1 ? `${state.book}枚目　` : ""}
                    {shortDate(state.cells[state.todayIndex].date)}（{today}日目）　{MOTIF_NAME[motifOf(today)]}のスタンプ
                    {todayGold && <span className="lpop-gold">金のスタンプ！</span>}
                </p>

                <div className="lpop-stage">
                    <div className="lpop-slot">
                        <span className="lpop-ring" />
                        <span className="lpop-n">{today}</span>
                        <Seal className="lpop-big" motif={motifOf(today)} day={today} color={todayInk} tilt={-6} />
                    </div>
                    <div className="lpop-hanko">
                        <HankoTool color={todayInk} />
                    </div>
                    <div className="lpop-burst" aria-hidden="true">
                        {Array.from({ length: 12 }, (_, i) => {
                            const a = (i / 12) * Math.PI * 2;
                            const r = 78 + (i % 3) * 10;
                            return (
                                <i
                                    key={i}
                                    style={
                                        {
                                            "--dx": `${Math.round(Math.cos(a) * r)}px`,
                                            "--dy": `${Math.round(Math.sin(a) * r * 0.8)}px`,
                                            background: todayInk,
                                        } as React.CSSProperties
                                    }
                                />
                            );
                        })}
                    </div>
                    <span className="lpop-pon" style={{ color: todayInk }}>
                        ポン!
                    </span>
                </div>

                <div className="lpop-row">
                    {Array.from({ length: ROW_CELLS }, (_, i) => {
                        const n = rowStart + i + 1;
                        const cell = state.cells[n - 1];
                        const isMiss = n < today && !cell.stamped;
                        return (
                            <div className={`lcard-cell${isMiss ? " is-miss" : ""}`} key={n}>
                                <span className="lcard-slot" />
                                {n < today && cell.stamped ? (
                                    <Seal
                                        className="lcard-seal"
                                        motif={motifOf(n)}
                                        day={n}
                                        color={cell.gold ? GOLD_INK : ink}
                                        tilt={tiltOf(n)}
                                    />
                                ) : n === today ? (
                                    <Seal
                                        className="lcard-seal lpop-today"
                                        motif={motifOf(n)}
                                        day={n}
                                        color={todayInk}
                                        tilt={tiltOf(n)}
                                    />
                                ) : (
                                    <span className="lcard-n">{shortDate(cell.date)}</span>
                                )}
                            </div>
                        );
                    })}
                    <div className={`lcard-tre${rowOff ? " is-off" : ""}`}>
                        <span className="lcard-slot" />
                        {rowDoneToday ? (
                            <SquareSeal className="lcard-seal lpop-tre" text="宝" color={ink} />
                        ) : (
                            <span className="lcard-tre-t">宝</span>
                        )}
                    </div>
                </div>

                <div className="lpop-pt">
                    <span className="lpop-coin">P</span>+{total}
                </div>
                {parts.length > 1 && <p className="lpop-parts">（{parts.join(" ＋ ")}）</p>}

                <div className="lpop-tmr">
                    {next ? (
                        <>
                            <span className="lpop-tmr-g">
                                <Seal motif={motifOf(next)} day={next} color={ink} ghost />
                            </span>
                            <span>
                                <b>明日は「{MOTIF_NAME[motifOf(next)]}」のスタンプ</b>
                                <small>{hint}。金のスタンプが出るかも</small>
                            </span>
                        </>
                    ) : (
                        <span>
                            <b>このカードはここまで</b>
                            <small>次に来た日から {state.book + 1}枚目。スタンプの色が変わります</small>
                        </span>
                    )}
                </div>

                <button type="button" className="lpop-close" onClick={onClose}>
                    とじる
                </button>
            </div>
        </div>
    );
}
