import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isOperator, liveSubscriptionOf } from "@/lib/subscription/plans";

/**
 * ============================================================
 * 原石航路 Studio
 * 「本文から資料を集める」の回数
 *
 * ★ 数えるのは、ここだけ。
 *
 *   前はブラウザの中（localStorage）で数えていた。
 *   消せば戻るし、別のブラウザでも戻る。
 *   押しすぎを防ぐ役には立つが、
 *   お金を払って外す境目には使えない。
 *
 *   本文を送る口で数えれば、画面を通さなくても効く。
 *
 * ★ 二種類ある。
 *
 *   full    全文。本文をまるごと送る。重い
 *   latest  最新。書き足したぶんだけ。軽い
 *
 * ★ 会員は外れる。
 *
 *   特典の「上限を広げる」に
 *   ref = scan_full / scan_latest を入れる。
 *   数が 0 なら無制限、数字が入っていればその数まで。
 *
 * ★ 先に見て、通ってから数える。
 *
 *   モデルが失敗したときに 1 回ぶん取られると、
 *   こちらの落ち度で回数が減る。
 *   返事が返ってきてから数える。
 * ============================================================
 */

export type ScanKind = "full" | "latest";

/** 会員でない人の上限。1 か月あたり */
export const BASE_LIMIT: Record<ScanKind, number> = {
    full: 3,
    latest: 30,
};

/** 特典で上限を書き換えるときの合言葉 */
const PERK_REF: Record<ScanKind, string> = {
    full: "scan_full",
    latest: "scan_latest",
};

export interface ScanGate {
    ok: boolean;
    /** この人の上限。0 なら無制限 */
    limit: number;
    /** 今月すでに使った数 */
    used: number;
    /** あと何回使えるか。無制限なら null */
    left: number | null;
    userId?: string;
    message?: string;
}

/** 今月。「2026-09」の形 */
function thisMonth(): string {
    return new Date().toISOString().slice(0, 7);
}

/**
 * その人の上限を出す。
 *
 * ★ 会員なら、特典の数で上書きする。
 *   0 が入っていれば無制限。
 */
export async function limitFor(
    userId: string,
    kind: ScanKind,
): Promise<number> {
    /*
     * ★ 運営は、はじめから無制限。
     *
     *   直したところを確かめるのに何度も押すので、
     *   月 3 回では足りない。
     *   自分で買って確かめるのも、帳簿に乗るので避ける。
     */
    if (await isOperator(userId)) return 0;

    const live = await liveSubscriptionOf(userId);

    if (!live) return BASE_LIMIT[kind];

    const perk = live.perks.find(
        (one) => one.kind === "limit" && one.ref === PERK_REF[kind],
    );

    if (!perk) return BASE_LIMIT[kind];

    /* 0 は無制限。表の側でも 0 を無制限として扱う */
    return Math.max(0, perk.amount);
}

/**
 * いま何回使ったか、あと何回使えるか。
 *
 * ★ 数は減らさない。画面に出すためのもの。
 */
export async function scanLeft(kind: ScanKind): Promise<ScanGate> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            ok: false,
            limit: BASE_LIMIT[kind],
            used: 0,
            left: 0,
            message: "入ってから使えます。",
        };
    }

    const limit = await limitFor(user.id, kind);
    const admin = createAdminClient();

    const { data } = await admin
        .from("scan_usage")
        .select("count")
        .eq("user_id", user.id)
        .eq("month", thisMonth())
        .eq("kind", kind)
        .maybeSingle();

    const used = Number(data?.count ?? 0);

    if (limit <= 0) {
        return { ok: true, limit: 0, used, left: null, userId: user.id };
    }

    return {
        ok: used < limit,
        limit,
        used,
        left: Math.max(0, limit - used),
        userId: user.id,
    };
}

/**
 * 通してよいか見る。
 *
 * ★ ここでは数えない。
 *   返事が返ってきてから countScan を呼ぶ。
 */
export async function checkScan(kind: ScanKind): Promise<ScanGate> {
    const gate = await scanLeft(kind);

    if (!gate.userId) return gate;

    if (!gate.ok) {
        const next = new Date();
        next.setMonth(next.getMonth() + 1, 1);

        return {
            ...gate,
            message:
                kind === "full"
                    ? `全文の読み直しは今月ぶんを使い切りました。${next.getMonth() + 1}月1日から、また${gate.limit}回使えます。`
                    : `最新の読み取りは今月ぶんを使い切りました。${next.getMonth() + 1}月1日から、また${gate.limit}回使えます。`,
        };
    }

    return gate;
}

/**
 * 1 回ぶん使う。
 *
 * ★ 足すのは、表の中の一つの文でやる。
 *   読んでから足すと、同時に押されたときにすり抜ける。
 *
 * ★ 失敗しても、呼ぶ側は止めない。
 *   数えられなかったことより、
 *   拾った候補を返せないことのほうが困る。
 */
export async function countScan(
    userId: string,
    kind: ScanKind,
    limit: number,
): Promise<void> {
    try {
        const admin = createAdminClient();

        await admin.rpc("use_scan", {
            who: userId,
            which: kind,
            cap: limit,
        });
    } catch {
        /* 数えられなくても、返すものは返す */
    }
}
