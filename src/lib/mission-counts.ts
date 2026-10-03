import { createAdminClient } from "@/lib/supabase/admin";
import { readAll } from "@/lib/utils/read-all";

/**
 * ============================================================
 * 原石航路 Studio
 * ミッションの「いいね」「保存」の数え方（画面の表示とポイントを配る側で同じものを使う）
 *
 * ★ いいね ＝ 作品へのいいね ＋ 話へのいいね（読み終わりのハート）
 *   前は作品へのいいねだけを数えていて、
 *   話のハートを押した人のミッションが進まなかった。
 * ★ 保存 ＝ 作品の保存（ブックマーク）か、話に栞を挟んだ作品の数（同じ作品は 1 つ）
 * ★ もらったいいね ＝ 自分の作品へのいいね ＋ 自分の話へのいいね
 * ★ ほかの人の行を含むので、運営の鍵で「数だけ」読む。
 * ============================================================
 */

type Admin = ReturnType<typeof createAdminClient>;

async function headCount(admin: Admin, table: string, build: (q: any) => any): Promise<number> {
    try {
        const { count } = await build(admin.from(table).select("*", { count: "exact", head: true }));
        return count ?? 0;
    } catch {
        return 0;
    }
}

/** 送ったいいね（作品＋話） */
export async function likesSent(admin: Admin, userId: string): Promise<number> {
    const [works, episodes] = await Promise.all([
        headCount(admin, "likes", (q) => q.eq("user_id", userId)),
        headCount(admin, "episode_likes", (q) => q.eq("user_id", userId)),
    ]);
    return works + episodes;
}

/** 保存した作品の数（ブックマーク・栞のどちらかがある作品） */
export async function savedWorks(admin: Admin, userId: string): Promise<number> {
    const ids = new Set<string>();
    try {
        const marked = await readAll<{ novel_id: string }>((from, to) =>
            admin.from("bookmarks").select("novel_id").eq("user_id", userId).order("novel_id").range(from, to),
        );
        marked.forEach((row) => row.novel_id && ids.add(row.novel_id));
    } catch {
        /* 読めなくても、ほかは数える */
    }
    try {
        const pinned = await readAll<{ novel_id: string }>((from, to) =>
            admin.from("episode_marks").select("novel_id").eq("user_id", userId).order("novel_id").range(from, to),
        );
        pinned.forEach((row) => row.novel_id && ids.add(row.novel_id));
    } catch {
        /* 栞の表が読めなくても、保存の数は出す */
    }
    return ids.size;
}

/** もらったいいね（自分の作品へ＋自分の話へ） */
export async function likesReceived(admin: Admin, novelIds: string[]): Promise<number> {
    if (novelIds.length === 0) return 0;
    const works = await headCount(admin, "likes", (q) => q.in("novel_id", novelIds));

    let episodes = 0;
    try {
        const eps = await readAll<{ id: string }>((from, to) =>
            admin.from("episodes").select("id").in("novel_id", novelIds).order("id").range(from, to),
        );
        const epIds = eps.map((row) => row.id);
        for (let at = 0; at < epIds.length; at += 100) {
            episodes += await headCount(admin, "episode_likes", (q) => q.in("episode_id", epIds.slice(at, at + 100)));
        }
    } catch {
        /* 読めなくても、作品へのいいねは数える */
    }
    return works + episodes;
}
