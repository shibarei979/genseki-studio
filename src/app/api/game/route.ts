import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * 原石航路
 * /api/game — 遊びの記録を受ける
 *
 * ★ 誰かは記録しない。
 *
 *   登録なしで遊べる場所なので、user_id は取らない。
 *   1 回の遊びごとの札（play_id）だけ持つ。
 *
 * ★ 落ちても、遊びは止めない。
 *
 *   記録は運営の都合であって、遊ぶ人には関係がない。
 *   失敗しても黙って ok を返す。
 *
 * ★ 運営の鍵で書く。
 *   表の決まりを緩めるより、入口を一つに絞るほうが安全。
 * ============================================================
 */

const KINDS = ["start", "step", "result", "write", "share", "again"];

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as {
            playId?: string;
            kind?: string;
            at?: number;
            place?: string;
            core?: string;
        };

        const playId = String(body.playId ?? "").slice(0, 40);
        const kind = String(body.kind ?? "");

        if (!playId || !KINDS.includes(kind)) {
            return NextResponse.json({ ok: false });
        }

        await createAdminClient()
            .from("game_events")
            .insert({
                play_id: playId,
                kind,
                at: typeof body.at === "number" ? body.at : null,
                place: body.place ? String(body.place).slice(0, 20) : null,
                core: body.core ? String(body.core).slice(0, 20) : null,
            });

        return NextResponse.json({ ok: true });
    } catch {
        /* 記録できなくても、遊びは続く */
        return NextResponse.json({ ok: true });
    }
}
