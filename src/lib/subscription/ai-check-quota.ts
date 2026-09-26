import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isOperator, liveSubscriptionOf } from "@/lib/subscription/plans";

/**
 * ============================================================
 * 原石航路 Studio
 * AI 誤字脱字・表記揺れチェックの回数と、使えるかどうか
 *
 * ★ Pro だけの機能。語彙集も同じ合言葉で開く。
 *
 *   特典の「上限を広げる」に ref = ai_check
 *   数（amount）がその月の上限。0 なら無制限
 *   （Pro は月 100 回の想定。/admin/plans で 100 を入れる）
 *
 * ★ 数えるのはサーバーだけ。1 回ごとに AI の費用がかかる。
 * ★ 月は日本の時刻で区切る（1 日の 0 時に戻る）。
 * ★ 先に見て、返事が返ってから数える。
 * ============================================================
 */

const PERK_REF = "ai_check";

export interface CheckGate {
    /** Pro か（語彙集もこれで開く） */
    allowed: boolean;
    /** 今回使えるか */
    ok: boolean;
    limit: number;
    used: number;
    /** あと何回。無制限なら null */
    left: number | null;
    userId?: string;
    message?: string;
}

export function checkMonth(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

/** その人が Pro（ai_check）か。上限もいっしょに返す */
async function planFor(userId: string): Promise<{ allowed: boolean; limit: number }> {
    if (await isOperator(userId)) return { allowed: true, limit: 0 };

    const live = await liveSubscriptionOf(userId);
    const perk = live?.perks.find((one) => one.kind === "limit" && one.ref === PERK_REF);
    if (!perk) return { allowed: false, limit: 0 };

    return { allowed: true, limit: Math.max(0, perk.amount) };
}

export async function checkLeft(): Promise<CheckGate> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { allowed: false, ok: false, limit: 0, used: 0, left: 0, message: "ログインすると使えます。" };
    }

    const { allowed, limit } = await planFor(user.id);
    if (!allowed) {
        return {
            allowed: false,
            ok: false,
            limit: 0,
            used: 0,
            left: 0,
            userId: user.id,
            message: "AIチェックは Pro の機能です。",
        };
    }

    const admin = createAdminClient();
    const { data } = await admin
        .from("ai_usage")
        .select("count")
        .eq("user_id", user.id)
        .eq("month", checkMonth())
        .eq("kind", "check")
        .maybeSingle();

    const used = Number(data?.count ?? 0);

    if (limit <= 0) {
        return { allowed: true, ok: true, limit: 0, used, left: null, userId: user.id };
    }

    const left = Math.max(0, limit - used);
    return {
        allowed: true,
        ok: left > 0,
        limit,
        used,
        left,
        userId: user.id,
        message:
            left > 0
                ? undefined
                : `今月のAIチェック（${limit}回）を使い切りました。来月1日にまた使えます。`,
    };
}

/** 1 回ぶん数える。失敗しても結果は返す */
export async function countCheck(userId: string, limit: number): Promise<void> {
    try {
        const admin = createAdminClient();
        await admin.rpc("use_ai", {
            who: userId,
            which_month: checkMonth(),
            which_kind: "check",
            cap: limit,
        });
    } catch {
        /* 数えられなくても、見つけたものは返す */
    }
}
