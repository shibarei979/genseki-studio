/**
 * ============================================================
 * 原石航路 Studio
 * 運営用の Supabase 繋ぎ口
 *
 * 見える範囲の決まりを飛び越えて、すべての行を読み書きできる。
 *
 * このファイルは Server でしか動かない。
 * Client Component から呼ぶと、鍵がブラウザへ送られる。
 * ============================================================
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { requireServiceRoleKey, serverEnv } from "@/config/env.server";

export function createAdminClient() {
    return createSupabaseClient(
        serverEnv.supabaseUrl,
        requireServiceRoleKey(),
    );
}
