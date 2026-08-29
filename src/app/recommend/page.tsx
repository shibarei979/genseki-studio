import Link from "next/link";
import { ageFromBirthdate, allowedRatings } from "@/lib/age";
import { notFound } from "next/navigation";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import ReaderWorkList from "@/components/home/reader-work-list";
import { createClient } from "@/lib/supabase/server";
import { getCachedRecommendScores, buildRecommendation } from "@/lib/recommend";
import { GENRES_SELECTABLE } from "@/types";
import type { HomeBook } from "@/types/home";

/**
 * ============================================================
 * 原石航路
 * おすすめ
 *
 * 読む人が、次の一冊を見つけるための場所。
 *
 * 切り口をいくつか並べる。
 * ひとつの物差しだけだと、同じ顔ぶれが並び続ける。
 *
 *   あなたへのおすすめ    読んだ傾向から
 *   まだ知られていない作品  読まれた数が少なく、点数の高いもの
 *   最近ふえている作品     新しく、読まれ始めたもの
 *   ジャンルから探す       気分で選ぶ入口
 * ============================================================
 */

export const dynamic = "force-dynamic";

export const metadata = {
    title: "おすすめ | 原石航路",
    description: "あなたに合いそうな作品と、まだ知られていない作品を並べます。",
};

/** 一覧ごとに出す数 */
const LIST_SIZE = 12;

/** 「まだ知られていない」とみなす読者数の上限 */
const HIDDEN_READER_MAX = 20;

function truncate(text: string | null | undefined, length: number): string {
    if (!text) return "";
    const t = text.replace(/\r?\n/g, " ").trim();
    return t.length > length ? t.slice(0, length) + "…" : t;
}

export default async function RecommendPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    /*
     * 執筆向けでは出さない。
     * まず読む側で形を確かめてから、書く側へ広げる。
     */
    if (user) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("home_mode")
            .eq("user_id", user.id)
            .maybeSingle();

        if (profile && profile.home_mode !== "read") notFound();
    }

    const all = await getCachedRecommendScores();

    /*
     * 年齢で絞る。
     *
     * 集計そのものは全員で共有し、
     * 見せる直前にここで絞る。
     * 人ごとに集計すると、そのたび計算し直しになる。
     */
    const { data: viewer } = user
        ? await supabase
              .from("profiles")
              .select("birthdate")
              .eq("user_id", user.id)
              .maybeSingle()
        : { data: null };

    const ratings = allowedRatings(
        ageFromBirthdate((viewer as { birthdate?: string } | null)?.birthdate),
    );

    const scored = all.filter((n) =>
        ratings.includes((n.age_rating as "all" | "r15" | "r18") ?? "all"),
    );

    /*
     * 好きなジャンル。
     *
     * 読んだ作品のジャンルを数え、多い順に。
     * 読んでいない人には空で渡す。
     */
    let favoriteGenres: string[] = [];
    if (user) {
        const { data: reads } = await supabase
            .from("read_episodes")
            .select("novel_id")
            .eq("user_id", user.id)
            .limit(100);

        const readIds = Array.from(
            new Set((reads || []).map((r: { novel_id: string }) => r.novel_id)),
        );

        if (readIds.length > 0) {
            const { data: readNovels } = await supabase
                .from("novels")
                .select("genre")
                .in("id", readIds);

            const count: Record<string, number> = {};
            (readNovels || []).forEach((n: { genre: string }) => {
                if (n.genre) count[n.genre] = (count[n.genre] || 0) + 1;
            });

            favoriteGenres = Object.entries(count)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([genre]) => genre);
        }
    }

    /* 作者の名前 */
    const authorIds = Array.from(new Set(scored.map((n) => n.author_id)));
    const { data: authors } = authorIds.length
        ? await supabase
              .from("public_profiles")
              .select("user_id, display_name")
              .in("user_id", authorIds)
        : { data: [] };

    const authorName: Record<string, string> = {};
    (authors || []).forEach((a: { user_id: string; display_name: string }) => {
        authorName[a.user_id] = a.display_name;
    });

    function toBook(novel: (typeof scored)[number]): HomeBook {
        return {
            id: novel.id,
            href: `/novel/${novel.id}`,
            title: novel.title,
            author: authorName[novel.author_id] || "不明な作者",
            tags: [novel.genre, ...(novel.tags || [])].filter(Boolean).slice(0, 3),
            head: truncate(novel.summary, 120),
            excerpt: truncate(novel.catchcopy || novel.summary, 80),
            comment: "",
            likes: 0,
        } as HomeBook;
    }

    /* あなたへのおすすめ */
    const forYou = buildRecommendation(
        scored,
        LIST_SIZE,
        favoriteGenres,
        user?.id,
    ).map(toBook);

    /*
     * まだ知られていない作品。
     *
     * 読者の数が少なく、それでも点数の高いもの。
     * 「読まれていない」だけでは選べない。
     */
    const hidden = scored
        .filter((n) => n.validReaders <= HIDDEN_READER_MAX)
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, LIST_SIZE)
        .map(toBook);

    /*
     * 最近ふえている作品。
     *
     * 出てから日が浅く、点数の付いているもの。
     */
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const rising = scored
        .filter((n) => n.created_at >= monthAgo)
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, LIST_SIZE)
        .map(toBook);

    return (
        /*
         * 骨組みはランキング・検索と同じ。
         *
         * 見出しは枠の外に置き、その下に札を積む。
         * 3 つの画面で形が違うと、行き来するたびに
         * 目の置き所を探し直すことになる。
         */
        <div style={{ minHeight: "100vh" }}>
            <Header />

            <div
                className="main-layout"
                style={{
                    maxWidth: 1200,
                    margin: "0 auto",
                    padding: "20px 32px",
                    display: "flex",
                    gap: 20,
                    alignItems: "flex-start",
                }}
            >
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 12 }}>
                        <h1
                            style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: "var(--color-text)",
                                marginBottom: 0,
                            }}
                        >
                            おすすめ
                        </h1>
                        <p
                            style={{
                                fontSize: 12.5,
                                color: "var(--color-text)",
                                opacity: 0.75,
                                marginTop: 6,
                                lineHeight: 1.8,
                            }}
                        >
                            読んだ傾向から選んだものと、まだ知られていない作品を並べます。
                        </p>
                    </div>

                    {/*
                     * 一覧の見た目は .reader-home の中でだけ効く。
                     * 囲いを付けないと、素の並びで出てしまう。
                     */}
                    <div className="reader-home space-y-4" data-theme="light">
                    {forYou.length > 0 && (
                        <ReaderWorkList
                            title="あなたへのおすすめ"
                            books={forYou}
                            moreHref="/search"
                        />
                    )}

                    <ReaderWorkList
                        title="まだ知られていない作品"
                        books={hidden}
                        moreHref="/search?sort=new"
                    />

                    <ReaderWorkList
                        title="最近ふえている作品"
                        books={rising}
                        moreHref="/ranking"
                    />
                    </div>

                    {/*
                     * ジャンルから探す。
                     *
                     * 上の一覧で見つからなかった人の受け皿。
                     * 検索の絞り込みと同じ見た目にする。
                     */}
                    <div
                        style={{
                            background: "var(--color-bg-card)",
                            border: "1px solid var(--color-brand-border)",
                            borderRadius: 12,
                            padding: "16px 20px",
                            marginTop: 16,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--color-text)",
                                marginBottom: 12,
                            }}
                        >
                            ジャンルから探す
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {GENRES_SELECTABLE.map((genre) => (
                                <Link
                                    key={genre}
                                    href={`/search?genre=${encodeURIComponent(genre)}`}
                                    style={{
                                        padding: "6px 14px",
                                        borderRadius: 16,
                                        border: "1px solid var(--color-brand-border)",
                                        background: "var(--color-bg)",
                                        fontSize: 12,
                                        color: "var(--color-text)",
                                        textDecoration: "none",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {genre}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
