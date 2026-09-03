/**
 * ============================================================
 * 原石航路 Studio
 * /api/tweets — つぶやきの本文を、サーバー側だけで読む
 *
 * ★ なぜ受け口を作るのか。
 *
 *   いまは画面から表を直に呼んでいる。鍵は誰でも持っているので、
 *   自分の投稿の id さえ分かれば、入っていない状態で呼び直して
 *   「返ってこない＝隠された」と確かめられてしまう。
 *
 *   本文を返すのをこの受け口だけにすれば、その手は使えない。
 *
 * ★ 隠したものの扱いは、ここで決める。
 *
 *   書いた本人と運営には、これまでどおり返す。
 *   それ以外には、はじめから無かったものとして返す。
 *
 * ★ 返すのは本文だけ。
 *   いいね・返信・栞の数は、これまでどおり画面の側で数える。
 *   本文さえ表から引けなくすれば、狙いは足りる。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** 一度に返す数 */
const LIMIT_AUTHOR = 20;
const LIMIT_ALL = 50;

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const authorId: string | null = body.authorId ?? null;
        const scope: string = body.scope ?? "all";
        const topic: string | null = body.topic ?? null;
        const sortBy: string = body.sortBy ?? "new";

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const admin = createAdminClient();

        /* 運営かどうか。隠したものを返すかの判断に使う */
        let isAdmin = false;
        if (user) {
            const { data: profile } = await admin
                .from("profiles")
                .select("is_admin")
                .eq("user_id", user.id)
                .single();
            isAdmin = profile?.is_admin === true;
        }

        let query = admin
            .from("tweets")
            .select(
                "id, user_id, body, image_url, created_at, edited_at, topic, hidden_by_admin",
            )
            .order("created_at", { ascending: false })
            .limit(authorId ? LIMIT_AUTHOR : LIMIT_ALL);

        if (authorId) {
            query = query.eq("user_id", authorId);
        } else if (scope === "following") {
            if (!user) return NextResponse.json({ tweets: [] });

            const { data: follows } = await admin
                .from("follows")
                .select("following_id")
                .eq("follower_id", user.id);

            const ids = (follows ?? [])
                .map((one: { following_id: string }) => one.following_id)
                .filter((id: string) => Boolean(id) && id !== user.id);

            if (ids.length === 0) return NextResponse.json({ tweets: [] });
            query = query.in("user_id", ids).neq("user_id", user.id);
        } else if (scope === "bookmarks") {
            if (!user) return NextResponse.json({ tweets: [] });

            const { data: marks } = await admin
                .from("tweet_bookmarks")
                .select("tweet_id")
                .eq("user_id", user.id);

            const ids = (marks ?? [])
                .map((one: { tweet_id: string }) => one.tweet_id)
                .filter(Boolean);

            if (ids.length === 0) return NextResponse.json({ tweets: [] });
            query = query.in("id", ids);
        }

        if (topic) query = query.eq("topic", topic);

        const { data, error } = await query;
        if (error) throw error;

        /*
         * ★ 隠したものを外すのは、ここ。
         *
         *   本人と運営には返す。それ以外には返さない。
         *   数を合わせるための細工はしない。
         *   もともと無かった、という形にする。
         */
        const rows = (data ?? []).filter((one: Record<string, unknown>) => {
            if (one.hidden_by_admin !== true) return true;
            if (isAdmin) return true;
            return !!user && one.user_id === user.id;
        });

        /* 隠している印は、運営にだけ返す */
        const tweets = rows.map((one: Record<string, unknown>) => ({
            id: one.id,
            user_id: one.user_id,
            body: one.body,
            image_url: one.image_url,
            created_at: one.created_at,
            edited_at: one.edited_at,
            topic: one.topic,
            hidden_by_admin: isAdmin ? one.hidden_by_admin === true : false,
        }));

        /* 古い順・人気順は画面の側で並べ替える。ここは新しい順で返す */
        return NextResponse.json({ tweets, sortBy });
    } catch (caught) {
        const detail =
            caught instanceof Error ? caught.message : "原因が分かりません";

        return NextResponse.json(
            { error: `読み込めませんでした（${detail}）`, tweets: [] },
            { status: 500 },
        );
    }
}
