/**
 * ============================================================
 * 原石航路 Studio
 * /api/notify — コメントの知らせを 1 人へ届ける
 *
 * ★ この道筋が丸ごと無かった。
 *
 *   感想の画面からは前から呼んでいたが、受け口が存在せず、
 *   404 を .catch で捨てていた。
 *   そのため、感想も返信も、相手のベルには何も入っていなかった。
 *
 * ★ 誰に届けるかは、送り手ではなくこちらで決める。
 *
 *   画面から user_id と本文をそのまま受け取ると、
 *   誰でも他人の通知欄へ好きな文を入れられる。
 *   受け取るのは comment_id だけにして、
 *   宛先も文もこちらで組み立てる。
 *
 * ★ notifications は運営しか入れられない決まりになっている。
 *   ここは運営用の繋ぎ口（service role）で入れる。SQL は要らない。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    try {
        const { comment_id: commentId } = await request.json();

        if (!commentId) {
            return NextResponse.json(
                { error: "comment_id が要ります" },
                { status: 400 },
            );
        }

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

        const { data: comment } = await admin
            .from("comments")
            .select("id, user_id, novel_id, episode_id, parent_id")
            .eq("id", commentId)
            .single();

        if (!comment) {
            return NextResponse.json(
                { error: "そのコメントがありません" },
                { status: 404 },
            );
        }

        /* 自分が書いたものについてだけ、知らせを出せる */
        if (comment.user_id !== user.id) {
            return NextResponse.json(
                { error: "自分のコメントではありません" },
                { status: 403 },
            );
        }

        /*
         * 宛先を決める。
         *
         * 返信      → 返された相手
         * ふつう    → 作品の作者
         */
        let targetId: string | null = null;
        let type = "comment";

        if (comment.parent_id) {
            const { data: parent } = await admin
                .from("comments")
                .select("user_id")
                .eq("id", comment.parent_id)
                .single();

            targetId = parent?.user_id ?? null;
            type = "reply";
        } else {
            const { data: novel } = await admin
                .from("novels")
                .select("author_id")
                .eq("id", comment.novel_id)
                .single();

            targetId = novel?.author_id ?? null;
        }

        /* 自分あては出さない */
        if (!targetId || targetId === user.id) {
            return NextResponse.json({ sent: 0 });
        }

        const { data: profile } = await admin
            .from("profiles")
            .select("display_name")
            .eq("user_id", user.id)
            .single();

        const name = profile?.display_name || "名無し";

        const { error: writeError } = await admin
            .from("notifications")
            .insert({
                user_id: targetId,
                type,
                message:
                    type === "reply"
                        ? `${name}さんがあなたのコメントに返信しました`
                        : `${name}さんがコメントしました`,
                link: `/novel/${comment.novel_id}/episode/${comment.episode_id}`,
            });

        if (writeError) throw writeError;

        return NextResponse.json({ sent: 1 });
    } catch (caught) {
        const detail =
            caught instanceof Error ? caught.message : "原因が分かりません";

        return NextResponse.json(
            { error: `届けられませんでした（${detail}）` },
            { status: 500 },
        );
    }
}
