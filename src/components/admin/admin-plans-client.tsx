"use client";

import { useCallback, useEffect, useState } from "react";

import AdminShell from "@/components/admin/admin-shell";

/**
 * ============================================================
 * 原石航路 Studio
 * AdminPlansClient — 会員（サブスクリプション）
 *
 * ★ まだ読む人には出していない。
 *
 *   売り物の形と、付く特典を決めるための画面。
 *   決済（pay.jp）はまだ繋いでいない。
 *
 * ★ 手で始めて、手で止められるようにしてある。
 *
 *   決済を繋いでからでないと試せない、では
 *   特典の出方を確かめようがない。
 *   運営が自分に付けて、配られるところまで見る。
 *
 * ★ 出すかどうかは、いちばん右の切り替え。
 *
 *   中身が揃うまでは切っておく。
 *   切ってあるものは、読む人からは無いのと同じ。
 * ============================================================
 */

interface Perk {
    id: string;
    plan_id: string;
    kind: string;
    amount: number;
    ref: string | null;
    note: string;
    sort: number;
    first_period_only: boolean;
}

interface Plan {
    id: string;
    code: string;
    name: string;
    blurb: string;
    price_yen: number;
    interval: string;
    trial_days: number;
    sort: number;
    is_active: boolean;
    perks: Perk[];
}

interface Member {
    user_id: string;
    display_name: string;
    points: number;
    subscription_id: string | null;
    plan_name: string;
    status: string | null;
    current_end: string | null;
    cancel_at_period_end: boolean;
}

interface Live {
    id: string;
    user_id: string;
    plan_id: string;
    status: string;
    current_start: string;
    current_end: string;
    cancel_at_period_end: boolean;
    display_name: string;
    plan_name: string;
    note: string;
}

const KINDS: [string, string][] = [
    ["free_points", "無料ポイント"],
    ["no_ads", "広告を出さない"],
    ["item", "アイテムを渡す"],
    ["badge", "称号を付ける"],
    ["limit", "上限を広げる"],
];

const STATUS: Record<string, string> = {
    trial: "お試し",
    active: "続いている",
    past_due: "払えていない",
    canceled: "終わった",
};

/** 日付を、読める形に */
function day(at: string | null | undefined): string {
    if (!at) return "";

    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return "";

    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminPlansClient() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [live, setLive] = useState<Live[]>([]);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    /* 手で始めるとき */
    const [word, setWord] = useState("");
    const [people, setPeople] = useState<
        { user_id: string; display_name: string }[]
    >([]);
    const [target, setTarget] = useState<{
        user_id: string;
        display_name: string;
    } | null>(null);
    const [pickPlan, setPickPlan] = useState("");

    /* 人ごとの状況 */
    const [members, setMembers] = useState<Member[]>([]);
    const [summary, setSummary] = useState({
        holders: 0,
        members: 0,
        points: 0,
    });
    const [look, setLook] = useState("");

    const reload = useCallback(async () => {
        try {
            const [a, b, c] = await Promise.all([
                fetch("/api/admin/plans").then((r) => r.json()),
                fetch("/api/admin/subscriptions").then((r) => r.json()),
                fetch("/api/admin/members").then((r) => r.json()),
            ]);

            setPlans((a.plans ?? []) as Plan[]);
            setLive((b.subscriptions ?? []) as Live[]);
            setMembers((c.members ?? []) as Member[]);

            if (c.summary) setSummary(c.summary);
        } catch {
            setMessage("読めませんでした。");
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    async function send(body: Record<string, unknown>, where: string) {
        setBusy(true);
        setMessage("");

        try {
            const response = await fetch(where, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = (await response.json()) as { error?: string };

            if (data.error) {
                setMessage(data.error);
            } else {
                await reload();
            }

            setBusy(false);
            return data;
        } catch {
            setMessage("繋がりませんでした。");
            setBusy(false);
            return { error: "繋がりませんでした" };
        }
    }

    /* 売り物・特典を直す */
    const savePlan = (id: string, patch: Record<string, unknown>) =>
        send({ what: "plan", id, patch }, "/api/admin/plans");

    const savePerk = (id: string, patch: Record<string, unknown>) =>
        send({ what: "perk", id, patch }, "/api/admin/plans");

    async function findPeople(text: string) {
        setWord(text);

        if (text.trim().length < 1) {
            setPeople([]);
            return;
        }

        try {
            const response = await fetch(
                `/api/admin/subscriptions?find=${encodeURIComponent(text.trim())}`,
            );

            const data = (await response.json()) as {
                people?: { user_id: string; display_name: string }[];
            };

            setPeople(data.people ?? []);
        } catch {
            setPeople([]);
        }
    }

    /* 名前で探す。空にすると、持っている人と会員だけに戻る */
    async function lookFor(text: string) {
        setLook(text);

        try {
            const response = await fetch(
                `/api/admin/members?find=${encodeURIComponent(text.trim())}`,
            );

            const data = (await response.json()) as { members?: Member[] };

            setMembers(data.members ?? []);
        } catch {
            /* 読めなくても、ほかは動く */
        }
    }

    const field: React.CSSProperties = {
        border: "1px solid var(--color-line)",
        borderRadius: 6,
        padding: "4px 8px",
        fontSize: 12,
        background: "var(--color-surface)",
        color: "var(--color-ink)",
    };

    return (
        <AdminShell
            title="会員"
            description="売り物と、付く特典。まだ読む人には出していません。"
        >
            {message && (
                <p className="mb-3 text-[12px] text-[var(--color-danger)]">{message}</p>
            )}

            {/* ------------------------------------------------ 売り物 */}
            <section className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[13px] font-medium text-ink">売り物</h2>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void send({ what: "plan" }, "/api/admin/plans")}
                        className="rounded-md border border-forest px-3 py-1 text-[11px] text-forest hover:bg-forest-tint/60"
                    >
                        売り物を足す
                    </button>
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-faint">
                    「合言葉」は、コードから呼ぶときの短い名前です（例 stone）。
                    「出す」を切っているあいだは、読む人からは無いのと同じです。
                </p>

                {plans.length === 0 && (
                    <p className="mt-4 text-[12px] text-muted">
                        まだ何もありません。「売り物を足す」から始めてください。
                    </p>
                )}

                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        className="mt-3 rounded-md border border-line p-3"
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="number"
                                defaultValue={plan.sort}
                                onBlur={(e) =>
                                    void savePlan(plan.id, {
                                        sort: Number(e.target.value),
                                    })
                                }
                                aria-label="並び"
                                style={{ ...field, width: 52 }}
                            />

                            <input
                                type="text"
                                defaultValue={plan.name}
                                onBlur={(e) =>
                                    void savePlan(plan.id, { name: e.target.value })
                                }
                                aria-label="名前"
                                style={{ ...field, width: 160 }}
                            />

                            <input
                                type="text"
                                defaultValue={plan.code}
                                onBlur={(e) =>
                                    void savePlan(plan.id, { code: e.target.value })
                                }
                                aria-label="合言葉"
                                placeholder="stone"
                                style={{ ...field, width: 120 }}
                            />

                            <label className="flex items-center gap-1 text-[11px] text-muted">
                                <input
                                    type="number"
                                    min={0}
                                    step={100}
                                    defaultValue={plan.price_yen}
                                    onBlur={(e) =>
                                        void savePlan(plan.id, {
                                            price_yen: Number(e.target.value),
                                        })
                                    }
                                    aria-label="値段"
                                    style={{ ...field, width: 90 }}
                                />
                                円
                            </label>

                            <select
                                defaultValue={plan.interval}
                                onChange={(e) =>
                                    void savePlan(plan.id, {
                                        interval: e.target.value,
                                    })
                                }
                                aria-label="期間"
                                style={field}
                            >
                                <option value="month">ひと月ごと</option>
                                <option value="year">一年ごと</option>
                            </select>

                            <label className="flex items-center gap-1 text-[11px] text-muted">
                                お試し
                                <input
                                    type="number"
                                    min={0}
                                    defaultValue={plan.trial_days}
                                    onBlur={(e) =>
                                        void savePlan(plan.id, {
                                            trial_days: Number(e.target.value),
                                        })
                                    }
                                    aria-label="お試しの日数"
                                    style={{ ...field, width: 60 }}
                                />
                                日
                            </label>

                            <label className="flex items-center gap-1.5 text-[11px] text-muted">
                                <input
                                    type="checkbox"
                                    defaultChecked={plan.is_active}
                                    onChange={(e) =>
                                        void savePlan(plan.id, {
                                            is_active: e.target.checked,
                                        })
                                    }
                                />
                                出す
                            </label>

                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    void send(
                                        { what: "plan", remove: plan.id },
                                        "/api/admin/plans",
                                    )
                                }
                                className="ml-auto text-[11px] text-faint hover:text-[var(--color-danger)]"
                            >
                                消す
                            </button>
                        </div>

                        <input
                            type="text"
                            defaultValue={plan.blurb}
                            onBlur={(e) =>
                                void savePlan(plan.id, { blurb: e.target.value })
                            }
                            placeholder="読む人に出す一行（例 毎月 500pt と、会員だけの飾り）"
                            aria-label="説明"
                            style={{ ...field, width: "100%", marginTop: 8 }}
                        />

                        {/* --------------------------------------- 特典 */}
                        <div className="mt-3 border-t border-line pt-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] text-muted">付く特典</p>

                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                        void send(
                                            { what: "perk", planId: plan.id },
                                            "/api/admin/plans",
                                        )
                                    }
                                    className="text-[11px] text-forest hover:underline"
                                >
                                    ＋ 特典を足す
                                </button>
                            </div>

                            {plan.perks.length === 0 && (
                                <p className="mt-2 text-[11px] text-faint">
                                    まだありません。
                                </p>
                            )}

                            {plan.perks.map((perk) => (
                                <div
                                    key={perk.id}
                                    className="mt-2 flex flex-wrap items-center gap-2"
                                >
                                    <select
                                        defaultValue={perk.kind}
                                        onChange={(e) =>
                                            void savePerk(perk.id, {
                                                kind: e.target.value,
                                            })
                                        }
                                        aria-label="特典の種類"
                                        style={field}
                                    >
                                        {KINDS.map(([key, label]) => (
                                            <option key={key} value={key}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        min={0}
                                        step={50}
                                        defaultValue={perk.amount}
                                        onBlur={(e) =>
                                            void savePerk(perk.id, {
                                                amount: Number(e.target.value),
                                            })
                                        }
                                        aria-label="数"
                                        style={{ ...field, width: 90 }}
                                    />

                                    <input
                                        type="text"
                                        defaultValue={perk.ref ?? ""}
                                        onBlur={(e) =>
                                            void savePerk(perk.id, {
                                                ref: e.target.value.trim() || null,
                                            })
                                        }
                                        placeholder="相手（アイテムの id など）"
                                        aria-label="相手"
                                        style={{ ...field, width: 200 }}
                                    />

                                    <label className="flex items-center gap-1.5 text-[11px] text-muted">
                                        <input
                                            type="checkbox"
                                            defaultChecked={perk.first_period_only}
                                            onChange={(e) =>
                                                void savePerk(perk.id, {
                                                    first_period_only:
                                                        e.target.checked,
                                                })
                                            }
                                        />
                                        初回だけ
                                    </label>

                                    <input
                                        type="text"
                                        defaultValue={perk.note}
                                        onBlur={(e) =>
                                            void savePerk(perk.id, {
                                                note: e.target.value,
                                            })
                                        }
                                        placeholder="覚え書き"
                                        aria-label="覚え書き"
                                        style={{ ...field, width: 180 }}
                                    />

                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            void send(
                                                { what: "perk", remove: perk.id },
                                                "/api/admin/plans",
                                            )
                                        }
                                        className="text-[11px] text-faint hover:text-[var(--color-danger)]"
                                    >
                                        消す
                                    </button>
                                </div>
                            ))}

                            <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                                いま配られるのは「無料ポイント」だけです。
                                ほかの種類は、置き場所だけ先に決めてあります。
                                「初回だけ」を入れると、入ってすぐの一期間にだけ配ります。
                            </p>
                        </div>
                    </div>
                ))}
            </section>

            {/* ------------------------------------------------ 契約 */}
            <section className="mt-4 rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[13px] font-medium text-ink">契約</h2>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                            void send({ do: "advance" }, "/api/admin/subscriptions")
                        }
                        className="rounded-md border border-line px-3 py-1 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                    >
                        期間を進める
                    </button>
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-faint">
                    決済はまだ繋いでいないので、ここから手で始めて手で止めます。
                    「期間を進める」は、終わりを過ぎた契約を次の期間へ送り、その期間ぶんの特典を配ります。
                </p>

                {/* 手で始める */}
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line p-3">
                    <span className="text-[11px] text-muted">手で始める</span>

                    <div className="relative">
                        <input
                            type="text"
                            value={target ? target.display_name : word}
                            onChange={(e) => {
                                setTarget(null);
                                void findPeople(e.target.value);
                            }}
                            placeholder="名前で探す"
                            aria-label="誰に"
                            style={{ ...field, width: 180 }}
                        />

                        {!target && people.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full rounded-md border border-line bg-surface py-1 shadow">
                                {people.map((one) => (
                                    <li key={one.user_id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTarget(one);
                                                setPeople([]);
                                            }}
                                            className="w-full px-2.5 py-1 text-left text-[12px] text-ink hover:bg-forest-tint"
                                        >
                                            {one.display_name || "名前のない書き手"}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <select
                        value={pickPlan}
                        onChange={(e) => setPickPlan(e.target.value)}
                        aria-label="どの売り物"
                        style={field}
                    >
                        <option value="">売り物を選ぶ</option>
                        {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                                {plan.name}（{plan.price_yen}円）
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        disabled={busy || !target || !pickPlan}
                        onClick={async () => {
                            await send(
                                {
                                    do: "start",
                                    userId: target?.user_id,
                                    planId: pickPlan,
                                    note: "運営が手で始めた",
                                },
                                "/api/admin/subscriptions",
                            );

                            setTarget(null);
                            setWord("");
                        }}
                        className="rounded-md bg-forest px-3 py-1 text-[11px] text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        始める
                    </button>
                </div>

                {live.length === 0 ? (
                    <p className="mt-3 text-[12px] text-muted">
                        まだ誰も入っていません。
                    </p>
                ) : (
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full border-collapse text-[12px]">
                            <thead>
                                <tr className="text-left text-[10.5px] text-faint">
                                    <th className="px-2 py-1">誰</th>
                                    <th className="px-2 py-1">売り物</th>
                                    <th className="px-2 py-1">状態</th>
                                    <th className="px-2 py-1">いまの期間</th>
                                    <th className="px-2 py-1" />
                                </tr>
                            </thead>

                            <tbody>
                                {live.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="border-t border-line"
                                    >
                                        <td className="px-2 py-1.5 text-ink">
                                            {row.display_name || "名前のない書き手"}
                                        </td>

                                        <td className="px-2 py-1.5 text-muted">
                                            {row.plan_name}
                                        </td>

                                        <td className="px-2 py-1.5 text-muted">
                                            {STATUS[row.status] ?? row.status}
                                            {row.cancel_at_period_end &&
                                                row.status !== "canceled" && (
                                                    <span className="ml-1 text-[10.5px] text-faint">
                                                        （期間の終わりで止める）
                                                    </span>
                                                )}
                                        </td>

                                        <td className="px-2 py-1.5 text-muted">
                                            {day(row.current_start)} 〜{" "}
                                            {day(row.current_end)}
                                        </td>

                                        <td className="px-2 py-1.5">
                                            {row.status !== "canceled" && (
                                                <span className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void send(
                                                                {
                                                                    do: "grant",
                                                                    id: row.id,
                                                                },
                                                                "/api/admin/subscriptions",
                                                            )
                                                        }
                                                        className="text-[11px] text-forest hover:underline"
                                                    >
                                                        配り直す
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void send(
                                                                {
                                                                    do: "stop",
                                                                    id: row.id,
                                                                },
                                                                "/api/admin/subscriptions",
                                                            )
                                                        }
                                                        className="text-[11px] text-muted hover:text-ink"
                                                    >
                                                        期間の終わりで止める
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void send(
                                                                {
                                                                    do: "stop",
                                                                    id: row.id,
                                                                    now: true,
                                                                },
                                                                "/api/admin/subscriptions",
                                                            )
                                                        }
                                                        className="text-[11px] text-faint hover:text-[var(--color-danger)]"
                                                    >
                                                        いま止める
                                                    </button>
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ------------------------------------------- 人ごとの状況 */}
            <section className="mt-4 rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-[13px] font-medium text-ink">
                        人ごとの状況
                    </h2>

                    <p className="text-[11px] text-faint">
                        会員 {summary.members} 人 ／ ポイントを持っている人{" "}
                        {summary.holders} 人 ／ 出回っている量{" "}
                        {summary.points.toLocaleString()} pt
                    </p>
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-faint">
                    ふだんは、ポイントを持っているか会員に入っている人だけを出します。
                    名前で探すと、それ以外の人も出ます。
                </p>

                <input
                    type="text"
                    value={look}
                    onChange={(e) => void lookFor(e.target.value)}
                    placeholder="名前で探す"
                    aria-label="人を名前で探す"
                    style={{ ...field, width: 200, marginTop: 10 }}
                />

                {members.length === 0 ? (
                    <p className="mt-3 text-[12px] text-muted">
                        当てはまる人がいません。
                    </p>
                ) : (
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full border-collapse text-[12px]">
                            <thead>
                                <tr className="text-left text-[10.5px] text-faint">
                                    <th className="px-2 py-1">名前</th>
                                    <th className="px-2 py-1">無料ポイント</th>
                                    <th className="px-2 py-1">会員</th>
                                    <th className="px-2 py-1">次の切り替え</th>
                                </tr>
                            </thead>

                            <tbody>
                                {members.map((one) => (
                                    <tr
                                        key={one.user_id}
                                        className="border-t border-line"
                                    >
                                        <td className="px-2 py-1.5 text-ink">
                                            {one.display_name ||
                                                "名前のない書き手"}
                                        </td>

                                        <td className="px-2 py-1.5 text-muted">
                                            {one.points.toLocaleString()} pt
                                        </td>

                                        <td className="px-2 py-1.5">
                                            {one.status ? (
                                                <span className="text-forest">
                                                    {one.plan_name}
                                                    <span className="ml-1 text-[10.5px] text-faint">
                                                        （
                                                        {STATUS[one.status] ??
                                                            one.status}
                                                        {one.cancel_at_period_end &&
                                                            "・終わりで止める"}
                                                        ）
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-faint">
                                                    入っていない
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-2 py-1.5 text-muted">
                                            {day(one.current_end)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </AdminShell>
    );
}
