import Link from "next/link";

import AdminCommentsClient from "@/components/admin/admin-comments-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * ============================================================
 * 原石航路 Studio
 * /admin/comments  コメントの一覧
 *
 * 新しい順に並べ、目に余るものを運営が消す。
 *
 * ★ ダッシュボードの「総コメント数」から来る。
 *   数だけ見せて中身が見られないと、
 *   荒れているかどうかが分からない。
 * ============================================================
 */

const PER_PAGE = 100;

export default async function AdminCommentsPage({
    searchParams,
}: {
    searchParams: { page?: string };
}) {
    const supabase = await createClient();

    const page = Math.max(1, Number(searchParams.page) || 1);
    const from = (page - 1) * PER_PAGE;

    const { data: rows, count } = await supabase
        .from("comments")
        .select("id, body, created_at, user_id, novel_id, episode_id, parent_id", {
            count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(from, from + PER_PAGE - 1);

    const comments = rows ?? [];

    /*
     * 名前と作品名を、まとめて引く。
     *
     * 1 件ずつ引くと、100 件で 200 回の往復になる。
     */
    const userIds = Array.from(
        new Set(comments.map((c) => c.user_id).filter(Boolean)),
    ) as string[];
    const novelIds = Array.from(
        new Set(comments.map((c) => c.novel_id).filter(Boolean)),
    ) as string[];

    const [{ data: profiles }, { data: novels }] = await Promise.all([
        userIds.length > 0
            ? supabase
                  .from("public_profiles")
                  .select("user_id, display_name")
                  .in("user_id", userIds)
            : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
        novelIds.length > 0
            ? supabase.from("novels").select("id, title").in("id", novelIds)
            : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);

    const nameById: Record<string, string> = {};
    (profiles ?? []).forEach((p) => {
        nameById[p.user_id] = p.display_name || "";
    });

    const titleById: Record<string, string> = {};
    (novels ?? []).forEach((n) => {
        titleById[n.id] = n.title || "無題";
    });

    const total = count ?? 0;
    const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

    return (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
            <div style={{ marginBottom: 18 }}>
                <Link
                    href="/admin"
                    style={{
                        fontSize: 12,
                        color: "var(--admin-stat-blue)",
                        textDecoration: "none",
                    }}
                >
                    ← ダッシュボードへ
                </Link>

                <h1
                    style={{
                        marginTop: 8,
                        fontSize: 20,
                        fontWeight: 700,
                        color: "var(--admin-text)",
                    }}
                >
                    コメント
                </h1>
                <p
                    style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: "var(--admin-text-muted)",
                    }}
                >
                    全 {total.toLocaleString()} 件　新しい順
                </p>
            </div>

            <AdminCommentsClient
                comments={comments.map((c) => ({
                    id: c.id as string,
                    body: (c.body as string) || "",
                    created_at: c.created_at as string,
                    author: nameById[c.user_id as string] || "（不明）",
                    novelTitle: titleById[c.novel_id as string] || "（不明）",
                    novelId: c.novel_id as string,
                    episodeId: c.episode_id as string,
                    isReply: Boolean(c.parent_id),
                }))}
            />

            {/* 頁送り */}
            {lastPage > 1 && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 8,
                        marginTop: 20,
                    }}
                >
                    {page > 1 && (
                        <Link href={`/admin/comments?page=${page - 1}`} style={pagerStyle}>
                            前へ
                        </Link>
                    )}
                    <span
                        style={{
                            ...pagerStyle,
                            border: "none",
                            color: "var(--admin-text-muted)",
                        }}
                    >
                        {page} / {lastPage}
                    </span>
                    {page < lastPage && (
                        <Link href={`/admin/comments?page=${page + 1}`} style={pagerStyle}>
                            次へ
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

const pagerStyle = {
    padding: "7px 16px",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--admin-text)",
    textDecoration: "none",
} as const;
