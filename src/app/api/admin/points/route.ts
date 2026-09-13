import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { freePointsOf, grantFreePoints, spendFreePoints } from "@/lib/points";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/admin/points — 運営が手で配る・取り消す
 *
 * ★ 試すために要る。
 *
 *   ミッションの条件を満たすには時間がかかる。
 *   数字が正しく動くかを見るのに、
 *   手で入れられる口が無いと確かめようがない。
 *
 * ★ 取り消しも置く。
 *
 *   不正が見つかったときに減らせないと、
 *   増えたままになる。
 *
 * ★ 運営だけ。
 *   ここが開いていると、いくらでも作れてしまう。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "入っていません" }, { status: 401 });
        }

        const admin = createAdminClient();

        const { data: me } = await admin
            .from("profiles")
            .select("is_admin")
            .eq("user_id", user.id)
            .maybeSingle();

        if (me?.is_admin !== true) {
            return NextResponse.json({ error: "通せません" }, { status: 403 });
        }

        const body = (await request.json()) as {
            /* grant 配る / revoke 取り消す */
            action?: string;
            /* 相手。名前でも id でも */
            target?: string;
            amount?: number;
            note?: string;
        };

        const amount = Number(body.amount ?? 0);

        if (!body.target || amount <= 0) {
            return NextResponse.json(
                { error: "相手と数を入れてください" },
                { status: 400 },
            );
        }

        /* 名前で渡されたときは、id を引く */
        let targetId = body.target;

        if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
            const { data: found } = await admin
                .from("public_profiles")
                .select("user_id")
                .eq("display_name", body.target)
                .maybeSingle();

            if (!found) {
                return NextResponse.json(
                    { error: "その名前の人が見つかりません" },
                    { status: 404 },
                );
            }

            targetId = found.user_id;
        }

        if (body.action === "revoke") {
            const result = await spendFreePoints({
                userId: targetId,
                amount,
                reason: "admin-revoke",
                reasonRef: body.note ?? undefined,
            });

            if (!result.spent) {
                return NextResponse.json(
                    { error: result.reason ?? "取り消せません" },
                    { status: 400 },
                );
            }

            return NextResponse.json({
                ok: true,
                left: await freePointsOf(targetId),
            });
        }

        const result = await grantFreePoints({
            userId: targetId,
            amount,
            source: "admin",
            sourceRef: body.note ?? undefined,
        });

        if (!result.granted) {
            return NextResponse.json(
                { error: result.reason ?? "配れません" },
                { status: 400 },
            );
        }

        return NextResponse.json({
            ok: true,
            left: await freePointsOf(targetId),
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
