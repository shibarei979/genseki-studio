/**
 * ============================================================
 * 原石航路 Studio
 * 見えている方の要素を探す
 *
 * ★ 話のページは、携帯用とパソコン用の 2 つの並びを同時に描き、
 *   CSS で片方を隠している。本文もコメントも 2 つずつある。
 *
 *   document.querySelector は先に見つけた方を返すので、
 *   携帯では隠れたパソコン側を掴み、そこへ送っても画面が動かなかった。
 *
 *   見えている方（offsetParent がある方）を返す。
 *   どちらも見えていなければ、最初の 1 つを返す（今までと同じ）。
 * ============================================================
 */
export function visibleElement(selector: string): HTMLElement | null {
    const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
    return all.find((el) => el.offsetParent !== null) ?? all[0] ?? null;
}

/** id で探す版。同じ id が 2 つあるときも、見えている方を返す */
export function visibleById(id: string): HTMLElement | null {
    return visibleElement(`[id="${id.replace(/["\\]/g, "\\$&")}"]`);
}
