/**
 * ============================================================
 * 原石航路 Studio
 * 縦書き用の整形
 *
 * よそから貼り付けた原稿は、半角英数字や "..." が混じっていることが多い。
 * そのまま縦書きにすると、半角文字が横倒しになって読めなくなる。
 *
 * 元に戻せるよう、変換は必ず「実行前の本文」を返り値に含める。
 * 自動では走らせない。書き手の表記の癖を勝手に潰さないため。
 * ============================================================
 */

export interface NormalizeResult {
    text: string;
    /** 変更が入った箇所の数。0 なら何もしていない */
    changeCount: number;
}

/** 半角英数字・記号を全角へ */
function toFullWidth(text: string): string {
    return text.replace(/[!-~]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) + 0xfee0),
    );
}

/**
 * 縦書き向けに整える。
 *
 * 1. 半角英数字 → 全角（縦組みで横倒しにならないようにする）
 * 2. ... → …… （三点リーダは二つ重ねが慣習）
 * 3. -- や ーー → —— （ダッシュも二つ重ね）
 * 4. 半角スペース → 全角スペース
 * 5. 段落の先頭に字下げ（全角スペース）を入れる
 */
export function normalizeForVertical(raw: string): NormalizeResult {
    let changeCount = 0;
    const lines = raw.replace(/\r\n/g, "\n").split("\n");

    const converted = lines.map((line) => {
        const original = line;
        let next = line;

        /*
         * 三点リーダ。
         *
         * 点 3 つで「…」1 つ。
         * 数を決め打ちにすると、
         * 「......」と書いた人のものが半分になる。
         */
        next = next.replace(/\.{3,}|。{3,}|・{3,}/g, (run) => {
            /*
             * 3 で割り切れない数は、切り上げる。
             * 「....」を「…」にすると 1 つ減るが、
             * 「……」なら多い。減らすより、多いほうが読みやすい。
             */
            const count = Math.max(1, Math.round(run.length / 3));
            return "…".repeat(count);
        });
        next = next.replace(/[-–—―]{2,}/g, "——");
        next = next.replace(/ー{2,}(?![ぁ-んァ-ヶ])/g, "——");

        next = toFullWidth(next);
        next = next.replace(/ /g, "　");

        // 字下げ。空行・記号だけの行・すでに字下げ済みの行は触らない
        const trimmed = next.trim();
        if (
            trimmed.length > 0 &&
            !next.startsWith("　") &&
            !/^[「『（〈《【〔”“']/.test(trimmed)
        ) {
            next = `　${next}`;
        }

        if (next !== original) changeCount += 1;
        return next;
    });

    return { text: converted.join("\n"), changeCount };
}

/**
 * ============================================================
 * 横書きに整える
 *
 * 縦書きで全角にしたものを戻す。
 *
 * 全部を半角に戻すわけではない。
 * 日本語に混ざる英単語や固有名詞は、
 * 全角のままのほうが読みやすいことがある。
 *
 * 直すのは、縦書きのために変えたものだけ。
 *   ・全角の数字と英字 → 半角
 *   ・行頭の全角空白は残す（字下げは横書きでも使う）
 *
 * 「——」は戻さない。日本語の組版で使う記号で、
 * 縦書きのために変えたものではない。
 *
 * 「……」は戻す。縦書きのために「...」から変えたもの。
 * ============================================================
 */

export function normalizeForHorizontal(raw: string): NormalizeResult {
    let changeCount = 0;
    const lines = raw.replace(/\r\n/g, "\n").split("\n");

    const converted = lines.map((line) => {
        const original = line;
        let next = line;

        /* 全角の数字と英字を半角へ */
        next = next.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (char) =>
            String.fromCharCode(char.charCodeAt(0) - 0xfee0),
        );

        /*
         * 三点リーダを元の形へ。
         * 「…」1 つが点 3 つ。数はそのまま保つ。
         */
        next = next.replace(/…+/g, (run) => ".".repeat(run.length * 3));

        /*
         * 全角の空白は、行の頭だけ残す。
         * 字下げは横書きでも使う。
         */
        const indent = next.startsWith("　") ? "　" : "";
        next = indent + next.slice(indent.length).replace(/　/g, " ");

        if (next !== original) changeCount += 1;
        return next;
    });

    return { text: converted.join("\n"), changeCount };
}
