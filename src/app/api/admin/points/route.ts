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

        /*
         * 名前で渡されたときは、id を引く。
         *
         * ★ profiles を見る。
         *
         *   public_profiles は見る人の決まりで絞られる表で、
         *   運営の鍵でも思ったように引けないことがある。
         *   元の表を直接見る。
         *
         * ★ 空白は落とす。
         *   名前に全角の空白が入っていると、打ち写しても当たらない。
         *
         * ★ 大文字小文字を区別しない。
         */
        let targetId = body.target.trim();

        if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
            const wanted = targetId;

            const { data: found } = await admin
                .from("profiles")
                .select("user_id, display_name")
                .ilike("display_name", wanted)
                .limit(2);

            if (!found || found.length === 0) {
                /* 一部でも当たるものを探して、候補を返す */
                const { data: near } = await admin
                    .from("profiles")
                    .select("display_name")
                    .ilike("display_name", `%${wanted}%`)
                    .limit(5);

                const hints = (near ?? [])
                    .map((one: any) => one.display_name)
                    .filter(Boolean);

                return NextResponse.json(
                    {
                        error:
                            hints.length > 0
                                ? `見つかりません。近いのは：${hints.join(" / ")}`
                                : "その名前の人が見つかりません",
                    },
                    { status: 404 },
                );
            }

            if (found.length > 1) {
                return NextResponse.json(
                    { error: "同じ名前の人が複数います。id で指定してください" },
                    { status: 400 },
                );
            }

            targetId = found[0].user_id;
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

/**
 * 名前を探す。
 *
 * ★ 打った字に近い人を返す。
 *
 *   名前は完全に一致しないと当たらない。
 *   全角の空白や似た字が入っていると、
 *   見た目が同じでも別の文字になる。
 *
 *   候補から選べば、打ち間違えようがない。
 */
export async function GET(request: Request) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ names: [] });

        const admin = createAdminClient();

        const { data: me } = await admin
            .from("profiles")
            .select("is_admin")
            .eq("user_id", user.id)
            .maybeSingle();

        if (me?.is_admin !== true) return NextResponse.json({ names: [] });

        const word = new URL(request.url).searchParams.get("find") ?? "";
        if (!word.trim()) return NextResponse.json({ names: [] });

        const { data } = await admin
            .from("profiles")
            .select("display_name")
            .ilike("display_name", `%${word.trim()}%`)
            .limit(10);

        return NextResponse.json({
            names: (data ?? [])
                .map((one: any) => one.display_name)
                .filter(Boolean),
        });
    } catch {
        return NextResponse.json({ names: [] });
    }
}
