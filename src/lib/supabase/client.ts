/**
 * ============================================================
 * 原石航路 Studio
 * ブラウザ側の Supabase
 *
 * 画面から呼ぶのはこちら。
 * ログイン中の人として動くので、RLS がそのまま効く。
 * ============================================================
 */

import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/config/env.client";

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
    /*
     * 使い回す。
     * 呼ぶたびに作ると、ログイン状態を見張る仕組みが増え続ける。
     */
    if (cached) return cached;

    /*
     * ★ 合鍵の持ちを、はっきり決めておく。
     *
     *   何も渡さないと、置き場の決まりが既定のままで、
     *   ブラウザを閉じたときに消える扱いになることがある。
     *   「昨日は入れていたのに、朝に開いたら切れている」はこれ。
     *
     *   1 年もたせる。合鍵そのものは短い期限で更新し続けるので、
     *   長く持たせても危なくはない。
     */
    cached = createBrowserClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, {
        cookieOptions: {
            path: "/",
            sameSite: "lax",
            secure: typeof window !== "undefined" && window.location.protocol === "https:",
            maxAge: 60 * 60 * 24 * 365,
        },
    });
    return cached;
}
