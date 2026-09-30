import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/points/equip — アイコン衣装をつける・称号を飾る
 *
 *   GET                              いまつけている物
 *   POST { costumeId: "…" | null }   衣装をつける（null で外す）
 *   POST { titleIds: ["…", …] }      作者ページに飾る称号（3 つまで。並べた順に出る）
 *
 * ★ 持っている物しかつけられない。表で確かめる。
 *
 * ★ 絵の住所もプロフィールに書いておく。
 *   アイコンはあちこちの画面に出るので、そのたびに品物の表を
 *   読みに行かなくて済むようにする。
 * ============================================================
 */

export const dynamic = "force-dynamic";

/** 作者ページに飾れる称号の数 */
const MAX_TITLES = 3;

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({});

        const admin = createAdminClient();
        const { data } = await admin
            .from("profiles")
            .select("costume_item_id, costume_url, titles")
            .eq("user_id", user.id)
            .maybeSingle();

        return NextResponse.json({
            costumeId: data?.costume_item_id ?? null,
            costumeUrl: data?.costume_url ?? null,
            titles: Array.isArray(data?.titles) ? data?.titles : [],
        });
    } catch {
        return NextResponse.json({});
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

        const body = (await request.json()) as {
            costumeId?: string | null;
            titleIds?: string[];
        };

        const admin = createAdminClient();

        /** 持っていて、その種類の品物か */
        async function ownedOf(ids: string[], kind: string) {
            if (ids.length === 0) return [];
            const { data: mine } = await admin
                .from("user_items")
                .select("item_id")
                .eq("user_id", user!.id)
                .in("item_id", ids);
            const have = new Set((mine ?? []).map((row: { item_id: string }) => row.item_id));

            const { data: items } = await admin
                .from("shop_items")
                .select("id, kind, name, asset_url")
                .in("id", ids)
                /* ★ 片づけた品物（一旦なしにしたもの）は、持っていてもつけられない */
                .eq("is_active", true);

            return (items ?? []).filter(
                (item: { id: string; kind: string }) => have.has(item.id) && item.kind === kind,
            ) as { id: string; kind: string; name: string; asset_url: string | null }[];
        }

        /* 衣装 */
        if ("costumeId" in body) {
            if (body.costumeId === null) {
                await admin
                    .from("profiles")
                    .update({ costume_item_id: null, costume_url: null })
                    .eq("user_id", user.id);
                return NextResponse.json({ ok: true, costumeUrl: null });
            }

            const [item] = await ownedOf([String(body.costumeId)], "costume");
            if (!item) {
                return NextResponse.json(
                    { error: "持っているアイコン衣装だけ、つけられます" },
                    { status: 400 },
                );
            }

            const { error } = await admin
                .from("profiles")
                .update({ costume_item_id: item.id, costume_url: item.asset_url })
                .eq("user_id", user.id);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            return NextResponse.json({ ok: true, costumeUrl: item.asset_url });
        }

        /* 称号 */
        if (Array.isArray(body.titleIds)) {
            const wanted = body.titleIds.map(String).filter((id, at, all) => all.indexOf(id) === at);
            if (wanted.length > MAX_TITLES) {
                return NextResponse.json(
                    { error: `称号は ${MAX_TITLES} つまで飾れます` },
                    { status: 400 },
                );
            }

            const items = await ownedOf(wanted, "badge");
            /* 送られてきた順に並べる */
            const titles = wanted
                .map((id) => items.find((item) => item.id === id))
                .filter(Boolean)
                .map((item) => ({ id: item!.id, name: item!.name, url: item!.asset_url }));

            const { error } = await admin
                .from("profiles")
                .update({ titles })
                .eq("user_id", user.id);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            return NextResponse.json({ ok: true, titles });
        }

        return NextResponse.json({ error: "中身がありません" }, { status: 400 });
    } catch (caught) {
        return NextResponse.json(
            { error: caught instanceof Error ? caught.message : "うまくいきません" },
            { status: 500 },
        );
    }
}
