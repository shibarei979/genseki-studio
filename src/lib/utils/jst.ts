/**
 * ============================================================
 * 原石航路 Studio
 * 日本時間で「その日」を出す
 *
 * ★ なぜ要るか。
 *
 *   toISOString() は協定世界時で返す。
 *   10 文字で切ると、日本の 0 時から 9 時までが
 *   前の日として記録される。
 *
 *   日付が変わってから投稿した話が、
 *   「昨日 2 話更新した」と数えられていた。
 *
 * ★ 使うのは、人に見せる「日」だけ。
 *
 *   表に控える時刻そのものは、これまでどおり
 *   協定世界時で持つ。世界のどこから見ても
 *   同じ一瞬を指すのは、そちらの形なので。
 *
 *   日ごとにまとめる所、その日の記録を探す所、
 *   「今日」を出す所だけ、これを使う。
 * ============================================================
 */

/** 日本時間での日付。"2026-09-10" の形 */
export function jstDay(at: Date | string | number = new Date()): string {
    const date = at instanceof Date ? at : new Date(at);

    /*
     * sv-SE は "2026-09-10" の形で返す。
     * 自分で組み立てるより短く、桁も揃う。
     */
    return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

/** 日本時間での月。"2026-09" の形 */
export function jstMonth(at: Date | string | number = new Date()): string {
    return jstDay(at).slice(0, 7);
}
