/**
 * ============================================================
 * 原石航路 Studio
 * /api/tweets/write — つぶやきの書き込み
 *
 * ★ 表を直に触らせないための受け口。
 *
 *   読み取りは /api/tweets へ寄せた。
 *   書き込みもここへ寄せると、表から権限を丸ごと外せる。
 *   外して初めて「隠されたか確かめる」手が塞がる。
 *
 * ★ 誰が何をできるかは、ここで確かめる。
 *
 *   create  入っている人。本文は自分の名で入る
 *   update  自分のつぶやきだけ
 *   delete  自分のつぶやき、または運営
 *   hide    運営だけ
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** 一度に入れられる長さ。長文は作品のほうへ */
const MAX_BODY = 1000;

export async function POST(request: Request) {
    try {
        const { action, tweetId, body, imageUrl, topic, hidden } =
            await request.json();

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "ログインしていません" },
                { status: 401 },
            );
        }

        const admin = createAdminClient();

        const { data: profile } = await admin
            .from("profiles")
            .select("is_admin")
            .eq("user_id", user.id)
            .single();

        const isAdmin = profile?.is_admin === true;

        /* ---------- 新しく書く ---------- */
        if (action === "create") {
            const text = String(body ?? "").trim();

            if (!text) {
                return NextResponse.json(
                    { error: "中身がありません" },
                    { status: 400 },
                );
            }

            if (text.length > MAX_BODY) {
                return NextResponse.json(
                    { error: `${MAX_BODY}文字までです` },
                    { status: 400 },
                );
            }

            const { data, error } = await admin
                .from("tweets")
                .insert({
                    /* ★ 名は必ずサーバー側で決める。画面から渡させない */
                    user_id: user.id,
                    body: text,
                    image_url: imageUrl ?? null,
                    topic: topic ?? null,
                })
                .select(
                    "id, user_id, body, image_url, created_at, edited_at, topic",
                )
                .single();

            if (error) throw error;
            return NextResponse.json({ tweet: data });
        }

        if (!tweetId) {
            return NextResponse.json(
                { error: "どのつぶやきか分かりません" },
                { status: 400 },
            );
        }

        const { data: target } = await admin
            .from("tweets")
            .select("id, user_id")
            .eq("id", tweetId)
            .single();

        if (!target) {
            return NextResponse.json(
                { error: "そのつぶやきがありません" },
                { status: 404 },
            );
        }

        const isMine = target.user_id === user.id;

        /* ---------- 直す ---------- */
        if (action === "update") {
            if (!isMine) {
                return NextResponse.json(
                    { error: "自分のつぶやきではありません" },
                    { status: 403 },
                );
            }

            const text = String(body ?? "").trim();
            if (!text || text.length > MAX_BODY) {
                return NextResponse.json(
                    { error: "中身を確かめてください" },
                    { status: 400 },
                );
            }

            const { error } = await admin
                .from("tweets")
                .update({ body: text, edited_at: new Date().toISOString() })
                .eq("id", tweetId);

            if (error) throw error;
            return NextResponse.json({ ok: true });
        }

        /* ---------- 消す ---------- */
        if (action === "delete") {
            if (!isMine && !isAdmin) {
                return NextResponse.json(
                    { error: "自分のつぶやきではありません" },
                    { status: 403 },
                );
            }

            const { error } = await admin
                .from("tweets")
                .delete()
                .eq("id", tweetId);

            if (error) throw error;
            return NextResponse.json({ ok: true });
        }

        /* ---------- ほかの人から隠す ---------- */
        if (action === "hide") {
            if (!isAdmin) {
                return NextResponse.json(
                    { error: "運営だけが行えます" },
                    { status: 403 },
                );
            }

            const { error } = await admin
                .from("tweets")
                .update({ hidden_by_admin: hidden === true })
                .eq("id", tweetId);

            if (error) throw error;
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json(
            { error: "何をするのか分かりません" },
            { status: 400 },
        );
    } catch (caught) {
        const detail =
            caught instanceof Error ? caught.message : "原因が分かりません";

        return NextResponse.json(
            { error: `できませんでした（${detail}）` },
            { status: 500 },
        );
    }
}
