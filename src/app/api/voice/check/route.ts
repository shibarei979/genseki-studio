import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { serverEnv } from "@/config/env.server";

/**
 * ============================================================
 * 原石航路 Studio
 * 鍵の確かめ（調べる用）
 *
 * 運営用の鍵で episodes が読めるかだけを見る。
 *
 * 「permission denied」が出るのに原因が掴めないので、
 * 鍵の形と、実際に読めるかを、その場で確かめる。
 *
 * 原因が分かったら、このファイルは消すこと。
 * 置いたままにすると、鍵の様子が外から見える。
 * ============================================================
 */

export async function GET() {
    const key = serverEnv.supabaseServiceRoleKey;

    /* 鍵の中身。値そのものは出さない */
    let role = "読めません";
    try {
        const payload = JSON.parse(
            Buffer.from(key.split(".")[1] ?? "", "base64").toString(),
        ) as { role?: string };
        role = payload.role ?? "役割が入っていません";
    } catch {
        /*
         * 新しい形式（sb_secret_...）は、この形ではない。
         * その場合はここへ来る。
         */
        role = key.startsWith("sb_") ? "新しい形式の鍵" : "形が読めません";
    }

    const admin = createAdminClient(serverEnv.supabaseUrl, key);

    const { error } = await admin.from("episodes").select("id").limit(1);

    return NextResponse.json({
        鍵の長さ: key.length,
        鍵の役割: role,
        話を読めたか: error ? `いいえ: ${error.message}` : "はい",
    });
}
