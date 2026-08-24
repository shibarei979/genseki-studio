import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { serverEnv, hasGoogleTts } from "@/config/env.server";
import { createClient } from "@/lib/supabase/server";
import { isValidVoice, synthesize } from "@/lib/voice/google-tts";

/**
 * ============================================================
 * 原石航路 Studio
 * 読み上げを作る
 *
 * 話と声を受け取り、音声の場所を返す。
 *
 * 費用がかかるので、作る前に必ず歯止めを通す。
 *   1  保存済みなら、作らずにその場所を返す（無料）
 *   2  1 人 1 日 3 回まで（作るときだけ数える）
 *   3  全体で 1 か月 80 万字まで
 *
 * 3 つとも、破られると請求が跳ねる。
 * 順番も大事で、1 を先に見ないと保存済みでも回数を食う。
 * ============================================================
 */

/** 1 人が 1 日に新しく作れる回数 */
const DAILY_LIMIT = 3;

/** 全体で 1 か月に作れる字数。無料枠 100 万字の 8 割で止める */
const MONTHLY_CHAR_LIMIT = 800_000;

/** 音声の置き場 */
const BUCKET = "episode-voices";

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

    /* ---------------------------------------------------------
     * 2. 1 人 1 日の回数
     * --------------------------------------------------------- */
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count } = await admin
        .from("voice_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", since);

    if ((count ?? 0) >= DAILY_LIMIT) {
        return NextResponse.json(
            {
                error: `新しく作れるのは 1 日 ${DAILY_LIMIT} 回までです。すでに作られた読み上げは、何度でも聞けます。`,
            },
            { status: 429 },
        );
    }

    /* ---------------------------------------------------------
     * 3. 本文を読む
     * --------------------------------------------------------- */
    const { data: episode } = await admin
        .from("episodes")
        .select("body, title, novel_id")
        .eq("id", episodeId)
        .maybeSingle();

    if (!episode) {
        return NextResponse.json({ error: "話が見つかりません" }, { status: 404 });
    }

    /*
     * 読み上げ用に整える。
     *
     * ルビの印はそのままだと読み上げられてしまう。
     * 親文字だけを残し、記号は落とす。
     */
    const text = String(episode.body ?? "")
        .replace(/[|｜]([^《]+)《[^》]+》/g, "$1")
        .replace(/《《([^》]+)》》/g, "$1")
        .replace(/<[^>]+>/g, "")
        .trim();

    if (text.length === 0) {
        return NextResponse.json({ error: "本文がありません" }, { status: 400 });
    }

    /* ---------------------------------------------------------
     * 4. 全体の字数
     * --------------------------------------------------------- */
    const month = new Date().toISOString().slice(0, 7);

    const { data: usage } = await admin
        .from("voice_usage")
        .select("char_count")
        .eq("month", month)
        .maybeSingle();

    const used = Number(usage?.char_count ?? 0);

    if (used + text.length > MONTHLY_CHAR_LIMIT) {
        return NextResponse.json(
            {
                error: "今月の読み上げの上限に達しました。来月またお使いください。",
            },
            { status: 429 },
        );
    }

    /* ---------------------------------------------------------
     * 5. 作って保存する
     * --------------------------------------------------------- */
    let audio: Buffer;
    try {
        audio = await synthesize(text, voice);
    } catch (caught) {
        return NextResponse.json(
            {
                error:
                    caught instanceof Error
                        ? caught.message
                        : "読み上げを作れませんでした",
            },
            { status: 500 },
        );
    }

    const path = `${episodeId}/${voice}.mp3`;

    const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, audio, {
            contentType: "audio/mpeg",
            upsert: true,
        });

    if (uploadError) {
        return NextResponse.json(
            { error: "音声を保存できませんでした" },
            { status: 500 },
        );
    }

    /* ---------------------------------------------------------
     * 6. 記録する
     *
     * 作れたあとに書く。
     * 先に書くと、失敗したときだけ回数が減る。
     * --------------------------------------------------------- */
    await admin.from("episode_voices").insert({
        episode_id: episodeId,
        voice,
        audio_path: path,
        char_count: text.length,
    });

    await admin.from("voice_requests").insert({
        user_id: user.id,
        episode_id: episodeId,
        voice,
    });

    await admin.from("voice_usage").upsert(
        {
            month,
            char_count: used + text.length,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "month" },
    );

    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: publicUrl.publicUrl, cached: false });
}
