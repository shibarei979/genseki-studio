/**
 * ============================================================
 * 原石航路 Studio
 * /mypage/history — 閲覧履歴
 * ============================================================
 */

import HistoryClient from "@/components/mypage/history-client";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: views } = await supabase
        .from("page_views")
        .select("episode_id, novel_id, viewed_at")
        .eq("user_id", user.id)
        .order("viewed_at", { ascending: false })
        .limit(200);

    const epIds = Array.from(
        new Set((views ?? []).map((row: any) => row.episode_id).filter(Boolean)),
    );

    /* 話ごとの、いちばん新しい閲覧 */
    const latestViewMap: Record<string, string> = {};
    (views ?? []).forEach((row: any) => {
        if (row.episode_id && !latestViewMap[row.episode_id]) {
            latestViewMap[row.episode_id] = row.viewed_at;
        }
    });

    let historyItems: any[] = [];
    const charCountMap: Record<string, number> = {};
    const epCountMap: Record<string, number> = {};
    const firstEpMap: Record<string, string> = {};

    if (epIds.length > 0) {
        const { data: episodes } = await supabase
            .from("episodes")
            .select(
                "id, title, ep_number, novel_id, novels(id, title, genre, author_id, summary, tags, novel_type, is_serial)",
            )
            .in("id", epIds as string[]);

        const authorIds = Array.from(
            new Set(
                (episodes ?? [])
                    .map((row: any) => row.novels?.author_id)
                    .filter(Boolean),
            ),
        );

        const nameById: Record<string, string> = {};
        if (authorIds.length > 0) {
            const { data: authors } = await supabase
                .from("profiles")
                .select("user_id, display_name")
                .in("user_id", authorIds as string[]);

            (authors ?? []).forEach((row: any) => {
                nameById[row.user_id] = row.display_name;
            });
        }

        historyItems = (episodes ?? [])
            .filter((row: any) => row.novels)
            .map((row: any) => ({
                ...row,
                authorName: nameById[row.novels.author_id] ?? "名無し",
                viewedAt: latestViewMap[row.id],
            }))
            .sort((a: any, b: any) =>
                (b.viewedAt ?? "").localeCompare(a.viewedAt ?? ""),
            );

        /* 作品ごとの字数・話数・第1話 */
        const novelIds = Array.from(
            new Set(historyItems.map((row: any) => row.novel_id)),
        );

        if (novelIds.length > 0) {
            const { data: allEps } = await supabase
                .from("episodes")
                .select("id, novel_id, ep_number, char_count")
                .in("novel_id", novelIds)
                .order("ep_number");

            (allEps ?? []).forEach((row: any) => {
                charCountMap[row.novel_id] =
                    (charCountMap[row.novel_id] ?? 0) + (row.char_count ?? 0);
                epCountMap[row.novel_id] = (epCountMap[row.novel_id] ?? 0) + 1;

                if (!firstEpMap[row.novel_id]) firstEpMap[row.novel_id] = row.id;
            });
        }
    }

    /* 保存済みの印 */
    const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select("novel_id")
        .eq("user_id", user.id);

    return (
        <HistoryClient
            historyItems={historyItems}
            charCountMap={charCountMap}
            epCountMap={epCountMap}
            firstEpMap={firstEpMap}
            myBookmarks={bookmarks ?? []}
            userId={user.id}
        />
    );
}
