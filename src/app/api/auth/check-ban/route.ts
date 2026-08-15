/**
 * ============================================================
 * 原石航路 Studio
 * /api/auth/check-ban — この住所は BAN されているか
 *
 * 画面から banned_emails を直に読ませない。
 * あの表は運営しか読めないうえ、読めるようにすると
 * 「誰が BAN されているか」を誰でも調べられてしまう。
 *
 * ここは「その住所が BAN かどうか」だけを返す。
 * 理由や、いつ BAN されたかは返さない。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    try {
        const { email } = await request.json();
        const target = String(email ?? "").trim().toLowerCase();

        if (!target) return NextResponse.json({ banned: false });

        const { data } = await createAdminClient()
            .from("banned_emails")
            .select("email")
            .eq("email", target)
            .maybeSingle();

        return NextResponse.json({ banned: !!data });
    } catch {
        /*
         * 確かめられなかったときは通す。
         *
         * ここで止めると、この入口が落ちているあいだ
         * 誰もログインできなくなる。
         * BAN の取りこぼしより、全員が入れないほうが重い。
         */
        return NextResponse.json({ banned: false });
    }
}
