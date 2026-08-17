/**
 * ============================================================
 * 原石航路 Studio
 * 原稿の一括取り込み
 *
 * 長い原稿を貼り付けて話に分ける。
 * 見出しの書き方は人によって違うので、
 * 「検出できたら使い、できなければ諦める」方針にしている。
 * 誤って 1 話に混ぜるより、分けすぎて手で直すほうが被害が小さい。
 * ============================================================
 */

export interface SplitOptions {
    /** 章見出し・シーン区切りを検出する */
    detectHeadings: boolean;
    /**
     * 「第◯章」をどう扱うか。
     *
     *   episode  1 話として切る（既定。「第一章＝1話」と書く人向け）
     *   chapter  章の見出しとして扱い、中の「第◯話」で切る
     *
     * 人によって意味が違う。「第一章」の下に第1話〜第5話が
     * 並ぶ書き方だと、話として切ると空の話ができてしまう。
     */
    chapterAs?: "episode" | "chapter";
}

export interface SplitResult {
    title: string;
    /** 属する章の名前。章として扱ったときだけ入る */
    chapterTitle?: string;
    body: string;
    charCount: number;
}

/**
 * 見出しとみなす行。
 *   第1話 / 第一話 / 第1章 / #1 / ◆ / ***
 * 行全体が短く、これらの形に合うものだけを拾う。
 */
const HEADING_PATTERNS: RegExp[] = [
    /^\s*第[0-9０-９一二三四五六七八九十百]+[話章節部幕]\s*[　\s].*$/,
    /^\s*第[0-9０-９一二三四五六七八九十百]+[話章節部幕]\s*$/,
    /^\s*[#＃]{1,3}\s*.+$/,
    /^\s*[◆◇■□●○※＊*]{1,3}\s*.*$/,
    /^\s*[-–—―ー=＝]{3,}\s*$/,
];

function isHeading(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;
    // 長い行は本文とみなす。見出しがこれ以上長いことは稀
    if (trimmed.length > 40) return false;
    return HEADING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** 見出し行から装飾を外してタイトルにする */
function toTitle(line: string): string {
    return line
        .trim()
        .replace(/^[#＃◆◇■□●○※＊*\s]+/, "")
        .replace(/[-–—―ー=＝\s]+$/, "")
        .trim();
}

function countChars(text: string): number {
    return Array.from(text.replace(/\r?\n/g, "")).length;
}

/**
 * 原稿を話に分ける。
 *
 * detectHeadings が false のとき、または見出しが 1 つも見つからないときは
 * 3 行以上の空行を区切りとして扱う。それも無ければ全体を 1 話にする。
 */
export function splitManuscript(raw: string, options: SplitOptions): SplitResult[] {
    const text = raw.replace(/\r\n/g, "\n").trim();
    if (text.length === 0) return [];

    if (options.detectHeadings) {
        /* 章を見出しとして扱うときは、そちらで切る */
        if (options.chapterAs === "chapter") {
            const withChapters = splitWithChapters(text);
            if (withChapters.length > 0) return withChapters;
        }

        const byHeading = splitByHeading(text);
        if (byHeading.length > 0) return byHeading;
    }

    const byBlank = splitByBlankLines(text);
    if (byBlank.length > 1) return byBlank;

    return [{ title: "", body: text, charCount: countChars(text) }];
}

/** 「第◯章」の行か */
function isChapterHeading(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > 40) return false;
    return /^\s*第[0-9０-９一二三四五六七八九十百]+[章部幕](\s|　|$)/.test(trimmed);
}

/**
 * 章を見出しとして扱い、中の話で切る。
 *
 * 章の行では切らない。切ると、その章の題だけの
 * 空の話ができてしまう。章の名前は覚えておき、
 * 中の話に添える。
 */
function splitWithChapters(text: string): SplitResult[] {
    const lines = text.split("\n");
    const chunks: { title: string; chapterTitle: string; lines: string[] }[] = [];
    let chapter = "";

    for (const line of lines) {
        if (isChapterHeading(line)) {
            chapter = toTitle(line);
            continue;
        }

        if (isHeading(line)) {
            chunks.push({ title: toTitle(line), chapterTitle: chapter, lines: [] });
            continue;
        }

        if (chunks.length === 0) {
            if (line.trim().length === 0) continue;
            chunks.push({ title: "", chapterTitle: chapter, lines: [] });
        }
        chunks[chunks.length - 1].lines.push(line);
    }

    if (chunks.length === 0) return [];

    return chunks
        .map((chunk) => {
            const body = chunk.lines.join("\n").trim();
            return {
                title: chunk.title,
                chapterTitle: chunk.chapterTitle || undefined,
                body,
                charCount: countChars(body),
            };
        })
        .filter((chunk) => chunk.body.length > 0 || chunk.title.length > 0);
}

function splitByHeading(text: string): SplitResult[] {
    const lines = text.split("\n");
    const chunks: { title: string; lines: string[] }[] = [];

    for (const line of lines) {
        if (isHeading(line)) {
            chunks.push({ title: toTitle(line), lines: [] });
            continue;
        }
        // 最初の見出しより前の本文は、見出しなしの 1 話として拾う
        if (chunks.length === 0) {
            if (line.trim().length === 0) continue;
            chunks.push({ title: "", lines: [] });
        }
        chunks[chunks.length - 1].lines.push(line);
    }

    // 見出しが 1 つも無かった、または全体が 1 かたまりなら失敗扱い
    if (chunks.length <= 1) return [];

    return chunks
        .map((chunk) => {
            const body = chunk.lines.join("\n").trim();
            return { title: chunk.title, body, charCount: countChars(body) };
        })
        .filter((chunk) => chunk.body.length > 0 || chunk.title.length > 0);
}

function splitByBlankLines(text: string): SplitResult[] {
    return text
        .split(/\n{3,}/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0)
        .map((body) => ({ title: "", body, charCount: countChars(body) }));
}

/**
 * ============================================================
 * 書き出し
 * ============================================================
 */

export interface ExportEpisode {
    ep_number: number;
    title: string;
    body: string;
}

/**
 * 全話を 1 つのプレーンテキストにまとめる。
 *
 * ルビの記法はそのまま残す。
 * 投稿サイトへ貼るときに必要だし、外すと読みの情報が消えてしまう。
 */
export function buildTxt(workTitle: string, episodes: ExportEpisode[]): string {
    const header = `${workTitle}\n\n`;
    const chapters = episodes.map((ep) => {
        const heading = ep.title.trim() ? `第${ep.ep_number}話　${ep.title}` : `第${ep.ep_number}話`;
        return `${heading}\n\n${ep.body}`;
    });
    return header + chapters.join("\n\n\n");
}

/** ブラウザにファイルを保存させる */
export function downloadTextFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}
