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

    cached = createBrowserClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey);
    return cached;
}
