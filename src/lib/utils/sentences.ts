/**
 * ============================================================
 * 原石航路 Studio
 * 本文を文で分ける
 *
 * ★ 分け方は 1 か所に置く。
 *
 *   読む画面と、挿絵の置き場所を選ぶ画面とで
 *   別々に書いていた。切れ目の決まりが少し違っていたので、
 *   「この文の後ろ」で置いた絵が、読む画面では
 *   別の場所（多くは本文の頭）に出ていた。
 *
 *   場所は「何文目か」で持っている。
 *   数え方が 1 か所でも違うと、指した先がずれる。
 * ============================================================
 */

/** 文の切れ目で分ける */
export function splitIntoSentences(text: string): string[] {
    const result: string[] = [];
    let buf = "";
    /*
     * ★ 注釈の記法（［＃注：…。］）の中では切らない。
     *   説明の文に「。」があると、記法が途中で割れて、印にならなかった。
     */
    let inNote = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        buf += ch;

        if (!inNote && ch === "［" && text.startsWith("＃注：", i + 1)) inNote = true;
        if (inNote) {
            if (ch === "］") inNote = false;
            else if (ch !== "\n") continue;
        }

        const isEnder =
            ch === "。" || ch === "！" || ch === "？" || ch === "」" || ch === "』";
        const next = text[i + 1];

        /* 改行は、それだけで 1 つに数える */
        if (ch === "\n") {
            result.push(buf);
            buf = "";
            continue;
        }

        /* 閉じ括弧が続くときは、そこまでを 1 文にする */
        /* 直後に注釈が付くときは、注釈まで同じ文にする（「」の言葉に付く注釈） */
        if (isEnder && next !== "」" && next !== "』" && !text.startsWith("［＃注：", i + 1)) {
            result.push(buf);
            buf = "";
        }
    }

    if (buf) result.push(buf);
    return result.filter((one) => one.length > 0);
}
