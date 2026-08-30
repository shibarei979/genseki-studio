/**
 * ============================================================
 * 原石航路 Studio
 * /api/novel/[id]/comments — コメント
 *
 * 話のページの一番下に出る。
 *
 * コメントそのもの・いいねの数・書いた人の名前で
 * 3 回かかるが、本文を読み終えるまで見えない。
 *
 * 表で待つと、本文が出るのが遅れる。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { loadBlockedIds, withoutBlocked } from "@/lib/social/blocks";

export async function GET(
    request: Request,
    { params }: { params: { id: string } },
) {
    const supabase = await createClient();

    /*
     * ブロックした相手のコメントを落とす。
     *
     * 落とすだけで、「隠しました」とは出さない。
     * 出すと、そこに誰かが居たことが分かってしまう。
     */
    const { data: auth } = await supabase.auth.getUser();
    const blocked = await loadBlockedIds(supabase, auth.user?.id);

    /*
     * 話ごとのコメントは、その話のものだけを出す。
     *
     * 前は作品で絞るだけだったので、どの話を開いても
     * 作品ぜんぶのコメントが同じ顔で並んでいた。
     * 第3話の感想が第1話にも出ている状態だった。
     *
     * episode を渡さない呼び方（作品ページ）は、
     * これまでどおり作品ぜんぶを出す。
     */
    const episodeId = new URL(request.url).searchParams.get("episode");

    let query = supabase
        .from("comments")
        .select("id, body, created_at, user_id, is_pinned, rating, quoted_text, parent_id, episode_id")
        .eq("novel_id", params.id);

    if (episodeId) query = query.eq("episode_id", episodeId);

    const { data: fetched } = await query
        .order("created_at", { ascending: false })
        .limit(50);

    const rawComments = withoutBlocked(
        fetched ?? [],
        blocked,
        (row: any) => row.user_id,
    );

    const commentIds = (rawComments ?? []).map((c: any) => c.id);
    const commentUserIds = Array.from(
        new Set((rawComments ?? []).map((c: any) => c.user_id).filter(Boolean)),
    );

    /* いいねの数と、書いた人の名前。互いに関わらないので同時に */
    const [clRes, cpRes] = await Promise.all([
        commentIds.length > 0
            ? supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds)
            : Promise.resolve({ data: [] } as any),
        commentUserIds.length > 0
            ? supabase.from("public_profiles").select("user_id, display_name, icon_url").in("user_id", commentUserIds as string[])
            : Promise.resolve({ data: [] } as any),
    ]);

    const commentLikeCounts: Record<string, number> = {};
    (clRes.data ?? []).forEach((cl: any) => {
        commentLikeCounts[cl.comment_id] = (commentLikeCounts[cl.comment_id] ?? 0) + 1;
    });

    const commentProfiles: Record<string, { display_name: string; icon_url: string }> = {};
    (cpRes.data ?? []).forEach((p: any) => {
        commentProfiles[p.user_id] = {
            display_name: p.display_name || "名無し",
            icon_url: p.icon_url || "",
        };
    });

    const comments = (rawComments ?? []).map((c: any) => ({
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        user_id: c.user_id,
        display_name: commentProfiles[c.user_id]?.display_name || "名無し",
        icon_url: commentProfiles[c.user_id]?.icon_url || "",
        like_count: commentLikeCounts[c.id] || 0,
        is_pinned: c.is_pinned || false,
        rating: c.rating ?? null,
        quoted_text: c.quoted_text ?? null,
        parent_id: c.parent_id ?? null,
    }));

    return NextResponse.json({ comments });
}
