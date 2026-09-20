import { NextResponse } from "next/server";

import { memberFeatures } from "@/lib/subscription/features";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/member/features — 会員だけが使えるもの
 *
 * ★ 見た目を切り替えるためだけの口。
 *
 *   ここで false が返っても、画面の作りは変わらない。
 *   囲みが出ないだけで、図はこれまでどおり描ける。
 *
 * ★ 入っていない人にも、ふつうに返す。
 *   断ると、画面の側で「失敗した」と見分けが付かない。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export async function GET() {
    const features = await memberFeatures();

    return NextResponse.json(features);
}
