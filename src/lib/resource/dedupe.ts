/**
 * ============================================================
 * 原石航路 Studio
 * 同じ名前のものをまとめる
 *
 * すでに並んでしまった重複を、あとから片付けるための処理。
 * 抽出の側でも防いでいるが、以前に拾ったものは残っている。
 *
 * 残すのは、中身が一番多いもの。
 * 名前だけのものを残して説明つきを消すと、書いた情報が失われる。
 * ============================================================
 */

import type { ResourceEntry } from "@/types";

export interface DuplicateGroup {
    /** 残すもの */
    keep: ResourceEntry;
    /** 消すもの */
    drop: ResourceEntry[];
    name: string;
}

/** 名前の揺れをならす。中黒・空白・記号の有無だけの違いを同じとみなす */
export function normalizeName(name: string): string {
    return name
        .trim()
        .replace(/[\s　・．。、,.\-—―ー]/g, "")
        .toLowerCase();
}

/** どれだけ中身が入っているか。多いほうを残す */
function weightOf(entry: ResourceEntry): number {
    const values = Object.values(entry.values ?? {}).filter((value) => {
        if (typeof value === "string") return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return value !== undefined && value !== null;
    });

    return (
        values.length * 10 +
        entry.summary.trim().length +
        (entry.aliases?.length ?? 0) * 5 +
        (entry.image_url ? 20 : 0) +
        (entry.is_major ? 3 : 0)
    );
}

/**
 * 同じ名前のかたまりを探す。
 * 承認済みのものだけを見る。候補はまだ資料ではない。
 */
export function findDuplicates(entries: ResourceEntry[]): DuplicateGroup[] {
    const buckets = new Map<string, ResourceEntry[]>();

    for (const entry of entries) {
        if (entry.candidate_status !== "none") continue;
        const key = normalizeName(entry.name);
        if (!key) continue;
        buckets.set(key, [...(buckets.get(key) ?? []), entry]);
    }

    const groups: DuplicateGroup[] = [];

    for (const rows of Array.from(buckets.values())) {
        if (rows.length < 2) continue;
        const sorted = [...rows].sort((a, b) => weightOf(b) - weightOf(a));
        groups.push({
            keep: sorted[0],
            drop: sorted.slice(1),
            name: sorted[0].name,
        });
    }

    return groups.sort((a, b) => b.drop.length - a.drop.length);
}

/**
 * まとめたあとの中身を作る。
 * 消すほうに入っていて、残すほうが空の欄は引き継ぐ。
 * 消す前に中身を移しておかないと、書いたものが失われる。
 */
export function mergeInto(group: DuplicateGroup): Partial<ResourceEntry> {
    const values: Record<string, unknown> = { ...(group.keep.values ?? {}) };
    const aliases = new Set(group.keep.aliases ?? []);
    let summary = group.keep.summary;
    let imageUrl = group.keep.image_url;

    for (const row of group.drop) {
        for (const [key, value] of Object.entries(row.values ?? {})) {
            const current = values[key];
            const isEmpty =
                current === undefined ||
                current === null ||
                (typeof current === "string" && current.trim() === "") ||
                (Array.isArray(current) && current.length === 0);
            if (isEmpty) values[key] = value;
        }

        for (const alias of row.aliases ?? []) aliases.add(alias);
        // 名前そのものが違う書き方なら、別名として残す
        if (row.name !== group.keep.name) aliases.add(row.name);

        if (!summary.trim() && row.summary.trim()) summary = row.summary;
        if (!imageUrl && row.image_url) imageUrl = row.image_url;
    }

    return {
        values: values as ResourceEntry["values"],
        aliases: Array.from(aliases),
        summary,
        image_url: imageUrl,
        is_major: group.keep.is_major || group.drop.some((row) => row.is_major),
    };
}
