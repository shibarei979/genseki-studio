/**
 * ============================================================
 * 原石航路 Studio
 * サーバー側の Supabase
 *
 * Server Component や API から呼ぶ。
 * 訪問者の cookie を読んで、その人として動く。
 * ============================================================
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/config/env.client";

export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(list: { name: string; value: string; options?: Record<string, unknown> }[]) {
                /*
                 * Server Component からは cookie を書けない。
                 * middleware が更新するので、ここで失敗しても構わない。
                 */
                try {
                    for (const { name, value, options } of list) {
                        cookieStore.set(name, value, options);
                    }
                } catch {
                    // 握りつぶす
                }
            },
        },
    });
}
