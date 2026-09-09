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

    /*
     * ★ 裏方の入口（/api）は送り返さない。
     *
     *   定時の見回りは、置き場が配る住所を叩く。
     *   ここで送り返すと、見回りは付いて来ないので
     *   中の処理が一度も走らない。
     *
     *   実際、予約が 2 日ぶん 15 件溜まった。
     *   毎分きちんと来ていたのに、毎分 308 で追い返していた。
     *
     *   送り返すのは検索のためで、
     *   /api は検索に載らない。外す。
     */
    const isBackstage = request.nextUrl.pathname.startsWith("/api/");

    if (
        !isBackstage &&
        host &&
        host !== site.host &&
        host.endsWith(".vercel.app")
    ) {
        const to = new URL(request.nextUrl.pathname + request.nextUrl.search, site);
        return NextResponse.redirect(to, 308);
    }

    // 繋いでいないときは何もしない
    const response = hasSupabase()
        ? await updateSession(request)
        : NextResponse.next();

    /*
     * ★ 訪れた人に、意味の無い札を 1 つ配る。
     *
     *   いま「入っていない人の閲覧 419」が何人か分からない。
     *   5人が読み回ったのか 300人が来たのかで、意味が正反対になる。
     *
     * ★ 名前も、住所も、機械の型番も取らない。
     *   でたらめな並びを 1 つ持つだけ。
     *   消せば、次から別の札になる。
     *
     * ★ ここで配ると、最初の 1 頁から数えられる。
     *   画面の側で配ると、1 頁目だけ数え落とす。
     *
     *   visitor  1 年。何人が来たかを数える
     *   session  30 分。1 回の訪問を追う
     */
    if (!request.cookies.get("gk-visitor")) {
        response.cookies.set("gk-visitor", makeToken(), {
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
            path: "/",
        });
    }

    if (!request.cookies.get("gk-session")) {
        response.cookies.set("gk-session", makeToken(), {
            maxAge: 60 * 30,
            sameSite: "lax",
            path: "/",
        });
    }

    return response;
}

/** でたらめな並び。意味は持たない */
function makeToken(): string {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
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
