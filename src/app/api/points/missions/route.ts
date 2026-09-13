import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantFreePoints } from "@/lib/points";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/points/missions — ミッションでポイントを配る
 *
 * ★ 画面の言い分を信じない。
 *
 *   いまの仕組みは、画面から user_missions へ直に書いている。
 *   記録だけなら害はないが、ポイントが付くと
 *   達成していないミッションを自分で書き込めてしまう。
 *
 *   ここでは表を数え直して、本当に達成しているかを見る。
 *
 * ★ 配る中身
 *
 *     1 つ達成        10 pt
 *     片方 15 個全部  アイテム（まだ決まっていないので保留）
 *     23 個ぜんぶ     300 pt ＋ アイテム
 *
 * ★ 共通の 7 個は、両方で数える。
 *
 *   読む向きと書く向きの、それぞれでポイントが出る。
 *   同じことをしても、向きを変えれば両方もらえる。
 *   作者は読者でもあるので、そういう決めにした。
 *
 * ★ 二度配らない。
 *   grantFreePoints の once で止める。
 * ============================================================
 */

export const dynamic = "force-dynamic";

/** 1 つ達成でもらえる数 */
const PER_MISSION = 10;

/** 23 個ぜんぶで、さらにもらえる数 */
const FULL_CLEAR = 300;

/** 共通 7 個。読む向き・書く向きの両方で数える */
const COMMON: [string, (s: Stats) => boolean][] = [
    ["first-read", (s) => s.read >= 1],
    ["read-5", (s) => s.read >= 5],
    ["first-like", (s) => s.like >= 1],
    ["first-bookmark", (s) => s.bookmark >= 1],
    ["first-comment", (s) => s.comment >= 1],
    ["first-follow", (s) => s.follow >= 1],
    ["profile-setup", (s) => s.hasBio],
];

/** 読む向きだけ 8 個 */
const READER_ONLY: [string, (s: Stats) => boolean][] = [
    ["read-30", (s) => s.read >= 30],
    ["like-10", (s) => s.like >= 10],
    ["comment-5", (s) => s.comment >= 5],
    ["bookmark-5", (s) => s.bookmark >= 5],
    ["follow-5", (s) => s.follow >= 5],
    ["first-discover", (s) => s.discover >= 1],
    ["discover-3", (s) => s.discover >= 3],
    ["first-tweet", (s) => s.tweet >= 1],
];

/** 書く向きだけ 8 個 */
const WRITER_ONLY: [string, (s: Stats) => boolean][] = [
    ["first-work", (s) => s.novel >= 1],
    ["first-episode", (s) => s.episode >= 1],
    ["episode-5", (s) => s.episode >= 5],
    ["episode-20", (s) => s.episode >= 20],
    ["first-series", (s) => s.series >= 1],
    ["first-cover", (s) => s.cover >= 1],
    ["got-like", (s) => s.gotLike >= 1],
    ["got-comment", (s) => s.gotComment >= 1],
];

interface Stats {
    read: number;
    like: number;
    bookmark: number;
    comment: number;
    follow: number;
    discover: number;
    tweet: number;
    novel: number;
    episode: number;
    series: number;
    cover: number;
    gotLike: number;
    gotComment: number;
    hasBio: boolean;
}

export async function POST() {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "入っていません" }, { status: 401 });
        }

        const admin = createAdminClient();

        /*
         * ★ 件数だけ数える。
         *
         *   行を取ってきて数えると、1000 件で切られる。
         *   head: true なら、表の側で数えてくれる。
         */
        const count = async (
            table: string,
            build: (q: any) => any = (q) => q,
        ): Promise<number> => {
            try {
                const { count: n } = await build(
                    admin.from(table).select("*", { count: "exact", head: true }),
                );
                return n ?? 0;
            } catch {
                /* 表が無くても、ほかの数は出す */
                return 0;
            }
        };

        /* 自分の作品。もらったいいねを数えるのに要る */
        const { data: myNovels } = await admin
            .from("novels")
            .select("id, cover_url")
            .eq("author_id", user.id);

        const novelIds = (myNovels ?? []).map((n: any) => n.id);

        const [
            read, like, bookmark, comment, follow,
            discover, tweet, episode, series,
            gotLike, gotComment,
        ] = await Promise.all([
            count("read_episodes", (q) => q.eq("user_id", user.id)),
            count("likes", (q) => q.eq("user_id", user.id)),
            count("bookmarks", (q) => q.eq("user_id", user.id)),
            count("comments", (q) => q.eq("user_id", user.id)),
            count("follows", (q) => q.eq("follower_id", user.id)),
            count("discovers", (q) => q.eq("user_id", user.id)),
            count("tweets", (q) => q.eq("user_id", user.id)),
            novelIds.length > 0
                ? count("episodes", (q) => q.in("novel_id", novelIds))
                : Promise.resolve(0),
            count("series", (q) => q.eq("user_id", user.id)),
            novelIds.length > 0
                ? count("likes", (q) => q.in("novel_id", novelIds))
                : Promise.resolve(0),
            novelIds.length > 0
                ? count("comments", (q) => q.in("novel_id", novelIds))
                : Promise.resolve(0),
        ]);

        const { data: profile } = await admin
            .from("profiles")
            .select("bio")
            .eq("user_id", user.id)
            .maybeSingle();

        const stats: Stats = {
            read, like, bookmark, comment, follow,
            discover, tweet,
            novel: novelIds.length,
            episode, series,
            cover: (myNovels ?? []).filter((n: any) => n.cover_url).length,
            gotLike, gotComment,
            hasBio: Boolean((profile?.bio ?? "").trim()),
        };

        /*
         * ★ 達成したものを数える。
         *
         *   共通は、読む向き・書く向きで別々に数える。
         *   同じ id では二度配れないので、
         *   向きを付けた印で分ける。
         */
        const done: string[] = [];

        for (const [id, check] of COMMON) {
            if (!check(stats)) continue;
            done.push(`reader:${id}`);
            done.push(`writer:${id}`);
        }

        for (const [id, check] of READER_ONLY) {
            if (check(stats)) done.push(`reader:${id}`);
        }

        for (const [id, check] of WRITER_ONLY) {
            if (check(stats)) done.push(`writer:${id}`);
        }

        /* 1 つずつ配る。もう配ったものは once が止める */
        let earned = 0;

        for (const key of done) {
            const result = await grantFreePoints({
                userId: user.id,
                amount: PER_MISSION,
                source: "mission",
                sourceRef: key,
                once: true,
            });

            if (result.granted) earned += PER_MISSION;
        }

        /*
         * ★ 23 個ぜんぶ。
         *
         *   共通 7 は両方に数えているので、
         *   done の長さは 7×2 + 8 + 8 = 30 になる。
         *   全部そろったかどうかは、中身で見る。
         */
        const readerDone =
            COMMON.every(([, c]) => c(stats)) &&
            READER_ONLY.every(([, c]) => c(stats));

        const writerDone =
            COMMON.every(([, c]) => c(stats)) &&
            WRITER_ONLY.every(([, c]) => c(stats));

        if (readerDone && writerDone) {
            const result = await grantFreePoints({
                userId: user.id,
                amount: FULL_CLEAR,
                source: "mission",
                sourceRef: "full-clear",
                once: true,
            });

            if (result.granted) earned += FULL_CLEAR;
        }

        /*
         * ★ アイテムは、まだ配らない。
         *
         *   何を配るかが決まっていない。
         *   決まってから shop_items の id を指して配る。
         *   仮のものを配ると、あとで回収できない。
         */
        return NextResponse.json({
            earned,
            readerDone,
            writerDone,
            doneCount: done.length,
        });
    } catch (caught) {
        return NextResponse.json(
            {
                error:
                    caught instanceof Error ? caught.message : "うまくいきません",
            },
            { status: 500 },
        );
    }
}
