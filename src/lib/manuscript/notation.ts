/**
 * ============================================================
 * 原石航路 Studio
 * 本文の記法（ルビ・傍点）
 *
 * これまで「本文は素のテキスト、装飾は別テーブル」で通してきた。
 * ルビだけはそれが成立しない。
 * 「どの文字に」「どう読ませるか」は文字の並びと不可分で、
 * 位置だけを別に持つと、本文を 1 文字直しただけで全部ずれる。
 *
 * そこでルビと傍点だけを本文に埋め込む唯一の例外とする。
 * 記法は日本語の投稿サイトで広く使われているものに合わせる。
 * 独自記法にすると、書き手が他所から持ってきた原稿が壊れる。
 *
 *   ｜原石《げんせき》   親文字を指定する
 *   原石《げんせき》     直前の漢字の連なりに振る
 *   《《ここ》》          傍点
 *
 * 文字数は親文字だけを数える。ルビは読みであって本文ではない。
 * ============================================================
 */

export type Segment =
    | { type: "text"; text: string }
    | { type: "ruby"; base: string; ruby: string }
    | { type: "emphasis"; text: string };

/** 傍点が先。《《》》を《》より先に食べないと入れ子を誤読する */
const EMPHASIS_PATTERN = /《《([^》]+)》》/g;
const EXPLICIT_RUBY_PATTERN = /[|｜]([^《]+)《([^》]+)》/g;
/** 親文字の指定が無いときは、直前の漢字・カタカナの連なりに振る */
const IMPLICIT_RUBY_PATTERN = /([一-龥々〆ヶァ-ヴー]+)《([^》]+)》/g;

/**
 * 本文を、そのまま組める形に分ける。
 * 表示側（プレビュー・PDF）はこれを読んで組む。
 */
export function parseNotation(text: string): Segment[] {
    const segments: Segment[] = [];
    let rest = text;

    // 一度の走査で扱えるよう、3 つの記法をまとめた正規表現にする
    const combined = new RegExp(
        `${EMPHASIS_PATTERN.source}|${EXPLICIT_RUBY_PATTERN.source}|${IMPLICIT_RUBY_PATTERN.source}`,
        "g",
    );

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = combined.exec(rest)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: "text", text: rest.slice(lastIndex, match.index) });
        }

        const [, emphasis, explicitBase, explicitRuby, implicitBase, implicitRuby] = match;
        if (emphasis !== undefined) {
            segments.push({ type: "emphasis", text: emphasis });
        } else if (explicitBase !== undefined) {
            segments.push({ type: "ruby", base: explicitBase, ruby: explicitRuby });
        } else if (implicitBase !== undefined) {
            segments.push({ type: "ruby", base: implicitBase, ruby: implicitRuby });
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < rest.length) {
        segments.push({ type: "text", text: rest.slice(lastIndex) });
    }
    return segments;
}

/**
 * 記法を外して素の本文にする。
 * 文字数の勘定、TXT の書き出し、AI補助へ送る本文はこちらを使う。
 */
export function stripNotation(text: string): string {
    return parseNotation(text)
        .map((segment) =>
            segment.type === "ruby"
                ? segment.base
                : segment.type === "emphasis"
                  ? segment.text
                  : segment.text,
        )
        .join("");
}

/**
 * 選んだ文字にルビを振った本文を返す。
 *
 * 親文字が漢字だけなら短い記法で足りるが、
 * かなや記号が混じると直前の連なりの判定が効かない。
 * その場合だけ ｜ を付ける。
 */
export function insertRuby(
    text: string,
    start: number,
    end: number,
    ruby: string,
): string {
    const base = text.slice(start, end);
    if (!base || !ruby) return text;

    const needsMarker = !/^[一-龥々〆ヶァ-ヴー]+$/.test(base);
    const inserted = needsMarker ? `｜${base}《${ruby}》` : `${base}《${ruby}》`;
    return text.slice(0, start) + inserted + text.slice(end);
}

/** 選んだ文字に傍点をつけた本文を返す */
export function insertEmphasis(text: string, start: number, end: number): string {
    const target = text.slice(start, end);
    if (!target) return text;
    return `${text.slice(0, start)}《《${target}》》${text.slice(end)}`;
}

/** 記法が壊れていないか。閉じ忘れを拾う */
export function findBrokenNotation(text: string): { line: number; message: string }[] {
    const issues: { line: number; message: string }[] = [];
    text.split("\n").forEach((line, index) => {
        const open = (line.match(/《/g) ?? []).length;
        const close = (line.match(/》/g) ?? []).length;
        if (open !== close) {
            issues.push({
                line: index + 1,
                message: "《 と 》 の数が合っていません。ルビが正しく表示されません。",
            });
        }
        if (/｜[^《]*$/.test(line)) {
            issues.push({
                line: index + 1,
                message: "｜のあとに《ルビ》がありません。",
            });
        }
    });
    return issues;
}

/**
 * 半角の英数字を全角にする。
 *
 * 縦書きでは半角文字が横倒しになる。
 * 「第1話」の 1 が寝てしまうのはこれが原因。
 * 本文には勝手に手を入れないが、
 * こちらで組み立てる見出しは最初から全角で作る。
 */
export function toFullWidthLatin(text: string): string {
    return text.replace(/[!-~]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) + 0xfee0),
    );
}
