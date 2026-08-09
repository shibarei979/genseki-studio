/**
 * ============================================================
 * 原石航路 Studio
 * /mypage/history — 閲覧履歴
 *
 * どの話をどこまで読んだか。
 * 作品ごとに 1 行だけ出す。話ごとに並べると探せない。
 * ============================================================
 */

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: views } = await supabase
        .from("page_views")
        .select("episode_id, novel_id, viewed_at")
        .eq("user_id", user.id)
        .order("viewed_at", { ascending: false })
        .limit(200);

    /*
     * 作品ごとに、いちばん新しいものだけ残す。
     * 同じ作品を何度も開くので、そのまま並べると同じ題名が続く。
     */
    const latest = new Map<string, { episodeId: string; at: string }>();
    (views ?? []).forEach((row: any) => {
        if (!row.novel_id || latest.has(row.novel_id)) return;
        latest.set(row.novel_id, { episodeId: row.episode_id, at: row.viewed_at });
    });

    const novelIds = Array.from(latest.keys());
    if (novelIds.length === 0) {
        return (
            <p className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-faint">
                読んだ作品はまだありません。
            </p>
        );
    }

    const [novelRes, episodeRes] = await Promise.all([
        supabase.from("novels").select("id, title, genre").in("id", novelIds),
        supabase
            .from("episodes")
            .select("id, title, ep_number")
            .in(
                "id",
                Array.from(latest.values())
                    .map((row) => row.episodeId)
                    .filter(Boolean),
            ),
    ]);

    const novelById = new Map(
        (novelRes.data ?? []).map((row: any) => [row.id, row]),
    );
    const episodeById = new Map(
        (episodeRes.data ?? []).map((row: any) => [row.id, row]),
    );

    return (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {novelIds.map((novelId) => {
                const novel = novelById.get(novelId);
                const spot = latest.get(novelId);
                const episode = spot ? episodeById.get(spot.episodeId) : null;

                if (!novel) return null;

                return (
                    <li key={novelId}>
                        <Link
                            href={
                                episode
                                    ? `/novel/${novelId}/episode/${episode.id}`
                                    : `/novel/${novelId}`
                            }
                            className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] text-ink">
                                    {novel.title || "名前のない作品"}
                                </span>

                                {episode && (
                                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                                        {episode.title || `第${episode.ep_number}話`}
                                        まで読みました
                                    </span>
                                )}
                            </span>

                            <span className="shrink-0 text-[10px] text-faint">
                                {spot?.at.slice(0, 10).replace(/-/g, "/")}
                            </span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}
