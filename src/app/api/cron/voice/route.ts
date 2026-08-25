/**
 * ============================================================
 * 原石航路 Studio
 * /api/cron/voice — AI 朗読を、裏で少しずつ作る
 *
 * 読者が押したときに作ると、待たせるうえ費用が読めない。
 * ここで作り置きし、できた話にだけ「聴く」を出す。
 *
 * 1 日 3 万字まで。投稿の古い順に進める。
 * 声は 2 つ（女性A・男性A）。
 *   1 話 8,000 字 × 2 声 = 16,000 字
 *   1 日 2 話ほど、1 か月で 56 話ほど
 *
 * 呼ぶのは Vercel の定時実行（vercel.json）。
 * 途中で止まっても、次の日に続きから始まる。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasGoogleTts } from "@/config/env.server";
import { synthesize } from "@/lib/voice/google-tts";
import type { VoiceId } from "@/lib/voice/google-tts";

/** 1 回で作る字数の上限。声の数を掛けた後の値 */
const DAILY_CHAR_LIMIT = 30_000;

/** 作り置きする声。増やすと、その分だけ進みが遅くなる */
const VOICES: VoiceId[] = ["ja-JP-Wavenet-A", "ja-JP-Wavenet-C"];

/** 音声の置き場 */
const BUCKET = "episode-voices";

/** 短すぎる話は作らない */
const MIN_CHARS = 200;

export async function GET(request: Request) {
    /* 誰でも叩ける入口にしない */
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const sent = request.headers.get("authorization");
        if (sent !== `Bearer ${secret}`) {
            return NextResponse.json({ error: "通せません" }, { status: 401 });
        }
    }

    if (!hasGoogleTts()) {
        return NextResponse.json({ error: "読み上げの設定がありません" }, { status: 503 });
    }

    const admin = createAdminClient();

    /*
     * 順番待ちを、投稿の古い順に取る。
     *
     * 多めに取っておき、字数の上限で切る。
     * 1 話ずつ問い合わせると、回数が増えて遅い。
     */
    const { data: queue } = await admin
        .from("voice_queue")
        .select("episode_id, char_count")
        .eq("status", "waiting")
        .order("published_at", { ascending: true })
        .limit(20);

    const waiting = queue || [];

    if (waiting.length === 0) {
        return NextResponse.json({ 作った話: 0, 使った字数: 0, 残り: 0 });
    }

    let usedChars = 0;
    let doneCount = 0;
    const failed: string[] = [];

    for (const row of waiting) {
        const episodeId = row.episode_id as string;

        /*
         * この話にかかる字数。
         * 声の数だけ作るので、その分を掛ける。
         */
        const cost = Number(row.char_count ?? 0) * VOICES.length;

        /* 上限を超えるなら、ここで止める。次の日に続きから */
        if (usedChars + cost > DAILY_CHAR_LIMIT) break;

        /* 本文を読む */
        const { data: episode } = await admin
            .from("episodes")
            .select("body")
            .eq("id", episodeId)
            .maybeSingle();

        const text = String(episode?.body ?? "")
            .replace(/[|｜]([^《]+)《[^》]+》/g, "$1")
            .replace(/《《([^》]+)》》/g, "$1")
            .replace(/<[^>]+>/g, "")
            .trim();

        if (text.length < MIN_CHARS) {
            /* 短すぎる話は飛ばす。作っても聴くほどのものにならない */
            await admin
                .from("voice_queue")
                .update({ status: "skipped", processed_at: new Date().toISOString() })
                .eq("episode_id", episodeId);
            continue;
        }

        try {
            for (const voice of VOICES) {
                /* すでにあれば飛ばす。二重に作ると、その分だけ無駄になる */
                const { data: existing } = await admin
                    .from("episode_voices")
                    .select("episode_id")
                    .eq("episode_id", episodeId)
                    .eq("voice", voice)
                    .maybeSingle();

                if (existing) continue;

                const audio = await synthesize(text, voice);
                const path = `${episodeId}/${voice}.mp3`;

                const { error: uploadError } = await admin.storage
                    .from(BUCKET)
                    .upload(path, audio, {
                        contentType: "audio/mpeg",
                        upsert: true,
                    });

                if (uploadError) throw new Error(uploadError.message);

                await admin.from("episode_voices").insert({
                    episode_id: episodeId,
                    voice,
                    audio_path: path,
                    char_count: text.length,
                });

                usedChars += text.length;
            }

            await admin
                .from("voice_queue")
                .update({
                    status: "done",
                    processed_at: new Date().toISOString(),
                    error: null,
                })
                .eq("episode_id", episodeId);

            doneCount += 1;
        } catch (caught) {
            const reason =
                caught instanceof Error ? caught.message : "作れませんでした";

            /*
             * 失敗しても止めない。
             *
             * 1 話でつまずいて全部止まると、
             * その日は何も進まなくなる。
             */
            await admin
                .from("voice_queue")
                .update({
                    status: "failed",
                    processed_at: new Date().toISOString(),
                    error: reason.slice(0, 300),
                })
                .eq("episode_id", episodeId);

            failed.push(episodeId);
        }
    }

    /* 使った字数を、月ごとの記録にも足す */
    if (usedChars > 0) {
        const month = new Date().toISOString().slice(0, 7);
        const { data: usage } = await admin
            .from("voice_usage")
            .select("char_count")
            .eq("month", month)
            .maybeSingle();

        await admin.from("voice_usage").upsert(
            {
                month,
                char_count: Number(usage?.char_count ?? 0) + usedChars,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "month" },
        );
    }

    const { count: remaining } = await admin
        .from("voice_queue")
        .select("episode_id", { count: "exact", head: true })
        .eq("status", "waiting");

    return NextResponse.json({
        作った話: doneCount,
        使った字数: usedChars,
        作れなかった話: failed.length,
        残り: remaining ?? 0,
    });
}
