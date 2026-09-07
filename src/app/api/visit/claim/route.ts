/**
 * ============================================================
 * 原石航路 Studio
 * /api/visit/claim — 登録した人と、その札を結ぶ
 *
 * ★ これで「X から来た人が何人 登録したか」が繋がる。
 *
 *   札は、その機械を指すだけの意味の無い並び。
 *   登録の瞬間にだけ、帳と結びつける。
 *
 * ★ 一度きり。あとから書き換えない。
 *   入り直すたびに上書きすると、最初にどこから来たかが消える。
 * ============================================================
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ ok: false }, { status: 401 });

        const jar = await cookies();
        const visitorId = jar.get("gk-visitor")?.value;
        if (!visitorId) return NextResponse.json({ ok: false });

        const admin = createAdminClient();

        /* すでに結んであれば、触らない */
        const { data: profile } = await admin
            .from("profiles")
            .select("signup_visitor_id")
            .eq("user_id", user.id)
            .single();

        if (profile?.signup_visitor_id) return NextResponse.json({ ok: true });

        /*
         * その札が、最初にどこから来たかを調べる。
         *
         * いちばん古い記録を見る。
         * 最後の記録だと「サイトの中」になり、外から来た元が消える。
         */
        const { data: first } = await admin
            .from("visits")
            .select("source")
            .eq("visitor_id", visitorId)
            .not("source", "in", '("site")')
            .order("visited_at", { ascending: true })
            .limit(1)
            .maybeSingle();

        await admin
            .from("profiles")
            .update({
                signup_visitor_id: visitorId,
                signup_source: first?.source ?? null,
            })
            .eq("user_id", user.id);

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false });
    }
}
