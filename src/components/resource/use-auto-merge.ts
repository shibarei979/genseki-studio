/**
 * ============================================================
 * 原石航路 Studio
 * useAutoMerge — 同じ名前のものを見つけて尋ねる
 *
 * 昔は尋ねずにまとめていた。
 * だがそれだと、名前を打ち替えただけで中身が吸われる。
 * 「ワイ」を「律」に直した瞬間、既にいる律にまとめられ、
 * 書いたものが移ってしまう。名前を直すのと、
 * 同じ人だと決めるのは、別の話。
 *
 * ★ 窓で尋ねるのは、やめた。
 *
 *   重複の数だけ窓が順に出ていた。
 *   20 組あれば 20 回。押し終えるまで先へ進めない。
 *   「何度もクリックするのが面倒」という声は、これ。
 *
 * ★ 本文から入ってきたものは、黙ってまとめる。
 *
 *   あれは機械が拾った候補で、作者が書いたものではない。
 *   吸われて困る中身が、そもそも入っていない。
 *   名前が同じなら、同じものとして扱ってよい。
 *
 * ★ 作者が自分で作ったものは、まとめない。
 *
 *   「ワイ」を「律」に直した瞬間に中身が吸われる、
 *   という事故はここで防ぐ。
 *   そちらは画面の帯（DuplicateStrip）に出す。
 *   帯には「すべてまとめる」があるので、
 *   まとめたい人は一押しで済む。
 * ============================================================
 */

"use client";

import { useEffect, useRef } from "react";

import { findDuplicates } from "@/lib/resource/dedupe";
import type { ResourceEntry } from "@/types";
import type { DuplicateGroup } from "@/lib/resource/dedupe";

/*
 * 断った組の覚え。
 *
 * ★ 窓で尋ねるのはやめたが、覚えは残す。
 *   前に「別もの」と答えた組を、今になって
 *   黙ってまとめてしまうと、約束が違う。
 */
const DECLINED_KEY = "genseki:merge-declined";

function loadDeclined(): Set<string> {
    try {
        const raw = window.localStorage.getItem(DECLINED_KEY);
        return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
        return new Set<string>();
    }
}

function saveDeclined(keys: Set<string>) {
    try {
        window.localStorage.setItem(
            DECLINED_KEY,
            JSON.stringify(Array.from(keys)),
        );
    } catch {
        /* 端末に置けなくても、その場では覚えている */
    }
}

/** 組の合言葉。同じ 2 つなら、どちらから見ても同じ言葉になる */
function keyOf(group: DuplicateGroup): string {
    return [group.keep.id, ...group.drop.map((row) => row.id)].sort().join("|");
}

export function useAutoMerge(
    entries: ResourceEntry[],
    onMerge: (group: DuplicateGroup) => void,
) {
    /* この画面で扱い終えた組。尋ねている間に何度も出さないため */
    const handledRef = useRef<Set<string>>(new Set());
    const declinedRef = useRef<Set<string> | null>(null);

    useEffect(() => {
        if (!declinedRef.current) declinedRef.current = loadDeclined();
        const declined = declinedRef.current;

        for (const group of findDuplicates(entries)) {
            const key = keyOf(group);
            if (handledRef.current.has(key) || declined.has(key)) continue;

            /*
             * 消えるほうが、すべて本文から拾った候補か。
             *
             * ★ 1 つでも作者が書いたものが混じっていれば、まとめない。
             *   書いたものが黙って移るのが、いちばん困る。
             */
            const allFromText = group.drop.every(
                (row) => row.candidate_source || row.candidate_status !== "none",
            );

            if (!allFromText) continue;

            handledRef.current.add(key);
            onMerge(group);
        }
    }, [entries, onMerge]);
}
