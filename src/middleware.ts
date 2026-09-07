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

import { appConfig } from "@/config";

import { hasSupabase } from "@/config/env.client";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
    /*
     * ★ 別の住所で開かれたら、本来の住所へ送る。
     *
     *   置き場（Vercel）が配る住所でも、同じ中身が開ける。
     *   検索の側は、それを別のサイトとみなして両方を載せ、
     *   評価が二手に分かれる。
     *   実際、gensekikoro.vercel.app の頁が検索に出ていた。
     *
     *   本来の住所へ 1 本にまとめる。
     */
    const host = request.headers.get("host") ?? "";
    const site = new URL(appConfig.siteUrl);

    if (host && host !== site.host && host.endsWith(".vercel.app")) {
        const to = new URL(request.nextUrl.pathname + request.nextUrl.search, site);
        return NextResponse.redirect(to, 308);
    }

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
