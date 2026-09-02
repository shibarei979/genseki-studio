/**
 * ============================================================
 * 原石航路 Studio
 * /api/notify — 自分あての知らせを 1 人へ届ける
 *
 * ★ この受け口が丸ごと無かった。
 *
 *   画面の側は前から呼んでいた。感想・返信・いいね・保存・
 *   発掘・フォロー・誤字報告・つぶやきへの返信、どれもである。
 *   受け口が無いので 404 が返り、それを .catch で捨てていた。
 *   だから通知欄には何も入っていなかった。
 *
 * ★ 宛先と文は、送り手ではなくこちらで決める。
 *
 *   画面から user_id と本文をそのまま受け取ると、
 *   誰でも他人の通知欄へ好きな文を入れられる。
 *   受け取るのは「何が起きたか」の id だけにして、
 *   本当に起きたかを表で確かめてから入れる。
 *
 * ★ notifications は運営しか入れられない決まりなので、
 *   ここは運営用の繋ぎ口（service role）で入れる。SQL は要らない。
 *
 * 受け取る形（どれか 1 つ）
 *
 *   { comment_id }          感想・返信
 *   { like_novel_id }       作品への いいね
 *   { like_episode_id }     話への いいね
 *   { bookmark_novel_id }   保存
 *   { discover_novel_id }   発掘・拡散
 *   { follow_user_id }      フォロー
 *   { typo_episode_id }     誤字報告
 *   { tweet_comment_id }    つぶやきへの返信
 *   { like_tweet_id }       つぶやきへの いいね
 *   { user_id, type, message, link }   運営だけ（個別の便り）
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;

interface Notice {
    targetId: string | null;
    type: string;
    message: string;
    link: string;
    /** 同じものが既にあれば出さない（付け外しの繰り返し対策） */
    once?: boolean;
}

const none = NextResponse.json({ sent: 0 });

/** 作品の作者を引く */
async function authorOf(admin: Admin, novelId: string | null) {
    if (!novelId) return null;

    const { data } = await admin
        .from("novels")
        .select("author_id")
        .eq("id", novelId)
        .single();

    return (data?.author_id as string | null) ?? null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

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
            .select("display_name, is_admin")
            .eq("user_id", user.id)
            .single();

        const name = profile?.display_name || "名無し";

        /*
         * 運営が個別に送る便り。
         * 宛先も文も自由に決められるので、運営のときだけ通す。
         */
        if (body.user_id && body.message) {
            if (!profile?.is_admin) {
                return NextResponse.json(
                    { error: "運営だけが送れます" },
                    { status: 403 },
                );
            }

            const { error } = await admin.from("notifications").insert({
                user_id: body.user_id,
                type: body.type || "announcement",
                message: body.message,
                link: body.link || null,
            });

            if (error) throw error;
            return NextResponse.json({ sent: 1 });
        }

        let notice: Notice | null = null;

        /* ---------- 感想・返信 ---------- */
        if (body.comment_id) {
            const { data: comment } = await admin
                .from("comments")
                .select("id, user_id, novel_id, episode_id, parent_id")
                .eq("id", body.comment_id)
                .single();

            /* 自分が書いたものについてだけ、知らせを出せる */
            if (!comment || comment.user_id !== user.id) return none;

            const link = comment.episode_id
                ? `/novel/${comment.novel_id}/episode/${comment.episode_id}`
                : `/novel/${comment.novel_id}`;

            if (comment.parent_id) {
                const { data: parent } = await admin
                    .from("comments")
                    .select("user_id")
                    .eq("id", comment.parent_id)
                    .single();

                notice = {
                    targetId: (parent?.user_id as string | null) ?? null,
                    type: "reply",
                    message: `${name}さんがあなたのコメントに返信しました`,
                    link,
                };
            } else {
                notice = {
                    targetId: await authorOf(admin, comment.novel_id),
                    type: "comment",
                    message: `${name}さんがコメントしました`,
                    link,
                };
            }
        }

        /* ---------- 作品への いいね ---------- */
        if (body.like_novel_id) {
            const { data: like } = await admin
                .from("likes")
                .select("novel_id")
                .eq("novel_id", body.like_novel_id)
                .eq("user_id", user.id)
                .maybeSingle();

            if (!like) return none;

            notice = {
                targetId: await authorOf(admin, body.like_novel_id),
                type: "like",
                message: `${name}さんが作品にいいねしました`,
                link: `/novel/${body.like_novel_id}`,
                once: true,
            };
        }

        /* ---------- 話への いいね ---------- */
        if (body.like_episode_id) {
            const { data: like } = await admin
                .from("episode_likes")
                .select("episode_id")
                .eq("episode_id", body.like_episode_id)
                .eq("user_id", user.id)
                .maybeSingle();

            if (!like) return none;

            const { data: episode } = await admin
                .from("episodes")
                .select("novel_id")
                .eq("id", body.like_episode_id)
                .single();

            const novelId = (episode?.novel_id as string | null) ?? null;
            if (!novelId) return none;

            notice = {
                targetId: await authorOf(admin, novelId),
                type: "like",
                message: `${name}さんが話にいいねしました`,
                link: `/novel/${novelId}/episode/${body.like_episode_id}`,
                once: true,
            };
        }

        /* ---------- 保存 ---------- */
        if (body.bookmark_novel_id) {
            const { data: mark } = await admin
                .from("bookmarks")
                .select("novel_id")
                .eq("novel_id", body.bookmark_novel_id)
                .eq("user_id", user.id)
                .maybeSingle();

            if (!mark) return none;

            notice = {
                targetId: await authorOf(admin, body.bookmark_novel_id),
                type: "bookmark",
                message: `${name}さんが作品を保存しました`,
                link: `/novel/${body.bookmark_novel_id}`,
                once: true,
            };
        }

        /* ---------- 発掘・拡散 ---------- */
        if (body.discover_novel_id) {
            const { data: found } = await admin
                .from("discovers")
                .select("novel_id")
                .eq("novel_id", body.discover_novel_id)
                .eq("user_id", user.id)
                .limit(1);

            if (!found || found.length === 0) return none;

            notice = {
                targetId: await authorOf(admin, body.discover_novel_id),
                type: "discover",
                message: `${name}さんが作品を発掘・拡散しました`,
                link: `/novel/${body.discover_novel_id}`,
                once: true,
            };
        }

        /* ---------- フォロー ---------- */
        if (body.follow_user_id) {
            const { data: follow } = await admin
                .from("follows")
                .select("following_id")
                .eq("follower_id", user.id)
                .eq("following_id", body.follow_user_id)
                .maybeSingle();

            if (!follow) return none;

            notice = {
                targetId: body.follow_user_id,
                type: "follow",
                message: `${name}さんにフォローされました`,
                link: `/author/${user.id}`,
                once: true,
            };
        }

        /* ---------- 誤字報告 ---------- */
        if (body.typo_episode_id) {
            const { data: report } = await admin
                .from("typo_reports")
                .select("novel_id, episode_id")
                .eq("episode_id", body.typo_episode_id)
                .eq("reporter_id", user.id)
                .order("created_at", { ascending: false })
                .limit(1);

            const row = report?.[0];
            if (!row) return none;

            notice = {
                targetId: await authorOf(admin, row.novel_id as string),
                type: "typo",
                /*
                 * 中身は書かない。
                 * 報告の文をそのまま通知に出すと、
                 * 相手の通知欄へ好きな文を送れてしまう。
                 * 話へ行けば、報告の一覧で読める。
                 */
                message: `${name}さんから誤字の知らせが届きました`,
                link: `/novel/${row.novel_id}/episode/${row.episode_id}`,
            };
        }

        /* ---------- つぶやきへの返信 ---------- */
        if (body.tweet_comment_id) {
            const { data: comment } = await admin
                .from("tweet_comments")
                .select("id, user_id, tweet_id, parent_id")
                .eq("id", body.tweet_comment_id)
                .single();

            if (!comment || comment.user_id !== user.id) return none;

            const { data: tweet } = await admin
                .from("tweets")
                .select("user_id")
                .eq("id", comment.tweet_id)
                .single();

            const ownerId = (tweet?.user_id as string | null) ?? null;
            let targetId = ownerId;

            /* 返信への返信は、その返信を書いた人へ */
            if (comment.parent_id) {
                const { data: parent } = await admin
                    .from("tweet_comments")
                    .select("user_id")
                    .eq("id", comment.parent_id)
                    .single();

                targetId = (parent?.user_id as string | null) ?? ownerId;
            }

            notice = {
                targetId,
                type: "reply",
                message: `${name}さんがあなたのつぶやきに返信しました`,
                link: `/author/${ownerId ?? user.id}`,
            };
        }

        /* ---------- つぶやきへの いいね ---------- */
        if (body.like_tweet_id) {
            const { data: like } = await admin
                .from("tweet_likes")
                .select("tweet_id")
                .eq("tweet_id", body.like_tweet_id)
                .eq("user_id", user.id)
                .maybeSingle();

            if (!like) return none;

            const { data: tweet } = await admin
                .from("tweets")
                .select("user_id")
                .eq("id", body.like_tweet_id)
                .single();

            const ownerId = (tweet?.user_id as string | null) ?? null;

            notice = {
                targetId: ownerId,
                type: "like",
                message: `${name}さんがつぶやきにいいねしました`,
                link: `/author/${ownerId ?? user.id}`,
                once: true,
            };
        }

        if (!notice) {
            return NextResponse.json(
                { error: "何についての知らせか分かりません" },
                { status: 400 },
            );
        }

        /* 自分あては出さない */
        if (!notice.targetId || notice.targetId === user.id) return none;

        if (notice.once) {
            const { data: already } = await admin
                .from("notifications")
                .select("id")
                .eq("user_id", notice.targetId)
                .eq("type", notice.type)
                .eq("link", notice.link)
                .eq("message", notice.message)
                .limit(1);

            if (already && already.length > 0) return none;
        }

        const { error: writeError } = await admin.from("notifications").insert({
            user_id: notice.targetId,
            type: notice.type,
            message: notice.message,
            link: notice.link,
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
