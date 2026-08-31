import Link from "next/link";
import { ageFromBirthdate, allowedRatings } from "@/lib/age";
import { notFound } from "next/navigation";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import RecommendBoard from "@/components/recommend/recommend-board";
import RecommendSidebar from "@/components/recommend/recommend-sidebar";
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

/**
 * 並びを混ぜる。
 *
 * 新しい順の先頭をそのまま出すと、
 * 誰かが投稿するまで中身が変わらない。
 * 母集団の中から選び直すために使う。
 */
function shuffle<T>(list: T[]): T[] {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export default async function RecommendPage({
    searchParams,
}: {
    searchParams: { view?: string; genre?: string; filter?: string };
}) {
    /*
     * 選ばれている見せ方と絞り込み。
     * どれも住所から読む。柱を押すと住所が変わり、ここが変わる。
     */
    const view = searchParams.view ?? "foryou";
    const genre = searchParams.genre;
    const filter = searchParams.filter;

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
              .select("birthdate, show_ai_works")
              .eq("user_id", user.id)
              .maybeSingle()
        : { data: null };

    const ratings = allowedRatings(
        ageFromBirthdate((viewer as { birthdate?: string } | null)?.birthdate),
    );

    /*
     * AI が本文を書いた作品を外す。
     *
     * ★ マイページで「出さない」を選んだ人にだけ。
     *   ai_usage が 'full' のものだけ外す。
     *   'assist'（下調べなどに使った）は残す。
     *   表紙を AI で作っただけの作品も残る。
     */
    const hideAi =
        (viewer as { show_ai_works?: boolean } | null)?.show_ai_works === false;

    const rated = all.filter(
        (n) =>
            ratings.includes((n.age_rating as "all" | "r15" | "r18") ?? "all")
            && !(hideAi && (n as { ai_usage?: string }).ai_usage === "full"),
    );

    /*
     * 読めない作品を外す。
     *
     * ★ 話が 1 つも無い作品が板に貼られていた。
     *   題名も空のまま、作者名だけの札になっていた。
     *
     *   しかも押すと「このページはありません」になる。
     *   作品ページは、話が 0 件なら読者に見せない作りだから。
     *
     * 題名の無いものも外す。板に貼っても何の話か分からない。
     *
     * 読者ホームでも同じことをしている。
     * 作品を並べる所では、毎回これが要る。
     */
    const liveIds = new Set<string>();
    if (rated.length > 0) {
        const { data: liveEpisodes } = await supabase
            .from("episodes")
            .select("novel_id")
            .in("novel_id", rated.map((n) => n.id))
            .eq("is_published", true)
            .limit(20000);

        for (const row of (liveEpisodes || []) as { novel_id: string }[]) {
            liveIds.add(row.novel_id);
        }
    }

    const scored = rated.filter(
        (n) => liveIds.has(n.id) && (n.title ?? "").trim() !== "",
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

    /*
     * 板に出すものを 1 つに決める。
     *
     * 前は 3 つの板を縦に並べていた。
     * 板が続くと重く、どれを見ればよいか分からない。
     * 柱で切り替える形にして、板は 1 つにする。
     */
    /*
     * 新着のおすすめ。
     *
     * ★ 新しい順の先頭をそのまま出さない。
     *   誰かが投稿するまで、中身も順番も変わらない。
     *   毎日見に来る人には、同じ並びが続く。
     *
     *   この 30 日に出た作品を母集団にして、その中から選ぶ。
     */
    const newBooks = shuffle(
        scored.filter((n) => n.created_at >= monthAgo),
    )
        .slice(0, LIST_SIZE)
        .map(toBook);

    const hotBooks = scored
        .slice()
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, LIST_SIZE)
        .map(toBook);

    const VIEW_MAP: Record<string, { title: string; note: string; books: HomeBook[] }> = {
        foryou: { title: "あなたへのおすすめ", note: "読んだ作品から選んでいます", books: forYou },
        hidden: { title: "ここからの作品", note: "まだ人目に触れていない、けれど読まれてほしい作品", books: hidden },
        rising: { title: "伸びている作品", note: "ここしばらく読まれ方が伸びています", books: rising },
        new:    { title: "新着のおすすめ", note: "この30日に出た作品から", books: newBooks },
        hot:    { title: "急上昇のおすすめ", note: "読まれ方の勢いが大きい作品", books: hotBooks },
    };

    const base = VIEW_MAP[view] ?? VIEW_MAP.foryou;

    /*
     * ジャンルと条件で絞る。
     *
     * 絞ったあとに残らないことがあるが、
     * そのときは板の側が「条件を外して見る」を出す。
     */
    const allowed = new Set(
        scored
            .filter((n) => {
                if (genre && n.genre !== genre) return false;
                /*
                 * ★ 完結・連載では絞れない。
                 *   点数付けの一覧（ScoredNovel）が is_serial を持っていない。
                 *   効かない押し具を柱に置くのは嘘になるので、
                 *   柱の側からも外してある。
                 */
                if (filter === "long" && n.novel_type !== "長編") return false;
                if (filter === "short" && n.novel_type !== "短編") return false;
                return true;
            })
            .map((n) => n.id),
    );

    const shown = {
        ...base,
        books: base.books.filter((book) => allowed.has(book.id)),
    };

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

            <div className="rec-page">
                <RecommendSidebar view={view} genre={genre} filter={filter} />

                <div style={{ minWidth: 0 }}>
                    <div className="rb_head">
                        <h1 className="rb_title">{shown.title}</h1>
                        <p className="rb_note">{shown.note}</p>
                    </div>

                    <RecommendBoard books={shown.books} />
                </div>
            </div>

            {/* フッターは詰めて置く。既定では上に 18rem の余白が入る */}
            <Footer tight />
        </div>
    );
}
