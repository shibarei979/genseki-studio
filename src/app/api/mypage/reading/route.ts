import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/mypage/reading — その月に読んだ量
 *
 * ★ 1 話につき 1 回だけ数える。
 *
 *   同じ話を読み返しても、文字数は増えない。
 *   「どれだけ読んだか」を出したいので、
 *   開いた回数ではなく、読んだ話の量を数える。
 *
 *   月は「初めて開いた月」に付ける。
 *   10 月に読み返したぶんを 10 月にも数えると、
 *   同じ話が二度数えられる。
 *
 * ★ 入っている人の記録だけ。
 *   入らずに読んだぶんは、その人のものと結び付かない。
 * ============================================================
 */

/** 読み込む上限。多すぎると重い */
const MAX_ROWS = 20000;

/** 内訳に出す数。残りは「その他」へまとめる */
const TOP_N = 3;

export async function GET(request: Request) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ months: {} });

    /* 開いた記録。古い順に見て、話ごとの最初の 1 件だけ残す */
    const { data: views } = await supabase
        .from("page_views")
        .select("episode_id, viewed_at")
        .eq("user_id", user.id)
        .not("episode_id", "is", null)
        .order("viewed_at", { ascending: true })
        .limit(MAX_ROWS);

    const firstSeen = new Map<string, string>();
    for (const row of views ?? []) {
        const id = (row as { episode_id: string }).episode_id;
        if (!firstSeen.has(id)) {
            firstSeen.set(id, (row as { viewed_at: string }).viewed_at);
        }
    }

    const episodeIds = Array.from(firstSeen.keys());
    if (episodeIds.length === 0) return NextResponse.json({ months: {} });

    /* 話の量と、どの作品のものか */
    const { data: episodes } = await supabase
        .from("episodes")
        .select("id, novel_id, char_count")
        .in("id", episodeIds);

    const novelIds = Array.from(
        new Set((episodes ?? []).map((e: { novel_id: string }) => e.novel_id)),
    );

    const { data: novels } = await supabase
        .from("novels")
        .select("id, title, genre, author_id")
        .in("id", novelIds);

    type NovelRow = {
        id: string;
        title: string;
        genre: string | null;
        author_id: string | null;
    };

    const novelById = new Map<string, NovelRow>(
        ((novels ?? []) as NovelRow[]).map((n) => [n.id, n]),
    );

    /* 作者の名前 */
    const authorIds = Array.from(
        new Set(
            (novels ?? [])
                .map((n: { author_id: string | null }) => n.author_id)
                .filter(Boolean) as string[],
        ),
    );

    const { data: authors } = await supabase
        .from("public_profiles")
        .select("user_id, display_name")
        .in("user_id", authorIds);

    const nameOf = new Map<string, string>(
        ((authors ?? []) as { user_id: string; display_name: string }[]).map(
            (a) => [a.user_id, a.display_name || "名無しの書き手"],
        ),
    );

    /*
     * 月ごとにまとめる。
     * 日本時間で区切る。協定世界時のままだと、
     * 月末の夜に読んだぶんが翌月に入る。
     */
    const months: Record<
        string,
        {
            chars: number;
            works: Set<string>;
            episodes: number;
            genres: Record<string, number>;
            authors: Record<string, number>;
        }
    > = {};

    for (const episode of episodes ?? []) {
        const row = episode as {
            id: string;
            novel_id: string;
            char_count: number | null;
        };

        const at = firstSeen.get(row.id);
        if (!at) continue;

        const key = new Date(at)
            .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
            .slice(0, 7);

        if (!months[key]) {
            months[key] = {
                chars: 0,
                works: new Set(),
                episodes: 0,
                genres: {},
                authors: {},
            };
        }

        const bucket = months[key];
        const chars = row.char_count ?? 0;
        const novel = novelById.get(row.novel_id);

        bucket.chars += chars;
        bucket.episodes += 1;
        bucket.works.add(row.novel_id);

        const genre = novel?.genre || "その他";
        bucket.genres[genre] = (bucket.genres[genre] ?? 0) + chars;

        const author = novel?.author_id
            ? (nameOf.get(novel.author_id) ?? "名無しの書き手")
            : "名無しの書き手";
        bucket.authors[author] = (bucket.authors[author] ?? 0) + chars;
    }

    /** 多い順に上位を出し、残りは「その他」へ */
    function top(source: Record<string, number>) {
        const sorted = Object.entries(source).sort((a, b) => b[1] - a[1]);
        const head = sorted.slice(0, TOP_N);
        const rest = sorted.slice(TOP_N).reduce((sum, one) => sum + one[1], 0);
        return rest > 0 ? [...head, ["その他", rest] as [string, number]] : head;
    }

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(months)) {
        out[key] = {
            chars: value.chars,
            works: value.works.size,
            episodes: value.episodes,
            genres: top(value.genres),
            authors: top(value.authors),
        };
    }

    return NextResponse.json({ months: out });
}
