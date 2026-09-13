import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * 原石航路 Studio
 * 無料ポイントの出し入れ
 *
 * ★ ここを通してだけ増やす。
 *
 *   画面から直に書けると、いくらでも作れてしまう。
 *   表の決まりでも書き込みを止めてあるので、
 *   運営の鍵を持つこの道具だけが触れる。
 *
 * ★ 期限は半年。古いものから使う。
 *
 *   新しいほうから使うと、
 *   古いものが期限切れで捨てられて、持ち主が損をする。
 *
 * ★ 履歴を必ず残す。
 *
 *   「減った」「増えない」という声が来たとき、
 *   履歴が無いと確かめようがない。
 * ============================================================
 */

/** 期限。もらった日から半年 */
const LIFE_DAYS = 182;

/** いま持っている数 */
export async function freePointsOf(userId: string): Promise<number> {
    const admin = createAdminClient();

    const { data } = await admin
        .from("free_point_lots")
        .select("amount, used")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString());

    return (data ?? []).reduce(
        (sum, row) => sum + (Number(row.amount) - Number(row.used)),
        0,
    );
}

/**
 * 配る。
 *
 * ★ 同じ理由で二度配らない。
 *
 *   ミッションの全クリなど、一度きりのものがある。
 *   once を true にすると、同じ reason_ref では
 *   二度目を配らない。
 */
export async function grantFreePoints(options: {
    userId: string;
    amount: number;
    source: string;
    sourceRef?: string;
    once?: boolean;
}): Promise<{ granted: boolean; reason?: string }> {
    const { userId, amount, source, sourceRef, once } = options;

    if (amount <= 0) return { granted: false, reason: "0 以下は配れません" };

    const admin = createAdminClient();

    if (once && sourceRef) {
        const { data: already } = await admin
            .from("free_point_events")
            .select("id")
            .eq("user_id", userId)
            .eq("kind", "earn")
            .eq("reason", source)
            .eq("reason_ref", sourceRef)
            .limit(1);

        if (already && already.length > 0) {
            return { granted: false, reason: "もう配ってあります" };
        }
    }

    const expires = new Date();
    expires.setDate(expires.getDate() + LIFE_DAYS);

    const { error } = await admin.from("free_point_lots").insert({
        user_id: userId,
        amount,
        source,
        source_ref: sourceRef ?? null,
        expires_at: expires.toISOString(),
    });

    if (error) return { granted: false, reason: error.message };

    await admin.from("free_point_events").insert({
        user_id: userId,
        kind: "earn",
        amount,
        reason: source,
        reason_ref: sourceRef ?? null,
    });

    return { granted: true };
}

/**
 * 使う。
 *
 * ★ 古いものから減らす。
 *
 *   期限の近いものを先に使えば、
 *   捨てられるぶんが減る。
 *
 * ★ 足りなければ、何も減らさない。
 *   途中まで減らして失敗すると、辻褄が合わなくなる。
 */
export async function spendFreePoints(options: {
    userId: string;
    amount: number;
    reason: string;
    reasonRef?: string;
}): Promise<{ spent: boolean; reason?: string }> {
    const { userId, amount, reason, reasonRef } = options;

    if (amount <= 0) return { spent: false, reason: "0 以下は使えません" };

    const admin = createAdminClient();

    const { data: lots } = await admin
        .from("free_point_lots")
        .select("id, amount, used")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        /* 期限の近いものから */
        .order("expires_at", { ascending: true });

    const rows = lots ?? [];

    const have = rows.reduce(
        (sum, row) => sum + (Number(row.amount) - Number(row.used)),
        0,
    );

    if (have < amount) {
        return { spent: false, reason: "ポイントが足りません" };
    }

    let left = amount;

    for (const row of rows) {
        if (left <= 0) break;

        const rest = Number(row.amount) - Number(row.used);
        if (rest <= 0) continue;

        const take = Math.min(rest, left);

        const { error } = await admin
            .from("free_point_lots")
            .update({ used: Number(row.used) + take })
            .eq("id", row.id);

        if (error) return { spent: false, reason: error.message };

        left -= take;
    }

    await admin.from("free_point_events").insert({
        user_id: userId,
        kind: "spend",
        amount,
        reason,
        reason_ref: reasonRef ?? null,
    });

    return { spent: true };
}

/**
 * 持ち物に加える。
 *
 * ★ 同じものは二度持たない。
 *   飾りは 1 つあれば足りる。
 */
export async function giveItem(options: {
    userId: string;
    itemId: string;
    paidFree?: number;
}): Promise<{ given: boolean; reason?: string }> {
    const admin = createAdminClient();

    const { error } = await admin.from("user_items").upsert(
        {
            user_id: options.userId,
            item_id: options.itemId,
            paid_free: options.paidFree ?? 0,
        },
        { onConflict: "user_id,item_id", ignoreDuplicates: true },
    );

    if (error) return { given: false, reason: error.message };
    return { given: true };
}
