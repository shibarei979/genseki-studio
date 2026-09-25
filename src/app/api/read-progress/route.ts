import { NextResponse } from "next/server";

import { cookies } from "next/headers";

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
 *   大きいほうを残す。
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

/**
 * 今の台帳の様子を見る。
 *
 * ★ ブラウザでこの住所を開くだけで分かる。
 *   {"ok":true,"rows":0}        … 台帳には届く。送る側が動いていない
 *   {"ok":true,"rows":3}        … 記録されている
 *   {"ok":false,"error":"..."}  … その文が原因
 *
 * ★ 数だけを返す。誰が何を読んだかは出さない。
 */
export async function GET() {
    try {
        const admin = createAdminClient();
        /*
         * ★ head（数だけ聞く形）にしない。
         *   head だと、失敗したときに理由の文が返ってこない。
         *   1 行だけ実際に読んで、理由の文ごと受け取る。
         */
        const { count, error, status } = await admin
            .from("read_progress")
            .select("session_key", { count: "exact" })
            .limit(1);
        if (error) {
            return NextResponse.json({
                ok: false,
                status,
                error: error.message,
                code: error.code ?? null,
                details: error.details ?? null,
                hint: error.hint ?? null,
            });
        }
        return NextResponse.json({ ok: true, rows: count ?? 0 });
    } catch (e) {
        return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
}

export async function POST(request: Request) {
    /*
     * 窓を閉じるときの知らせは sendBeacon で来る。
     * その荷は text/plain なので、request.json() では読めない。
     */
    let body: Record<string, unknown>;
    try {
        body = JSON.parse(await request.text());
    } catch {
        return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
    }

    const episodeId = String(body.episode_id || "");
    const sessionKey = String(body.session_key || "").slice(0, 40);
    if (!episodeId || !sessionKey) {
        return NextResponse.json({ ok: false, error: "no key" }, { status: 400 });
    }

    /* 割合は 0〜100、時間は 6 時間まで。おかしな数を弾く */
    const maxPct = Math.max(0, Math.min(100, Math.round(Number(body.max_pct) || 0)));
    const seconds = Math.max(0, Math.min(6 * 60 * 60, Math.round(Number(body.read_seconds) || 0)));

    try {
        const admin = createAdminClient();

        const { data: episode, error: epError } = await admin
            .from("episodes")
            .select("id, novel_id")
            .eq("id", episodeId)
            .maybeSingle();
        if (epError) {
            console.error("[read-progress] episodes", epError);
            return NextResponse.json({ ok: false, error: epError.message }, { status: 500 });
        }
        if (!episode) return NextResponse.json({ ok: false, error: "no episode" }, { status: 404 });

        const { data: novel } = await admin
            .from("novels")
            .select("id, author_id")
            .eq("id", episode.novel_id)
            .maybeSingle();

        /* 入っている人かどうか。入っていなくても控える */
        let userId: string | null = null;
        try {
            const supabase = await createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            userId = user?.id ?? null;
        } catch {
            userId = null;
        }

        /*
         * その機械の札。
         * 画面の側では読めないことがあるので、まず cookie を見る。
         */
        let visitor: string | null = null;
        try {
            visitor = (await cookies()).get("gk-visitor")?.value ?? null;
        } catch {
            visitor = null;
        }
        if (!visitor && body.visitor_key) visitor = String(body.visitor_key);
        if (visitor) visitor = visitor.slice(0, 40);

        const agent = (request.headers.get("user-agent") || "").toLowerCase();
        const isBot = agent === "" || BOT_WORDS.some((word) => agent.includes(word));
        const isPhone = /mobile|android|iphone|ipad|ipod/.test(agent);
        const now = new Date().toISOString();

        /*
         * ★ SQL の関数は通さず、表へ直に書く。
         *   関数の実行権限や、関数が見つからない問題を避けるため。
         *
         * ★ 既にあれば、大きいほうを残して書き替える。
         *   無ければ 1 行足す。
         */
        const { data: before, error: readError } = await admin
            .from("read_progress")
            .select("max_pct, read_seconds")
            .eq("session_key", sessionKey)
            .eq("episode_id", episodeId)
            .maybeSingle();
        if (readError) {
            console.error("[read-progress] read", readError);
            return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
        }

        if (before) {
            const nextPct = Math.max(Number(before.max_pct) || 0, maxPct);
            const nextSeconds = Math.max(Number(before.read_seconds) || 0, seconds);
            const { error } = await admin
                .from("read_progress")
                .update({
                    max_pct: nextPct,
                    read_seconds: nextSeconds,
                    reached_end: nextPct >= 95,
                    updated_at: now,
                })
                .eq("session_key", sessionKey)
                .eq("episode_id", episodeId);
            if (error) {
                console.error("[read-progress] update", error);
                return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ ok: true, updated: true });
        }

        const { error: insertError } = await admin.from("read_progress").insert({
            session_key: sessionKey,
            episode_id: episodeId,
            novel_id: episode.novel_id,
            user_id: userId,
            visitor_key: visitor,
            max_pct: maxPct,
            read_seconds: seconds,
            reached_end: maxPct >= 95,
            is_author: !!(userId && novel && novel.author_id === userId),
            is_bot: isBot,
            device: isPhone ? "mobile" : "desktop",
            referrer: body.referrer ? String(body.referrer).slice(0, 300) : null,
            started_at: now,
            updated_at: now,
        });

        if (insertError) {
            /*
             * ほぼ同時に 2 つ届いて、先に片方が行を作ったとき。
             * 次の知らせで書き替わるので、ここでは失敗にしない。
             */
            if (insertError.code === "23505") {
                return NextResponse.json({ ok: true, raced: true });
            }
            console.error("[read-progress] insert", insertError);
            return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, inserted: true });
    } catch (e) {
        console.error("[read-progress] crash", e);
        return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
        );
    }
}
