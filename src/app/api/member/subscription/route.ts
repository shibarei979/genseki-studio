import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { freePointsOf, spendFreePoints } from "@/lib/points";
import {
    PAID_BY_POINTS,
    ALL_IN_LINES,
    POINT_PRICE,
    listPlans,
    liveSubscriptionOf,
    startSubscription,
    stopSubscription,
} from "@/lib/subscription/plans";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/member/subscription — サブスクに入る・やめる（読む人・書く人の側）
 *
 *   GET                                   売り物（出しているもの）と、いまの契約と、手持ちのポイント
 *   POST { action: "join", planId }       入る（無料ポイント 800pt で 1 か月。1 か月たつと自動で終わる）
 *   POST { action: "cancel" }             今すぐやめる（ポイントは戻らない）
 *
 * ★ いまは無料ポイントで払う。pay.jp を繋いだら、join をカードの払いに差し替える。
 * ============================================================
 */

export const dynamic = "force-dynamic";

async function me() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
}

/** 全部入りの名前 */
const ALL_IN_NAME = "サブスク（全部入り）";

/**
 * 全部入りの契約に付ける売り物（表の上で、契約はどれか 1 つの売り物に付く）。
 * 出しているものを先に、無ければ並びの先頭。売り物が 1 つも無ければ null。
 */
async function anchorPlan() {
    const plans = await listPlans();
    return plans.find((plan) => plan.is_active) ?? plans[0] ?? null;
}

async function view(userId: string) {
    const [anchor, live, points] = await Promise.all([
        anchorPlan(),
        liveSubscriptionOf(userId),
        freePointsOf(userId),
    ]);

    return {
        price: POINT_PRICE,
        points,
        /* ★ 800pt で、これまでの売り物の特典すべて。選ぶものは 1 つだけ */
        plans: anchor
            ? [
                  {
                      id: anchor.id,
                      name: ALL_IN_NAME,
                      blurb: "資料の追加の機能がすべて開き、回数に上限のある機能は上限がなくなります。",
                      perks: ALL_IN_LINES,
                  },
              ]
            : [],
        current: live
            ? {
                  id: live.id,
                  planId: live.plan_id,
                  planName: live.note === PAID_BY_POINTS ? ALL_IN_NAME : live.plan.name,
                  perks: live.note === PAID_BY_POINTS ? ALL_IN_LINES : live.perks.map((perk) => perk.note).filter(Boolean),
                  status: live.status,
                  currentEnd: live.current_end,
                  cancelAtPeriodEnd: live.cancel_at_period_end,
                  byPoints: live.note === PAID_BY_POINTS,
              }
            : null,
    };
}

export async function GET() {
    const user = await me();
    if (!user) return NextResponse.json({ error: "入っていません" }, { status: 401 });

    try {
        return NextResponse.json(await view(user.id));
    } catch (caught) {
        return NextResponse.json(
            { error: caught instanceof Error ? caught.message : "読めません" },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    const user = await me();
    if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });

    let body: { action?: string; planId?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "読めません" }, { status: 400 });
    }

    const admin = createAdminClient();

    if (body.action === "join") {
        const live = await liveSubscriptionOf(user.id);
        if (live) return NextResponse.json({ error: "すでに入っています" }, { status: 400 });

        /* 全部入りは 1 つだけ。送られてきた planId ではなく、こちらで決めた売り物に付ける */
        const plan = await anchorPlan();
        if (!plan) {
            return NextResponse.json({ error: "いまは入れません（準備中です）" }, { status: 400 });
        }
        body.planId = plan.id;

        /* 先に払う。払えたら始める。始められなければ返す */
        const paid = await spendFreePoints({
            userId: user.id,
            amount: POINT_PRICE,
            reason: "subscription",
            reasonRef: `join:${body.planId}:${new Date().toISOString()}`,
        });
        if (!paid.spent) {
            return NextResponse.json(
                { error: paid.reason === "ポイントが足りません" ? `無料ポイントが足りません（${POINT_PRICE}pt 要ります）` : paid.reason ?? "払えませんでした" },
                { status: 400 },
            );
        }

        const started = await startSubscription({
            userId: user.id,
            planId: body.planId,
            note: PAID_BY_POINTS,
            skipTrial: true,
            /* 売り物が年ぎめでも、ポイント払いは 1 か月 */
            interval: "month",
        });

        if (started.error) {
            /* 払ったのに入れなかった。ポイントを戻す */
            const expires = new Date();
            expires.setDate(expires.getDate() + 180);
            await admin.from("free_point_lots").insert({
                user_id: user.id,
                amount: POINT_PRICE,
                source: "admin",
                source_ref: `refund:subscription:${body.planId}`,
                expires_at: expires.toISOString(),
            });
            return NextResponse.json({ error: started.error }, { status: 400 });
        }

        return NextResponse.json({ ok: true, ...(await view(user.id)) });
    }

    if (body.action === "cancel" || body.action === "resume") {
        const live = await liveSubscriptionOf(user.id);
        if (!live) return NextResponse.json({ error: "入っていません" }, { status: 400 });

        if (body.action === "cancel") {
            /* ポイント払いは自動で終わるので、「やめる」は今すぐ終わらせる */
            const done = await stopSubscription({
                subscriptionId: live.id,
                now: live.note === PAID_BY_POINTS,
            });
            if (!done.ok) return NextResponse.json({ error: done.error ?? "やめられませんでした" }, { status: 500 });
        } else {
            const { error } = await admin
                .from("subscriptions")
                .update({ cancel_at_period_end: false })
                .eq("id", live.id);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, ...(await view(user.id)) });
    }

    return NextResponse.json({ error: "何をするか分かりません" }, { status: 400 });
}
