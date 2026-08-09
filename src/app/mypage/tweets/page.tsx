/**
 * ============================================================
 * 原石航路 Studio
 * /mypage/tweets — つぶやき
 * ============================================================
 */

import TweetSection from "@/components/tweet-section";
import { createClient } from "@/lib/supabase/server";

export default async function TweetsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, icon_url")
        .eq("user_id", user.id)
        .maybeSingle();

    return (
        <TweetSection
            authorId={user.id}
            currentUserId={user.id}
            currentUserName={profile?.display_name ?? ""}
            currentUserIconUrl={profile?.icon_url ?? null}
            isOwner
        />
    );
}
