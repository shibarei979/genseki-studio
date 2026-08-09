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

        // 三点リーダとダッシュは全角化より先に処理する
        next = next.replace(/\.{3,}|。{3,}|・{3,}/g, "……");
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

/** 全角英数字・記号を半角へ */
function toHalfWidth(text: string): string {
    return text.replace(/[！-～]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    );
}

/**
 * 横書き向けに整える。
 *
 * 1. 全角英数字 → 半角（横組みでは半角のほうが読みやすい）
 * 2. …… → ...
 * 3. 全角スペース → 半角スペース
 *
 * ダッシュ（——）は変えない。
 * 横書きでも意味を持つ記号なので、勝手に崩さない。
 *
 * 字下げも外さない。
 * 段落の始まりを示すもので、書き方に関わらず要る。
 */
export function normalizeForHorizontal(raw: string): NormalizeResult {
    let changeCount = 0;
    const lines = raw.replace(/\r\n/g, "\n").split("\n");

    const converted = lines.map((line) => {
        const original = line;
        let next = line;

        /* 三点リーダを先に。全角化を戻す前に見分ける */
        next = next.replace(/…{2,}/g, "...");
        next = next.replace(/…/g, "...");

        next = toHalfWidth(next);

        /*
         * 全角スペースを半角へ。
         * ただし行頭の字下げは残す。
         */
        const indent = next.startsWith("　") ? "　" : "";
        const body = indent ? next.slice(1) : next;

        next = indent + body.replace(/　/g, " ");

        if (next !== original) changeCount += 1;
        return next;
    });

    return { text: converted.join("\n"), changeCount };
}
