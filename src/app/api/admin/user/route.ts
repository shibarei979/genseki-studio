/**
 * ============================================================
 * 原石航路 Studio
 * /api/admin/user — 利用者を BAN する・消す
 *
 * どちらも運営だけ。ここでしかできないのは、
 * 認証そのものを触るのに運営用の鍵が要るため。
 * その鍵は Server から出してはいけないので、
 * 画面から直に触らせず、この入口を通す。
 *
 *   ban     ログインごと止める。同じ住所では入り直せない
 *   delete  記録を消すだけ。同じ住所でまた登録できる
 *
 * どちらも書いたものは消さない。
 * 作品まで消えると、読んでいた人の頁が急に消える。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    try {
        const { action, userId, reason } = await request.json();

        if (action !== "ban" && action !== "delete") {
            return NextResponse.json(
                { error: "何をするか分かりません" },
                { status: 400 },
            );
        }
        if (!userId) {
            return NextResponse.json(
                { error: "誰に対してか分かりません" },
                { status: 400 },
            );
        }

        const supabase = await createClient();

        /* 運営かどうか確かめる */
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "ログインしていません" },
                { status: 401 },
            );
        }

        const { data: me } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("user_id", user.id)
            .single();

        if (!me?.is_admin) {
            return NextResponse.json(
                { error: "運営だけができます" },
                { status: 403 },
            );
        }

        if (userId === user.id) {
            return NextResponse.json(
                { error: "自分には行えません" },
                { status: 400 },
            );
        }

        const admin = createAdminClient();

        /* 相手の住所を控える。BAN の記録と、消したあとの照合に使う */
        const { data: target } = await admin
            .from("profiles")
            .select("email, is_admin")
            .eq("user_id", userId)
            .maybeSingle();

        if (target?.is_admin) {
            return NextResponse.json(
                { error: "運営には行えません" },
                { status: 400 },
            );
        }

        const email = (target?.email ?? "").trim().toLowerCase();

        if (action === "ban") {
            /*
             * 住所を控えてから消す。
             *
             * 認証を消さずに「入れなくする」だけだと、
             * 合鍵が残っているあいだは動けてしまう。
             * 消したうえで、同じ住所を控えておき、
             * 入り直そうとしたときに弾く。
             */
            if (email) {
                await admin.from("banned_emails").upsert({
                    email,
                    reason: (reason ?? "").trim() || null,
                    banned_by: user.id,
                });
            }

            await admin
                .from("profiles")
                .update({
                    suspended_at: new Date().toISOString(),
                    suspend_reason: (reason ?? "").trim() || null,
                })
                .eq("user_id", userId);

            const { error } = await admin.auth.admin.deleteUser(userId);
            if (error) {
                return NextResponse.json(
                    { error: `止められませんでした：${error.message}` },
                    { status: 500 },
                );
            }

            return NextResponse.json({ ok: true, email });
        }

        /*
         * 消すだけ。
         * 住所は控えない。また登録できる。
         */
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) {
            return NextResponse.json(
                { error: `消せませんでした：${error.message}` },
                { status: 500 },
            );
        }

        return NextResponse.json({ ok: true });
    } catch (caught) {
        return NextResponse.json(
            {
                error:
                    caught instanceof Error
                        ? caught.message
                        : "うまくいきませんでした",
            },
            { status: 500 },
        );
    }
}
