import { createClient } from "@/lib/supabase/server";
import HomeClient from "@/components/home/home-client";
import ReaderHome from "@/components/home/reader-home";

/**
 * ホーム。
 *
 * 表示設定によって、読む人向けと書く人向けを切り替える。
 * 同じ場所で切り替えるのは、行き先を覚え直さずに済むため。
 */
/* 読者向けホームの一覧は 30 秒ごとに作り直す */
export const revalidate = 30;

export default async function HomePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        /*
         * 照合は user_id。
         *
         * profiles の主キーは id だが、ログインした人と結びつくのは
         * user_id のほう。id で引くと、いつまでも見つからない。
         */
        const { data: profile } = await supabase
            .from("profiles")
            .select("home_mode")
            .eq("user_id", user.id)
            .maybeSingle();

        if (profile?.home_mode === "read") return <ReaderHome />;
    }

    return <HomeClient />;
}
