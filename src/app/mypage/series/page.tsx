/**
 * ============================================================
 * 原石航路 Studio
 * /mypage/series — シリーズ
 * ============================================================
 */

import SeriesManager from "@/components/series-manager";
import { createClient } from "@/lib/supabase/server";

export default async function SeriesPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    /* まとめる相手の作品。題名だけあればよい */
    const { data: novels } = await supabase
        .from("novels")
        .select("id, title")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });

    return <SeriesManager userId={user.id} myNovels={novels ?? []} />;
}
