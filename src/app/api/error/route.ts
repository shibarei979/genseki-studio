import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/error — 不具合の記録を受ける
 *
 * ★ いまは、読者から声が届いて初めて気づく。
 *
 *   声を上げてくれる人は、ごく一部。
 *   黙って帰った人のぶんは、何も残らない。
 *   落ちた瞬間に、こちらへ残す。
 *
 * ★ 誰かは残さない。
 *   直すのに要らない。要らないものは持たない。
 *
 * ★ 長い言葉は切る。
 *   落ちた言葉に本文が混じることがある。
 *
 * ★ 落ちても、何もしない。
 *   不具合を記録する仕組みが落ちて頁が壊れたら、
 *   本末転倒になる。
 * ============================================================
 */

/** 落ちた言葉の長さ。これより長いものは切る */
const MAX = 400;

/**
 * すぐ知らせる先。
 *
 * ★ 決めていなければ、表に残すだけ。
 *
 *   Discord や Slack の「webhook」の住所を
 *   環境変数 ERROR_WEBHOOK_URL に入れておくと、
 *   そちらへも流す。
 */
const WEBHOOK = process.env.ERROR_WEBHOOK_URL;

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as {
            message?: string;
            path?: string;
            kind?: string;
            digest?: string;
        };

        const message = String(body.message ?? "").slice(0, MAX);
        if (!message) return NextResponse.json({ ok: true });

        const path = String(body.path ?? "").slice(0, 200);
        const kind = String(body.kind ?? "client").slice(0, 20);
        const digest = String(body.digest ?? "").slice(0, 80);

        await createAdminClient().from("error_events").insert({
            message,
            path,
            kind,
            digest: digest || null,
        });

        /*
         * すぐ知らせる。
         *
         * ★ 待たない。知らせが遅れても、記録は残っている。
         * ★ 落ちても黙る。ここで転ぶ意味がない。
         */
        if (WEBHOOK) {
            void fetch(WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: [
                        "**不具合が起きました**",
                        `画面：${path || "（不明）"}`,
                        `落ち方：${kind}`,
                        "```",
                        message.slice(0, 300),
                        "```",
                    ].join("\n"),
                }),
            }).catch(() => {
                /* 知らせられなくても、記録は残っている */
            });
        }

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: true });
    }
}
