/**
 * ============================================================
 * 原石航路 Studio
 * ブラウザから見える環境変数
 *
 * NEXT_PUBLIC_ の付いたものだけ。
 * ここに鍵を書かないこと。ブラウザから丸見えになる。
 * ============================================================
 */

export const clientEnv = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

/**
 * Supabase に繋ぐ用意ができているか。
 *
 * 未設定なら、これまで通り端末の中だけで動く。
 * 設定を忘れて真っ白な画面になる、ということが起きないようにする。
 */
export function hasSupabase(): boolean {
    return (
        clientEnv.supabaseUrl.length > 0 && clientEnv.supabaseAnonKey.length > 0
    );
}

/**
 * 繋がっていない理由。
 *
 * 「繋がっていません」とだけ出しても、
 * 設定を書き忘れたのか、名前を間違えたのか、
 * サーバーを立て直していないのかが分からない。
 *
 * どちらの値が空かまで出せば、その場で直せる。
 * 値そのものは出さない。鍵を画面に出すことになる。
 */
export function describeSupabaseGap(): string | null {
    const missing: string[] = [];
    if (clientEnv.supabaseUrl.length === 0) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (clientEnv.supabaseAnonKey.length === 0) {
        missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    if (missing.length === 0) return null;
    return `${missing.join(" と ")} が読めていません`;
}
