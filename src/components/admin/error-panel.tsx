import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * 原石航路 Studio
 * ErrorPanel — 不具合の記録を、管理画面に小さく出す
 *
 * ★ 自分で読む。
 *
 *   admin/page.tsx の Promise.all には割り込まない。
 *   あそこは数え上げの順番が組んであり、
 *   割り込むと取りこぼしが出る。
 *
 * ★ 小さく出す。
 *
 *   何も起きていない日は、一行で済ませる。
 *   毎日いちばん上に大きな枠があると、
 *   そのうち見なくなる。
 *
 * ★ 起きているときだけ、目に付く色にする。
 *   数が出ているときだけ、赤みを差す。
 *
 * ★ 運営の鍵で読む。
 *   表の決まりで、ほかからは読めないようにしてある。
 * ============================================================
 */

export default async function ErrorPanel() {
    let recent: { message: string; path: string | null; created_at: string }[] = [];
    let week = 0;
    let today = 0;

    try {
        const admin = createAdminClient();

        /* 日本時間の今日の始まり */
        const now = new Date();
        const jstToday = new Date(
            now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) +
                "T00:00:00+09:00",
        );

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [{ count: weekCount }, { count: todayCount }, { data: rows }] =
            await Promise.all([
                admin
                    .from("error_events")
                    .select("*", { count: "exact", head: true })
                    .gte("created_at", weekAgo.toISOString()),
                admin
                    .from("error_events")
                    .select("*", { count: "exact", head: true })
                    .gte("created_at", jstToday.toISOString()),
                admin
                    .from("error_events")
                    .select("message, path, created_at")
                    .order("created_at", { ascending: false })
                    .limit(20),
            ]);

        week = weekCount ?? 0;
        today = todayCount ?? 0;
        recent = (rows ?? []) as typeof recent;
    } catch {
        /*
         * 読めなくても、管理画面は出す。
         * 表がまだ無い（SQL を流していない）ときは、ここに来る。
         */
        return null;
    }

    const isQuiet = week === 0;

    return (
        <section
            style={{
                marginBottom: 20,
                borderRadius: 10,
                border: `1px solid ${isQuiet ? "var(--color-border)" : "#e0b4b4"}`,
                background: isQuiet ? "var(--color-bg-card)" : "#fdf4f4",
                overflow: "hidden",
            }}
        >
            {/*
              * 見出し。
              *
              * ★ 押すと、中身が開く。
              *
              *   件数だけ出しても、何が起きたのか分からない。
              *   押せば読める形にしておけば、
              *   気になったときにその場で確かめられる。
              *
              * ★ 何も起きていない日は、一行で済ませる。
              *   毎日大きな枠があると、そのうち見なくなる。
              */}
            <details open={!isQuiet && today > 0}>
                <summary
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 12,
                        flexWrap: "wrap",
                        padding: "12px 16px",
                        cursor: "pointer",
                        listStyle: "none",
                    }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            letterSpacing: ".14em",
                            color: "var(--color-text-muted)",
                            fontWeight: 700,
                        }}
                    >
                        不具合
                    </span>

                    {isQuiet ? (
                        <span
                            style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                        >
                            この7日間、記録はありません
                        </span>
                    ) : (
                        <span style={{ fontSize: 12.5, color: "var(--color-text)" }}>
                            今日 <b style={{ fontSize: 15 }}>{today}</b> 件 ／ 7日で{" "}
                            <b style={{ fontSize: 15 }}>{week}</b> 件
                        </span>
                    )}

                    {recent.length > 0 && (
                        <span
                            style={{
                                marginLeft: "auto",
                                fontSize: 11,
                                color: "var(--color-text-faint)",
                            }}
                        >
                            押すと中身を見る
                        </span>
                    )}
                </summary>

                {recent.length > 0 && (
                    <ul
                        style={{
                            listStyle: "none",
                            margin: 0,
                            padding: "0 16px 12px",
                        }}
                    >
                        {recent.map((one, at) => (
                            <li
                                key={`${one.created_at}-${at}`}
                                style={{
                                    padding: "10px 0",
                                    borderTop: "1px solid var(--color-border)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 10,
                                        flexWrap: "wrap",
                                        fontSize: 11,
                                        color: "var(--color-text-faint)",
                                    }}
                                >
                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {new Date(one.created_at).toLocaleString("ja-JP", {
                                            timeZone: "Asia/Tokyo",
                                            month: "numeric",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>

                                    <span>{one.path || "画面は不明"}</span>
                                </div>

                                {/*
                                  * 中身。
                                  *
                                  * ★ 折り返して全部出す。
                                  *
                                  *   1 行に切り詰めると、肝心の場所が切れる。
                                  *   長くても、読めるほうがよい。
                                  */}
                                <p
                                    style={{
                                        marginTop: 4,
                                        fontSize: 12,
                                        lineHeight: 1.7,
                                        color: "var(--color-text)",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {one.message}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </details>
        </section>
    );
}
