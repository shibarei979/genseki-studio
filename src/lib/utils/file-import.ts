/**
 * ============================================================
 * 原石航路 Studio
 * ファイルからの原稿読み込み
 *
 * 対応: .txt / .md（文字コード自動判定）, .pdf
 *
 * PDF は pdfjs-dist を動的 import で読む。
 * 初期表示に不要な重いライブラリを、
 * PDF を選んだ人にだけ読み込ませるため。
 * ============================================================
 */

export interface ImportedText {
    text: string;
    /** 判定に使った文字コード。テキストファイルのときだけ入る */
    encoding?: string;
}

/**
 * テキストファイルを読む。
 *
 * 日本語の原稿は Shift_JIS で保存されていることがまだ多い。
 * UTF-8 として読んで化けたら Shift_JIS で読み直す。
 */
export async function readTextFile(file: File): Promise<ImportedText> {
    const buffer = await file.arrayBuffer();

    const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    // U+FFFD（置換文字）が多いときは UTF-8 ではないと判断する
    const brokenCount = (utf8.match(/\ufffd/g) ?? []).length;
    if (brokenCount === 0) return { text: utf8, encoding: "UTF-8" };

    try {
        const sjis = new TextDecoder("shift_jis", { fatal: false }).decode(buffer);
        const sjisBroken = (sjis.match(/\ufffd/g) ?? []).length;
        if (sjisBroken < brokenCount) return { text: sjis, encoding: "Shift_JIS" };
    } catch {
        // shift_jis に対応していない環境では UTF-8 の結果を返す
    }

    return { text: utf8, encoding: "UTF-8" };
}

/**
 * pdfjs-dist のうち、この画面で使う部分だけの型。
 *
 * ライブラリ本体の型は巨大で、バージョンが上がるたびに形が変わる。
 * 使う 4 つだけをここに書いておけば、更新の影響がここで止まる。
 */
interface PdfTextItem {
    str?: string;
}

interface PdfPage {
    getTextContent(): Promise<{ items: PdfTextItem[] }>;
}

interface PdfDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPage>;
}

interface PdfjsModule {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument(options: { data: ArrayBuffer }): { promise: Promise<PdfDocument> };
}

/**
 * PDF からテキストを取り出す。
 *
 * PDF は「どこに何の字を置くか」しか持っていないため、
 * 段落や改行が原稿どおりに戻るとは限らない。
 * 取り込んだあとに手直しが要ることを利用者に伝えること。
 */

/**
 * 縦書き用の字を、ふつうの字へ戻す。
 *
 * ★ 縦書きで作られた PDF は、括弧や句読点が
 *   「縦書き用の別の字」で埋め込まれている。
 *
 *   ﹁白書の魔女﹂水瀬透  ← 取り込んだまま
 *   「白書の魔女」水瀬透  ← 直したあと
 *
 *   見た目が似ているので気づきにくいが、別の字なので
 *   置き換えも検索も効かず、横書きで読むと形が崩れる。
 */
const VERTICAL_FORMS: Record<string, string> = {
    "\uFE41": "「", "\uFE42": "」",
    "\uFE43": "『", "\uFE44": "』",
    "\uFE10": "、", "\uFE12": "。",
    "\uFE11": "、",
    "\uFE35": "（", "\uFE36": "）",
    "\uFE37": "｛", "\uFE38": "｝",
    "\uFE39": "〔", "\uFE3A": "〕",
    "\uFE3B": "【", "\uFE3C": "】",
    "\uFE3D": "《", "\uFE3E": "》",
    "\uFE3F": "〈", "\uFE40": "〉",
    "\uFE47": "［", "\uFE48": "］",
    "\uFE19": "…",
    "\uFE31": "―", "\uFE32": "―",
    "\uFE30": "…",
};

export function normalizeVerticalForms(text: string): string {
    return text.replace(
        /[\uFE10-\uFE19\uFE30-\uFE48]/g,
        (ch) => VERTICAL_FORMS[ch] ?? ch,
    );
}


/**
 * 行の切れ目を作り直す。
 *
 * ★ PDF は「どこで改行していたか」を持っていない。
 *
 *   文字と、その位置しか入っていない。
 *   そのまま取り出すと、1 話ぶんが 1 行に繋がってしまう。
 *   切れ目の提案も、行の頭を見ているので何も見つけられない。
 *
 * ★ 日本語の小説は、句点と閉じ括弧で行が変わる。
 *
 *   そこで切ると、元の原稿にかなり近い形へ戻る。
 *   完全ではないので、取り込んだあとの手直しは前提にする。
 *
 * ★ 見出しは、前後で行を分ける。
 *
 *   「・プロローグここは……」のように、
 *   見出しと本文が繋がってしまうため。
 */
const HEADING_WORDS =
    "プロローグ|エピローグ|エンドロール|オープニング|エンディング|序章|終章|終幕|幕間|間章|閑話|外伝|番外編|番外|後日談|前日譚|あとがき|後書き|まえがき|前書き";

export function restoreLineBreaks(text: string): string {
    let out = text;

    /* 句点・感嘆符のあと。閉じ括弧が続くときは切らない */
    out = out.replace(/([。！？])(?![」』）\)】〉》。！？、])/g, "$1\n");

    /* 閉じ括弧のあと。句読点や別の閉じ括弧が続くときは切らない */
    out = out.replace(/([」』])(?![。、！？」』）\)】〉》])/g, "$1\n");

    /* 見出しは前後で分ける。「第◯章『題』」は題まで含めて 1 行に */
    out = out.replace(
        new RegExp(
            `[・◆◇■□●○]?\\s*(第?[0-9０-９一二三四五六七八九十百千]+\\s*[話章節部幕](?:\\s*[『「][^』」]{0,40}[』」])?|${HEADING_WORDS})`,
            "g",
        ),
        "\n\n$1\n",
    );

    /* 空行は 2 つまで。無駄に間延びさせない */
    out = out.replace(/\n{3,}/g, "\n\n");

    return out
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .trim();
}

export async function readPdfFile(file: File): Promise<ImportedText> {
    // 初期表示に不要な重いライブラリなので、PDF を選んだ人にだけ読み込ませる
    // @ts-ignore -- npm install 前でも型チェックが通るようにする
    const pdfjs = (await import("pdfjs-dist")) as unknown as PdfjsModule;

    /*
     * ワーカーの置き場所。
     *
     * new URL(..., import.meta.url) で指すと、
     * その .mjs が立てるときの圧縮にかけられて落ちる。
     * 新しい書き方で書かれていて、圧縮の道具が読めない。
     *
     * public に置いたものを、道筋で指す。
     * 圧縮を通らないので、そのまま動く。
     */
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const buffer = await file.arrayBuffer();
    const document = await pdfjs.getDocument({ data: buffer }).promise;

    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();

        const text = content.items
            .map((item) => item.str ?? "")
            .join("")
            .trim();
        pages.push(text);
    }

    // ページの切れ目は段落の切れ目とは限らないので、空行 2 つで繋ぐ
    const joined = pages.filter((page) => page.length > 0).join("\n\n");

    /*
     * 縦書き用の字を戻し、行の切れ目を作り直してから渡す。
     * PDF は改行を持っていないので、ここで組み立てる。
     */
    return { text: restoreLineBreaks(normalizeVerticalForms(joined)) };
}

/** 拡張子から読み方を選ぶ */
export async function readManuscriptFile(file: File): Promise<ImportedText> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return readPdfFile(file);
    return readTextFile(file);
}

export const ACCEPTED_IMPORT_TYPES = ".txt,.md,.text,.pdf";
