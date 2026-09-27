/**
 * ============================================================
 * 原石航路 Studio
 * 話・章ごとの関係図 — ある話の時点で、図に何を出すか
 *
 * ★ 人：本文に初めて出た話より前は出さない。
 *   本文にまだ一度も出ていない人（資料にだけいる人）は、どの時点でも出す。
 *   消えると「どこへ行った？」になる。章の絞り込みと同じ考え方。
 *
 * ★ 関係：両側の人が出ているときだけ出す。
 *   名前は「関係の変化」のうち、その話までに起きたいちばん新しいもの。
 *   まだ変化が起きていなければ、結んだときの名前。
 *
 * ★ 変化の「いつ」は自由に書ける欄なので、読めるものだけ使う。
 *   ・話の題名そのもの（「灯台」）、題名の頭（「第5話」→「第5話 灯台」）
 *   ・「5話」「第五話」 → 前から 5 番目の話
 *   読めないもの（「再会のあと」など）は、時点の図では使わない。
 * ============================================================
 */

import type { Episode, ResourceEntry, ResourceRelation } from "@/types";

const KANJI_DIGIT: Record<string, number> = {
    〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 「12」「１２」「十二」「百二十」を数に */
function readNumber(text: string): number | null {
    const half = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    if (/^\d+$/.test(half)) return Number(half);

    let total = 0;
    let current = 0;
    for (const char of text) {
        if (char in KANJI_DIGIT) current = KANJI_DIGIT[char];
        else if (char === "十") {
            total += (current || 1) * 10;
            current = 0;
        } else if (char === "百") {
            total += (current || 1) * 100;
            current = 0;
        } else return null;
    }
    return total + current || null;
}

/**
 * 「いつ」を、話の並びの何番目（0 から）に直す。読めなければ null。
 * episodes は読む順に並べて渡す。
 */
export function resolveEpisodeAt(at: string, episodes: Pick<Episode, "title">[]): number | null {
    const text = at.trim();
    if (!text) return null;

    const exact = episodes.findIndex((episode) => episode.title.trim() === text);
    if (exact !== -1) return exact;

    if (text.length >= 2) {
        const head = episodes.findIndex((episode) => episode.title.trim().startsWith(text));
        if (head !== -1) return head;
    }

    const hit = /^第?\s*([0-9０-９〇一二三四五六七八九十百]+)\s*話/.exec(text);
    if (hit) {
        const n = readNumber(hit[1]);
        if (n !== null && n >= 1 && n <= episodes.length) return n - 1;
    }
    return null;
}

/**
 * 人ごとに、本文に初めて出た話（0 から）。一度も出ていなければ入れない。
 * 名前と呼び名をそのまま探す。数え方は軽くしておく（全員・全話を見るので）。
 */
export function firstAppearances(
    entries: Pick<ResourceEntry, "id" | "name" | "aliases">[],
    episodes: Pick<Episode, "body">[],
): Map<string, number> {
    const map = new Map<string, number>();
    for (const entry of entries) {
        const words = [entry.name, ...(entry.aliases ?? [])]
            .map((word) => word.trim())
            .filter((word) => word.length > 0);
        if (words.length === 0) continue;
        const index = episodes.findIndex((episode) =>
            words.some((word) => (episode.body ?? "").includes(word)),
        );
        if (index !== -1) map.set(entry.id, index);
    }
    return map;
}

export interface RelationAtPoint {
    entries: ResourceEntry[];
    /** 名前を、その時点のものに差し替えたもの */
    relations: ResourceRelation[];
    /** この話で初めて出た人 */
    newcomers: ResourceEntry[];
    /** この話で名前が変わった関係 */
    changed: { relation: ResourceRelation; before: string; after: string }[];
}

/**
 * upTo 番目（0 から）の話までを読んだ時点の図。
 */
export function relationsAt(
    entries: ResourceEntry[],
    relations: ResourceRelation[],
    episodes: Pick<Episode, "title">[],
    first: Map<string, number>,
    upTo: number,
): RelationAtPoint {
    const shown = entries.filter((entry) => {
        const at = first.get(entry.id);
        return at === undefined || at <= upTo;
    });
    const shownIds = new Set(shown.map((entry) => entry.id));

    const labelAt = (relation: ResourceRelation, point: number): string => {
        let label = relation.label;
        let best = -1;
        relation.changes.forEach((change) => {
            const at = resolveEpisodeAt(change.at, episodes);
            if (at !== null && at <= point && at >= best) {
                best = at;
                label = change.label;
            }
        });
        return label;
    };

    const changed: RelationAtPoint["changed"] = [];
    const nextRelations = relations
        .filter((relation) => shownIds.has(relation.from_entry_id) && shownIds.has(relation.to_entry_id))
        .map((relation) => {
            const after = labelAt(relation, upTo);
            const before = upTo > 0 ? labelAt(relation, upTo - 1) : relation.label;
            const changedHere = relation.changes.some(
                (change) => resolveEpisodeAt(change.at, episodes) === upTo,
            );
            if (changedHere) changed.push({ relation, before, after });
            return after === relation.label ? relation : { ...relation, label: after };
        });

    return {
        entries: shown,
        relations: nextRelations,
        /* 関係図に線の無い項目（出来事・場所など）は、初登場に数えない。図に出てこない */
        newcomers: shown.filter(
            (entry) =>
                first.get(entry.id) === upTo &&
                relations.some(
                    (relation) => relation.from_entry_id === entry.id || relation.to_entry_id === entry.id,
                ),
        ),
        changed,
    };
}
