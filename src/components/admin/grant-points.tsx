"use client";

import { useState } from "react";

/**
 * ============================================================
 * 原石航路 Studio
 * GrantPoints — 運営が手で配る・取り消す
 *
 * ★ 試すために要る。
 *
 *   ミッションの条件を満たすには時間がかかる。
 *   数字が正しく動くかを見るのに、
 *   手で入れられる口が無いと確かめようがない。
 *
 * ★ 取り消しも置く。
 *
 *   不正が見つかったときに減らせないと、
 *   増えたままになる。
 *
 * ★ 取り消しは、二度押しで確かめる。
 *
 *   人のポイントを減らす操作なので、
 *   手が滑ったときに戻せない。
 * ============================================================
 */

export default function GrantPoints() {
    const [target, setTarget] = useState("");
    const [amount, setAmount] = useState(100);
    const [note, setNote] = useState("");

    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [askRevoke, setAskRevoke] = useState(false);

    async function run(action: "grant" | "revoke") {
        if (!target.trim() || amount <= 0) {
            setMessage("相手と数を入れてください。");
            return;
        }

        setBusy(true);
        setMessage("");

        try {
            const response = await fetch("/api/admin/points", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    target: target.trim(),
                    amount,
                    note: note.trim() || undefined,
                }),
            });

            const data = (await response.json()) as {
                ok?: boolean;
                left?: number;
                error?: string;
            };

            if (!response.ok || data.error) {
                setMessage(data.error ?? "うまくいきませんでした。");
            } else {
                setMessage(
                    action === "grant"
                        ? `${amount} pt 配りました。いま ${data.left} pt です。`
                        : `${amount} pt 取り消しました。いま ${data.left} pt です。`,
                );
                setAskRevoke(false);
            }
        } catch {
            setMessage("繋がりませんでした。");
        }

        setBusy(false);
    }

    const field: React.CSSProperties = {
        border: "1px solid var(--color-brand-border)",
        borderRadius: 8,
        padding: "7px 10px",
        fontSize: 13,
        background: "var(--color-bg-card)",
        color: "var(--color-text)",
    };

    return (
        <section
            style={{
                marginBottom: 24,
                padding: "16px 18px",
                borderRadius: 12,
                border: "1px solid var(--color-brand-border)",
                background: "var(--color-bg-card)",
            }}
        >
            <h2
                style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--color-text)",
                }}
            >
                手で配る
            </h2>

            <p
                style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "var(--color-text-faint)",
                }}
            >
                試すためのものです。名前でも、利用者の id でも渡せます。
            </p>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 12,
                }}
            >
                <input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="名前 または id"
                    aria-label="配る相手"
                    style={{ ...field, flex: "1 1 200px" }}
                />

                <input
                    type="number"
                    value={amount}
                    min={1}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    aria-label="数"
                    style={{ ...field, width: 100 }}
                />

                <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="覚え書き（任意）"
                    aria-label="覚え書き"
                    style={{ ...field, flex: "1 1 160px" }}
                />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run("grant")}
                    style={{
                        padding: "8px 20px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--color-brand)",
                        color: "var(--color-text-inverse)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.5 : 1,
                    }}
                >
                    配る
                </button>

                {/*
                  * ★ 取り消しは、二度押しで確かめる。
                  *   人のポイントを減らす操作は、戻せない。
                  */}
                {askRevoke ? (
                    <>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void run("revoke")}
                            style={{
                                padding: "8px 20px",
                                borderRadius: 8,
                                border: "1px solid var(--color-danger)",
                                background: "var(--color-danger)",
                                color: "#fff",
                                fontSize: 13,
                                cursor: "pointer",
                            }}
                        >
                            本当に取り消す
                        </button>

                        <button
                            type="button"
                            onClick={() => setAskRevoke(false)}
                            style={{
                                padding: "8px 14px",
                                borderRadius: 8,
                                border: "1px solid var(--color-brand-border)",
                                background: "none",
                                color: "var(--color-text-muted)",
                                fontSize: 13,
                                cursor: "pointer",
                            }}
                        >
                            やめる
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => setAskRevoke(true)}
                        style={{
                            padding: "8px 20px",
                            borderRadius: 8,
                            border: "1px solid var(--color-brand-border)",
                            background: "none",
                            color: "var(--color-text-muted)",
                            fontSize: 13,
                            cursor: "pointer",
                        }}
                    >
                        取り消す
                    </button>
                )}
            </div>

            {message && (
                <p
                    style={{
                        marginTop: 10,
                        fontSize: 12,
                        lineHeight: 1.7,
                        color: "var(--color-text)",
                    }}
                >
                    {message}
                </p>
            )}
        </section>
    );
}
