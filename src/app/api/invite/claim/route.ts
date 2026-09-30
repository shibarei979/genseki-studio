import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { claimInvite } from "@/lib/invite";

/**
 * /api/invite/claim — 招待リンクから来た人を、招待された人として控える
 *
 *   POST { code }
 *   返り値の final が true なら、もう送り直さなくてよい（成功でも、受けられない理由でも）。
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "入っていません" }, { status: 401 });

        const body = (await request.json().catch(() => ({}))) as { code?: string };
        if (!body.code) return NextResponse.json({ error: "コードがありません", final: true }, { status: 400 });

        const result = await claimInvite({
            inviteeId: user.id,
            inviteeCreatedAt: user.created_at,
            code: body.code,
        });
        return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    } catch (caught) {
        return NextResponse.json(
            { error: caught instanceof Error ? caught.message : "うまくいきません" },
            { status: 500 },
        );
    }
}
