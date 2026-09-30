/**
 * ============================================================
 * 原石航路 Studio
 * /api/mypage/milestones — まだ祝っていない節目
 *
 * GET   まだ見ていない節目を返す（大きい順）。
 *       作品と種類ごとに、いちばん大きいものだけを祝う。
 *       小さいものは skipKeys に入れて返す（見たことにする）。
 * POST  { keys: string[] } を「見た」にする。
 *
 * ★ 数え方は、ダッシュボードと同じ。
 *   作者自身の閲覧と、見回りの機械は数えない。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
    LIKE_STEPS,
    pvStepsUpTo,
    RANK_STEPS,
    milestoneKey,
    milestoneWeight,
    reachedSteps,
    type Milestone,
} from "@/lib/milestones";

export const dynamic = "force-dynamic";

/** いま祝う種類。いいね・ランキングを祝うときは、ここに足す */
const ENABLED: Milestone["kind"][] = ["pv"];

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ items: [], skipKeys: [] });

        const { data: novels } = await supabase
            .from("novels")
            .select("id, title")
            .eq("author_id", user.id)
            .is("deleted_at", null);
        const list = (novels ?? []) as { id: string; title: string }[];
        if (list.length === 0) return NextResponse.json({ items: [], skipKeys: [] });

        const novelIds = list.map((n) => n.id);
        const titleOf = new Map(list.map((n) => [n.id, n.title]));

        const [{ data: episodes }, { data: seenRows }, { data: ranks }] = await Promise.all([
            supabase.from("episodes").select("id, novel_id, is_published, posted_at, created_at").in("novel_id", novelIds),
            supabase.from("read_feedbacks").select("item_key").eq("user_id", user.id).like("item_key", "ms-%").limit(2000),
            supabase
                .from("ranking_history")
                .select("novel_id, period, rank")
                .eq("author_id", user.id)
                .lte("rank", 10)
                .limit(1000),
        ]);

        const seen = new Set((seenRows ?? []).map((r: { item_key: string }) => r.item_key));
        const epIdsByNovel: Record<string, string[]> = {};
        /* 作品の航海を始めた日。公開した話のうち、いちばん早く出したもの */
        const startedAt: Record<string, string> = {};
        for (const ep of (episodes ?? []) as { id: string; novel_id: string; is_published: boolean | null; posted_at: string | null; created_at: string | null }[]) {
            (epIdsByNovel[ep.novel_id] ||= []).push(ep.id);
            const at = ep.is_published ? ep.posted_at || ep.created_at : null;
            if (at && (!startedAt[ep.novel_id] || at < startedAt[ep.novel_id])) startedAt[ep.novel_id] = at;
        }

        /* 作品ごとの PV といいね。数だけ聞く */
        const counts = await Promise.all(
            list.map(async (novel) => {
                const ids = epIdsByNovel[novel.id] ?? [];
                const [pv, like] = await Promise.all([
                    ids.length
                        ? supabase
                              .from("page_views")
                              .select("*", { count: "exact", head: true })
                              .eq("is_author", false)
                              .or("is_bot.is.null,is_bot.eq.false")
                              .in("episode_id", ids)
                        : Promise.resolve({ count: 0 }),
                    supabase.from("likes").select("*", { count: "exact", head: true }).eq("novel_id", novel.id),
                ]);
                return { id: novel.id, pv: pv.count ?? 0, like: like.count ?? 0 };
            }),
        );

        const items: Milestone[] = [];
        const skipKeys: string[] = [];

        /* 数の節目。作品と種類ごとに、まだ見ていない中でいちばん大きいものだけ */
        const pushSteps = (kind: "pv" | "like", novelId: string, steps: number[], actual: number) => {
            const unseen = reachedSteps(steps, actual).filter((v) => !seen.has(milestoneKey(kind, novelId, v)));
            if (unseen.length === 0) return;
            const top = unseen[unseen.length - 1];
            items.push({
                key: milestoneKey(kind, novelId, top),
                kind,
                novelId,
                novelTitle: titleOf.get(novelId) ?? "",
                value: top,
                actual,
                weight: milestoneWeight(kind, top),
                startedAt: startedAt[novelId],
            });
            for (const v of unseen.slice(0, -1)) skipKeys.push(milestoneKey(kind, novelId, v));
        };
        for (const c of counts) {
            pushSteps("pv", c.id, pvStepsUpTo(c.pv), c.pv);
            pushSteps("like", c.id, LIKE_STEPS, c.like);
        }

        /* ランキング。作品と期間ごとに、いちばん良い順位 */
        const best = new Map<string, { novelId: string; period: string; rank: number }>();
        for (const r of (ranks ?? []) as { novel_id: string; period: string; rank: number }[]) {
            if (!titleOf.has(r.novel_id)) continue;
            const k = `${r.novel_id}|${r.period}`;
            const cur = best.get(k);
            if (!cur || r.rank < cur.rank) best.set(k, { novelId: r.novel_id, period: r.period, rank: r.rank });
        }
        best.forEach(({ novelId, period, rank }) => {
            /* 届いた段（10位以内 → 3位以内 → 1位）。大きい順に並ぶので、最後がいちばん上 */
            const reached = RANK_STEPS.filter((step) => rank <= step);
            const unseen = reached.filter((v) => !seen.has(milestoneKey("rank", novelId, v, period)));
            if (unseen.length === 0) return;
            const top = unseen[unseen.length - 1];
            items.push({
                key: milestoneKey("rank", novelId, top, period),
                kind: "rank",
                novelId,
                novelTitle: titleOf.get(novelId) ?? "",
                value: top,
                actual: rank,
                period,
                weight: milestoneWeight("rank", top),
            });
            for (const v of unseen.slice(0, -1)) skipKeys.push(milestoneKey("rank", novelId, v, period));
        });

        items.sort((a, b) => b.weight - a.weight);

        /*
         * ★ いまは PV だけ祝う（いいね・ランキングは出さない）。
         *   出さないものは「見た」にもしない。あとで祝うことにしたとき、ちゃんと出るように。
         */
        const shown = items.filter((m) => ENABLED.includes(m.kind));
        const shownSkips = skipKeys.filter((k) => ENABLED.some((kind) => k.startsWith(`ms-${kind}-`)));
        return NextResponse.json({ items: shown, skipKeys: shownSkips });
    } catch {
        /* 祝えなくても、ほかの邪魔はしない */
        return NextResponse.json({ items: [], skipKeys: [] });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ ok: false }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        const keys = (Array.isArray(body?.keys) ? body.keys : [])
            .map((k: unknown) => String(k))
            .filter((k: string) => k.startsWith("ms-") && k.length <= 200)
            .slice(0, 200);
        if (keys.length === 0) return NextResponse.json({ ok: true });

        /* すでに見たものは入れ直さない */
        const { data: already } = await supabase
            .from("read_feedbacks")
            .select("item_key")
            .eq("user_id", user.id)
            .in("item_key", keys);
        const have = new Set((already ?? []).map((r: { item_key: string }) => r.item_key));
        const rows = keys.filter((k: string) => !have.has(k)).map((k: string) => ({ user_id: user.id, item_key: k }));
        if (rows.length > 0) await supabase.from("read_feedbacks").insert(rows);

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false });
    }
}
