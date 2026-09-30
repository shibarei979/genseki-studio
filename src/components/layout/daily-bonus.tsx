"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * DailyBonus — 毎日ログイン（乗船印帳）のハンコを押す
 *
 *   その日はじめて開いたとき（またはログインしたとき）、裏で /api/points/daily を呼ぶ。
 *   押せたら、真ん中に「本日の乗船印」を出す。
 *   木のハンコが降りてきて、ポンと押す → 今の行に印が入る → もらったポイント → 明日の印。
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
    ROW_BONUS,
    ROW_CELLS,
    inkOf,
    motifOf,
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
                if (alive && data.granted && data.grant && data.state && data.state.filled > 0) {
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
    const today = state.filled;
    const todayGold = grant.gold > 0;
    const todayInk = todayGold ? GOLD_INK : ink;
    const rowStart = Math.floor((today - 1) / ROW_CELLS) * ROW_CELLS;
    const rowDoneToday = today % ROW_CELLS === 0;
    const total = grant.daily + grant.row + grant.full + grant.gold;

    const parts: string[] = [`毎日 ${grant.daily}`];
    if (grant.row) parts.push(`宝 ${grant.row}`);
    if (grant.full) parts.push(`全部うまった ${grant.full}`);
    if (grant.gold) parts.push(`金のスタンプ ${grant.gold}`);

    const next = today < CARD_CELLS ? today + 1 : 0;
    const toTreasure = ROW_CELLS - (today % ROW_CELLS);

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
                    {today}日目　{MOTIF_NAME[motifOf(today)]}のスタンプ
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
                        const day = state.days[n - 1];
                        return (
                            <div className="lcard-cell" key={n}>
                                <span className="lcard-slot" />
                                {n < today ? (
                                    <Seal
                                        className="lcard-seal"
                                        motif={motifOf(n)}
                                        day={n}
                                        color={day?.gold ? GOLD_INK : ink}
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
                                    <span className="lcard-n">{n}</span>
                                )}
                            </div>
                        );
                    })}
                    <div className="lcard-tre">
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
                                <small>
                                    {rowDoneToday
                                        ? `次の行へ。7つそろうと、また「宝」のスタンプ +${ROW_BONUS}`
                                        : `あと ${toTreasure} つで「宝」のスタンプ +${ROW_BONUS}`}
                                    。金のスタンプが出るかも
                                </small>
                            </span>
                        </>
                    ) : (
                        <span>
                            <b>全部うまりました</b>
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
