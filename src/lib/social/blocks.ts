import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ============================================================
 * 原石航路 Studio
 * blocks — ブロックとミュートを読む
 *
 * ブロックは、押した時点では「記録されるだけ」だった。
 * コメントも DM も、絞り込みに使っていなかった。
 *
 * 自衛したつもりの人が無防備なまま置かれるので、
 * 読む所を 1 か所にまとめて、使う側から呼べるようにする。
 *
 * ★ 読めるのは「自分がブロックした相手」だけ。
 *
 *   誰が自分をブロックしたかは読めない。
 *   知られると報復を招くので、決まりの側で閉じてある。
 *
 *   だから「ブロックした相手からの DM を止める」は、
 *   画面の側では作れない。
 *   表の決まり（RLS）で止めている。
 * ============================================================
 */

/** 自分がブロックした相手の id */
export async function loadBlockedIds(
    supabase: SupabaseClient,
    userId: string | null | undefined,
): Promise<Set<string>> {
    if (!userId) return new Set();

    const { data } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", userId);

    return new Set(
        (data ?? [])
            .map((row: { blocked_id: string }) => row.blocked_id)
            .filter(Boolean),
    );
}

/** 自分がミュートした相手の id */
export async function loadMutedIds(
    supabase: SupabaseClient,
    userId: string | null | undefined,
): Promise<Set<string>> {
    if (!userId) return new Set();

    const { data } = await supabase
        .from("user_mutes")
        .select("muted_id")
        .eq("muter_id", userId);

    return new Set(
        (data ?? [])
            .map((row: { muted_id: string }) => row.muted_id)
            .filter(Boolean),
    );
}

/**
 * ブロックした相手のものを落とす。
 *
 * 落とすだけで、「ブロックしたので隠しました」とは出さない。
 * 出すと、そこに誰かが居たことが分かってしまう。
 */
export function withoutBlocked<T>(
    rows: T[],
    blocked: Set<string>,
    userIdOf: (row: T) => string | null | undefined,
): T[] {
    if (blocked.size === 0) return rows;
    return rows.filter((row) => {
        const id = userIdOf(row);
        return !id || !blocked.has(id);
    });
}
