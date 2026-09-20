import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { listPlans } from "@/lib/subscription/plans";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/admin/plans — 売り物と、付く特典
 *
 * ★ 運営だけ。
 *
 *   まだ読む人には出していない。
 *   売り物の値段も特典も、ここで決めている途中。
 *
 * ★ 読むのも運営の鍵で読む。
 *
 *   表の決まりでは「出している売り物」しか読めない。
 *   運営の画面では、まだ出していないものも見たい。
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

export async function GET() {
    const gate = await mustBeAdmin();

    if ("error" in gate) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    return NextResponse.json({ plans: await listPlans() });
}

/**
 * 作る・直す・消す。
 *
 * 売り物
 *   { what: "plan",  id?: string, patch: {...} }
 *   { what: "plan",  remove: string }
 *
 * 特典
 *   { what: "perk",  id?: string, planId?: string, patch: {...} }
 *   { what: "perk",  remove: string }
 */
export async function POST(request: Request) {
    const gate = await mustBeAdmin();

    if ("error" in gate) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const body = (await request.json().catch(() => null)) as {
        what?: "plan" | "perk";
        id?: string;
        planId?: string;
        remove?: string;
        patch?: Record<string, unknown>;
    } | null;

    if (!body?.what) {
        return NextResponse.json({ error: "何をするか要ります" }, { status: 400 });
    }

    const table = body.what === "plan" ? "plans" : "plan_perks";

    /* 消す */
    if (body.remove) {
        const { error } = await gate.admin
            .from(table)
            .delete()
            .eq("id", body.remove);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    }

    /* 直す */
    if (body.id) {
        const { error } = await gate.admin
            .from(table)
            .update(body.patch ?? {})
            .eq("id", body.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    }

    /* 作る */
    if (body.what === "plan") {
        /*
         * ★ 初めは出さない。
         *   中身が揃う前に出ると、買えてしまう。
         */
        const { data, error } = await gate.admin
            .from("plans")
            .insert({
                code: `plan_${Date.now()}`,
                name: "新しい会員",
                price_yen: 0,
                is_active: false,
                ...(body.patch ?? {}),
            })
            .select("id")
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ id: data?.id });
    }

    if (!body.planId) {
        return NextResponse.json(
            { error: "どの売り物に付けるか要ります" },
            { status: 400 },
        );
    }

    const { data, error } = await gate.admin
        .from("plan_perks")
        .insert({
            plan_id: body.planId,
            kind: "free_points",
            amount: 0,
            ...(body.patch ?? {}),
        })
        .select("id")
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ id: data?.id });
}
