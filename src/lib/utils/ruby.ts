/**
 * ============================================================
 * 原石航路 Studio
 * ruby — ふりがなの印
 *
 * 使える書き方は 3 つ。
 *
 *   ｜漢字《かんじ》    親文字を ｜ で始める
 *   漢字《かんじ》      ｜ を省く。《 の直前の漢字が親文字になる
 *   《《漢字》》        傍点（ふりがなではない）
 *
 * 2 つめが抜けていた。
 *
 * ほかの投稿サイトから持ってきた原稿は、
 * ほとんどがこの書き方になっている。
 * 読めないと「作品《さくひん》」と素のまま出てしまう。
 *
 * ★ 漢字が前に無いときは、ふりがなにしない。
 *
 *   《》 は引用の記号としても使われる。
 *   「彼は《正義》を信じた」を勝手にふりがなにすると、
 *   書いていないものが本文に出る。
 *   直前が漢字のときだけ、ふりがなとして読む。
 *
 * ★ 決まりは 1 か所に置く。
 *
 *   横書き・縦書き・スマホ・書き出しで、
 *   それぞれ別に書いてあった。
 *   1 つ足りないだけで、その画面だけルビが出ない。
 * ============================================================
 */

/**
 * 親文字になれる字。
 *
 * 漢字と、繰り返しの記号だけ。
 * ひらがな・カタカナを含めると、
 * 「ここで《おわり》」のような書き方まで拾ってしまう。
 */
const BASE = "\\u4E00-\\u9FFF\\u3005\\u3006\\u3007\\u30F5\\u30F6";

/**
 * ふりがなと傍点を見つける決まり。
 *
 * 呼ぶたびに作り直す。
 * /g の付いた決まりは、どこまで読んだかを自分で覚えている。
 * 使い回すと、2 回目が途中から始まって取りこぼす。
 *
 * 拾える組は 3 つ。
 *   1, 2  ｜親文字《よみ》
 *   3     《《傍点》》
 *   4, 5  親文字《よみ》（｜ 無し）
 *
 * ★ 並べる順を変えないこと。
 *   《《傍点》》 を後ろに回すと、その手前の漢字が
 *   親文字として拾われ、「文《《強調》」で切れる。
 */
export function rubyPattern(): RegExp {
    return new RegExp(
        "[|｜]([^《》\\n]*)《([^》《\\n]+)》" +
            "|《《([^》《\\n]+)》》" +
            `|([${BASE}]+)《([^》《\\n]+)》`,
        "g",
    );
}

/** ふりがなと傍点の印を外して、素の文だけにする */
export function stripRuby(text: string): string {
    return text.replace(rubyPattern(), (_match, pipeBase, _pipeRuby, dot, kanjiBase) => {
        if (dot !== undefined) return dot;
        return (pipeBase ?? kanjiBase ?? "") as string;
    });
}

/**
 * ふりがなと傍点を、組み立てやすい形に切り分ける。
 *
 * 縦書きは 1 文字ずつ包むので、先に切り出しておかないと
 * ｜ や 《》 まで別々の文字として並んでしまう。
 */
export type RubyPart =
    | { type: "text"; body: string }
    | { type: "ruby"; body: string; ruby: string }
    | { type: "dot"; body: string };

export function splitRuby(text: string): RubyPart[] {
    const parts: RubyPart[] = [];
    const pattern = rubyPattern();
    let last = 0;
    let hit: RegExpExecArray | null;

    while ((hit = pattern.exec(text)) !== null) {
        if (hit.index > last) {
            parts.push({ type: "text", body: text.slice(last, hit.index) });
        }

        if (hit[3] !== undefined) {
            parts.push({ type: "dot", body: hit[3] });
        } else if (hit[4] !== undefined) {
            parts.push({ type: "ruby", body: hit[4], ruby: hit[5] });
        } else {
            /*
             * ｜ の後ろが空のときは、ふりがなの掛かる先が無い。
             * 印だけ落として、読みをそのまま本文に置く。
             */
            const base = hit[1] ?? "";
            if (base.length === 0) {
                parts.push({ type: "text", body: hit[2] });
            } else {
                parts.push({ type: "ruby", body: base, ruby: hit[2] });
            }
        }

        last = hit.index + hit[0].length;
    }

    if (last < text.length) {
        parts.push({ type: "text", body: text.slice(last) });
    }

    return parts;
}
