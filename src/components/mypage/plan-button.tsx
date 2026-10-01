"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * PlanButton — サブスクの入り口（入る・やめる）
 *
 *   マイページのミッションの横に小さな札で置く。
 *   押すと小窓が開き、プランを選んで入る・やめる・やめるのを取り消す。
 *
 * ★ いまは無料ポイント 800pt で 1 か月（pay.jp を繋ぐまで）。1 か月たつと自動で終わる。
 * ★ 「今すぐやめる」も置く（ポイントは戻らない）。
 * ============================================================
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PlanRow {
    id: string;
    name: string;
    blurb: string;
    perks: string[];
}

interface View {
    price: number;
    points: number;
    plans: PlanRow[];
    current: {
        id: string;
        planId: string;
        planName: string;
        perks: string[];
        status: string;
        currentEnd: string;
        cancelAtPeriodEnd: boolean;
        byPoints: boolean;
    } | null;
}

function day(iso: string) {
    const at = new Date(iso);
    return `${at.getFullYear()}年${at.getMonth() + 1}月${at.getDate()}日`;
}

export default function PlanButton() {
    const [data, setData] = useState<View | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [confirmCancel, setConfirmCancel] = useState(false);
    /** 読み込めなかったときの理由（札は出したまま、中で知らせる） */
    const [failed, setFailed] = useState("");

    const load = useCallback(async () => {
        try {
            const response = await fetch("/api/member/subscription", { cache: "no-store" });
            if (response.status === 401) return; /* 入っていない人には出さない */
            const next = (await response.json().catch(() => null)) as (View & { error?: string }) | null;
            if (!response.ok || !next || !Array.isArray(next.plans)) {
                setFailed(next?.error ?? `読み込めませんでした（${response.status}）`);
                return;
            }
            setFailed("");
            setData(next);
        } catch {
            setFailed("繋がりませんでした");
        }
    }, []);

    useEffect(() => {
        void load();
        const again = () => void load();
        window.addEventListener("gk-points-changed", again);
        return () => window.removeEventListener("gk-points-changed", again);
    }, [load]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen]);

    function close() {
        setIsOpen(false);
        setMessage("");
        setConfirmCancel(false);
    }

    async function act(body: Record<string, unknown>, done: string) {
        setBusy(true);
        setMessage("");
        try {
            const response = await fetch("/api/member/subscription", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const next = (await response.json()) as View & { error?: string };
            if (!response.ok || next.error) {
                setMessage(next.error ?? "うまくいきませんでした。");
            } else {
                setData(next);
                setMessage(done);
                setConfirmCancel(false);
                /* 頭の帯のポイント・会員の機能を読み直す */
                window.dispatchEvent(new Event("gk-points-changed"));
            }
        } catch {
            setMessage("繋がりませんでした。");
        } finally {
            setBusy(false);
        }
    }

    /* 読み込めなかったとき：札は出して、押すと読み直す */
    if (!data) {
        if (!failed) return null;
        return (
            <button type="button" className="lsb sub-b" onClick={() => void load()} title={failed}>
                <span className="sub-ic" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z" />
                    </svg>
                </span>
                <span className="lsb-t">
                    <b>サブスク</b>
                    <small>{failed}（押すと読み直す）</small>
                </span>
            </button>
        );
    }

    const current = data.current;
    /* 出しているプランがまだ無い（管理画面で月のプランを公開すると入れるようになる） */
    const notYet = !current && data.plans.length === 0;
    const short = data.points < data.price;

    return (
        <>
            <button type="button" className="lsb sub-b" onClick={() => setIsOpen(true)} aria-haspopup="dialog">
                <span className="sub-ic" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z" />
                    </svg>
                </span>
                <span className="lsb-t">
                    <b>サブスク</b>
                    <small>
                        {current
                            ? current.cancelAtPeriodEnd || current.byPoints
                                ? `${day(current.currentEnd)}まで`
                                : `${current.planName}　入っています`
                            : notYet
                              ? "準備中です"
                              : `${data.price}pt で 1 か月`}
                    </small>
                </span>
                {!notYet && <span className="lsb-n sub-n">{current ? "会員" : "入る"}</span>}
            </button>

            {isOpen && createPortal(
                <div className="lpop-dim" onClick={close}>
                    <div className="sub-modal" role="dialog" aria-modal="true" aria-label="サブスク" onClick={(event) => event.stopPropagation()}>
                        <div className="sub-h">
                            <b>サブスク</b>
                            <button type="button" onClick={close} aria-label="とじる">×</button>
                        </div>

                        {!notYet && (
                        <p className="sub-note">
                            いまは <strong>無料ポイント {data.price}pt</strong> で 1 か月、これまでのサブスクの特典が<strong>すべて</strong>使えます。
                            <br />
                            1 か月たつと自動で終わります（続けてポイントが引かれることはありません）。
                            <br />
                            続けたいときは、終わったあとにもう一度入ってください。
                        </p>
                        )}
                        <p className="sub-have">
                            手持ち <strong>{data.points.toLocaleString()}</strong> pt
                        </p>

                        {current ? (
                            <div className="sub-now">
                                <p className="sub-now-t">
                                    <span className="sub-chip">入っています</span>
                                    <b>{current.planName}</b>
                                </p>
                                {current.perks.length > 0 && (
                                    <ul className="sub-perks">
                                        {current.perks.map((perk) => (
                                            <li key={perk}>{perk}</li>
                                        ))}
                                    </ul>
                                )}
                                {current.byPoints ? (
                                    <>
                                        <p className="sub-end">
                                            <b>{day(current.currentEnd)}</b> まで使えます。そのあと自動で終わります。
                                        </p>
                                        {confirmCancel ? (
                                            <div className="sub-confirm">
                                                <p>
                                                    今すぐやめますか？ すぐに使えなくなります。
                                                    <br />
                                                    払ったポイントは戻りません。
                                                </p>
                                                <div>
                                                    <button type="button" className="sub-quiet" onClick={() => setConfirmCancel(false)}>
                                                        続ける
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="sub-stop"
                                                        disabled={busy}
                                                        onClick={() => void act({ action: "cancel" }, "サブスクをやめました。")}
                                                    >
                                                        今すぐやめる
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button type="button" className="sub-quiet sub-wide" onClick={() => setConfirmCancel(true)}>
                                                サブスクを今すぐやめる
                                            </button>
                                        )}
                                    </>
                                ) : current.cancelAtPeriodEnd ? (
                                    <>
                                        <p className="sub-end">
                                            やめる手続き済みです。<b>{day(current.currentEnd)}</b> まで使えます。
                                            <br />
                                            そのあとポイントは引かれません。
                                        </p>
                                        <button
                                            type="button"
                                            className="sub-go"
                                            disabled={busy}
                                            onClick={() => void act({ action: "resume" }, "続けるようにしました。")}
                                        >
                                            やめるのを取り消す
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p className="sub-end">
                                            次は <b>{day(current.currentEnd)}</b> に {data.price}pt 引いて続きます。
                                        </p>
                                        {confirmCancel ? (
                                            <div className="sub-confirm">
                                                <p>
                                                    やめますか？ {day(current.currentEnd)} までは使えます。
                                                    <br />
                                                    払ったポイントは戻りません。
                                                </p>
                                                <div>
                                                    <button type="button" className="sub-quiet" onClick={() => setConfirmCancel(false)}>
                                                        続ける
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="sub-stop"
                                                        disabled={busy}
                                                        onClick={() => void act({ action: "cancel" }, "やめる手続きをしました。")}
                                                    >
                                                        やめる
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button type="button" className="sub-quiet sub-wide" onClick={() => setConfirmCancel(true)}>
                                                サブスクをやめる
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : notYet ? (
                            <p className="sub-msg">いまは入れるプランがありません。準備ができたら、ここから入れます。</p>
                        ) : (
                            <ul className="sub-plans">
                                {data.plans.map((plan) => (
                                    <li key={plan.id} className="sub-plan">
                                        <p className="sub-plan-t">
                                            <b>{plan.name}</b>
                                            <span>
                                                <span className="mc-coin">P</span>
                                                {data.price}pt / 1 か月
                                            </span>
                                        </p>
                                        {plan.blurb && <p className="sub-plan-d">{plan.blurb}</p>}
                                        {plan.perks.length > 0 && (
                                            <ul className="sub-perks">
                                                {plan.perks.map((perk) => (
                                                    <li key={perk}>{perk}</li>
                                                ))}
                                            </ul>
                                        )}
                                        <button
                                            type="button"
                                            className="sub-go"
                                            disabled={busy || short}
                                            onClick={() => void act({ action: "join", planId: plan.id }, "入りました。")}
                                        >
                                            {short ? `あと ${(data.price - data.points).toLocaleString()} pt` : `${data.price}pt で入る`}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {message && <p className="sub-msg">{message}</p>}
                        <button type="button" className="lpop-close" onClick={close}>
                            とじる
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
