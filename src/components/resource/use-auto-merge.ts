/**
 * ============================================================
 * 原石航路 Studio
 * useAutoMerge — 同じ名前のものを自動でまとめる
 *
 * 尋ねない。
 *
 * 「6組・28件が重複しています」と出しても、
 * 中身を1つずつ見比べる人はいない。
 * 同じ名前なら同じものなので、黙ってまとめる。
 *
 * 消えたほうの名前は別名として残るので、
 * 取り違えても本文からは辿れる。
 * ============================================================
 */

"use client";

import { useEffect, useRef } from "react";

import { findDuplicates } from "@/lib/resource/dedupe";
import type { ResourceEntry } from "@/types";
import type { DuplicateGroup } from "@/lib/resource/dedupe";

export function useAutoMerge(
    entries: ResourceEntry[],
    onMerge: (group: DuplicateGroup) => void,
) {
    /*
     * まとめた組を覚えておく。
     *
     * まとめると entries が変わり、この処理がまた走る。
     * 覚えていないと、同じ組を何度も送ることになる。
     */
    const doneRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const groups = findDuplicates(entries);

        for (const group of groups) {
            if (doneRef.current.has(group.keep.id)) continue;
            doneRef.current.add(group.keep.id);
            onMerge(group);
        }
    }, [entries, onMerge]);
}
