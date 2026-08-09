/**
 * ============================================================
 * 原石航路 Studio
 * /api/notify-all — みんなに知らせる
 *
 * 運営がお知らせを出したとき、全員のベルに届ける。
 *
 * 一度に入れると詰まるので、500 人ずつに分けて送る。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** 一度に入れる人数 */
const BATCH = 500;

export async function POST(request: Request) {
    try {
        const { title, message, link } = await request.json();

        if (!title && !message) {
            return NextResponse.json(
                { error: "題名か本文が要ります" },
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

        const { data: profile } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("user_id", user.id)
            .single();

        if (!profile?.is_admin) {
            return NextResponse.json(
                { error: "運営だけが送れます" },
                { status: 403 },
            );
        }

        /* 送り先 */
        const { data: profiles, error: readError } = await supabase
            .from("profiles")
            .select("user_id");

        if (readError) throw readError;
        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ sent: 0 });
        }

        const rows = profiles.map((row: { user_id: string }) => ({
            user_id: row.user_id,
            type: "announcement",
            message: message || title,
            link: link || "/announcements",
        }));

        /*
         * 500 人ずつ入れる。
         * 一度に何千件も入れると、途中で切られる。
         */
        for (let at = 0; at < rows.length; at += BATCH) {
            const { error: writeError } = await supabase
                .from("notifications")
                .insert(rows.slice(at, at + BATCH));

            if (writeError) throw writeError;
        }

        return NextResponse.json({ sent: rows.length });
    } catch (caught) {
        const detail =
            caught instanceof Error ? caught.message : "原因が分かりません";

        return NextResponse.json(
            { error: `送れませんでした（${detail}）` },
            { status: 500 },
        );
    }
}
