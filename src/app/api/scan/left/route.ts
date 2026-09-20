import { NextResponse } from "next/server";

import { scanLeft } from "@/lib/subscription/scan-quota";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/scan/left — あと何回使えるか
 *
 * ★ 画面に出すためだけの口。数は減らさない。
 *
 *   前はブラウザの中の数を出していたので、
 *   消せば「3回」に戻って見えた。
 *   数えているところと、出しているところを揃える。
 *
 * ★ 無制限のときは left が null で返る。
 *   画面はそれを見て「無制限」と出す。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export async function GET() {
    const [full, latest] = await Promise.all([
        scanLeft("full"),
        scanLeft("latest"),
    ]);

    return NextResponse.json({
        full: { left: full.left, limit: full.limit, used: full.used },
        latest: { left: latest.left, limit: latest.limit, used: latest.used },
    });
}
