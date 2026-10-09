/**
 * ============================================================
 * 原石航路 Studio
 * recordPageView — 話の閲覧を 1 件残す（サーバーの側）
 *
 * ★ 話の頁を組み立てたときに数える（2026-10-09 にこちらへ戻した）。
 *
 *   いっとき「画面が開いて 1.5 秒見えてから」数えるようにしたが、
 *   名乗らない機械（ブラウザのふりをして頁を取っていくもの）が数に入らなくなり、
 *   作品の閲覧数がほとんど増えなくなった。
 *   運営の判断で、名乗らない機械のぶんは閲覧数に入れたままにする。
 *
 * ★ ここで決めること
 *   ・作者が自分の作品を開いた → 印（is_author）を付けて残す（閲覧数には入れない）
 *   ・名乗りから見回りの機械と分かる → 印（is_bot）を付けて残す（閲覧数には入れない）
 *   ・ログインしている人が同じ日（日本時間）に同じ話をもう一度開いた → 足さない
 *
 * ★ 失敗しても読むのは止めない（黙って何もしない）。
 * ============================================================
 */

import { cookies, headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { looksLikeBotRequest } from "@/lib/utils/bot";

const SOURCES = new Set(["direct", "site", "search", "x", "line", "youtube", "instagram", "tiktok", "note", "other", "social", "mail"]);

export async function recordPageView({
    novelId,
    episodeId,
    source,
    authorId,
}: {
    novelId: string;
    episodeId: string;
    source: string;
    /** 分かっていれば渡す（作品をもう一度読まずに済む） */
    authorId?: string | null;
}): Promise<"ok" | "skipped" | "failed"> {
    if (!novelId || !episodeId) return "skipped";

    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        let owner = authorId ?? null;
        if (owner === null) {
            const { data: novel } = await supabase.from("novels").select("author_id").eq("id", novelId).maybeSingle();
            owner = (novel?.author_id as string | undefined) ?? null;
        }
        const isAuthorView = !!user && owner === user.id;

        const head = await headers();
        const ua = head.get("user-agent") || "";
        const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
        const isBot = looksLikeBotRequest(head);

        const jar = await cookies();
        const visitorId = jar.get("gk-visitor")?.value ?? null;
        const sessionId = jar.get("gk-session")?.value ?? null;

        const raw = typeof source === "string" && source.length <= 20 ? source : "direct";
        const safeSource = SOURCES.has(raw) || /^[a-z0-9_-]{1,20}$/.test(raw) ? raw : "other";

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
            if (existing) return "skipped";
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
        return "ok";
    } catch {
        return "failed";
    }
}
