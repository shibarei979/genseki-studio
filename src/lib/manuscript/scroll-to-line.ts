/**
 * ============================================================
 * 原石航路 Studio
 * 本文の指定した行まで動かす
 *
 * 「行番号 × 行の高さ」では合わない。
 * textarea は長い行を折り返すので、
 * 何行目かと、画面上で何段目かは一致しない。
 *
 * そこで、同じ書式の写しを作って高さを測る。
 * 折り返しも同じように起きるので、実際の位置が分かる。
 * ============================================================
 */

/** 写しに移す書式。ここが違うと折り返しの位置がずれる */
const COPIED_STYLES = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textIndent",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "boxSizing",
    "writingMode",
    "textOrientation",
    "whiteSpace",
    "wordBreak",
    "overflowWrap",
] as const;

export interface JumpResult {
    /** 行の先頭が本文の何文字目か */
    start: number;
    /** その行の長さ */
    length: number;
}

/**
 * 指定した行を選んで、画面の中ほどに来るよう動かす。
 *
 * @param area  本文の textarea
 * @param line  1 から数えた行番号
 */
export function scrollToLine(area: HTMLTextAreaElement, line: number): JumpResult {
    const lines = area.value.split("\n");
    const index = Math.min(Math.max(1, line), lines.length) - 1;

    const start = lines
        .slice(0, index)
        .reduce((sum, row) => sum + row.length + 1, 0);
    const length = lines[index]?.length ?? 0;

    const offset = measureOffset(area, lines, index);
    const isVertical = getComputedStyle(area).writingMode.startsWith("vertical");

    if (isVertical) {
        /*
         * 縦書きは右から左へ進む。
         * scrollLeft は左端からの距離なので、右端から引く。
         */
        const fromRight = offset + area.clientWidth / 2;
        area.scrollLeft = Math.max(0, area.scrollWidth - fromRight);
    } else {
        area.scrollTop = Math.max(0, offset - area.clientHeight / 2);
    }

    area.focus({ preventScroll: true });
    area.setSelectionRange(start, start + length);

    return { start, length };
}

/**
 * その行の先頭が、本文の先頭から何ピクセル先にあるかを測る。
 * 折り返しを含めた実際の位置。
 */
function measureOffset(
    area: HTMLTextAreaElement,
    lines: string[],
    index: number,
): number {
    const computed = getComputedStyle(area);
    const mirror = document.createElement("div");

    for (const key of COPIED_STYLES) {
        mirror.style[key] = computed[key];
    }

    // 折り返しを textarea と同じにする
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.overflowWrap = "break-word";
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.pointerEvents = "none";
    mirror.style.top = "0";
    mirror.style.left = "-9999px";

    const isVertical = computed.writingMode.startsWith("vertical");
    if (isVertical) {
        // 縦書きは高さが折り返しを決める
        mirror.style.height = `${area.clientHeight}px`;
        mirror.style.width = "auto";
    } else {
        mirror.style.width = `${area.clientWidth}px`;
        mirror.style.height = "auto";
    }

    /*
     * 目当ての行の手前までを入れて測る。
     * 末尾に文字を 1 つ足すのは、
     * 改行だけで終わると最後の空行を数えない実装があるため。
     */
    mirror.textContent = `${lines.slice(0, index).join("\n")}\n\u200b`;
    document.body.appendChild(mirror);

    const offset = isVertical ? mirror.scrollWidth : mirror.scrollHeight;
    document.body.removeChild(mirror);

    return offset;
}
