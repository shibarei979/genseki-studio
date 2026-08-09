/**
 * ============================================================
 * 原石航路 Studio
 * /api/valid-read — 読んだ跡
 *
 * 10 秒以上とどまり、下まで送った人だけが送ってくる。
 *
 * 開いただけの人と、実際に読んだ人を分ける。
 * 閲覧数だけでは、その差が分からない。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    const supabase = await createClient();

    let body: {
        episode_id?: string;
        read_seconds?: number;
        scroll_pct?: number;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "読めません" }, { status: 400 });
    }

    if (!body.episode_id) {
        return NextResponse.json({ error: "話がありません" }, { status: 400 });
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    /*
     * いちばん新しい閲覧に印を付ける。
     *
     * 新しく行を足すと、閲覧数が二重に増える。
     * すでにある行を書き換える。
     */
    const query = supabase
        .from("page_views")
        .select("id")
        .eq("episode_id", body.episode_id)
        .order("viewed_at", { ascending: false })
        .limit(1);

    const { data: found } = user
        ? await query.eq("user_id", user.id).maybeSingle()
        : await query.is("user_id", null).maybeSingle();

    if (!found) return NextResponse.json({ ok: true });

    await supabase
        .from("page_views")
        .update({
            is_valid_read: true,
            read_seconds: body.read_seconds ?? null,
            scroll_pct: body.scroll_pct ?? null,
        })
        .eq("id", found.id);

    return NextResponse.json({ ok: true });
}
