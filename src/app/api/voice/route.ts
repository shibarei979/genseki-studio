import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { serverEnv, hasGoogleTts } from "@/config/env.server";
import { createClient } from "@/lib/supabase/server";
import { isValidVoice } from "@/lib/voice/google-tts";

/**
 * ============================================================
 * 原石航路 Studio
 * 朗読の場所を返す
 *
 * 話と声を受け取り、作り置きした音声の場所を返す。
 *
 * ここでは作らない。
 * 作るのは裏の定時実行（/api/cron/voice）で、
 * 1 日 3 万字ずつ、投稿の古い順に進める。
 *
 * 押したときに作ると、読者を待たせるうえ、
 * いつ費用が出るか読めない。
 * ============================================================
 */

/** 音声の置き場 */
const BUCKET = "episode-voices";

/*
 * 作り置きしない。
 *
 * 指定が無いと、site を組み立てる段階で
 * この処理が実際に走ってしまう。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
    if (!hasGoogleTts()) {
        return NextResponse.json(
            { error: "読み上げは今は使えません" },
            { status: 503 },
        );
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    /* ログインした人だけ */
    if (!user) {
        return NextResponse.json(
            { error: "ログインすると読み上げを使えます" },
            { status: 401 },
        );
    }

    const body = (await request.json()) as {
        episodeId?: string;
        voice?: string;
    };

    const episodeId = body.episodeId ?? "";
    const voice = body.voice ?? "";

    if (!episodeId || !isValidVoice(voice)) {
        return NextResponse.json({ error: "指定が正しくありません" }, { status: 400 });
    }

    /*
     * 運営の鍵で読み書きする。
     *
     * 音声の記録は誰でも読めるが、書くのはここだけ。
     * 決まりごとを飛び越える必要があるので、運営の鍵を使う。
     */
    if (!serverEnv.supabaseServiceRoleKey) {
        return NextResponse.json(
            { error: "読み上げの設定が足りません（運営用の鍵）" },
            { status: 503 },
        );
    }

    /*
     * 運営の鍵で読み書きする。
     *
     * 書き方はランキングに揃える。
     * そちらは同じ鍵で動いているので、
     * 余計な指定を足さないほうが確実。
     */
    const admin = createAdminClient(
        serverEnv.supabaseUrl,
        serverEnv.supabaseServiceRoleKey,
    );

    /* ---------------------------------------------------------
     * 1. すでに作ってあれば、それを返す
     *
     * ここを先に見る。あとに回すと、保存済みでも
     * 回数を食ってしまう。
     * --------------------------------------------------------- */
    const { data: existing } = await admin
        .from("episode_voices")
        .select("audio_path")
        .eq("episode_id", episodeId)
        .eq("voice", voice)
        .maybeSingle();

    if (existing) {
        const { data } = admin.storage
            .from(BUCKET)
            .getPublicUrl(existing.audio_path as string);

        return NextResponse.json({ url: data.publicUrl, cached: true });
    }

    /*
     * ここから先は作らない。
     *
     * 朗読は裏で作り置きする（/api/cron/voice）。
     * 押したときに作ると待たせるし、
     * いつ費用が出るか読めない。
     *
     * まだ無い話には、そもそも「聴く」を出していない。
     * ここへ来るのは、行き違いか、直接叩かれたときだけ。
     */
    return NextResponse.json(
        { error: "この話の朗読は、まだ用意できていません。" },
        { status: 404 },
    );
}
