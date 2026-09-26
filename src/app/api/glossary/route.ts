import { NextResponse } from "next/server";

import { checkLeft } from "@/lib/subscription/ai-check-quota";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/glossary — 作品の語彙集（Pro）
 *
 * GET    ?work=<作品>        語彙集と、取り込める「ほかの作品」の一覧
 * POST   { work, correct, variants, note }   1 語足す
 * DELETE ?id=<語>            1 語消す
 *
 * ★ Pro かどうかはサーバーで見る（ai_check と同じ合言葉）。
 * ★ 読み書きは本人の鍵で行う。表の決まり（RLS）で、自分の語しか触れない。
 * ============================================================
 */

export const dynamic = "force-dynamic";

async function gate() {
    const check = await checkLeft();
    if (!check.userId) {
        return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    }
    if (!check.allowed) {
        return {
            error: NextResponse.json(
                { error: "pro", message: "語彙集は Pro の機能です。" },
                { status: 403 },
            ),
        };
    }
    return { userId: check.userId };
}

export async function GET(request: Request) {
    const g = await gate();
    if (g.error) return g.error;

    const work = new URL(request.url).searchParams.get("work") ?? "";
    const supabase = await createClient();

    const { data: terms, error } = await supabase
        .from("work_terms")
        .select("id, novel_id, correct, variants, note, created_at")
        .eq("novel_id", work)
        .order("created_at", { ascending: true });

    if (error) {
        return NextResponse.json({ error: "db", message: error.message }, { status: 500 });
    }

    /*
     * 取り込める作品。語彙集に語が 1 つ以上ある、自分のほかの作品。
     */
    const { data: allTerms } = await supabase
        .from("work_terms")
        .select("novel_id")
        .eq("user_id", g.userId)
        .neq("novel_id", work);

    const countBy = new Map<string, number>();
    for (const row of allTerms ?? []) {
        countBy.set(row.novel_id, (countBy.get(row.novel_id) ?? 0) + 1);
    }

    let works: { id: string; title: string; count: number }[] = [];
    if (countBy.size > 0) {
        const { data: novels } = await supabase
            .from("novels")
            .select("id, title")
            .in("id", Array.from(countBy.keys()));
        works = (novels ?? []).map((novel) => ({
            id: novel.id as string,
            title: (novel.title as string) || "（題名なし）",
            count: countBy.get(novel.id as string) ?? 0,
        }));
    }

    return NextResponse.json({ terms: terms ?? [], works });
}

export async function POST(request: Request) {
    const g = await gate();
    if (g.error) return g.error;

    let body: { work?: string; correct?: string; variants?: string[] | string; note?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const correct = String(body.correct ?? "").trim().slice(0, 60);
    const raw = Array.isArray(body.variants) ? body.variants : String(body.variants ?? "").split(/[、,，\s]+/);
    const variants = Array.from(
        new Set(raw.map((one) => String(one).trim().slice(0, 60)).filter((one) => one && one !== correct)),
    ).slice(0, 20);

    if (!body.work || !correct) {
        return NextResponse.json({ error: "invalid", message: "正しい書き方を入れてください。" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("work_terms")
        .insert({
            novel_id: body.work,
            user_id: g.userId,
            correct,
            variants,
            note: String(body.note ?? "").trim().slice(0, 120),
        })
        .select("id, novel_id, correct, variants, note, created_at")
        .single();

    if (error) {
        return NextResponse.json({ error: "db", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ term: data });
}

export async function DELETE(request: Request) {
    const g = await gate();
    if (g.error) return g.error;

    const id = new URL(request.url).searchParams.get("id") ?? "";
    const supabase = await createClient();
    const { error } = await supabase.from("work_terms").delete().eq("id", id);

    if (error) {
        return NextResponse.json({ error: "db", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}
