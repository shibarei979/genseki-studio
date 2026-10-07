import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { contestMarksFor } from "@/lib/contest-marks";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/contest-marks?ids=作品id,作品id,…
 *
 *   作品ごとに、出しているコンテスト（公開しているものだけ）を返す。
 *   画面の側で作品を読む所（執筆向けホームの作品の棚など）で、「応募中」の札を出すのに使う。
 *
 * ★ 返すのは、誰でも見られるもの（コンテストの応募作の一覧と同じ）だけ。
 * ★ 一度に読むのは 200 作まで。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const raw = new URL(request.url).searchParams.get("ids") ?? "";
    const ids = raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-zA-Z_-]{1,64}$/.test(id))
        .slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ marks: {} });

    try {
        const supabase = await createClient();
        const marks = await contestMarksFor(supabase, ids);
        return NextResponse.json({ marks });
    } catch {
        return NextResponse.json({ marks: {} });
    }
}
