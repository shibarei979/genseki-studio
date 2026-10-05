import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantFreePoints } from "@/lib/points";
import {
    CARD_CELLS,
    DAILY_POINTS,
    FULL_BONUS,
    GOLD_BONUS,
    GOLD_CHANCE,
    REASON,
    ROW_BONUS,
    ROW_CELLS,
    buildCard,
    cardDone,
    daysBetween,
    rowDone,
    type LoginCardState,
    type LoginGrant,
} from "@/lib/login-card";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/points/daily — 毎日ログイン（乗船印帳）
 *
 *   GET   印帳のようす（何枚目・28 日のマス・金の印・続いた日数）
 *   POST  今日のハンコを押す（1 日 1 回）。配ったものと印帳のようすを返す
 *
 *   毎日 5 pt ／ 7 日連続（1 行ぜんぶ）+50 ／ 28 日連続（ぜんぶ）+200 ／ ときどき金の印 +10
 *   来なかった日のマスは空いたまま（決まりは lib/login-card.ts）
 *
 * ★ 日の区切りは日本時間。サーバーは世界標準時なので +9 時間して数える。
 *
 * ★ 二度配らない。
 *   その日の日付を印にして、grantFreePoints の once で止める。
 *   連続のおまけは「最後の日:7」「最後の日:28」を印にして、once で止める。
 *   金の印は、その日の 5 pt を配れたとき（＝その日いちばん最初）だけ決める。
 *
 * ★ 押した日は、これまでにもらった記録（free_point_events）から数える。
 *   別に表を作らなくても、日付の印を並べれば、どのカードの何マス目か分かる。
 * ============================================================
 */

export const dynamic = "force-dynamic";

/** grantFreePoints が「もう配ってある」ときに返す理由 */
const ALREADY = "もう配ってあります";

/** 日本時間の日付（2026-09-30 の形） */
function jstDate(offsetDays = 0): string {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
    return now.toISOString().slice(0, 10);
}

type Admin = ReturnType<typeof createAdminClient>;

/** 印帳のようす */
async function cardState(admin: Admin, userId: string, today: string): Promise<LoginCardState> {

    /* これまでに押した日（全部。1 日 1 行なので多くても数百） */
    const { data: rows } = await admin
        .from("free_point_events")
        .select("reason_ref")
        .eq("user_id", userId)
        .eq("kind", "earn")
        .eq("reason", REASON.daily)
        .order("reason_ref", { ascending: true })
        .limit(5000);
    const dates = ((rows ?? []) as { reason_ref: string | null }[])
        .map((r) => r.reason_ref ?? "")
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

    /* 金の印の日（このカードの分だけあれば足りるが、数が少ないので 60 日分を見る） */
    let golds = new Set<string>();
    if (dates.length > 0) {
        const { data: goldRows } = await admin
            .from("free_point_events")
            .select("reason_ref")
            .eq("user_id", userId)
            .eq("kind", "earn")
            .eq("reason", REASON.gold)
            .gte("reason_ref", jstDate(-60));
        golds = new Set(((goldRows ?? []) as { reason_ref: string | null }[]).map((r) => r.reason_ref ?? ""));
    }

    /* 続いた日数。今日（まだなら昨日）から、印が途切れるまでさかのぼる */
    const seen = new Set(dates);
    let streak = 0;
    let offset = seen.has(today) ? 0 : -1;
    while (seen.has(jstDate(offset))) {
        streak += 1;
        offset -= 1;
    }

    return buildCard(dates, golds, today, streak);
}

async function currentUserId(): Promise<string | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
}

export async function GET() {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({});
        const state = await cardState(createAdminClient(), userId, jstDate());
        return NextResponse.json({ state });
    } catch {
        return NextResponse.json({});
    }
}

export async function POST() {
    try {
        const userId = await currentUserId();

        /* 入っていない人には、何も返さない（画面は次の頁でまた頼む） */
        if (!userId) return NextResponse.json({});

        const today = jstDate();
        const admin = createAdminClient();

        const daily = await grantFreePoints({
            userId,
            amount: DAILY_POINTS,
            source: REASON.daily,
            sourceRef: today,
            once: true,
        });

        /*
         * ★ 5 pt を配れなかったのが「もう押してある」以外（表に書けなかった等）なら、
         *   失敗として返す。画面は日付を覚えず、次に開いたときにまた頼む。
         */
        if (!daily.granted && daily.reason !== ALREADY) {
            return NextResponse.json({ error: true }, { status: 500 });
        }

        const grant: LoginGrant = { daily: 0, row: 0, full: 0, gold: 0 };
        let state = await cardState(admin, userId, today);

        /*
         * ★ 連続のおまけ（7 日連続・28 日連続）。
         *   そろった行の最後の日を印にして配る（once なので、何度呼んでも 1 回だけ）。
         *   今日の行だけでなく、このカードのそろった行を全部たしかめる。
         *   前に配るのに失敗した分があっても、次に来た日に届く。
         *   ただし、そろったのが 7 日より前の行は見ない（この決まりにする前のカードの分は配らない）。
         */
        const fresh = (date: string) => daysBetween(date, today) <= ROW_CELLS;
        let rowToday = false;
        for (let r = 0; r < CARD_CELLS / ROW_CELLS; r += 1) {
            if (!rowDone(state, r)) continue;
            const last = state.cells[(r + 1) * ROW_CELLS - 1].date;
            if (last === today) rowToday = true;
            if (!fresh(last)) continue;
            const got = await grantFreePoints({
                userId,
                amount: ROW_BONUS,
                source: REASON.streak,
                sourceRef: `${last}:${ROW_CELLS}`,
                once: true,
            });
            if (got.granted) grant.row += ROW_BONUS;
        }
        const fullToday = cardDone(state) && state.end === today;
        if (cardDone(state) && fresh(state.end)) {
            const got = await grantFreePoints({
                userId,
                amount: FULL_BONUS,
                source: REASON.streak,
                sourceRef: `${state.end}:${CARD_CELLS}`,
                once: true,
            });
            if (got.granted) grant.full = FULL_BONUS;
        }

        if (daily.granted) {
            grant.daily = DAILY_POINTS;

            /*
             * 今日で 7 日連続・28 日連続になった日は、お知らせに必ず出す。
             * （同時に開いた別の画面のほうが先に配っていても、もらえていることに変わりはない）
             */
            if (rowToday) grant.row = Math.max(grant.row, ROW_BONUS);
            if (fullToday) grant.full = FULL_BONUS;

            /* ときどき金の印（その日いちばん最初に押したときだけ決める） */
            if (Math.random() < GOLD_CHANCE) {
                const r = await grantFreePoints({
                    userId,
                    amount: GOLD_BONUS,
                    source: REASON.gold,
                    sourceRef: today,
                    once: true,
                });
                if (r.granted) {
                    grant.gold = GOLD_BONUS;
                    state = {
                        ...state,
                        cells: state.cells.map((c) => (c.date === today ? { ...c, gold: true } : c)),
                    };
                }
            }
        }

        /* today：画面はこの日付を覚える（端末の時計がずれていても、サーバーの日付で数える） */
        return NextResponse.json({ granted: daily.granted, grant, state, today });
    } catch {
        return NextResponse.json({ error: true }, { status: 500 });
    }
}
