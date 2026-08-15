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
 * そこで今は尋ねる。
 *   はい    別名として 1 つにまとめる（今までと同じ）
 *   いいえ  別々のまま。その組は二度と訊かない
 *
 * 断った組は覚えておく。覚えないと、一覧を開くたびに
 * 同じことを訊かれる。
 * ============================================================
 */

"use client";

import { useEffect, useRef } from "react";

import { findDuplicates } from "@/lib/resource/dedupe";
import type { ResourceEntry } from "@/types";
import type { DuplicateGroup } from "@/lib/resource/dedupe";

/** 断った組の覚え。頁を開き直しても残るよう、端末に置く */
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
            handledRef.current.add(key);

            const names = group.drop.map((row) => row.name).join("」「");
            const ok = window.confirm(
                `「${names}」と「${group.keep.name}」は同じものですか？\n\n` +
                    `はい　　1 つにまとめます。「${names}」は別名として残り、\n` +
                    `　　　　以後は本文に出ても同じものとして数えられます。\n` +
                    `いいえ　別々のままにします。この組は二度と訊きません。`,
            );

            if (ok) {
                onMerge(group);
            } else {
                declined.add(key);
                saveDeclined(declined);
            }
        }
    }, [entries, onMerge]);
}
