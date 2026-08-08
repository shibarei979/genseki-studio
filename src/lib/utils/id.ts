/**
 * ============================================================
 * 原石航路 Studio
 * ID 生成
 *
 * v1 はローカル保存のためクライアントで ID を発行する。
 * Supabase 移行後は DB 側の gen_random_uuid() に任せるため、
 * この関数の呼び出し箇所は repository 実装内に閉じておく。
 * ============================================================
 */

export function createId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
