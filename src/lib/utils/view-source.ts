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

/**
 * ============================================================
 * 入ってきた先を、1 回の訪問のあいだ覚えておく
 *
 * ★ 閲覧は「話の頁」を開いたときだけ数えている。
 *
 *   X から来た人は、たいてい作品の頁（あらすじ）に着き、
 *   そこから 1 話目を押す。その 1 話目の送り元は自分のサイトなので、
 *   「サイトの中」と数えられ、X から来たことが消えていた。
 *
 *   サイトに着いたとき（middleware）に入ってきた先を札に書き、
 *   話の頁では、送り元が自分のサイトならその札を見る。
 *
 * ★ 札の中身は「x」「search」などの名前だけ。住所は持たない。
 * ============================================================
 */
export const ENTRY_COOKIE = "gk-src";

/** 外から入ってきた先として使える名前（サイトの中 は入らない） */
const ENTRY_NAMES: ViewSource[] = ["x", "youtube", "instagram", "note", "search", "direct", "other"];

/**
 * 住所に付けた印（?from=x）や札の値を、名前として確かめる。
 *
 * ★ X のアプリの中の窓などは、送り元を消して開く。
 *   消されると「直接」に見えるので、シェアの住所には ?from=x を付けておく。
 */
export function entryName(value: string | null | undefined): ViewSource | null {
    if (!value) return null;
    const v = value.toLowerCase() as ViewSource;
    return ENTRY_NAMES.includes(v) ? v : null;
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
