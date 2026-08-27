/**
 * ============================================================
 * 原石航路 Studio
 * /api/mypage/extra — あとから埋まるもの
 *
 * 開いた瞬間に見えないものを、ここでまとめて返す。
 *
 * 未読の数・ミッションの進み・閲覧履歴・保存済み。
 * どれも画面の下のほうにあるか、小さな数字なので、
 * 少し遅れて出ても困らない。
 *
 * 表で全部待つと、作品を見たいだけの人まで待たされる。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* 組み立ての段階で走らせない。呼ばれたときだけ動かす */
export const dynamic = "force-dynamic";

export async function GET() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "ログインしていません" }, { status: 401 });
    }

    /* 自分の作品。ここから先の数え上げに要る */
    const { data: novels } = await supabase
        .from("novels")
        .select("id")
        .eq("author_id", user.id);

    const novelIds = (novels ?? []).map((row: any) => row.id);

    /*
     * 数え上げと閲覧履歴を、まとめて頼む。
     * 互いに関わらないので、順に待つ理由が無い。
     */
    const [
        cmRes, dcRes, rkRes, readRes,
        likesM, discoversM, commentsM, bookmarksM, novelsCountM,
        followsM, readsM, tweetsM, seriesM, epCountRes,
        viewRes, bookmarkRes,
    ] = await Promise.all([
        novelIds.length > 0
            ? supabase.from("comments").select("id").in("novel_id", novelIds).neq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
            : Promise.resolve({ data: [] } as any),
        novelIds.length > 0
            ? supabase.from("discovers").select("novel_id, user_id, created_at").in("novel_id", novelIds).eq("is_pending", false).neq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
            : Promise.resolve({ data: [] } as any),
        supabase.from("ranking_history").select("id").eq("author_id", user.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("read_feedbacks").select("item_key").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),

        supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("discovers").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("bookmarks").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("novels").select("*", { count: "exact", head: true }).eq("author_id", user.id).eq("published", true),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
        supabase.from("read_episodes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("tweets").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("series").select("*", { count: "exact", head: true }).eq("user_id", user.id),

        novelIds.length > 0
            ? supabase.from("episodes").select("*", { count: "exact", head: true }).in("novel_id", novelIds)
            : Promise.resolve({ count: 0 } as any),

        supabase.from("page_views").select("episode_id, novel_id, viewed_at").eq("user_id", user.id).order("viewed_at", { ascending: false }).limit(60),

        supabase.from("bookmarks")
            .select("novel_id, created_at, folder_id, novels(id, title, genre, is_serial, novel_type, summary, tags, author_id)")
            .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    /* 未読の数 */
    const readSet = new Set((readRes.data ?? []).map((r: any) => r.item_key));
    const fbKeys = [
        ...(cmRes.data ?? []).map((c: any) => `c-${c.id}`),
        ...(dcRes.data ?? []).map((d: any) => `d-${d.novel_id}-${d.user_id}-${d.created_at}`),
    ];

    const unreadFeedback = fbKeys.filter((k) => !readSet.has(k)).length;
    const unreadRanking = (rkRes.data ?? [])
        .map((r: any) => `r-${r.id}`)
        .filter((k: string) => !readSet.has(k)).length;

    /* 自己紹介があるか。ミッションで使う */
    const { data: profile } = await supabase
        .from("profiles")
        .select("bio")
        .eq("user_id", user.id)
        .maybeSingle();

    const missionStats = {
        likeCount: likesM.count ?? 0,
        discoverCount: discoversM.count ?? 0,
        commentCount: commentsM.count ?? 0,
        bookmarkCount: bookmarksM.count ?? 0,
        novelCount: novelsCountM.count ?? 0,
        episodeCount: epCountRes.count ?? 0,
        followCount: followsM.count ?? 0,
        readCount: readsM.count ?? 0,
        hasBio: Boolean(profile?.bio),
        tweetCount: tweetsM.count ?? 0,
        seriesCount: seriesM.count ?? 0,
    };

    /*
     * 閲覧履歴。
     * 話を読んでから、作品ごとに 1 つへ畳む。
     */
    const views = viewRes.data ?? [];
    const epIds = Array.from(
        new Set(views.map((v: any) => v.episode_id).filter(Boolean)),
    );

    const latestViewMap: Record<string, string> = {};
    views.forEach((v: any) => {
        if (v.episode_id && !latestViewMap[v.episode_id]) {
            latestViewMap[v.episode_id] = v.viewed_at;
        }
    });

    let historyItems: any[] = [];
    const charCountMap: Record<string, number> = {};
    const likeMap: Record<string, number> = {};
    const firstEpMap: Record<string, string> = {};

    if (epIds.length > 0) {
        const { data: episodes } = await supabase
            .from("episodes")
            .select("id, title, ep_number, novel_id, novels(id, title, genre, author_id, summary, tags, novel_type, is_serial)")
            .in("id", epIds as string[]);

        const authorIds = Array.from(
            new Set((episodes ?? []).map((e: any) => e.novels?.author_id).filter(Boolean)),
        );

        const authorMap: Record<string, string> = {};
        if (authorIds.length > 0) {
            const { data: authors } = await supabase
                .from("profiles")
                .select("user_id, display_name")
                .in("user_id", authorIds as string[]);

            (authors ?? []).forEach((a: any) => {
                authorMap[a.user_id] = a.display_name;
            });
        }

        const novelMap: Record<string, any> = {};
        (episodes ?? []).forEach((ep: any) => {
            const novel = ep.novels;
            if (!novel) return;

            const viewedAt = latestViewMap[ep.id];
            if (!novelMap[novel.id] || viewedAt > novelMap[novel.id].viewedAt) {
                novelMap[novel.id] = {
                    novelId: novel.id,
                    novelTitle: novel.title,
                    genre: novel.genre,
                    novelType: novel.novel_type ?? "",
                    isSerial: novel.is_serial,
                    authorId: novel.author_id,
                    displayName: authorMap[novel.author_id] ?? "",
                    summary: novel.summary ?? "",
                    tags: novel.tags ?? [],
                    episodeId: ep.id,
                    episodeTitle: ep.title,
                    epNumber: ep.ep_number,
                    viewedAt,
                };
            }
        });

        historyItems = Object.values(novelMap).sort((a: any, b: any) =>
            b.viewedAt > a.viewedAt ? 1 : -1,
        );

        /* 作品ごとの字数・いいね・第1話 */
        const historyNovelIds = historyItems.map((i: any) => i.novelId);

        if (historyNovelIds.length > 0) {
            const [epData, likeData, firstEps] = await Promise.all([
                supabase.from("episodes").select("novel_id, char_count").in("novel_id", historyNovelIds),
                supabase.from("likes").select("novel_id").in("novel_id", historyNovelIds),
                supabase.from("episodes").select("id, novel_id, ep_number").in("novel_id", historyNovelIds).eq("published", true).lte("ep_number", 5).order("ep_number", { ascending: true }),
            ]);

            (epData.data ?? []).forEach((ep: any) => {
                charCountMap[ep.novel_id] = (charCountMap[ep.novel_id] ?? 0) + (ep.char_count ?? 0);
            });
            (likeData.data ?? []).forEach((l: any) => {
                likeMap[l.novel_id] = (likeMap[l.novel_id] ?? 0) + 1;
            });
            (firstEps.data ?? []).forEach((ep: any) => {
                if (!firstEpMap[ep.novel_id]) firstEpMap[ep.novel_id] = ep.id;
            });
        }
    }

    /* 保存済みの書き手 */
    const bookmarkedNovels = bookmarkRes.data ?? [];
    const bmAuthorIds = Array.from(
        new Set(bookmarkedNovels.map((b: any) => b.novels?.author_id).filter(Boolean)),
    );

    const bmAuthorMap: Record<string, string> = {};
    if (bmAuthorIds.length > 0) {
        const { data: authors } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", bmAuthorIds as string[]);

        (authors ?? []).forEach((a: any) => {
            bmAuthorMap[a.user_id] = a.display_name;
        });
    }

    return NextResponse.json({
        unreadFeedback,
        unreadRanking,
        missionStats,
        historyItems,
        charCountMap,
        likeMap,
        firstEpMap,
        bookmarkedNovels,
        bmAuthorMap,
    });
}
