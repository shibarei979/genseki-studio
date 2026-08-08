/**
 * ============================================================
 * 原石航路 Studio
 * ログイン状態を保つ
 *
 * Supabase の合鍵は期限が短い。
 * 毎回の要求で更新しないと、しばらく開いていただけで切れる。
 * ============================================================
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { clientEnv } from "@/config/env.client";

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        clientEnv.supabaseUrl,
        clientEnv.supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(list: { name: string; value: string; options?: Record<string, unknown> }[]) {
                    for (const { name, value } of list) {
                        request.cookies.set(name, value);
                    }
                    response = NextResponse.next({ request });
                    for (const { name, value, options } of list) {
                        response.cookies.set(name, value, options);
                    }
                },
            },
        },
    );

    /*
     * ここで呼ぶことで合鍵が更新される。
     * 返り値は使わないが、呼ぶこと自体に意味がある。
     */
    await supabase.auth.getUser();

    return response;
}
