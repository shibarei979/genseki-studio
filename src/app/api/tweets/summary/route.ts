/**
 * ============================================================
 * 原石航路 Studio
 * /api/tweets/summary — 話題ごとの数と、公式のお知らせ
 *
 * ★ コミュニティー画面が表を直に数えていたので、ここへ寄せる。
 *   数えるだけでも、表に触れる道が残ると権限を外せない。
 *
 * ★ 隠したものは、数からも外す。
 *   数だけ合っていると、そこに何かある、と分かってしまう。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    try {
        const { keys } = await request.json();
        const admin = createAdminClient();

        const { count: total } = await admin
            .from("tweets")
            .select("id", { count: "exact", head: true })
            .eq("hidden_by_admin", false);

        const list: string[] = Array.isArray(keys) ? keys.slice(0, 20) : [];

        const counts = await Promise.all(
            list.map(async (key) => {
                const { count } = await admin
                    .from("tweets")
                    .select("id", { count: "exact", head: true })
                    .eq("hidden_by_admin", false)
                    .eq("topic", key);
                return { key, count: count ?? 0 };
            }),
        );

        const { data: notices } = await admin
            .from("tweets")
            .select("id, body")
            .eq("topic", "notice")
            .eq("hidden_by_admin", false)
            .order("created_at", { ascending: false })
            .limit(3);

        return NextResponse.json({
            total: total ?? 0,
            counts,
            notices: notices ?? [],
        });
    } catch {
        return NextResponse.json({ total: 0, counts: [], notices: [] });
    }
}
