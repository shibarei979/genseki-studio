/**
 * ============================================================
 * 原石航路 Studio
 * 呼称をそろえる
 *
 * 「リオ」「リオさん」「リオくん」は同じ人物を指す。
 * 別々の項目として並ぶと、書き手が毎回まとめ直すことになる。
 *
 * 呼称を外した形で照らし合わせ、同じなら同じ人物として扱う。
 * ただし外した形は捨てず、別名として残す。
 * 「先生」と呼ぶ相手と「さん」で呼ぶ相手の違いは、
 * 人物像そのものだから。
 * ============================================================
 */

/**
 * 人名の後ろに付く呼称。
 * 長いものから外す。「ちゃん」を「ん」で切らないため。
 */
const SUFFIXES = [
    "先輩", "後輩", "先生", "さん", "ちゃん", "くん", "君", "様", "さま",
    "殿", "どの", "氏", "師匠", "会長", "社長", "部長", "課長", "主任",
    "隊長", "団長", "校長", "教授", "博士", "陛下", "殿下", "閣下",
    "たん", "っち", "きゅん",
].sort((a, b) => b.length - a.length);

/** 前に付く呼称 */
const PREFIXES = ["お", "御"];

/**
 * 呼称を外した形を返す。
 * 外せないときは元の文字列をそのまま返す。
 */
export function stripHonorific(name: string): string {
    let base = name.trim();

    for (const suffix of SUFFIXES) {
        if (!base.endsWith(suffix)) continue;

        /*
         * 呼称そのものが名前の場合は外さない。
         * 「先生」「師匠」と呼ばれている人物は、それが呼び名。
         */
        if (base === suffix) break;

        const stripped = base.slice(0, -suffix.length);

        /*
         * 一文字残れば外す。
         * 「律さん」「律君」は「律」。
         * 二文字を下限にしていたので、一字名が揃わなかった。
         */
        if (stripped.length >= 1) {
            base = stripped;
            break;
        }
    }

    for (const prefix of PREFIXES) {
        if (base.startsWith(prefix) && base.length - prefix.length >= 1) {
            base = base.slice(prefix.length);
            break;
        }
    }

    return base;
}

/**
 * 2 つの名前が同じ人物を指すか。
 *
 * 呼称を外して一致すれば同じとみなす。
 * 「リオ」と「リオ・アルセイン」のような姓名の一部一致も拾う。
 */
export function isSamePerson(a: string, b: string): boolean {
    const left = stripHonorific(a);
    const right = stripHonorific(b);
    if (left === right) return true;

    // 姓名の区切りで割って、どちらかの部分と一致するか見る
    const parts = (name: string) =>
        name.split(/[・\s　.]+/).filter((part) => part.length >= 2);

    const leftParts = parts(left);
    const rightParts = parts(right);

    if (leftParts.length > 1 && leftParts.includes(right)) return true;
    if (rightParts.length > 1 && rightParts.includes(left)) return true;

    return false;
}

/**
 * すでにある名前の中から、同じ人物を指すものを探す。
 *
 * @returns 見つかった名前。無ければ null
 */
export function findSamePerson(name: string, known: string[]): string | null {
    for (const row of known) {
        if (row === name) return row;
        if (isSamePerson(name, row)) return row;
    }
    return null;
}
