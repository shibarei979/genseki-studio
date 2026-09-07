import React from 'react'

/**
 * ============================================================
 * 原石航路 Studio
 * tate-chu-yoko — 縦書きの中の英数字を立てる
 *
 * 縦書きでは、半角の英数字が既定で 90 度倒れる。
 * 「35歳」の 35 も、「(Pr. I)」も、寝たまま出る。
 *
 * 日本語の組版では、短い英数字は 1 文字ぶんの枡に
 * まとめて立てる。これを縦中横という。
 *
 * ★ 長さで扱いを変える。
 *
 *   数字 1〜2 桁    枡にまとめて立てる
 *   数字 3 桁以上   1 字ずつ立てて縦に積む
 *                  まとめると枡に収まらず、潰れて読めない
 *   英字 1〜4 字    枡にまとめて立てる（Pr, I, AI, OK）
 *   英字 5 字以上   倒したまま
 *                  立てると "Albert" が縦に積まれて読めない
 *                  紙の本でも、長い欧文は倒すのがふつう
 *
 * ここは画面を持たない。文字を切り分けて返すだけ。
 * 横書きでは呼ばない。
 * ============================================================
 */

/** まとめて立てられる長さの上限 */
const DIGIT_MAX = 2;
/* 英字は 1 マスにまとめない。長さにかかわらず縦に積む */

/** 半角の数字の並び、または半角の英字の並び */
const RUN = /[0-9]+|[A-Za-z]+/g;

export function withTateChuYoko(
    text: string,
    keyPrefix: string,
): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    const pattern = new RegExp(RUN.source, 'g');

    let last = 0;
    let hit: RegExpExecArray | null;
    let index = 0;

    while ((hit = pattern.exec(text)) !== null) {
        if (hit.index > last) out.push(text.slice(last, hit.index));

        const run = hit[0];
        const isDigits = run.charCodeAt(0) <= 57;
        const key = `${keyPrefix}-tcy-${index}`;
        index += 1;

        /*
         * ★ 英字は、長さにかかわらず縦に積む。
         *
         *   前は 4 字までを 1 マスにまとめていた（縦中横）。
         *   だが縦書きの小説では、英字は縦に積むのが見慣れた形。
         *   長さで見え方が変わると、同じ語が場所によって
         *   寝たり立ったりして落ち着かない。
         *
         *   1 マスにまとめるのは数字だけにする。
         */
        if (isDigits && run.length <= DIGIT_MAX) {
            /* 枡にまとめて立てる */
            out.push(
                <span key={key} className="tcy">
                    {run}
                </span>,
            );
        } else {
            /*
             * 桁の多い数字と、英字。1 字ずつ立てて縦に積む。
             *
             * ★ 前は倒していた（横に寝かせていた）。
             *
             *   もっとも、以前は読む前に半角を全角へ直しており、
             *   全角の英字はそのまま縦に積まれていた。
             *   書いた字をそのまま出すようにしたところ、
             *   半角のまま倒れるようになり、見え方が変わった。
             *
             *   縦書きの小説では、英字も縦に積むのが見慣れた形。
             *   字は書かれたまま、置き方だけ縦にする。
             */
            out.push(
                <span key={key} className="tcy-upright">
                    {run}
                </span>,
            );
        }

        last = hit.index + run.length;
    }

    if (last < text.length) out.push(text.slice(last));

    return out;
}
