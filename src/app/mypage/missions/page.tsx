/**
 * ============================================================
 * 原石航路 Studio
 * /mypage/missions — ミッション
 *
 * 数を数えるだけなので、行そのものは運ばない。
 * count だけを頼めば、何万件あっても軽い。
 * ============================================================
 */

import MissionClient from "@/components/mypage/mission-client";
import { createClient } from "@/lib/supabase/server";

export default async function MissionsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [
        likes,
        discovers,
        comments,
        bookmarks,
        novels,
        follows,
        reads,
        tweets,
        series,
        claimed,
        profile,
    ] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("discovers").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("bookmarks").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("novels").select("id", { count: "exact" }).eq("author_id", user.id).eq("published", true),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
        supabase.from("read_episodes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("tweets").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("series").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("user_missions").select("mission_id").eq("user_id", user.id),
        supabase.from("profiles").select("bio").eq("user_id", user.id).maybeSingle(),
    ]);

    /* 話の数。作品が無ければ数えない */
    const novelIds = (novels.data ?? []).map((row: any) => row.id);
    let episodeCount = 0;

    if (novelIds.length > 0) {
        const { count } = await supabase
            .from("episodes")
            .select("*", { count: "exact", head: true })
            .in("novel_id", novelIds);
        episodeCount = count ?? 0;
    }

    const stats = {
        likeCount: likes.count ?? 0,
        discoverCount: discovers.count ?? 0,
        commentCount: comments.count ?? 0,
        bookmarkCount: bookmarks.count ?? 0,
        novelCount: novels.count ?? 0,
        episodeCount,
        followCount: follows.count ?? 0,
        readCount: reads.count ?? 0,
        hasBio: Boolean(profile.data?.bio),
        tweetCount: tweets.count ?? 0,
        seriesCount: series.count ?? 0,
    };

    return (
        <MissionClient
            user
            stats={stats}
            initialClaimedIds={(claimed.data ?? []).map((row: any) => row.mission_id)}
            isWriter
        />
    );
}
