/**
 * ============================================================
 * 原石航路 Studio
 * Server 専用の環境変数
 *
 * このファイルを Client Component から import しないこと。
 * 鍵がブラウザへ送られてしまう。
 * ============================================================
 */

import "server-only";

export const serverEnv = {
    /** 未設定なら AI補助は端末内の簡易版で動く */
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",

    /**
     * 候補を拾うだけの仕事なので、小さい模型で足りる。
     * 本文を丸ごと送るぶん入力は多くなるが、出力は短い。
     */
    textModel: process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini",

    /**
     * 資料の図案づくり。
     * mini のほうが 1 枚あたり安い。図案は数が出るので効く。
     */
    imageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1-mini",

    /*
     * ------------------------------------------------------------
     * Supabase の運営用の鍵
     *
     * 見える範囲の決まりを飛び越えて、すべての行を読み書きできる。
     * 運営の画面だけで使い、ブラウザへは絶対に送らない。
     * ------------------------------------------------------------
     */
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
} as const;

/**
 * 運営用の鍵を取り出す。
 *
 * 無ければ止める。
 * 黙って通すと、見えないところで書き込みが失敗する。
 */
export function requireServiceRoleKey(): string {
    if (!serverEnv.supabaseServiceRoleKey) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY が設定されていません。\n" +
                ".env.local に足してください。",
        );
    }
    return serverEnv.supabaseServiceRoleKey;
}

export function hasModelAccess(): boolean {
    return serverEnv.openaiApiKey.length > 0;
}
