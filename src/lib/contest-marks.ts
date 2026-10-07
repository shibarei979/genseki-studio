/**
 * ============================================================
 * 原石航路 Studio
 * コンテストの応募の印（作品ごと）
 *
 *   作品カード・表紙・作品ページに「応募中」を出すために、
 *   作品の id から、その作品が出しているコンテストを引く。
 *
 * ★ 出すのは、公開しているコンテストの、募集中と審査中だけ。
 *   準備中・非公開は出さない。結果発表のあとも出さない（終わった応募の印は要らない）。
 * ★ 1 つの作品が何本も出していることがある。作品ごとに配列で返す。
 *   並びは「募集中 → 審査中」。カードには先頭の 1 つだけ出す。
 * ★ 読むのは誰でも読める表だけ（コンテストの応募作の一覧と同じもの）。
 * ============================================================
 */

import type { ContestStatus } from "@/types/contest";

export interface ContestMark {
    id: string;
    title: string;
    status: "open" | "judging";
}

/** まだ終わっていないものか（いまは終わったものを読まないので、いつも true。念のため残す） */
export function isLiveMark(mark: ContestMark | null | undefined): mark is ContestMark {
    return !!mark && (mark.status === "open" || mark.status === "judging");
}

const STATUS_ORDER: Record<ContestMark["status"], number> = { open: 0, judging: 1 };

/** 表紙・カードに出す短い言葉 */
export const CONTEST_MARK_LABEL: Record<ContestMark["status"], string> = {
    open: "応募中",
    judging: "審査中",
};

/** そのコンテストの応募作を探す住所（タグで探すのと同じ使い方） */
export function contestSearchHref(contestId: string): string {
    return `/search?contest=${encodeURIComponent(contestId)}`;
}

type Client = { from: (table: string) => any };

/**
 * 作品の id → その作品が出しているコンテスト
 *
 * 失敗しても画面は出したいので、そのときは空で返す。
 */
export async function contestMarksFor(
    supabase: Client,
    novelIds: string[],
): Promise<Record<string, ContestMark[]>> {
    const ids = Array.from(new Set(novelIds.filter(Boolean)));
    if (ids.length === 0) return {};

    try {
        const { data: entries } = await supabase
            .from("contest_entries")
            .select("novel_id, contest_id")
            .in("novel_id", ids);
        const rows = (entries ?? []) as { novel_id: string; contest_id: string }[];
        if (rows.length === 0) return {};

        const contestIds = Array.from(new Set(rows.map((r) => r.contest_id)));
        const { data: contests } = await supabase
            .from("contests")
            .select("id, title, status")
            .in("id", contestIds)
            .eq("is_published", true);

        const byId = new Map<string, ContestMark>();
        for (const c of (contests ?? []) as { id: string; title: string; status: ContestStatus }[]) {
            if (c.status !== "open" && c.status !== "judging") continue;
            byId.set(c.id, { id: c.id, title: c.title, status: c.status });
        }

        const result: Record<string, ContestMark[]> = {};
        for (const row of rows) {
            const mark = byId.get(row.contest_id);
            if (!mark) continue;
            const list = (result[row.novel_id] ??= []);
            if (!list.some((m) => m.id === mark.id)) list.push(mark);
        }
        for (const list of Object.values(result)) {
            list.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        }
        return result;
    } catch {
        return {};
    }
}

/** カード用：まだ終わっていない応募のうち、先頭の 1 つ */
export function liveMarkOf(marks: Record<string, ContestMark[]>, novelId: string): ContestMark | null {
    const first = marks[novelId]?.[0];
    return isLiveMark(first) ? first : null;
}
