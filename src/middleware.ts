/**
 * ============================================================
 * 原石航路 Studio
 * すべての要求の前に通る場所
 *
 * ログイン状態を保つためだけに使う。
 * ここで行き先を止めたりはしない。
 * ============================================================
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { hasSupabase } from "@/config/env.client";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
    // 繋いでいないときは何もしない
    if (!hasSupabase()) return NextResponse.next();

    return updateSession(request);
}

export const config = {
    matcher: [
        /*
         * 画像や静的ファイルは通さない。
         * 毎回合鍵を更新する必要がなく、そのぶん速い。
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
