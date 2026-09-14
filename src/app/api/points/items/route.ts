import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { freePointsOf, giveItem, spendFreePoints } from "@/lib/points";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/points/items — 品物の一覧と、交換
 *
 * ★ 交換の判断は、ここでする。
 *
 *   画面の言い分を信じない。
 *   値段も、持っているかも、前の品物も、
 *   すべて表を見て確かめる。
 *
 * ★ 値段は表から取る。
 *
 *   画面から送られた数を信じると、
 *   1 pt で何でも買えてしまう。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        const admin = createAdminClient();

        /*
         * ★ 中身が決まっていないものも出す。
         *
         *   is_active が false のものは「？？？」として並ぶ。
         *   何段目にどんな値段のものが来るかが分かると、
         *   貯める目当てになる。
         */
        const { data: items } = await admin
            .from("shop_items")
            .select(
                "id, kind, name, description, asset_url, free_price," +
                    " tier, position, requires_item_id, is_secret, is_active",
            )
            .order("tier", { ascending: true })
            .order("position", { ascending: true });

        if (!user) {
            return NextResponse.json({ items: items ?? [], owned: [], free: 0 });
        }

        const { data: mine } = await admin
            .from("user_items")
            .select("item_id")
            .eq("user_id", user.id);

        return NextResponse.json({
            items: items ?? [],
            owned: (mine ?? []).map((one: any) => one.item_id),
            free: await freePointsOf(user.id),
        });
    } catch {
        return NextResponse.json({ items: [], owned: [], free: 0 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "入っていません" }, { status: 401 });
        }

        const body = (await request.json()) as { itemId?: string };
        if (!body.itemId) {
            return NextResponse.json({ error: "品物が要ります" }, { status: 400 });
        }

        const admin = createAdminClient();

        const { data: item } = await admin
            .from("shop_items")
            .select("id, name, free_price, requires_item_id, is_active")
            .eq("id", body.itemId)
            .maybeSingle();

        if (!item) {
            return NextResponse.json(
                { error: "その品物が見つかりません" },
                { status: 404 },
            );
        }

        /* まだ用意していないものは、交換できない */
        if (item.is_active !== true) {
            return NextResponse.json(
                { error: "この品物は、まだ用意していません" },
                { status: 400 },
            );
        }

        /* もう持っている */
        const { data: already } = await admin
            .from("user_items")
            .select("id")
            .eq("user_id", user.id)
            .eq("item_id", item.id)
            .maybeSingle();

        if (already) {
            return NextResponse.json(
                { error: "もう持っています" },
                { status: 400 },
            );
        }

        /* 前の品物が要る */
        if (item.requires_item_id) {
            const { data: prev } = await admin
                .from("user_items")
                .select("id")
                .eq("user_id", user.id)
                .eq("item_id", item.requires_item_id)
                .maybeSingle();

            if (!prev) {
                return NextResponse.json(
                    { error: "先に、前の品物を交換してください" },
                    { status: 400 },
                );
            }
        }

        /*
         * ★ 値段は表から取る。
         *   画面から送られた数を信じると、
         *   1 pt で何でも買えてしまう。
         */
        const price = Number(item.free_price ?? 0);

        if (price <= 0) {
            return NextResponse.json(
                { error: "この品物は、まだ値段が決まっていません" },
                { status: 400 },
            );
        }

        const spent = await spendFreePoints({
            userId: user.id,
            amount: price,
            reason: "item",
            reasonRef: item.id,
        });

        if (!spent.spent) {
            return NextResponse.json(
                { error: spent.reason ?? "交換できません" },
                { status: 400 },
            );
        }

        const given = await giveItem({
            userId: user.id,
            itemId: item.id,
            paidFree: price,
        });

        if (!given.given) {
            /*
             * ★ 渡せなかったら、ポイントを戻す。
             *   引いたのに品物が入らないのは、いちばん困る。
             */
            await admin.from("free_point_lots").insert({
                user_id: user.id,
                amount: price,
                source: "admin",
                source_ref: `refund:${item.id}`,
                expires_at: new Date(
                    Date.now() + 1000 * 60 * 60 * 24 * 182,
                ).toISOString(),
            });

            return NextResponse.json(
                { error: "渡せませんでした。ポイントは戻しました" },
                { status: 500 },
            );
        }

        return NextResponse.json({
            ok: true,
            left: await freePointsOf(user.id),
        });
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
