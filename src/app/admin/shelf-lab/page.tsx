/**
 * ============================================================
 * 原石航路 Studio
 * /admin/shelf-lab — 本棚をいじるための場所
 *
 * ★ 読者のホームを直に触らずに、本棚だけを試す。
 *
 *   本棚は home.js が位置を計算していて、
 *   少し触るだけで本の並びや吹き出しの座標が崩れる。
 *   本番で試すと、その間ずっと読者に壊れた画面を見せる。
 *
 * ★ 運営だけが入れる。
 *
 *   /admin の下に置いているので、
 *   admin/layout.tsx の確かめを通らないと開けない。
 *   robots.txt でも /admin は塞いである。
 *   どこからも繋いでいないので、住所を知る人しか来ない。
 *
 * ★ 本物と同じものを出す。
 *
 *   作品も、CSS も、home.js も、読者のホームと同じ。
 *   ここで整ったものは、そのまま本番でも整う。
 * ============================================================
 */

import BookshelfSection from "@/components/home/bookshelf-section";
import HomeEffects from "@/components/home/home-effects";
import ShelfNav from "@/components/home/shelf-nav";
import { createAdminClient } from "@/lib/supabase/admin";

import type { HomeBook } from "@/types/home";

/* 本棚に並べる数。読者のホームと同じ */
const SHELF_COUNT = 24;

export const dynamic = "force-dynamic";

export default async function ShelfLabPage() {
    const supabase = createAdminClient();

    const { data } = await supabase
        .from("novels")
        .select("id, title, summary, genre, tags, author_id")
        .eq("published", true)
        .eq("visibility", "public")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(SHELF_COUNT);

    const authorIds = [
        ...new Set((data ?? []).map((row) => row.author_id)),
    ].filter(Boolean) as string[];

    const nameOf: Record<string, string> = {};
    if (authorIds.length > 0) {
        const { data: authors } = await supabase
            .from("public_profiles")
            .select("user_id, display_name")
            .in("user_id", authorIds);

        for (const row of authors ?? []) {
            nameOf[row.user_id as string] = (row.display_name as string) ?? "";
        }
    }

    const books: HomeBook[] = (data ?? []).map((row) => ({
        id: row.id as string,
        href: `/novel/${row.id}`,
        title: (row.title as string) ?? "",
        author: nameOf[row.author_id as string] ?? "",
        head: (row.genre as string) ?? "",
        excerpt: ((row.summary as string) ?? "").slice(0, 60),
        comment: "",
        likes: 0,
        tags: ((row.tags as string[]) ?? []).slice(0, 3),
    }));

    return (
        <>
            <div className="mx-auto max-w-[900px] px-6 py-5">
                <h1 className="text-sm font-medium text-ink">本棚を試す場所</h1>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                    読者のホームと同じ本棚を出しています。ここで直してから、
                    本番へ移してください。
                    <br />
                    この頁は運営だけが開けます。どこからも繋いでいません。
                </p>
            </div>

            {/*
              * ★ 読者のホームと、まったく同じ入れ子にする。
              *
              *   home.js は .reader-home の中の
              *   .rh_main > .rh_shelf を見て位置を計算する。
              *   囲いが違うと、本が積み上がったまま並ばない。
              *
              *   data-view / data-auth も、あちらと同じものを付ける。
              */}
            {/*
              * ★ id="home-page" が要る。
              *
              *   home.js の init は、この印を探して
              *   見つからなければ何もせずに戻る。
              *   印が無いと、本が積み上がったまま並ばない。
              */}
            <div
                id="home-page"
                className="reader-home"
                data-theme="light"
                data-view="reader"
                data-auth="login"
            >
                <div className="rh_main">
                    <div className="rh_shelf">
                        <BookshelfSection books={books} />
                        <div className="rh_shelf-board" aria-hidden="true" />
                        <ShelfNav />
                    </div>
                </div>
            </div>

            {/*
              * 位置の計算と回転は home.js が受け持つ。
              * 入れ替え用の作品は、本棚と同じものを渡しておく。
              */}
            <HomeEffects pools={{ pickupPool: books, newReleasePool: books }} />
        </>
    );
}
