import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/admin/members — 人ごとの、持ち物と契約
 *
 * ★ 一枚で分かるようにする。
 *
 *   ポイントは無料ポイントの画面、契約は会員の画面、
 *   と分かれていると、「この人は何者か」を見るのに
 *   二か所を行き来することになる。
 *
 *   名前・持っているポイント・入っている会員を、同じ行に置く。
 *
 * ★ 並びは「会員が上、次にポイントの多い順」。
 *
 *   見たいのは、まず払っている人。
 *   次に、たくさん持っている人（不正を見つけるのに要る）。
 *
 * ★ ポイントは、期限の切れていないぶんだけ数える。
 *   持ち主から見た「使える数」と合わせる。
 * ============================================================
 */

export const dynamic = "force-dynamic";

/** 一度に読む行数。PostgREST は既定で 1000 行までしか返さない */
const PAGE = 1000;

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
    const find = (url.searchParams.get("find") ?? "").trim();

    /* いま使えるポイントを、人ごとに足す */
    const now = new Date().toISOString();
    const points = new Map<string, number>();

    for (let from = 0; ; from += PAGE) {
        const { data, error } = await gate.admin
            .from("free_point_lots")
            .select("user_id, amount, used")
            .gt("expires_at", now)
            .range(from, from + PAGE - 1);

        if (error) break;

        const rows = data ?? [];

        for (const row of rows) {
            const rest = Number(row.amount) - Number(row.used);
            if (rest <= 0) continue;

            points.set(
                row.user_id as string,
                (points.get(row.user_id as string) ?? 0) + rest,
            );
        }

        if (rows.length < PAGE) break;
    }

    /* 生きている契約 */
    const { data: subs } = await gate.admin
        .from("subscriptions")
        .select("*")
        .in("status", ["trial", "active", "past_due"]);

    const subOf = new Map(
        (subs ?? []).map((row) => [row.user_id as string, row]),
    );

    const { data: plans } = await gate.admin.from("plans").select("id, name");

    const planOf = new Map(
        (plans ?? []).map((row) => [row.id as string, row.name as string]),
    );

    /*
     * 出す人。
     *
     * ★ 探しているときは、名前で絞ってから。
     * ★ 探していないときは、ポイントを持っているか、
     *   会員に入っている人だけ。
     *
     *   何も持っていない人まで並べると、
     *   見たい人が埋もれる。
     */
    let people: { user_id: string; display_name: string }[] = [];

    if (find) {
        const { data } = await gate.admin
            .from("profiles")
            .select("user_id, display_name")
            .ilike("display_name", `%${find}%`)
            .limit(200);

        people = (data ?? []) as typeof people;
    } else {
        const ids = Array.from(
            new Set([...points.keys(), ...subOf.keys()]),
        );

        for (let at = 0; at < ids.length; at += 200) {
            const { data } = await gate.admin
                .from("profiles")
                .select("user_id, display_name")
                .in("user_id", ids.slice(at, at + 200));

            people = people.concat((data ?? []) as typeof people);
        }
    }

    const rows = people.map((one) => {
        const sub = subOf.get(one.user_id);

        return {
            user_id: one.user_id,
            display_name: one.display_name ?? "",
            points: points.get(one.user_id) ?? 0,
            subscription_id: (sub?.id as string) ?? null,
            plan_name: sub ? (planOf.get(sub.plan_id as string) ?? "") : "",
            status: (sub?.status as string) ?? null,
            current_end: (sub?.current_end as string) ?? null,
            cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
        };
    });

    /* 会員が上、次にポイントの多い順 */
    rows.sort((a, b) => {
        if (!!a.status !== !!b.status) return a.status ? -1 : 1;
        return b.points - a.points;
    });

    return NextResponse.json({
        members: rows.slice(0, 300),
        /* 見出しに出す数 */
        summary: {
            holders: points.size,
            members: subOf.size,
            points: Array.from(points.values()).reduce(
                (sum, one) => sum + one,
                0,
            ),
        },
    });
}
