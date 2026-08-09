/**
 * ============================================================
 * 原石航路 Studio
 * /mypage/settings — 設定
 *
 * 読むのは自分の情報だけ。
 * 作品も履歴も要らない。
 * ============================================================
 */

import MypageSettings from "@/components/mypage/mypage-settings-client";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [profileRes, blockRes, muteRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
            .from("user_blocks")
            .select("blocked_id, profiles!user_blocks_blocked_id_fkey(user_id, display_name)")
            .eq("blocker_id", user.id),
        supabase
            .from("user_mutes")
            .select("muted_id, profiles!user_mutes_muted_id_fkey(user_id, display_name)")
            .eq("muter_id", user.id),
    ]);

    if (!profileRes.data) return null;

    return (
        <MypageSettings
            profile={profileRes.data}
            blocks={blockRes.data ?? []}
            mutes={muteRes.data ?? []}
        />
    );
}
