/**
 * ============================================================
 * 原石航路 Studio
 * /api/visit — 頁に着いたことを控える
 *
 * ★ 話を開いた数だけでは、流れが分からない。
 *
 *   サイトに着いた → 作品を見た → 本文を読んだ → 登録した
 *   のどこで止まったのかを知るために、
 *   どの種類の頁に着いたかを控える。
 *
 * ★ 名前は取らない。札だけを控える。
 *
 * ★ 見回りの機械は、印を付けて残す。
 *   消すと、あとから振り返れない。
 * ============================================================
 */

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { appConfig } from "@/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { looksLikeBot } from "@/lib/utils/bot";
import { nameSource } from "@/lib/utils/view-source";

/** 控える頁の種類 */
const KINDS = [
    "home",
    "novel",
    "episode",
    "search",
    "ranking",
    "signup",
    "other",
] as const;

export async function POST(request: Request) {
    try {
        const { kind, novelId, episodeId } = await request.json();

        if (!KINDS.includes(kind)) {
            return NextResponse.json({ ok: false }, { status: 400 });
        }

        const head = await headers();
        const jar = await cookies();

        const ua = head.get("user-agent") ?? "";

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        await createAdminClient()
            .from("visits")
            .insert({
                visitor_id: jar.get("gk-visitor")?.value ?? null,
                session_id: jar.get("gk-session")?.value ?? null,
                user_id: user?.id ?? null,
                kind,
                novel_id: novelId ?? null,
                episode_id: episodeId ?? null,
                source: nameSource(
                    head.get("referer") ?? "",
                    new URL(appConfig.siteUrl).host,
                ),
                device: /mobile|android|iphone|ipad/i.test(ua)
                    ? "mobile"
                    : "desktop",
                is_bot: looksLikeBot(ua),
            });

        return NextResponse.json({ ok: true });
    } catch {
        /* 控えられなくても、読む邪魔はしない */
        return NextResponse.json({ ok: false });
    }
}
