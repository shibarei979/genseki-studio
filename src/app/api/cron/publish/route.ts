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

import { publishDueEpisodes } from "@/lib/publish-due";

/*
 * 作り置きしない。
 *
 * 指定が無いと、site を組み立てる段階で
 * この処理が実際に走ってしまう。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        /*
         * 中身は publish-due.ts と同じもの。
         *
         * ★ 二か所に同じ手を書かない。
         *   前はここだけが片付けをしていた。
         *   ここが止まると誰も気づかないので、
         *   ホームからも同じものを回すようにした。
         *
         * ★ 間を空ける決まりは、ここでは邪魔になる。
         *   定時に呼ばれる側なので、呼ばれたら必ず回す。
         */
        const published = await publishDueEpisodes({ force: true });

        return NextResponse.json({ published });
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
