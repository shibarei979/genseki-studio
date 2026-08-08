/**
 * ============================================================
 * 原石航路 Studio
 * Repository の入口
 *
 * 保存先を差し替えるときは、この 1 ファイルだけを変更する。
 *
 *   接続なし … localRepository（端末の中だけ）
 *   接続あり … supabaseRepository（どの端末からでも開ける）
 *
 * 呼び出し側は必ず getRepository() を使うこと。
 * ============================================================
 */

import { hasSupabase } from "@/config/env.client";
import { localRepository } from "@/lib/repository/local-repository";
import { supabaseRepository } from "@/lib/repository/supabase-repository";
import type { Repository } from "@/lib/repository/types";

export type { Repository } from "@/lib/repository/types";

export function getRepository(): Repository {
    /*
     * 環境変数が入っていれば Supabase を使う。
     * 入れ忘れて真っ白になる、ということが起きないよう、
     * 未設定なら黙って端末の中の保存先に落ちる。
     */
    return hasSupabase() ? supabaseRepository : localRepository;
}

/** いま Supabase に繋がっているか。画面の出し分けに使う */
export function isConnected(): boolean {
    return hasSupabase();
}
