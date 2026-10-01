import { createAdminClient } from "@/lib/supabase/admin";
import { readAll } from "@/lib/utils/read-all";

/**
 * ============================================================
 * 原石航路 Studio
 * いいね・保存・話のいいね を「数える」ためだけの読み方
 *
 * ★ これらの表は、決まり（RLS）で「自分が押した行」しか読めない。
 *   ふつうの鍵で数えると、他人のいいねが 1 つも返らず、
 *   分析やマイページで いいね 0・保存 0 と出ていた（コメントは誰でも読めるので数が出ていた）。
 *
 * ★ ここでは運営の鍵で読む。ただし返すのは
 *   「どの作品（話）の行か」だけ。誰が押したかは返さない。
 *
 * ★ 1 回 1,000 行までなので、読み切るまで分けて取る。
 *   並びは（作品または話, 押した人）で決める。どちらも 1 人 1 回なので境目がずれない。
 * ============================================================
 */

export type CountTable = "likes" | "bookmarks" | "episode_likes";
type Column = "novel_id" | "episode_id";

/** 1 回に並べる id の数（住所が長くなりすぎないように） */
const IDS_AT_ONCE = 100;

/**
 * 作品（話）ごとの行を返す。`{ novel_id }` または `{ episode_id }` だけ。
 * since を渡すと、その時刻より後に押されたものだけ。
 */
export async function rowsFor(
    table: CountTable,
    column: Column,
    ids: string[],
    since?: string,
): Promise<Record<string, string>[]> {
    const list = Array.from(new Set(ids.filter(Boolean)));
    if (list.length === 0) return [];

    const admin = createAdminClient();
    const out: Record<string, string>[] = [];

    for (let at = 0; at < list.length; at += IDS_AT_ONCE) {
        const some = list.slice(at, at + IDS_AT_ONCE);
        const rows = await readAll<Record<string, string>>((from, to) => {
            let query = admin.from(table).select(column).in(column, some);
            if (since) query = query.gte("created_at", since);
            return query
                .order(column, { ascending: true })
                .order("user_id", { ascending: true })
                .range(from, to);
        });
        for (const row of rows) out.push({ [column]: row[column] });
    }
    return out;
}

/** 作品（話）ごとの数 */
export async function countsFor(
    table: CountTable,
    column: Column,
    ids: string[],
    since?: string,
): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const row of await rowsFor(table, column, ids, since)) {
        const key = row[column];
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}

/** 1 つの作品（話）の数 */
export async function countOne(table: CountTable, column: Column, id: string): Promise<number> {
    const admin = createAdminClient();
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, id);
    return count ?? 0;
}
