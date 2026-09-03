/**
 * ============================================================
 * 原石航路 Studio
 * /api/presence — いま開いている人の合図
 *
 * POST  画面から 30 秒ごとに届く「まだ見ています」
 * GET   運営だけが読める「いまの人数」
 *
 * ★ 書き込みは、この受け口だけが行う。
 *   画面から表へ直に書けると、数を水増しできてしまう。
 *
 * ★ 誰が見ているかは持たない。
 *   入っているかどうかだけを控える。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** これより古い合図は「もう閉じた」とみなす */
const ALIVE_SECONDS = 70;

/** これより古い行は捨てる */
const KEEP_MINUTES = 30;

export async function POST(request: Request) {
    try {
        const { key } = await request.json();

        /* 札は画面が作る。長すぎるものは受けない */
        if (typeof key !== "string" || key.length < 8 || key.length > 64) {
            return NextResponse.json({ ok: false }, { status: 400 });
        }

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const admin = createAdminClient();

        await admin.from("presence_pings").upsert(
            {
                key,
                signed_in: !!user,
                last_seen: new Date().toISOString(),
            },
            { onConflict: "key" },
        );

        /*
         * 古い行を片付ける。
         * 合図が来たついでに捨てるので、掃除の仕組みを別に作らなくてよい。
         */
        const limit = new Date(Date.now() - KEEP_MINUTES * 60_000).toISOString();
        await admin.from("presence_pings").delete().lt("last_seen", limit);

        return NextResponse.json({ ok: true });
    } catch {
        /* 数が少し狂うだけなので、画面には何も返さない */
        return NextResponse.json({ ok: false });
    }
}

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "権限がありません" }, { status: 401 });
        }

        const admin = createAdminClient();

        const { data: profile } = await admin
            .from("profiles")
            .select("is_admin")
            .eq("user_id", user.id)
            .single();

        if (!profile?.is_admin) {
            return NextResponse.json({ error: "権限がありません" }, { status: 403 });
        }

        const since = new Date(Date.now() - ALIVE_SECONDS * 1000).toISOString();

        const { count: total } = await admin
            .from("presence_pings")
            .select("key", { count: "exact", head: true })
            .gte("last_seen", since);

        const { count: signedIn } = await admin
            .from("presence_pings")
            .select("key", { count: "exact", head: true })
            .gte("last_seen", since)
            .eq("signed_in", true);

        return NextResponse.json({
            total: total ?? 0,
            signedIn: signedIn ?? 0,
            guests: (total ?? 0) - (signedIn ?? 0),
        });
    } catch (caught) {
        const detail =
            caught instanceof Error ? caught.message : "原因が分かりません";

        return NextResponse.json(
            { error: `数えられませんでした（${detail}）` },
            { status: 500 },
        );
    }
}
