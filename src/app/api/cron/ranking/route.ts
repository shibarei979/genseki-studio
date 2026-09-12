import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/cron/ranking — ランキングの点を数え直す
 *
 * ★ なぜ溜めるか。
 *
 *   前はランキングを開くたびに、
 *   いいね・保存・星・読まれた数を全作品ぶん集めていた。
 *
 *   作品が増えるほど重くなり、
 *   1000 行の頭打ちにも当たりやすくなる。
 *   195 作品が 73 件しか出ない不具合は、それで起きた。
 *
 *   あらかじめ数えておけば、画面は 1 回読むだけで済む。
 *
 * ★ 間隔は、期間によって変える。
 *
 *     15 分ごと  日間・週間      動きが速い
 *     30 分ごと  月間・四半期    そこまで速くない
 *     1 日 1 回  年間・累計      ほとんど動かない
 *
 *   短い期間を長く放っておくと、
 *   投稿した人が「反応が見えない」と感じる。
 *   長い期間を細かく数え直しても、順位は動かない。
 *
 * ★ 呼び方
 *     /api/cron/ranking?set=fast   日間・週間
 *     /api/cron/ranking?set=mid    月間・四半期
 *     /api/cron/ranking?set=slow   年間・累計
 * ============================================================
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** 数え直す組。呼び分けに使う */
const SETS: Record<string, string[]> = {
    fast: ["daily", "weekly"],
    mid: ["monthly", "quarterly"],
    slow: ["yearly", "all"],
};

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

    const { searchParams } = new URL(request.url);
    const periods = SETS[searchParams.get("set") ?? "fast"] ?? SETS.fast;

    const done: Record<string, number | string> = {};

    for (const period of periods) {
        try {
            /*
             * ★ 1 つ失敗しても、残りは続ける。
             *
             *   日間が失敗したせいで週間まで古いまま、
             *   では困る。
             */
            const { data, error } = await createAdminClient().rpc(
                "refresh_ranking_points",
                { target: period },
            );

            done[period] = error ? `失敗：${error.message}` : (data as number);
        } catch (caught) {
            done[period] =
                caught instanceof Error ? `失敗：${caught.message}` : "失敗";
        }
    }

    return NextResponse.json({ ok: true, done });
}
