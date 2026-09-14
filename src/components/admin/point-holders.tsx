"use client";

import { useMemo, useState } from "react";

/**
 * ============================================================
 * 原石航路 Studio
 * PointHolders — 誰が何ポイント持っているか
 *
 * ★ 全員ぶん出す。0 pt の人も。
 *
 *   「誰が持っているか」を見る場所なので、
 *   持っていない人も含めて一覧でないと意味がない。
 *
 * ★ 多い順。
 *
 *   招待で増やし続けている口座は、上に並ぶ。
 *   不正を見つけるのに要る。
 *
 * ★ 名前で探せる。
 *
 *   人が増えると、目で探すのは無理。
 *
 * ★ はじめは 50 人まで。
 *
 *   何百人も一度に出すと、開くのが遅くなる。
 *   足りなければ押して伸ばす。
 * ============================================================
 */

interface Holder {
    id: string;
    name: string;
    points: number;
}

const STEP = 50;

export default function PointHolders({ holders }: { holders: Holder[] }) {
    const [word, setWord] = useState("");
    const [shown, setShown] = useState(STEP);

    const found = useMemo(() => {
        const needle = word.trim();
        if (!needle) return holders;

        return holders.filter(
            (one) =>
                one.name.includes(needle) ||
                one.id.startsWith(needle),
        );
    }, [holders, word]);

    const holding = holders.filter((one) => one.points > 0).length;

    const box: React.CSSProperties = {
        border: "1px solid var(--color-brand-border)",
        borderRadius: 12,
        padding: "16px 18px",
        background: "var(--color-bg-card)",
    };

    return (
        <section style={box}>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    gap: 10,
                }}
            >
                <h2
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--color-text)",
                    }}
                >
                    誰が何ポイント持っているか
                </h2>

                <span
                    style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
                >
                    {holders.length}人中 {holding}人が持っています
                </span>
            </div>

            <p
                style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "var(--color-text-faint)",
                }}
            >
                多い順。招待で増やし続けている口座は、上に並びます。
            </p>

            <input
                type="text"
                value={word}
                onChange={(e) => {
                    setWord(e.target.value);
                    setShown(STEP);
                }}
                placeholder="名前で探す"
                aria-label="名前で探す"
                style={{
                    marginTop: 10,
                    width: "min(100%, 240px)",
                    border: "1px solid var(--color-brand-border)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12.5,
                    background: "var(--color-bg-page)",
                    color: "var(--color-text)",
                }}
            />

            {found.length === 0 ? (
                <p
                    style={{
                        marginTop: 12,
                        fontSize: 12,
                        color: "var(--color-text-faint)",
                    }}
                >
                    見つかりません。
                </p>
            ) : (
                <>
                    <ul
                        style={{
                            listStyle: "none",
                            margin: "10px 0 0",
                            padding: 0,
                        }}
                    >
                        {found.slice(0, shown).map((one, at) => (
                            <li
                                key={one.id}
                                style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    gap: 10,
                                    padding: "6px 0",
                                    fontSize: 12.5,
                                    color: "var(--color-text)",
                                    borderTop: "1px solid var(--color-border)",
                                    /* 持っていない人は、少し沈める */
                                    opacity: one.points > 0 ? 1 : 0.45,
                                }}
                            >
                                <span
                                    style={{
                                        width: 28,
                                        flexShrink: 0,
                                        fontSize: 10.5,
                                        color: "var(--color-text-faint)",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {at + 1}
                                </span>

                                <span
                                    style={{
                                        minWidth: 0,
                                        flex: 1,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {one.name || one.id.slice(0, 8)}
                                </span>

                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontVariantNumeric: "tabular-nums",
                                        fontWeight: one.points > 0 ? 700 : 400,
                                    }}
                                >
                                    {one.points.toLocaleString()} pt
                                </span>
                            </li>
                        ))}
                    </ul>

                    {found.length > shown && (
                        <button
                            type="button"
                            onClick={() => setShown((now) => now + STEP)}
                            style={{
                                marginTop: 10,
                                background: "none",
                                border: "none",
                                padding: 0,
                                fontSize: 12,
                                color: "var(--color-brand)",
                                cursor: "pointer",
                                textDecoration: "underline",
                            }}
                        >
                            もっと見る（残り {found.length - shown}人）
                        </button>
                    )}
                </>
            )}
        </section>
    );
}
