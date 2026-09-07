/**
 * ============================================================
 * 原石航路 Studio
 * どこから来たかを、名前で言い当てる
 *
 * ★ 元の住所そのものは残さない。
 *
 *   どこの誰が、どの頁から来たかまで持てば、
 *   人を追える記録になってしまう。
 *   来た先の名（X・YouTube・検索 など）だけを残す。
 *
 * ★ 分からないものは「その他」。
 *   無理に当てず、分からないと言う。
 * ============================================================
 */

/** 残す名前。ここに無いものは その他 か 直接 */
export type ViewSource =
    | "x"
    | "youtube"
    | "instagram"
    | "note"
    | "search"
    | "site"
    | "direct"
    | "other";

/**
 * 送り元の住所から、来た先の名を決める。
 *
 * @param referrer document.referrer。空なら直接
 * @param host     このサイトの住所。自分の中の移動を見分ける
 */
export function nameSource(referrer: string, host: string): ViewSource {
    if (!referrer) return "direct";

    let from = "";
    try {
        from = new URL(referrer).hostname.toLowerCase();
    } catch {
        return "other";
    }

    /* 自分の中の移動。読者が話から話へ進んだとき */
    if (host && (from === host || from.endsWith(`.${host}`))) return "site";

    /* X。短縮の t.co もこちら */
    if (
        from === "t.co" ||
        from === "x.com" ||
        from.endsWith(".x.com") ||
        from.endsWith("twitter.com")
    ) {
        return "x";
    }

    if (from.includes("youtube.") || from === "youtu.be") return "youtube";
    if (from.includes("instagram.")) return "instagram";
    if (from.includes("note.com")) return "note";

    /* 検索。Google・Yahoo・Bing・DuckDuckGo */
    if (
        from.includes("google.") ||
        from.includes("yahoo.") ||
        from.includes("bing.") ||
        from.includes("duckduckgo.")
    ) {
        return "search";
    }

    return "other";
}

/** 画面に出すときの名 */
export const SOURCE_LABEL: Record<ViewSource, string> = {
    x: "X",
    youtube: "YouTube",
    instagram: "Instagram",
    note: "note",
    search: "検索",
    site: "サイトの中",
    direct: "直接",
    other: "その他",
};
