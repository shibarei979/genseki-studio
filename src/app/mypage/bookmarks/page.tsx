/**
 * ============================================================
 * 原石航路 Studio
 * /mypage/bookmarks — 保存済み
 *
 * 読むのは保存した作品と、その仕分けだけ。
 * ============================================================
 */

import BookmarksClient from "@/components/mypage/bookmarks-client";
import { createClient } from "@/lib/supabase/server";

export default async function BookmarksPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [bookmarkRes, folderRes] = await Promise.all([
        supabase
            .from("bookmarks")
            .select(
                "novel_id, folder_id, created_at, novels(id, title, summary, genre, author_id, published, novel_type, is_serial)",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(200),

        supabase
            .from("bookmark_folders")
            .select("id, name, order_num")
            .eq("user_id", user.id)
            .order("order_num"),
    ]);

    const bookmarks = (bookmarkRes.data ?? []).filter((row: any) => row.novels);

    /* 書き手の名前。1 回でまとめて引く */
    const authorIds = Array.from(
        new Set(bookmarks.map((row: any) => row.novels?.author_id).filter(Boolean)),
    );

    const bmAuthorMap: Record<string, string> = {};
    if (authorIds.length > 0) {
        const { data: authors } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", authorIds as string[]);

        (authors ?? []).forEach((row: any) => {
            bmAuthorMap[row.user_id] = row.display_name;
        });
    }

    return (
        <BookmarksClient
            myBookmarks={bookmarks}
            folders={folderRes.data ?? []}
            bmAuthorMap={bmAuthorMap}
        />
    );
}
