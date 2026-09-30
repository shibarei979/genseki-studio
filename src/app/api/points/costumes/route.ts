import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/points/costumes?ids=a,b,c — その人たちがつけているアイコン衣装
 *
 * ★ コメント欄など、たくさんの人のアイコンが並ぶ所で使う。
 *   返すのは衣装の絵の住所だけ（ほかの中身は返さない）。
 * ★ 一度に 100 人まで。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const ids = (new URL(request.url).searchParams.get("ids") ?? "")
            .split(",")
            .map((id) => id.trim())
            .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
            .slice(0, 100);
        if (ids.length === 0) return NextResponse.json({ costumes: {} });

        const { data } = await createAdminClient()
            .from("profiles")
            .select("user_id, costume_url")
            .in("user_id", ids)
            .not("costume_url", "is", null);

        const costumes: Record<string, string> = {};
        for (const row of (data ?? []) as { user_id: string; costume_url: string | null }[]) {
            if (row.costume_url) costumes[row.user_id] = row.costume_url;
        }
        return NextResponse.json({ costumes });
    } catch {
        return NextResponse.json({ costumes: {} });
    }
}
