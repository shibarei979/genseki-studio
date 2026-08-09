/**
 * ============================================================
 * 原石航路 Studio
 * /mypage — マイページの入口
 *
 * ここで読むのは、開いた瞬間に見たいものだけ。
 *
 * 保存済み・履歴・つぶやきは別のページにした。
 * 設定を見たいだけの人が、それらを待つ理由が無い。
 * ============================================================
 */

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils/text";

export default async function MypagePage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    /*
     * 一度にまとめて頼む。
     * どれも互いに関わらないので、順に待つ理由が無い。
     */
    const [profileRes, novelRes, followerRes, followingRes] = await Promise.all([
        supabase
            .from("profiles")
            .select("display_name, bio, icon_url, created_at")
            .eq("user_id", user.id)
            .maybeSingle(),

        supabase
            .from("novels")
            .select("id, title, published, visibility, views, updated_at")
            .eq("author_id", user.id)
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
            .limit(6),

        supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", user.id),

        supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", user.id),
    ]);

    const profile = profileRes.data;
    const novels = novelRes.data ?? [];

    /* いいねの数。作品が無ければ数えない */
    let likeCount = 0;
    if (novels.length > 0) {
        const { count } = await supabase
            .from("likes")
            .select("*", { count: "exact", head: true })
            .in("novel_id", novels.map((row: any) => row.id));
        likeCount = count ?? 0;
    }

    const since = profile?.created_at
        ? `${new Date(profile.created_at).getFullYear()}年${new Date(profile.created_at).getMonth() + 1}月`
        : "";

    return (
        <div className="space-y-5">
            {/* 名乗り */}
            <section className="rounded-xl border border-line bg-surface px-6 py-5">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-forest-tint text-lg text-forest">
                        {Array.from(String(profile?.display_name ?? "?"))[0]}
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="text-[17px] font-semibold text-ink">
                            {profile?.display_name ?? "名無しの書き手"}
                        </p>
                        {since && (
                            <p className="mt-0.5 text-[11px] text-faint">
                                {since}から活動中
                            </p>
                        )}
                    </div>

                    <Link
                        href="/mypage/settings"
                        className="shrink-0 rounded-lg border border-line px-4 py-2 text-xs text-ink hover:border-forest-line hover:text-forest"
                    >
                        設定
                    </Link>
                </div>

                {profile?.bio && (
                    <p className="mt-3.5 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
                        {profile.bio}
                    </p>
                )}
            </section>

            {/* 数 */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="作品" value={novels.length} />
                <Stat label="総いいね" value={likeCount} />
                <Stat label="フォロワー" value={followerRes.count ?? 0} />
                <Stat label="フォロー中" value={followingRes.count ?? 0} />
            </ul>

            {/* 最近の作品 */}
            <section>
                <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-sm font-medium text-ink">最近の作品</h2>
                    <Link
                        href="/mypage/works"
                        className="text-[11px] text-forest hover:underline"
                    >
                        すべて見る
                    </Link>
                </div>

                {novels.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line py-14 text-center text-sm text-faint">
                        まだ作品がありません。
                    </p>
                ) : (
                    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                        {novels.map((novel: any) => {
                            const isPublic =
                                novel.visibility === "public" || novel.published;

                            return (
                                <li key={novel.id}>
                                    <Link
                                        href={`/workspace/${novel.id}`}
                                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas"
                                    >
                                        <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                                            {novel.title || "名前のない作品"}
                                        </span>

                                        <span
                                            className={[
                                                "shrink-0 rounded px-2 py-0.5 text-[10px]",
                                                isPublic
                                                    ? "bg-forest-tint text-forest"
                                                    : "bg-canvas text-faint",
                                            ].join(" ")}
                                        >
                                            {isPublic ? "公開中" : "下書き"}
                                        </span>

                                        <span className="shrink-0 text-[10px] text-faint">
                                            {novel.updated_at
                                                .slice(0, 10)
                                                .replace(/-/g, "/")}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <li className="rounded-xl border border-line bg-surface px-4 py-3.5">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="mt-1 text-[20px] font-semibold leading-none text-ink">
                {formatNumber(value)}
            </p>
        </li>
    );
}
