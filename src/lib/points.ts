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

    /*
     * ★ 一度きりのものは、先に履歴（印）を書く。
     *
     *   上の「確かめる」だけだと、同時に 2 回呼ばれたとき
     *   両方とも「まだ」と見て、二度配ってしまう。
     *   表の決まり（items_tree6.sql の free_point_events_once）で
     *   2 つ目の印が弾かれたら、配らない。
     */
    if (once && sourceRef) {
        const { data: mark, error: markError } = await admin
            .from("free_point_events")
            .insert({
                user_id: userId,
                kind: "earn",
                amount,
                reason: source,
                reason_ref: sourceRef,
            })
            .select("id")
            .single();

        if (markError || !mark) {
            if (markError?.code === "23505") {
                return { granted: false, reason: "もう配ってあります" };
            }
            return { granted: false, reason: markError?.message ?? "配れません" };
        }

        const { error: lotError } = await admin.from("free_point_lots").insert({
            user_id: userId,
            amount,
            source,
            source_ref: sourceRef,
            expires_at: expires.toISOString(),
        });

        if (lotError) {
            /* 配れなかったら印も消す。印だけ残ると、二度ともらえない */
            await admin.from("free_point_events").delete().eq("id", mark.id);
            return { granted: false, reason: lotError.message };
        }

        return { granted: true };
    }

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

    /* ここまでに引いた束。途中でやめたときに戻す */
    const taken: { id: string; take: number }[] = [];

    for (const row of rows) {
        if (left <= 0) break;

        const rest = Number(row.amount) - Number(row.used);
        if (rest <= 0) continue;

        const take = Math.min(rest, left);

        /*
         * ★ 読んだときの used のままのときだけ書く。
         *
         *   同時に 2 つの交換が走ると、両方が同じ used を読んで
         *   同じ数を書き、1 回ぶんしか減らないのに品物が 2 つ入ってしまう。
         *   ほかの払いが先に書いていたら、ここは 0 行になるのでやめる。
         */
        const { data: hit, error } = await admin
            .from("free_point_lots")
            .update({ used: Number(row.used) + take })
            .eq("id", row.id)
            .eq("used", row.used)
            .select("id");

        if (error || !hit || hit.length === 0) {
            for (const done of taken) {
                const { data: now } = await admin
                    .from("free_point_lots")
                    .select("used")
                    .eq("id", done.id)
                    .maybeSingle();
                if (now) {
                    await admin
                        .from("free_point_lots")
                        .update({ used: Math.max(0, Number(now.used) - done.take) })
                        .eq("id", done.id);
                }
            }
            return {
                spent: false,
                reason: error?.message ?? "ほかの交換と重なりました。もう一度お試しください",
            };
        }

        taken.push({ id: row.id, take });
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

    const { data, error } = await admin
        .from("user_items")
        .upsert(
            {
                user_id: options.userId,
                item_id: options.itemId,
                paid_free: options.paidFree ?? 0,
            },
            { onConflict: "user_id,item_id", ignoreDuplicates: true },
        )
        .select("item_id");

    if (error) return { given: false, reason: error.message };

    /*
     * ★ 何も入らなかった ＝ もう持っていた。
     *   同じ品物の交換が 2 つ同時に走ると、2 つ目はここに来る。
     *   「渡せた」と返すと、ポイントだけ二重に引かれる（呼んだ側が戻す）。
     */
    if (!data || data.length === 0) {
        return { given: false, reason: "もう持っています" };
    }
    return { given: true };
}
