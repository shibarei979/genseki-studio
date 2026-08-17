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
    /*
     * 「第◯話」「◯話」。
     *
     * 題との区切りは空白とは限らない。
     * 「第1話：始まり」「第1話.始まり」「第1話-始まり」も拾う。
     * 以前は空白だけを見ていて、これらを本文として扱っていた。
     */
    /^\s*[・◆◇■□●○※＊*☆★]{0,2}\s*第?[0-9０-９一二三四五六七八九十百千]+\s*[話章節部幕][\s　:：.．,、。・\-–—ー|｜]*.*$/,

    /*
     * 「プロローグ」「エピローグ」など。
     * 頭に「・」や「◆」が付いていても拾う。
     * 「・プロローグ」と書く人が多いため。
     */
    /^\s*[・◆◇■□●○※＊*☆★（(【\[]{0,2}\s*(プロローグ|エピローグ|エンドロール|オープニング|エンディング|序章|終章|終幕|幕間|間章|閑話|外伝|番外編|番外|後日談|前日譚|あとがき|後書き|まえがき|前書き|おまけ|付録|設定資料)\s*[)）】\]]?\s*([　\s:：.．\-–—][^\n]*)?$/,

    /*
     * 記号の区切り。
     *
     * 「・彼は言った」「※注意」まで見出しとして切っていた。
     * 小説では、記号で始まる行はいくらでもある。
     * 場面ごとに切られて、2,300 行の原稿が
     * 4,200 話になるという報告があった。
     *
     * 記号だけの行に限る。あとに文が続くものは本文とみなす。
     * 「#」で始まる書き方だけは、見出しの印として広く使われて
     * いるので、そのまま残す。
     */
    /^\s*[#＃]{1,3}\s+.+$/,
    /^\s*[◆◇■□●○※＊*☆★]{1,5}\s*$/,
    /^\s*[-–—―ー=＝~〜_＿]{3,}\s*$/,
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
/**
 * 手で入れた切り印。
 *
 * 画面から「ここで切る」で挟む印。
 * 自動の見分けより、手で指したほうを必ず優先する。
 * 指したのに変わらなければ、指す意味がない。
 */
export const SPLIT_MARK = "──── ここで切る ────";

/**
 * 切ったほうがよさそうな場所を探す。
 *
 * 見出しらしい行が無い原稿でも、
 * 空行が続く所や、場面の変わり目らしい所はある。
 * 「ここで切れます」と示せれば、自分で探さずに済む。
 *
 * 返すのは、その行が本文の何文字目から始まるか。
 */
export function suggestSplitPoints(raw: string): {
    at: number;
    label: string;
    preview: string;
}[] {
    const text = raw.replace(/\r\n/g, "\n");
    if (text.trim().length === 0) return [];

    const lines = text.split("\n");
    const found: { at: number; label: string; preview: string }[] = [];

    let cursor = 0;
    let blankRun = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.length === 0) {
            blankRun++;
            cursor += line.length + 1;
            continue;
        }

        /* 見出しらしい行 */
        if (isHeading(line)) {
            found.push({
                at: cursor,
                label: "見出しらしい行",
                preview: trimmed.slice(0, 24),
            });
        } else if (blankRun >= 2) {
            /*
             * 空行が 2 つ以上続いたあと。
             * 書き手が場面を分けた印であることが多い。
             */
            found.push({
                at: cursor,
                label: "空行のあと",
                preview: trimmed.slice(0, 24),
            });
        }

        blankRun = 0;
        cursor += line.length + 1;
    }

    /* 多すぎても選べない。上から 12 個まで */
    return found.slice(0, 12);
}

export function splitManuscript(raw: string, options: SplitOptions): SplitResult[] {
    const text = raw.replace(/\r\n/g, "\n").trim();
    if (text.length === 0) return [];

    /* 手で切った所があれば、まずそこで分ける */
    if (text.includes(SPLIT_MARK)) {
        const pieces = text
            .split(SPLIT_MARK)
            .map((piece) => piece.trim())
            .filter((piece) => piece.length > 0);

        if (pieces.length > 0) {
            return pieces.map((piece) => {
                /*
                 * かたまりの頭が見出しなら、それを題にする。
                 * 手で切った所でも、題は拾えたほうがよい。
                 */
                const lines = piece.split("\n");
                const first = (lines[0] ?? "").trim();

                /*
                 * 見出しの形なら、それを題にする。
                 *
                 * 加えて、頭の行が短くて次に本文が続くときも
                 * 題として拾う。「選んだ所で切る」で置いた
                 * 題名は「第◯話」の形とは限らないため。
                 * 30 字までにするのは、本文の 1 行目を
                 * 誤って題にしないため。
                 */
                const looksLikeTitle =
                    isHeading(first) ||
                    (first.length > 0 &&
                        first.length <= 30 &&
                        lines.length > 1 &&
                        lines.slice(1).join("").trim().length > 0);

                if (looksLikeTitle) {
                    const body = lines.slice(1).join("\n").trim();
                    return {
                        title: toTitle(first),
                        body,
                        charCount: countChars(body),
                    };
                }
                return { title: "", body: piece, charCount: countChars(piece) };
            });
        }
    }

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

/** 空行で切るときの、最低の空行数 */
const BLANK_LINES_TO_SPLIT = 4;

/**
 * 空行で切ったとき、これを超えたら切りすぎとみなす。
 *
 * 見出しで切れたものには効かない。
 * 空行だけで何百話にもなるのは、まず書き方の癖であって
 * 話の切れ目ではない。
 */
const TOO_MANY_PIECES = 200;

/**
 * 一度に取り込める話の上限。
 *
 * これ以上は、送るのも読むのも時間がかかりすぎる。
 * 超えるぶんは切り捨てず、画面で知らせて分けてもらう。
 */
export const MAX_IMPORT_EPISODES = 5000;

function splitByBlankLines(text: string): SplitResult[] {
    /*
     * 空行で切る。
     *
     * 以前は空行 2 つで切っていた。
     * だが小説では場面の変わり目に空行を 2 つ空けるのが普通で、
     * 場面ごとに全部切られてしまう。
     * 「2,300 行の原稿が 4,200 話になる」という報告がこれ。
     *
     * 4 つ以上に上げる。ここまで空けるのは、
     * 話の切れ目のつもりで空けたときぐらい。
     */
    const pieces = text
        .split(new RegExp(`\\n{${BLANK_LINES_TO_SPLIT + 1},}`))
        .map((block) => block.trim())
        .filter((block) => block.length > 0);

    /*
     * それでも切れすぎたら、切らない。
     *
     * 空行の使い方は書き手によってまるで違う。
     * 何百話にも刻まれるより、1 話のまま渡して
     * 「ここで切る」で指してもらうほうが早い。
     */
    if (pieces.length > TOO_MANY_PIECES) {
        const body = text.trim();
        return [{ title: "", body, charCount: countChars(body) }];
    }

    return pieces.map((body) => ({
        title: "",
        body,
        charCount: countChars(body),
    }));
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
        /* 書き出しも題名をそのまま。取り込み直すときの切れ目にもなる */
        const heading = ep.title.trim() || `${ep.ep_number}話`;
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
