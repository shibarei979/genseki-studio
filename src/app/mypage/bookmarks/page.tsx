/**
 * ============================================================
 * 原石航路 Studio
 * /mypage/bookmarks — 保存済み
 *
 * 読むのは 2 つだけ。
 * 保存した作品と、その書き手の名前。
 * ============================================================
 */

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function BookmarksPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: rows } = await supabase
        .from("bookmarks")
        .select(
            "novel_id, created_at, novels(id, title, summary, genre, author_id, published)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

    const bookmarks = (rows ?? []).filter((row: any) => row.novels);

    /* 書き手の名前。1 回でまとめて引く */
    const authorIds = Array.from(
        new Set(bookmarks.map((row: any) => row.novels?.author_id).filter(Boolean)),
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

    if (bookmarks.length === 0) {
        return (
            <p className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-faint">
                保存した作品はまだありません。
            </p>
        );
    }

    return (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {bookmarks.map((row: any) => (
                <li key={row.novel_id}>
                    <Link
                        href={`/novel/${row.novel_id}`}
                        className="block px-5 py-4 hover:bg-canvas"
                    >
                        <p className="truncate text-[14px] font-medium text-ink">
                            {row.novels.title || "名前のない作品"}
                        </p>

                        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[11px] text-muted">
                            <span>{nameById[row.novels.author_id] ?? "名無し"}</span>
                            {row.novels.genre && (
                                <>
                                    <span className="text-faint">·</span>
                                    <span>{row.novels.genre}</span>
                                </>
                            )}
                            <span className="text-faint">·</span>
                            <span className="text-faint">
                                {row.created_at.slice(0, 10).replace(/-/g, "/")}
                            </span>
                        </p>

                        {row.novels.summary && (
                            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                                {row.novels.summary}
                            </p>
                        )}
                    </Link>
                </li>
            ))}
        </ul>
    );
}
