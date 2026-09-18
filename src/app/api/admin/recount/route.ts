import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { countChars } from "@/lib/utils/text";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/admin/recount — 話の文字数を数え直す
 *
 * ★ なぜ要るか。
 *
 *   保存するときの数え方が、書く画面と違っていた。
 *
 *     書く画面   ルビの記法を外し、改行だけ数えない
 *     保存する側  空白を全部消して、記法はそのまま数える
 *
 *   ルビを振るほど保存側が増え、
 *   字下げの全角空白があると逆に減る。
 *   数え方は直したが、すでに入っている数は古いままなので、
 *   ここで数え直す。
 *
 * ★ 既定では、書き換えない。
 *
 *   まず「何話ずれているか」だけ返す。
 *   中身を見てから run=1 を付ける。
 *
 * ★ 一度に全部やらない。
 *
 *   話が多いと時間切れになる。
 *   20 秒を目安に切り上げ、続きの位置を返す。
 *   next が返ってきたら、その from を付けてもう一度呼ぶ。
 *
 * 使い方（運営で入ったまま、ブラウザで開く）
 *   下見   /api/admin/recount
 *   直す   /api/admin/recount?run=1
 *   続き   /api/admin/recount?run=1&from=4000
 * ============================================================
 */

export const dynamic = "force-dynamic";

/** 一度に読む話数 */
const PAGE = 300;

/** ここまで来たら切り上げる */
const BUDGET_MS = 20_000;

/** 運営かどうか */
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
    const write = url.searchParams.get("run") === "1";
    const startAt = Math.max(0, Number(url.searchParams.get("from")) || 0);

    const began = Date.now();

    let looked = 0;
    let wrong = 0;
    let fixed = 0;
    let from = startAt;
    let next: number | null = null;

    /* どんなふうにずれているか、いくつか持ち帰る */
    const samples: {
        id: string;
        title: string;
        before: number;
        after: number;
    }[] = [];

    for (;;) {
        const { data, error } = await gate.admin
            .from("episodes")
            .select("id, title, body, char_count")
            .is("deleted_at", null)
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1);

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 },
            );
        }

        const page = (data ?? []) as {
            id: string;
            title: string | null;
            body: string | null;
            char_count: number | null;
        }[];

        if (page.length === 0) break;

        for (const row of page) {
            looked += 1;

            const after = countChars(row.body ?? "");
            const before = row.char_count ?? 0;

            if (after === before) continue;

            wrong += 1;

            if (samples.length < 20) {
                samples.push({
                    id: row.id,
                    title: row.title ?? "",
                    before,
                    after,
                });
            }

            if (write) {
                const { error: bad } = await gate.admin
                    .from("episodes")
                    .update({ char_count: after })
                    .eq("id", row.id);

                if (!bad) fixed += 1;
            }
        }

        from += page.length;

        if (page.length < PAGE) break;

        if (Date.now() - began > BUDGET_MS) {
            next = from;
            break;
        }
    }

    return NextResponse.json({
        /* 書き換えたか、下見だけか */
        mode: write ? "直した" : "下見だけ（直すには ?run=1）",
        looked,
        wrong,
        fixed,
        /* 続きがあるなら、この from を付けてもう一度 */
        next,
        samples,
    });
}
