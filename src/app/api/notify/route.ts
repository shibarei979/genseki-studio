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
        const body = await request.json();
        const commentId: string | undefined = body.comment_id;
        const likeNovelId: string | undefined = body.like_novel_id;
        const likeEpisodeId: string | undefined = body.like_episode_id;

        if (!commentId && !likeNovelId && !likeEpisodeId) {
            return NextResponse.json(
                { error: "何についての知らせか分かりません" },
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

        const { data: profile } = await admin
            .from("profiles")
            .select("display_name")
            .eq("user_id", user.id)
            .single();

        const name = profile?.display_name || "名無し";

        /*
         * いいね。
         *
         * ★ 押した本人かどうかを、表を見て確かめる。
         *   画面から「押しました」と言われただけでは信じない。
         *
         * ★ 同じ相手・同じ行き先の知らせが既にあれば出さない。
         *   付けたり外したりを繰り返すと、通知欄が埋まる。
         */
        if (likeNovelId || likeEpisodeId) {
            let novelId: string | null = likeNovelId ?? null;
            let link = "";

            if (likeEpisodeId) {
                const { data: like } = await admin
                    .from("episode_likes")
                    .select("episode_id")
                    .eq("episode_id", likeEpisodeId)
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (!like) return NextResponse.json({ sent: 0 });

                const { data: episode } = await admin
                    .from("episodes")
                    .select("novel_id")
                    .eq("id", likeEpisodeId)
                    .single();

                novelId = episode?.novel_id ?? null;
                link = novelId
                    ? `/novel/${novelId}/episode/${likeEpisodeId}`
                    : "";
            } else {
                const { data: like } = await admin
                    .from("likes")
                    .select("novel_id")
                    .eq("novel_id", likeNovelId)
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (!like) return NextResponse.json({ sent: 0 });

                link = `/novel/${likeNovelId}`;
            }

            if (!novelId || !link) return NextResponse.json({ sent: 0 });

            const { data: novel } = await admin
                .from("novels")
                .select("author_id")
                .eq("id", novelId)
                .single();

            const authorId = novel?.author_id ?? null;
            if (!authorId || authorId === user.id) {
                return NextResponse.json({ sent: 0 });
            }

            const { data: already } = await admin
                .from("notifications")
                .select("id")
                .eq("user_id", authorId)
                .eq("type", "like")
                .eq("link", link)
                .eq("message", `${name}さんがいいねしました`)
                .limit(1);

            if (already && already.length > 0) {
                return NextResponse.json({ sent: 0 });
            }

            const { error: likeWriteError } = await admin
                .from("notifications")
                .insert({
                    user_id: authorId,
                    type: "like",
                    message: `${name}さんがいいねしました`,
                    link,
                });

            if (likeWriteError) throw likeWriteError;

            return NextResponse.json({ sent: 1 });
        }

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

        const { error: writeError } = await admin
            .from("notifications")
            .insert({
                user_id: targetId,
                type,
                message:
                    type === "reply"
                        ? `${name}さんがあなたのコメントに返信しました`
                        : `${name}さんがコメントしました`,
                link: comment.episode_id
                    ? `/novel/${comment.novel_id}/episode/${comment.episode_id}`
                    : `/novel/${comment.novel_id}`,
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
