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
