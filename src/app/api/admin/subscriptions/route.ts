import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
    advancePeriods,
    applyPerks,
    startSubscription,
    stopSubscription,
} from "@/lib/subscription/plans";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/admin/subscriptions — 契約を見る・手で動かす
 *
 * ★ 決済を繋ぐ前に、形を試すために要る。
 *
 *   pay.jp を繋いでからでないと試せない、では
 *   特典の出方を確かめようがない。
 *   運営が手で始めて、手で止められるようにしておく。
 *
 * ★ 人を探す口も置く。
 *
 *   id を手で打たせると、打ち間違いが起きる。
 *   無料ポイントの画面と同じ形にする。
 * ============================================================
 */

export const dynamic = "force-dynamic";

async function mustBeAdmin() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "入っていません", status: 401 as const };

    const admin = createAdminClient();

    const { data: me } = await admin
        .from("profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle();

    if (me?.is_admin !== true) {
        return { error: "通せません", status: 403 as const };
    }

    return { admin };
}

export async function GET(request: Request) {
    const gate = await mustBeAdmin();

    if ("error" in gate) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const url = new URL(request.url);
    const find = url.searchParams.get("find");

    /* 名前で人を探す */
    if (find) {
        const { data } = await gate.admin
            .from("profiles")
            .select("user_id, display_name")
            .ilike("display_name", `%${find}%`)
            .limit(10);

        return NextResponse.json({ people: data ?? [] });
    }

    const { data } = await gate.admin
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

    const rows = data ?? [];

    /* 名前と売り物の名前を、まとめて引く */
    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    const planIds = Array.from(new Set(rows.map((row) => row.plan_id)));

    const { data: people } = userIds.length
        ? await gate.admin
              .from("profiles")
              .select("user_id, display_name")
              .in("user_id", userIds)
        : { data: [] };

    const { data: plans } = planIds.length
        ? await gate.admin.from("plans").select("id, name").in("id", planIds)
        : { data: [] };

    const nameOf = new Map(
        (people ?? []).map((row) => [row.user_id, row.display_name as string]),
    );

    const planOf = new Map(
        (plans ?? []).map((row) => [row.id, row.name as string]),
    );

    return NextResponse.json({
        subscriptions: rows.map((row) => ({
            ...row,
            display_name: nameOf.get(row.user_id) ?? "",
            plan_name: planOf.get(row.plan_id) ?? "",
        })),
    });
}

/**
 * 手で動かす。
 *
 *   { do: "start",   userId, planId, note? }
 *   { do: "stop",    id, now? }
 *   { do: "grant",   id }          いまの期間ぶんを配り直す
 *   { do: "advance" }              終わりを過ぎたものを次の期間へ
 */
export async function POST(request: Request) {
    const gate = await mustBeAdmin();

    if ("error" in gate) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const body = (await request.json().catch(() => null)) as {
        do?: "start" | "stop" | "grant" | "advance";
        userId?: string;
        planId?: string;
        id?: string;
        now?: boolean;
        note?: string;
    } | null;

    if (body?.do === "start") {
        if (!body.userId || !body.planId) {
            return NextResponse.json(
                { error: "誰に、どの売り物かが要ります" },
                { status: 400 },
            );
        }

        const made = await startSubscription({
            userId: body.userId,
            planId: body.planId,
            note: body.note,
        });

        if (made.error) {
            return NextResponse.json({ error: made.error }, { status: 400 });
        }

        return NextResponse.json({ id: made.id });
    }

    if (body?.do === "stop") {
        if (!body.id) {
            return NextResponse.json({ error: "どれを止めるか要ります" }, { status: 400 });
        }

        const done = await stopSubscription({
            subscriptionId: body.id,
            now: body.now,
        });

        if (!done.ok) {
            return NextResponse.json({ error: done.error }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    }

    if (body?.do === "grant") {
        if (!body.id) {
            return NextResponse.json({ error: "どれに配るか要ります" }, { status: 400 });
        }

        return NextResponse.json(await applyPerks(body.id));
    }

    if (body?.do === "advance") {
        return NextResponse.json(await advancePeriods());
    }

    return NextResponse.json({ error: "何をするか要ります" }, { status: 400 });
}
