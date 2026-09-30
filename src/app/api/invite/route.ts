import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { inviteSummaryOf, rewardInviteIfReady } from "@/lib/invite";

/**
 * /api/invite — 自分の招待コードと、招待した人数
 *
 * ★ 開いたついでに、自分が招待された側なら、配れるか確かめる。
 */

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "入っていません" }, { status: 401 });

        const rewardedNow = await rewardInviteIfReady(user.id).catch(() => false);
        const summary = await inviteSummaryOf(user.id, user.created_at);
        return NextResponse.json({ ...summary, rewardedNow });
    } catch (caught) {
        return NextResponse.json(
            { error: caught instanceof Error ? caught.message : "読めません" },
            { status: 500 },
        );
    }
}
