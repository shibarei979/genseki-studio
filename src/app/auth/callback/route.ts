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

    /*
     * よその鍵（Google・X・GitHub）で入ってきた人も確かめる。
     *
     * BAN は住所で覚えているので、別の入口から
     * 同じ住所で入り直せてしまうと意味がない。
     * ここで見つけたら、座らせずに追い返す。
     */
    if (data?.user?.email) {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const { data: banned } = await createAdminClient()
            .from("banned_emails")
            .select("email")
            .eq("email", data.user.email.trim().toLowerCase())
            .maybeSingle();

        if (banned) {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/login?error=banned`);
        }
    }

    /*
     * ここで失敗しても、まだ諦めない。
     *
     * X（OAuth 1.0a）は、server 側での取り替えが通らないことがある。
     * その場合でも、ブラウザの中でなら合鍵を拾えることがあるので、
     * finish へ回す。理由は住所に載せて、何が起きたか分かるようにする。
     * （ログインへ即戻すと、原因が何も残らない）
     */
    if (error || !data.user) {
        const reason = error?.message ?? "no-user";
        const response = NextResponse.redirect(
            `${origin}/auth/finish?next=${encodeURIComponent(next)}&reason=${encodeURIComponent(reason)}`,
        );
        response.headers.set("Cache-Control", "no-store");
        return response;
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

    /*
     * finish を通して戻す。
     *
     * ログインの前に控えた行き先は端末の中にあり、
     * ここ（サーバー）からは読めない。
     * finish は client なので、そこで読んで送り出す。
     */
    const response = NextResponse.redirect(
        `${origin}/auth/finish?next=${encodeURIComponent(next)}`,
    );
    // 戻ったあとに古い画面を見せない
    response.headers.set("Cache-Control", "no-store");
    return response;
}
