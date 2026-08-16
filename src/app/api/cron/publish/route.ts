/**
 * ============================================================
 * 原石航路 Studio
 * /api/cron/publish — 時間の来た予約を公開する
 *
 * これまでは「誰かが作品ページを開いたとき」に
 * ついでで公開していた。
 * 誰も開かなければ時間が過ぎても出ないままで、
 * 「12:00 に予約したのに 12:10 でも出ない」が起きる。
 *
 * ここを定時に叩いて、開かれなくても出るようにする。
 * 呼ぶのは Vercel の定時実行（vercel.json）。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
    /*
     * 誰でも叩ける入口にしない。
     *
     * Vercel の定時実行は CRON_SECRET を Authorization に載せてくる。
     * 決めていなければ素通しにする（設定前でも動くように）。
     */
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const sent = request.headers.get("authorization");
        if (sent !== `Bearer ${secret}`) {
            return NextResponse.json({ error: "通せません" }, { status: 401 });
        }
    }

    try {
        const admin = createAdminClient();
        const now = new Date().toISOString();

        /*
         * 時間の来た予約を探す。
         *
         * 見るのは is_published。published は既定 true なので
         * 「まだ出していない話」の目印にならない。
         */
        const { data: due, error } = await admin
            .from("episodes")
            .select("id, novel_id")
            .neq("is_published", true)
            .not("scheduled_at", "is", null)
            .lte("scheduled_at", now);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!due || due.length === 0) {
            return NextResponse.json({ published: 0 });
        }

        /* 印は 2 つあるので、両方そろえて立てる */
        await admin
            .from("episodes")
            .update({
                is_published: true,
                published: true,
                scheduled_at: null,
                publish_at: null,
            })
            .in(
                "id",
                due.map((row) => row.id),
            );

        /*
         * 作品のほうが下書きのままだと、話だけ出しても読めない。
         * 1 話でも出たら、作品も公開にする。
         */
        const novelIds = Array.from(new Set(due.map((row) => row.novel_id)));
        if (novelIds.length > 0) {
            await admin
                .from("novels")
                .update({ published: true })
                .in("id", novelIds)
                .eq("published", false);
        }

        return NextResponse.json({ published: due.length });
    } catch (caught) {
        return NextResponse.json(
            {
                error:
                    caught instanceof Error
                        ? caught.message
                        : "うまくいきませんでした",
            },
            { status: 500 },
        );
    }
}
