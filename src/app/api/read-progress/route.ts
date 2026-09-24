import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/read-progress — どこまで読まれたかを控える
 *
 * ★ これまでは「読んだ」か「読んでいない」かしか無かった。
 *
 *   valid-read は「10 秒 以上 + 3 割 以上」を満たした
 *   その一瞬に 1 回だけ送る作りで、
 *   残る割合はいつも 3 割あたりになる。
 *   だから「どこで離れたか」は分からなかった。
 *
 * ★ ここでは、1 回の読書につき 1 行だけ持つ。
 *
 *   読み進むたびに同じ行を書き替える。
 *   行が増えないので、話 1 本に何百行も溜まらない。
 *
 * ★ 数は減らさない。
 *
 *   後から届いた知らせのほうが小さくても、
 *   大きいほうを残す（SQL 側の record_read_progress）。
 *   戻って読み直したときに、記録が巻き戻らないため。
 *
 * ★ 誰が読んだかは持たない。
 *   入っている人は user_id、入っていない人は
 *   その機械に配った意味の無い札だけ。
 * ============================================================
 */

export const dynamic = "force-dynamic";

/**
 * 見回りの機械の名乗り。
 *
 * ★ lib/bot.ts と同じ考え方だが、ここでは持ち込まない。
 *   この道は知らせを受けるだけの細い道で、
 *   読み込むものを増やしたくない。
 */
const BOT_WORDS = [
    "bot",
    "crawler",
    "spider",
    "slurp",
    "facebookexternalhit",
    "embedly",
    "discordbot",
    "headlesschrome",
    "chrome-lighthouse",
    "python-requests",
    "curl/",
    "wget",
    "axios",
    "node-fetch",
];

export async function POST(request: Request) {
    /*
     * 窓を閉じるときの知らせは sendBeacon で来る。
     * その荷は text/plain なので、request.json() では読めない。
     */
    let body: Record<string, unknown>;
    try {
        body = JSON.parse(await request.text());
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const episodeId = String(body.episode_id || "");
    const sessionKey = String(body.session_key || "").slice(0, 40);
    if (!episodeId || !sessionKey) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    /* 割合は 0〜100、時間は 6 時間まで。おかしな数を弾く */
    const maxPct = Math.max(0, Math.min(100, Math.round(Number(body.max_pct) || 0)));
    const seconds = Math.max(0, Math.min(6 * 60 * 60, Math.round(Number(body.read_seconds) || 0)));

    const admin = createAdminClient();

    const { data: episode } = await admin
        .from("episodes")
        .select("id, novel_id")
        .eq("id", episodeId)
        .maybeSingle();
    if (!episode) return NextResponse.json({ ok: false }, { status: 404 });

    const { data: novel } = await admin
        .from("novels")
        .select("id, author_id")
        .eq("id", episode.novel_id)
        .maybeSingle();

    /* 入っている人かどうか。入っていなくても控える */
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const agent = (request.headers.get("user-agent") || "").toLowerCase();
    const isBot = agent === "" || BOT_WORDS.some((word) => agent.includes(word));
    const isPhone = /mobile|android|iphone|ipad|ipod/.test(agent);

    await admin.rpc("record_read_progress", {
        p_session_key: sessionKey,
        p_episode_id: episodeId,
        p_novel_id: episode.novel_id,
        p_user_id: user?.id ?? null,
        p_visitor_key: body.visitor_key ? String(body.visitor_key).slice(0, 40) : null,
        p_max_pct: maxPct,
        p_read_seconds: seconds,
        p_is_author: !!(user && novel && novel.author_id === user.id),
        p_is_bot: isBot,
        p_device: isPhone ? "mobile" : "desktop",
        p_referrer: body.referrer ? String(body.referrer).slice(0, 300) : null,
    });

    return NextResponse.json({ ok: true });
}
