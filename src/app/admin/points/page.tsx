import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * 原石航路 Studio
 * /admin/points — 無料ポイントの様子
 *
 * ★ 運営だけが見る。
 *
 *   読む人にはまだ何も出していない。
 *   数字が正しく動くのを、ここで確かめてから出す。
 *
 * ★ 見たいのは 3 つ。
 *
 *     いま出回っている量
 *     何で増えたか
 *     誰がたくさん持っているか
 *
 *   3 つ目は、不正を見つけるために要る。
 *   招待で増やし続けている口座は、ここに出る。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export default async function AdminPointsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <main style={{ padding: 40 }}>
                <p>入っていません。</p>
            </main>
        );
    }

    const admin = createAdminClient();

    const { data: me } = await admin
        .from("profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle();

    if (me?.is_admin !== true) {
        return (
            <main style={{ padding: 40 }}>
                <p>この画面は運営だけが見られます。</p>
            </main>
        );
    }

    /*
     * ★ 束から数える。
     *
     *   期限の切れていないものだけが、いまの持ち高。
     *   切れたものは「消えた」として別に数える。
     */
    const { data: lots } = await admin
        .from("free_point_lots")
        .select("user_id, amount, used, source, expires_at");

    const now = Date.now();

    let live = 0;
    let spent = 0;
    let expired = 0;

    const bySource: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    for (const lot of lots ?? []) {
        const amount = Number(lot.amount);
        const used = Number(lot.used);
        const rest = amount - used;
        const isLive = new Date(lot.expires_at).getTime() > now;

        spent += used;

        if (isLive) {
            live += rest;
            byUser[lot.user_id] = (byUser[lot.user_id] ?? 0) + rest;
        } else {
            expired += rest;
        }

        bySource[lot.source] = (bySource[lot.source] ?? 0) + amount;
    }

    /* たくさん持っている人。上から 20 人 */
    const top = Object.entries(byUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

    const nameById = new Map<string, string>();

    if (top.length > 0) {
        const { data: people } = await admin
            .from("public_profiles")
            .select("user_id, display_name")
            .in(
                "user_id",
                top.map(([id]) => id),
            );

        for (const one of people ?? []) {
            nameById.set(
                (one as any).user_id,
                (one as any).display_name ?? "",
            );
        }
    }

    const box: React.CSSProperties = {
        border: "1px solid var(--color-brand-border)",
        borderRadius: 12,
        padding: "16px 18px",
        background: "var(--color-bg-card)",
    };

    return (
        <main
            style={{
                maxWidth: 880,
                margin: "0 auto",
                padding: "32px 20px 64px",
            }}
        >
            <Link
                href="/admin"
                style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    textDecoration: "none",
                }}
            >
                ‹ 運営の画面へもどる
            </Link>

            <h1
                style={{
                    fontSize: 20,
                    fontWeight: 700,
                    margin: "10px 0 4px",
                    color: "var(--color-text)",
                }}
            >
                無料ポイント
            </h1>

            <p
                style={{
                    fontSize: 12,
                    color: "var(--color-text-faint)",
                    marginBottom: 20,
                }}
            >
                まだ読む人には出していません。数字が正しく動くかを、ここで確かめます。
            </p>

            {/* いまの様子 */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 12,
                    marginBottom: 24,
                }}
            >
                {[
                    { label: "いま出回っている", value: live, note: "期限内の残り" },
                    { label: "使われた", value: spent, note: "交換に使った量" },
                    { label: "消えた", value: expired, note: "期限切れ" },
                    {
                        label: "持っている人",
                        value: Object.keys(byUser).length,
                        note: "1pt 以上",
                    },
                ].map((one) => (
                    <div key={one.label} style={box}>
                        <div
                            style={{
                                fontSize: 11,
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {one.label}
                        </div>
                        <div
                            style={{
                                fontSize: 24,
                                fontWeight: 700,
                                color: "var(--color-text)",
                                margin: "4px 0 2px",
                            }}
                        >
                            {one.value.toLocaleString()}
                        </div>
                        <div
                            style={{
                                fontSize: 10.5,
                                color: "var(--color-text-faint)",
                            }}
                        >
                            {one.note}
                        </div>
                    </div>
                ))}
            </div>

            {/* 何で増えたか */}
            <section style={{ ...box, marginBottom: 24 }}>
                <h2
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 10,
                        color: "var(--color-text)",
                    }}
                >
                    何で配ったか
                </h2>

                {Object.keys(bySource).length === 0 ? (
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--color-text-faint)",
                        }}
                    >
                        まだ 1 件も配っていません。
                    </p>
                ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {Object.entries(bySource)
                            .sort((a, b) => b[1] - a[1])
                            .map(([source, total]) => (
                                <li
                                    key={source}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "6px 0",
                                        fontSize: 12.5,
                                        color: "var(--color-text)",
                                        borderTop:
                                            "1px solid var(--color-border)",
                                    }}
                                >
                                    <span>
                                        {source === "mission"
                                            ? "ミッション"
                                            : source === "invite"
                                              ? "招待した"
                                              : source === "invited"
                                                ? "招待された"
                                                : source === "admin"
                                                  ? "運営が配った"
                                                  : source}
                                    </span>
                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {total.toLocaleString()} pt
                                    </span>
                                </li>
                            ))}
                    </ul>
                )}
            </section>

            {/* たくさん持っている人 */}
            <section style={box}>
                <h2
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 4,
                        color: "var(--color-text)",
                    }}
                >
                    たくさん持っている人
                </h2>

                <p
                    style={{
                        fontSize: 11,
                        color: "var(--color-text-faint)",
                        marginBottom: 10,
                    }}
                >
                    不正を見つけるために出しています。招待で増やし続けている口座は、ここに並びます。
                </p>

                {top.length === 0 ? (
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--color-text-faint)",
                        }}
                    >
                        まだ誰も持っていません。
                    </p>
                ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {top.map(([id, amount]) => (
                            <li
                                key={id}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    padding: "6px 0",
                                    fontSize: 12.5,
                                    color: "var(--color-text)",
                                    borderTop: "1px solid var(--color-border)",
                                }}
                            >
                                <span
                                    style={{
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {nameById.get(id) || id.slice(0, 8)}
                                </span>
                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {amount.toLocaleString()} pt
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
