import { createAdminClient } from "@/lib/supabase/admin";
import { grantFreePoints } from "@/lib/points";

/**
 * ============================================================
 * 原石航路 Studio
 * サブスクリプション
 *
 * ★ まだ読む人には出していない。
 *
 *   運営だけが見られる画面から、形と特典を決めている途中。
 *   決済（pay.jp）はまだ繋いでいない。
 *   繋ぐ場所は subscriptions の payjp_* に空けてある。
 *
 * ★ ここを通してだけ、契約を作る・進める。
 *
 *   表の決まりで、画面からの書き込みは止めてある。
 *   運営の鍵を持つこの道具だけが触れる。
 *
 * ★ 特典は「期間ごとに 1 回」。
 *
 *   毎月配るものを二重に配ると、取り返せない。
 *   配る前に控えを入れ、入らなければ配らない。
 *   数えて判断すると、同時に二度呼ばれたときにすり抜ける。
 * ============================================================
 */

/** 特典の種類 */
export type PerkKind =
    | "free_points"
    | "no_ads"
    | "item"
    | "badge"
    | "limit";

export interface Perk {
    id: string;
    plan_id: string;
    kind: PerkKind;
    amount: number;
    ref: string | null;
    note: string;
    sort: number;
    first_period_only: boolean;
}

export interface Plan {
    id: string;
    code: string;
    name: string;
    blurb: string;
    price_yen: number;
    interval: "month" | "year";
    trial_days: number;
    sort: number;
    is_active: boolean;
}

export type SubscriptionStatus =
    | "trial"
    | "active"
    | "past_due"
    | "canceled";

export interface Subscription {
    id: string;
    user_id: string;
    plan_id: string;
    status: SubscriptionStatus;
    started_at: string;
    current_start: string;
    current_end: string;
    cancel_at_period_end: boolean;
    ended_at: string | null;
    note: string;
}

/** 生きている契約とみなす状態 */
const LIVE: SubscriptionStatus[] = ["trial", "active", "past_due"];

/** 次の期間の終わりを出す */
function nextEnd(from: Date, interval: "month" | "year"): Date {
    const to = new Date(from);

    if (interval === "year") {
        to.setFullYear(to.getFullYear() + 1);
    } else {
        /*
         * ★ 月をまたぐときの日ずれ。
         *
         *   1/31 に 1 か月足すと 3/3 になる処理系がある。
         *   末日を越えたら、その月の末日に寄せる。
         */
        const day = to.getDate();
        to.setMonth(to.getMonth() + 1);

        if (to.getDate() !== day) to.setDate(0);
    }

    return to;
}

/** 売り物を、特典ごと読む */
export async function listPlans(): Promise<
    (Plan & { perks: Perk[] })[]
> {
    const admin = createAdminClient();

    const { data: plans } = await admin
        .from("plans")
        .select("*")
        .order("sort", { ascending: true });

    const { data: perks } = await admin
        .from("plan_perks")
        .select("*")
        .order("sort", { ascending: true });

    return ((plans ?? []) as Plan[]).map((plan) => ({
        ...plan,
        perks: ((perks ?? []) as Perk[]).filter(
            (perk) => perk.plan_id === plan.id,
        ),
    }));
}

/** いま生きている契約 */
export async function liveSubscriptionOf(
    userId: string,
): Promise<(Subscription & { plan: Plan; perks: Perk[] }) | null> {
    const admin = createAdminClient();

    const { data } = await admin
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .in("status", LIVE)
        .maybeSingle();

    if (!data) return null;

    const row = data as Subscription;

    const { data: plan } = await admin
        .from("plans")
        .select("*")
        .eq("id", row.plan_id)
        .maybeSingle();

    if (!plan) return null;

    const { data: perks } = await admin
        .from("plan_perks")
        .select("*")
        .eq("plan_id", row.plan_id)
        .order("sort", { ascending: true });

    return {
        ...row,
        plan: plan as Plan,
        perks: (perks ?? []) as Perk[],
    };
}

/**
 * 運営かどうか。
 *
 * ★ 運営は、はじめから会員として扱う。
 *
 *   自分の売り物を自分で買って確かめるのは、
 *   帳簿にも売上として乗ってしまうし、
 *   期間が切れれば、確かめる手も止まる。
 *
 *   払わずに、いつでも会員と同じものが見える状態にしておく。
 *
 * ★ 見るのは profiles.is_admin。
 *   運営の画面を通すときと、同じ物差しを使う。
 *
 * ★ 聞けなかったときは false。
 *   分からないときに通すと、誰でも通ってしまう。
 */
export async function isOperator(userId: string): Promise<boolean> {
    try {
        const admin = createAdminClient();

        const { data } = await admin
            .from("profiles")
            .select("is_admin")
            .eq("user_id", userId)
            .maybeSingle();

        return data?.is_admin === true;
    } catch {
        return false;
    }
}

/**
 * その人が、その特典を持っているか。
 *
 * ★ 広告を出すかどうかなど、見た目の分岐に使う。
 *
 * ★ 運営は、いつでも持っている。
 */
export async function hasPerk(
    userId: string,
    kind: PerkKind,
): Promise<boolean> {
    if (await isOperator(userId)) return true;

    const live = await liveSubscriptionOf(userId);
    if (!live) return false;

    return live.perks.some((perk) => perk.kind === kind);
}

/**
 * いまの期間ぶんの特典を配る。
 *
 * ★ 何度呼んでも、期間ごとに 1 回だけ。
 *
 *   控えの表が (契約, 特典, 期間の始まり) で 1 行しか持てない。
 *   先に控えを入れて、入ったときだけ配る。
 *
 * ★ 「初月だけ」は、初めの期間かどうかで決める。
 *   契約の始まりと、いまの期間の始まりが同じなら初月。
 */
export async function applyPerks(
    subscriptionId: string,
): Promise<{ granted: number; skipped: number }> {
    const admin = createAdminClient();

    const { data: row } = await admin
        .from("subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .maybeSingle();

    if (!row) return { granted: 0, skipped: 0 };

    const sub = row as Subscription;

    if (!LIVE.includes(sub.status)) return { granted: 0, skipped: 0 };

    const { data: perks } = await admin
        .from("plan_perks")
        .select("*")
        .eq("plan_id", sub.plan_id)
        .order("sort", { ascending: true });

    const firstPeriod =
        new Date(sub.current_start).getTime() ===
        new Date(sub.started_at).getTime();

    let granted = 0;
    let skipped = 0;

    for (const perk of (perks ?? []) as Perk[]) {
        /* いまは無料ポイントだけ配る。ほかは持っているだけ */
        if (perk.kind !== "free_points") continue;
        if (perk.amount <= 0) continue;

        if (perk.first_period_only && !firstPeriod) {
            skipped += 1;
            continue;
        }

        /*
         * ★ 先に控えを入れる。
         *
         *   入らなければ、もう配ってある。
         *   数えてから配ると、同時に呼ばれたときに二重になる。
         */
        const { error } = await admin.from("subscription_grants").insert({
            subscription_id: sub.id,
            perk_id: perk.id,
            period_start: sub.current_start,
            amount: perk.amount,
        });

        if (error) {
            skipped += 1;
            continue;
        }

        const result = await grantFreePoints({
            userId: sub.user_id,
            amount: perk.amount,
            source: "subscription",
            sourceRef: `${sub.id}:${perk.id}:${sub.current_start}`,
            once: true,
        });

        if (result.granted) {
            granted += 1;
        } else {
            /*
             * ★ 配れなかったら、控えも消す。
             *   控えだけ残ると、次の機会にも配れない。
             */
            await admin
                .from("subscription_grants")
                .delete()
                .eq("subscription_id", sub.id)
                .eq("perk_id", perk.id)
                .eq("period_start", sub.current_start);

            skipped += 1;
        }
    }

    return { granted, skipped };
}

/**
 * 始める。
 *
 * ★ いまは運営が手で始める。
 *   pay.jp を繋いだら、向こうからの知らせでここを呼ぶ。
 *
 * ★ すでに生きている契約があれば、作らない。
 *   表の決まりでも止めてあるが、先に見て理由を返す。
 */
export async function startSubscription(options: {
    userId: string;
    planId: string;
    note?: string;
}): Promise<{ id?: string; error?: string }> {
    const admin = createAdminClient();

    const { data: already } = await admin
        .from("subscriptions")
        .select("id")
        .eq("user_id", options.userId)
        .in("status", LIVE)
        .maybeSingle();

    if (already) return { error: "すでに続いている契約があります" };

    const { data: plan } = await admin
        .from("plans")
        .select("*")
        .eq("id", options.planId)
        .maybeSingle();

    if (!plan) return { error: "その売り物がありません" };

    const now = new Date();

    const trial = (plan as Plan).trial_days;

    const end =
        trial > 0
            ? new Date(now.getTime() + trial * 24 * 60 * 60 * 1000)
            : nextEnd(now, (plan as Plan).interval);

    const { data, error } = await admin
        .from("subscriptions")
        .insert({
            user_id: options.userId,
            plan_id: options.planId,
            status: trial > 0 ? "trial" : "active",
            started_at: now.toISOString(),
            current_start: now.toISOString(),
            current_end: end.toISOString(),
            note: options.note ?? "",
        })
        .select("id")
        .maybeSingle();

    if (error || !data) return { error: error?.message ?? "作れませんでした" };

    await applyPerks(data.id as string);

    return { id: data.id as string };
}

/**
 * 止める。
 *
 * ★ 既定は「期間の終わりで」。
 *
 *   払ったぶんは使えるのが筋なので、
 *   その場で取り上げない。
 *
 * ★ now を渡したときだけ、すぐ終わる。
 *   返金したときなど、運営の判断で使う。
 */
export async function stopSubscription(options: {
    subscriptionId: string;
    now?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
    const admin = createAdminClient();

    const patch = options.now
        ? {
              status: "canceled" as const,
              ended_at: new Date().toISOString(),
              cancel_at_period_end: false,
          }
        : { cancel_at_period_end: true };

    const { error } = await admin
        .from("subscriptions")
        .update(patch)
        .eq("id", options.subscriptionId);

    if (error) return { ok: false, error: error.message };

    return { ok: true };
}

/**
 * 期間を進める。
 *
 * ★ 終わりを過ぎた契約を、次の期間へ送る。
 *
 *   送ったところで、その期間ぶんの特典を配る。
 *   「期間の終わりで止める」になっていれば、そこで終わる。
 *
 * ★ 毎日 1 回呼ぶ想定。
 *   いまは運営の画面から手で押す。
 *   決済を繋いだら、向こうの知らせで進める。
 */
export async function advancePeriods(): Promise<{
    moved: number;
    ended: number;
}> {
    const admin = createAdminClient();

    const { data } = await admin
        .from("subscriptions")
        .select("*")
        .in("status", LIVE)
        .lte("current_end", new Date().toISOString());

    let moved = 0;
    let ended = 0;

    for (const row of (data ?? []) as Subscription[]) {
        if (row.cancel_at_period_end) {
            await admin
                .from("subscriptions")
                .update({
                    status: "canceled",
                    ended_at: row.current_end,
                })
                .eq("id", row.id);

            ended += 1;
            continue;
        }

        const { data: plan } = await admin
            .from("plans")
            .select("interval")
            .eq("id", row.plan_id)
            .maybeSingle();

        const start = new Date(row.current_end);

        const end = nextEnd(
            start,
            ((plan?.interval as "month" | "year") ?? "month"),
        );

        await admin
            .from("subscriptions")
            .update({
                status: "active",
                current_start: start.toISOString(),
                current_end: end.toISOString(),
            })
            .eq("id", row.id);

        await applyPerks(row.id);

        moved += 1;
    }

    return { moved, ended };
}
