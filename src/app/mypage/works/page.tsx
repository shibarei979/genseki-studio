/**
 * ============================================================
 * 原石航路 Studio
 * /mypage/works — 作品管理
 *
 * 作品と、その数だけ。
 * 本文は運ばない。
 * ============================================================
 */

import MypageWorks from "@/components/mypage/mypage-works-client";
import { createClient } from "@/lib/supabase/server";

export default async function WorksPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: novels } = await supabase
        .from("novels")
        .select(
            "id, title, summary, genre, tags, published, visibility, views, created_at, updated_at, serial_status",
        )
        .eq("author_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

    const novelIds = (novels ?? []).map((row: any) => row.id);

    /* 作品ごとの数。行は運ばず、集めてから数える */
    const likeById: Record<string, number> = {};
    const episodeById: Record<string, number> = {};

    if (novelIds.length > 0) {
        const [likeRes, episodeRes] = await Promise.all([
            supabase.from("likes").select("novel_id").in("novel_id", novelIds),
            supabase
                .from("episodes")
                .select("novel_id")
                .in("novel_id", novelIds)
                .is("deleted_at", null),
        ]);

        (likeRes.data ?? []).forEach((row: any) => {
            likeById[row.novel_id] = (likeById[row.novel_id] ?? 0) + 1;
        });
        (episodeRes.data ?? []).forEach((row: any) => {
            episodeById[row.novel_id] = (episodeById[row.novel_id] ?? 0) + 1;
        });
    }

    return (
        <MypageWorks
            novels={novels ?? []}
            likeById={likeById}
            episodeById={episodeById}
        />
    );
}
