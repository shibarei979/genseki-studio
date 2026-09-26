import { NextResponse } from "next/server";

import { checkLeft } from "@/lib/subscription/ai-check-quota";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * 原石航路 Studio
 * POST /api/glossary/import — ほかの作品の語彙集を使う（Pro）
 *
 * { from: <元の作品>, to: <この作品> }
 *
 * ★ 写す。つなげない。
 *   写したあとは、それぞれの作品で別々に直せる。
 *   つなげておくと、新しい作品の都合で直した語が
 *   前の作品のチェックまで変えてしまう。
 *
 * ★ 同じ「正しい書き方」がもうあれば、使わない書き方だけ足す。
 *   何度取り込んでも、同じ語が二重にならない。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const check = await checkLeft();
    if (!check.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!check.allowed) {
        return NextResponse.json({ error: "pro", message: "語彙集は Pro の機能です。" }, { status: 403 });
    }

    let body: { from?: string; to?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    if (!body.from || !body.to || body.from === body.to) {
        return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const supabase = await createClient();

    const [{ data: source }, { data: target }] = await Promise.all([
        supabase.from("work_terms").select("correct, variants, note").eq("novel_id", body.from),
        supabase.from("work_terms").select("id, correct, variants").eq("novel_id", body.to),
    ]);

    const byCorrect = new Map((target ?? []).map((row) => [row.correct as string, row]));
    let added = 0;
    let merged = 0;

    for (const row of source ?? []) {
        const already = byCorrect.get(row.correct as string);

        if (!already) {
            const { error } = await supabase.from("work_terms").insert({
                novel_id: body.to,
                user_id: check.userId,
                correct: row.correct,
                variants: row.variants ?? [],
                note: row.note ?? "",
            });
            if (!error) added += 1;
            continue;
        }

        const next = Array.from(
            new Set([...(already.variants as string[]), ...((row.variants as string[]) ?? [])]),
        );
        if (next.length !== (already.variants as string[]).length) {
            const { error } = await supabase
                .from("work_terms")
                .update({ variants: next })
                .eq("id", already.id);
            if (!error) merged += 1;
        }
    }

    return NextResponse.json({ ok: true, added, merged });
}
