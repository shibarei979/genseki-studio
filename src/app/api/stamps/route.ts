import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/stamps — 話ページのスタンプ
 *
 *   GET  ?episode=<話の id>
 *        その話に押されたスタンプ（種類ごとの数・自分が押したか）と、
 *        自分が持っているスタンプの一覧
 *
 *   POST { episodeId, itemId }
 *        押す。もう押していれば外す（押し直しで取り消せる）
 *
 * ★ 押せるのは、アイテムツリーで交換したスタンプだけ。表で確かめる。
 * ★ 1 人が 1 つの話に、同じスタンプは 1 回まで（表の決まりでも止めてある）。
 * ============================================================
 */

export const dynamic = "force-dynamic";

interface StampItem {
    id: string;
    name: string;
    asset_url: string | null;
}

async function stampItems(ids?: string[]): Promise<StampItem[]> {
    const admin = createAdminClient();
    let query = admin
        .from("shop_items")
        .select("id, name, asset_url, tier, position")
        .eq("kind", "stamp")
        .order("tier", { ascending: true })
        .order("position", { ascending: true });
    if (ids) {
        if (ids.length === 0) return [];
        query = query.in("id", ids);
    }
    const { data } = await query;
    return (data ?? []) as StampItem[];
}

export async function GET(request: Request) {
    try {
        const episodeId = new URL(request.url).searchParams.get("episode");
        if (!episodeId) return NextResponse.json({ stamps: [], owned: [] });

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const admin = createAdminClient();
        const { data: rows } = await admin
            .from("episode_stamps")
            .select("item_id, user_id")
            .eq("episode_id", episodeId)
            .limit(5000);

        const counts = new Map<string, { count: number; mine: boolean }>();
        for (const row of (rows ?? []) as { item_id: string; user_id: string }[]) {
            const now = counts.get(row.item_id) ?? { count: 0, mine: false };
            now.count += 1;
            if (user && row.user_id === user.id) now.mine = true;
            counts.set(row.item_id, now);
        }

        const items = await stampItems(Array.from(counts.keys()));
        const stamps = items
            .map((item) => ({
                id: item.id,
                name: item.name,
                url: item.asset_url,
                count: counts.get(item.id)?.count ?? 0,
                mine: counts.get(item.id)?.mine ?? false,
            }))
            /* たくさん押されたものから */
            .sort((a, b) => b.count - a.count);

        let owned: { id: string; name: string; url: string | null }[] = [];
        if (user) {
            const { data: mine } = await admin
                .from("user_items")
                .select("item_id")
                .eq("user_id", user.id);
            const ownedItems = await stampItems(
                (mine ?? []).map((row: { item_id: string }) => row.item_id),
            );
            owned = ownedItems.map((item) => ({ id: item.id, name: item.name, url: item.asset_url }));
        }

        return NextResponse.json({ stamps, owned, loggedIn: Boolean(user) });
    } catch {
        return NextResponse.json({ stamps: [], owned: [] });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "スタンプを押すにはログインが必要です" }, { status: 401 });
        }

        const body = (await request.json()) as { episodeId?: string; itemId?: string };
        if (!body.episodeId || !body.itemId) {
            return NextResponse.json({ error: "中身が足りません" }, { status: 400 });
        }

        const admin = createAdminClient();

        /* 持っているスタンプか */
        const { data: owned } = await admin
            .from("user_items")
            .select("id")
            .eq("user_id", user.id)
            .eq("item_id", body.itemId)
            .maybeSingle();
        const [item] = await stampItems([body.itemId]);
        if (!owned || !item) {
            return NextResponse.json({ error: "持っているスタンプだけ押せます" }, { status: 400 });
        }

        /* 公開されている話か。作品の id もここで取る */
        const { data: episode } = await admin
            .from("episodes")
            .select("id, novel_id, is_published")
            .eq("id", body.episodeId)
            .maybeSingle();
        /* ★ 見るのは is_published（published は作った時点で立つので当てにならない） */
        if (!episode || episode.is_published !== true) {
            return NextResponse.json({ error: "その話が見つかりません" }, { status: 404 });
        }

        /* もう押していれば、外す */
        const { data: already } = await admin
            .from("episode_stamps")
            .select("id")
            .eq("episode_id", body.episodeId)
            .eq("user_id", user.id)
            .eq("item_id", body.itemId)
            .maybeSingle();

        if (already) {
            await admin.from("episode_stamps").delete().eq("id", already.id);
            return NextResponse.json({ ok: true, pressed: false });
        }

        const { error } = await admin.from("episode_stamps").insert({
            episode_id: body.episodeId,
            novel_id: episode.novel_id,
            user_id: user.id,
            item_id: body.itemId,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true, pressed: true });
    } catch (caught) {
        return NextResponse.json(
            { error: caught instanceof Error ? caught.message : "うまくいきません" },
            { status: 500 },
        );
    }
}
