import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { freePointsOf } from "@/lib/points";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/points/me — いま自分が何ポイント持っているか
 *
 * ★ 期限の切れていないぶんだけ。
 *
 *   半年で消えるので、切れた束は数えない。
 *
 * ★ 次に消える日も返す。
 *
 *   出さないと「知らないうちに減った」になる。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        /* 入っていない人には、何も返さない */
        if (!user) return NextResponse.json({});

        const free = await freePointsOf(user.id);

        /*
         * 次に消える束。
         *
         * ★ まだ残っているものだけ見る。
         *   使い切った束は、消えても困らない。
         */
        const { data: soon } = await supabase
            .from("free_point_lots")
            .select("amount, used, expires_at")
            .eq("user_id", user.id)
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: true })
            .limit(10);

        const next = (soon ?? []).find(
            (row: any) => Number(row.amount) - Number(row.used) > 0,
        );

        return NextResponse.json({
            free,
            nextExpiresAt: next?.expires_at ?? null,
            nextExpiresAmount: next
                ? Number(next.amount) - Number(next.used)
                : 0,
        });
    } catch {
        return NextResponse.json({});
    }
}
