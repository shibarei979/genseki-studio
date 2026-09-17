import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/admin/items — 品物を作る・直す
 *
 * ★ 運営だけ。
 *
 *   ここが開いていると、値段も中身も
 *   誰にでも書き換えられてしまう。
 *
 * ★ 繋がりも、ここで決める。
 *
 *   どの品物を取ったら次が買えるか。
 *   絵の枝にあたるもの。
 * ============================================================
 */

export const dynamic = "force-dynamic";

/** 運営かどうか。違えば理由を返す */
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

    const { data } = await gate.admin
        .from("shop_items")
        .select("*")
        .order("tier", { ascending: true })
        .order("position", { ascending: true });

    return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
    const gate = await mustBeAdmin();

    if ("error" in gate) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    try {
        const body = (await request.json()) as {
            id?: string;
            patch?: Record<string, unknown>;
        };

        if (!body.id || !body.patch) {
            return NextResponse.json(
                { error: "品物と、直す中身が要ります" },
                { status: 400 },
            );
        }

        /*
         * ★ 直せる列を、名指しで決める。
         *
         *   何でも渡せるようにすると、
         *   作った日や id まで書き換えられてしまう。
         */
        const ALLOWED = [
            "kind",
            "name",
            "description",
            "asset_url",
            "free_price",
            "tier",
            "position",
            "requires_item_id",
            "is_secret",
            "is_active",
            "hint",
        ];

        const patch: Record<string, unknown> = {};

        for (const key of ALLOWED) {
            if (key in body.patch) patch[key] = body.patch[key];
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json(
                { error: "直すものがありません" },
                { status: 400 },
            );
        }

        /*
         * ★ 自分を、自分の前提にしない。
         *   そうすると、永久に買えない品物ができる。
         */
        if (patch.requires_item_id === body.id) {
            return NextResponse.json(
                { error: "自分自身を前提にはできません" },
                { status: 400 },
            );
        }

        const { error } = await gate.admin
            .from("shop_items")
            .update(patch)
            .eq("id", body.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (caught) {
        return NextResponse.json(
            {
                error:
                    caught instanceof Error ? caught.message : "うまくいきません",
            },
            { status: 500 },
        );
    }
}
