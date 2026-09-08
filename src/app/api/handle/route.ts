/**
 * ============================================================
 * 原石航路 Studio
 * /api/handle — 作者の呼び名を決める
 *
 * ★ 番号（user_id）は触らない。呼び名を1つ足すだけ。
 *
 * ★ 早い者勝ち。同じ名前は2人が持てない。
 *   大文字小文字は区別しない。Taro と taro が別人だと、
 *   なりすましの元になる。
 *
 * ★ 空にすれば、手放せる。ほかの人が使えるようになる。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** 使えない呼び名。案内の頁と紛れるもの */
const RESERVED = [
    "admin", "about", "search", "ranking", "contest", "novel", "author",
    "mypage", "login", "signup", "help", "faq", "terms", "privacy",
    "guide", "guidelines", "contact", "feedback", "notices", "rooms",
    "post", "works", "api", "u", "w", "official", "genseki", "support",
];

export async function POST(request: Request) {
    try {
        const { handle } = await request.json();

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "ログインしていません" },
                { status: 401 },
            );
        }

        const admin = createAdminClient();
        const wanted = String(handle ?? "").trim().toLowerCase();

        /* 空なら手放す */
        if (!wanted) {
            await admin
                .from("profiles")
                .update({ handle: null })
                .eq("user_id", user.id);
            return NextResponse.json({ ok: true, handle: null });
        }

        if (!/^[a-z0-9_]{3,20}$/.test(wanted)) {
            return NextResponse.json(
                { error: "英小文字・数字・下線で、3〜20字にしてください" },
                { status: 400 },
            );
        }

        if (RESERVED.includes(wanted)) {
            return NextResponse.json(
                { error: "その名前は使えません" },
                { status: 400 },
            );
        }

        /* すでに誰かが持っていないか */
        const { data: taken } = await admin
            .from("profiles")
            .select("user_id")
            .ilike("handle", wanted)
            .maybeSingle();

        if (taken && taken.user_id !== user.id) {
            return NextResponse.json(
                { error: "その名前は、すでに使われています" },
                { status: 409 },
            );
        }

        const { error } = await admin
            .from("profiles")
            .update({ handle: wanted })
            .eq("user_id", user.id);

        if (error) throw error;

        return NextResponse.json({ ok: true, handle: wanted });
    } catch (caught) {
        const detail =
            caught instanceof Error ? caught.message : "原因が分かりません";
        return NextResponse.json(
            { error: `決められませんでした（${detail}）` },
            { status: 500 },
        );
    }
}
