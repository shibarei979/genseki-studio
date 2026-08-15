/**
 * ============================================================
 * 原石航路 Studio
 * /auth/callback — よそのアカウントから戻ってくる場所
 *
 * Google・GitHub・X の画面で許可したあと、ここへ帰ってくる。
 * 受け取った合言葉を、使える形の合鍵に取り替える。
 *
 * profiles は登録の引き金が作るが、
 * 引き金が動かなかったときのために、ここでも確かめる。
 * ============================================================
 */

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    const supabase = await createClient();

    /*
     * code が無いまま来ることがある。
     *
     * X は OAuth 1.0a なので、code ではなく
     * 合鍵そのものを持って帰ってくる（住所の # から後ろ）。
     * # から後ろはここ（server）まで届かないので、
     * code が無い＝失敗、と決めつけてはいけない。
     * その場合は client 側の受け口へ回し、そこで合鍵を拾う。
     */
    if (!code) {
        const response = NextResponse.redirect(
            `${origin}/auth/finish?next=${encodeURIComponent(next)}`,
        );
        response.headers.set("Cache-Control", "no-store");
        return response;
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
        return NextResponse.redirect(`${origin}/login?error=callback`);
    }

    /*
     * profiles が無ければ作る。
     * 引き金が動いていれば、ここは何もしない。
     */
    const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

    if (!existing) {
        const meta = data.user.user_metadata ?? {};
        const displayName =
            (meta.full_name as string) ||
            (meta.name as string) ||
            data.user.email?.split("@")[0] ||
            "名無しの書き手";

        await supabase.from("profiles").insert({
            user_id: data.user.id,
            display_name: displayName,
            email: data.user.email ?? "",
            login_provider:
                (data.user.app_metadata?.provider as string) ?? "google",
        });
    }

    const response = NextResponse.redirect(`${origin}${next}`);
    // 戻ったあとに古い画面を見せない
    response.headers.set("Cache-Control", "no-store");
    return response;
}
