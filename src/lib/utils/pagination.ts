/**
 * ============================================================
 * 原石航路 Studio
 * ページ送り用の組版
 *
 * 本文を「1 ページに収まる行のかたまり」に分ける。
 *
 * ブラウザに折り返させて高さを測る方法もあるが、
 * 端末ごとに結果が変わりページ番号が安定しない。
 * 日本語は等幅に近いので、文字数で割るほうが結果が揃う。
 * ============================================================
 */

export interface PageMetrics {
    /** 1 行に入る文字数 */
    charsPerLine: number;
    /** 1 ページに入る行数 */
    linesPerPage: number;
}

/**
 * 本文をページの配列にする。
 * 各ページは行の配列。
 */
export function paginate(text: string, metrics: PageMetrics): string[][] {
    const { charsPerLine, linesPerPage } = metrics;
    if (charsPerLine < 1 || linesPerPage < 1) return [[text]];

    const lines: string[] = [];

    for (const paragraph of text.replace(/\r\n/g, "\n").split("\n")) {
        if (paragraph.length === 0) {
            lines.push("");
            continue;
        }
        // 段落を 1 行に入る長さで切っていく
        const chars = Array.from(paragraph);
        for (let i = 0; i < chars.length; i += charsPerLine) {
            lines.push(chars.slice(i, i + charsPerLine).join(""));
        }
    }

    const pages: string[][] = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
        pages.push(lines.slice(i, i + linesPerPage));
    }

    return pages.length > 0 ? pages : [[""]];
}

/**
 * 表示領域の大きさと文字サイズから、1 ページに入る量を見積もる。
 * 縦書きは行が横に並ぶので、幅と高さの役割が入れ替わる。
 */
export function estimateMetrics(
    widthPx: number,
    heightPx: number,
    fontSizePx: number,
    lineHeight: number,
    isVertical: boolean,
): PageMetrics {
    const linePitch = fontSizePx * lineHeight;

    if (isVertical) {
        return {
            charsPerLine: Math.max(1, Math.floor(heightPx / fontSizePx)),
            linesPerPage: Math.max(1, Math.floor(widthPx / linePitch)),
        };
    }
    return {
        charsPerLine: Math.max(1, Math.floor(widthPx / fontSizePx)),
        linesPerPage: Math.max(1, Math.floor(heightPx / linePitch)),
    };
}
