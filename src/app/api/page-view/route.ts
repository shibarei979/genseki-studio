import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { looksLikeBotRequest } from "@/lib/utils/bot";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/page-view — 話の閲覧の記録（画面の側から 1 回だけ届く）
 *
 * ★ 前は話の頁を組み立てた時点（サーバー）で記録していた。
 *   画面を動かさない機械が頁を取るたびに数えてしまうので、画面からの知らせで数える。
 * ★ ここで決めること
 *   ・作者が自分の作品を開いた → 印（is_author）を付けて残す（閲覧数には入れない）
 *   ・名乗りなどから見回りの機械と分かる → 印（is_bot）を付けて残す
 *   ・ログインしている人が同じ日（日本時間）に同じ話をもう一度開いた → 足さない
 * ★ 誰が来たかではなく、何人来たかを数えるための札（gk-visitor / gk-session）だけを残す。
 * ============================================================
 */

export const dynamic = "force-dynamic";

const SOURCES = new Set(["direct", "site", "search", "x", "line", "youtube", "instagram", "tiktok", "note", "other", "social", "mail"]);

export async function POST(request: Request) {
    let body: { novel_id?: string; episode_id?: string; source?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const novelId = typeof body.novel_id === "string" ? body.novel_id : "";
    const episodeId = typeof body.episode_id === "string" ? body.episode_id : "";
    if (!novelId || !episodeId) return NextResponse.json({ ok: false }, { status: 400 });

    try {
        const supabase = await createClient();

        /* 話と作品が本当に組になっているか（でたらめな id で数を増やされないように） */
        const { data: episode } = await supabase
            .from("episodes")
            .select("id, novel_id")
            .eq("id", episodeId)
            .maybeSingle();
        if (!episode || episode.novel_id !== novelId) return NextResponse.json({ ok: true, skipped: "unknown" });

        const {
            data: { user },
        } = await supabase.auth.getUser();

        const { data: novel } = await supabase.from("novels").select("author_id").eq("id", novelId).maybeSingle();
        const isAuthorView = !!user && novel?.author_id === user.id;

        const head = await headers();
        const ua = head.get("user-agent") || "";
        const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
        const isBot = looksLikeBotRequest(head);

        const jar = await cookies();
        const visitorId = jar.get("gk-visitor")?.value ?? null;
        const sessionId = jar.get("gk-session")?.value ?? null;

        /* 来た経路は、頁を組み立てたときに決めた名前だけを受け取る（住所そのものは持たない） */
        const source = typeof body.source === "string" && body.source.length <= 20 ? body.source : "direct";
        const safeSource = SOURCES.has(source) || /^[a-z0-9_-]{1,20}$/.test(source) ? source : "other";

        if (user) {
            /* 同じ日（日本時間）に同じ話を開いていたら足さない */
            const todayStart = new Date(Math.floor((Date.now() + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000);
            const { data: existing } = await supabase
                .from("page_views")
                .select("id")
                .eq("episode_id", episodeId)
                .eq("user_id", user.id)
                .gte("viewed_at", todayStart.toISOString())
                .limit(1)
                .maybeSingle();
            if (existing) return NextResponse.json({ ok: true, skipped: "today" });
        }

        await supabase.from("page_views").insert({
            novel_id: novelId,
            episode_id: episodeId,
            user_id: user?.id ?? null,
            device,
            source: safeSource,
            is_author: isAuthorView,
            visitor_id: visitorId,
            session_id: sessionId,
            is_bot: isBot,
        });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
