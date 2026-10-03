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
 *   comment-update  自分の返信（コメント）だけ
 *   comment-delete  自分の返信、または運営。下に返信が付いているときは
 *                   中身だけ「削除されました」に置き換える（返信の流れを切らないため）
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** 一度に入れられる長さ。長文は作品のほうへ */
const MAX_BODY = 1000;
/** 返信（コメント）の長さ。書く欄と同じ */
const COMMENT_MAX = 200;
/** 下に返信が付いた返信を消したときに、代わりに残す言葉（画面の側と同じ） */
const DELETED_COMMENT = "（このコメントは削除されました）";

export async function POST(request: Request) {
    try {
        const { action, tweetId, commentId, body, imageUrl, topic, hidden } =
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

        /* ---------- 返信（コメント）を直す・消す ---------- */
        if (action === "comment-update" || action === "comment-delete") {
            if (!commentId) {
                return NextResponse.json({ error: "どの返信か分かりません" }, { status: 400 });
            }
            const { data: comment } = await admin
                .from("tweet_comments")
                .select("id, user_id")
                .eq("id", commentId)
                .maybeSingle();
            if (!comment) {
                return NextResponse.json({ error: "その返信がありません" }, { status: 404 });
            }
            const mine = comment.user_id === user.id;

            if (action === "comment-update") {
                if (!mine) {
                    return NextResponse.json({ error: "自分の返信ではありません" }, { status: 403 });
                }
                const text = String(body ?? "").trim();
                if (!text || text.length > COMMENT_MAX) {
                    return NextResponse.json({ error: "中身を確かめてください" }, { status: 400 });
                }
                const { error } = await admin.from("tweet_comments").update({ body: text }).eq("id", commentId);
                if (error) throw error;
                return NextResponse.json({ ok: true });
            }

            if (!mine && !isAdmin) {
                return NextResponse.json({ error: "自分の返信ではありません" }, { status: 403 });
            }
            /* 下に返信が付いていれば、中身だけ消す。付いていなければ行ごと消す */
            const { count: children } = await admin
                .from("tweet_comments")
                .select("*", { count: "exact", head: true })
                .eq("parent_id", commentId);
            if ((children ?? 0) > 0) {
                const { error } = await admin
                    .from("tweet_comments")
                    .update({ body: DELETED_COMMENT })
                    .eq("id", commentId);
                if (error) throw error;
                return NextResponse.json({ ok: true, softDeleted: true });
            }
            const { error } = await admin.from("tweet_comments").delete().eq("id", commentId);
            if (error) throw error;
            return NextResponse.json({ ok: true });
        }

        if (!tweetId) {
            return NextResponse.json(
                { error: "どの書き込みか分かりません" },
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
                { error: "その書き込みがありません" },
                { status: 404 },
            );
        }

        const isMine = target.user_id === user.id;

        /* ---------- 直す ---------- */
        if (action === "update") {
            if (!isMine) {
                return NextResponse.json(
                    { error: "自分の書き込みではありません" },
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
                    { error: "自分の書き込みではありません" },
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
