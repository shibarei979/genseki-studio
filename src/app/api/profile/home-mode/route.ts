import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * 原石航路 Studio
 * 読む向き・書く向きを控える
 *
 * ★ 何のために作ったか。
 *
 *   切り替えの押し具は、押したあと頁を丸ごと読み直す。
 *   読み直すと、途中の頼みは切られる。
 *   表への控えを待ってから読み直せば確実だが、
 *   通信の 1 往復ぶん、切り替えが遅くなる。
 *
 *   sendBeacon は、頁を離れても最後まで届く。
 *   待たずに読み直しても、控えは着く。
 *
 * ★ 画面の向きそのものはクッキーで決まる。
 *   ここは、別の端末で開いたときのために残す控え。
 * ============================================================
 */
export async function POST(request: Request) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    /*
     * sendBeacon は形を選べないことがあるので、
     * 文字としても読めるようにしておく。
     */
    let mode = "";
    try {
        const body = await request.text();
        mode = body.trim().startsWith("{")
            ? ((JSON.parse(body) as { mode?: string }).mode ?? "")
            : body.trim();
    } catch {
        mode = "";
    }

    if (mode !== "read" && mode !== "write") {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { error } = await supabase
        .from("profiles")
        .update({ home_mode: mode })
        .eq("user_id", user.id);

    if (error) {
        return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
