import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isOperator, liveSubscriptionOf } from "@/lib/subscription/plans";

/**
 * ============================================================
 * 原石航路 Studio
 * 資料の画像づくりの回数
 *
 * ★ 数えるのは、ここ（サーバー）だけ。
 *
 *   前は作品ごとの設定の中に枚数を持ち、画面の側で数えていた。
 *   消せば戻るし、画面を通さずに頼めば数えられない。
 *   1 枚ごとに費用がかかるので、お金の線引きには使えない。
 *
 * ★ 1 人につき、1 か月あたりで数える。
 *
 *   無料    月 3 枚
 *   Pro     特典の「上限を広げる」に ref = image_monthly
 *           数（amount）がその月の上限。0 なら無制限
 *
 * ★ 月は日本の時刻で区切る。
 *   1 日の朝 0 時に戻る。世界の時刻だと朝 9 時に戻ってしまう。
 *
 * ★ 先に見て、描けてから数える。
 *   描けなかったのに 1 枚ぶん減ると、こちらの落ち度で回数が減る。
 * ============================================================
 */

/** 会員でない人の上限。1 か月あたり */
export const IMAGE_BASE_LIMIT = 3;

/** 特典で上限を書き換えるときの合言葉 */
const PERK_REF = "image_monthly";

export interface ImageGate {
    ok: boolean;
    /** この人の上限。0 なら無制限 */
    limit: number;
    used: number;
    /** あと何枚描けるか。無制限なら null */
    left: number | null;
    /** Pro の上限で数えているか。画面の案内を変えるのに使う */
    pro: boolean;
    userId?: string;
    message?: string;
}

/** 今月。日本の時刻で「2026-09」の形 */
export function imageMonth(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

async function limitFor(userId: string): Promise<{ limit: number; pro: boolean }> {
    /* 運営は無制限。確かめるたびに回数を気にしなくてよいように */
    if (await isOperator(userId)) return { limit: 0, pro: true };

    const live = await liveSubscriptionOf(userId);
    if (!live) return { limit: IMAGE_BASE_LIMIT, pro: false };

    const perk = live.perks.find((one) => one.kind === "limit" && one.ref === PERK_REF);
    if (!perk) return { limit: IMAGE_BASE_LIMIT, pro: false };

    return { limit: Math.max(0, perk.amount), pro: true };
}

/** いま何枚使ったか、あと何枚描けるか。数は減らさない */
export async function imageLeft(): Promise<ImageGate> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            ok: false,
            limit: IMAGE_BASE_LIMIT,
            used: 0,
            left: 0,
            pro: false,
            message: "ログインすると使えます。",
        };
    }

    const { limit, pro } = await limitFor(user.id);
    const admin = createAdminClient();

    const { data } = await admin
        .from("image_usage")
        .select("count")
        .eq("user_id", user.id)
        .eq("month", imageMonth())
        .maybeSingle();

    const used = Number(data?.count ?? 0);

    if (limit <= 0) {
        return { ok: true, limit: 0, used, left: null, pro, userId: user.id };
    }

    const left = Math.max(0, limit - used);

    return {
        ok: left > 0,
        limit,
        used,
        left,
        pro,
        userId: user.id,
        message:
            left > 0
                ? undefined
                : `今月AIで描ける枚数（${limit}枚）を使い切りました。来月1日にまた描けます。`,
    };
}

/**
 * 1 枚ぶん使う。
 *
 * ★ 足すのは SQL の中で 1 回にまとめる（use_image）。
 *   読んでから足すと、同時に押されたときにすり抜ける。
 *
 * ★ 失敗しても呼ぶ側は止めない。描けた画像は渡す。
 */
export async function countImage(userId: string, limit: number): Promise<void> {
    try {
        const admin = createAdminClient();
        await admin.rpc("use_image", { who: userId, which_month: imageMonth(), cap: limit });
    } catch {
        /* 数えられなくても、描けたものは返す */
    }
}
