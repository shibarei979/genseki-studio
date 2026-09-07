/**
 * ============================================================
 * 原石航路 Studio
 * 見回りの機械かどうかを見分ける
 *
 * ★ 混ぜて数えると、人数が実際より膨らむ。
 *
 *   検索の見回りが来た日ほど数字が跳ね、
 *   告知が効いたのか見回りが来ただけなのか分からなくなる。
 *
 * ★ 名乗りだけで見分ける。
 *
 *   まともな見回りは、自分から名乗る（Googlebot など）。
 *   名乗らないものは見分けられないが、
 *   それは「人として数えられる」だけで、実害は小さい。
 *
 * ★ 消さない。印を付けて残す。
 *   あとから「あの日は見回りが多かった」と振り返れる。
 * ============================================================
 */

/** 名乗りに含まれていたら、見回りとみなす言葉 */
const BOT_WORDS = [
    "bot",
    "crawler",
    "spider",
    "slurp",
    "facebookexternalhit",
    "embedly",
    "quora link preview",
    "outbrain",
    "pinterest",
    "vkshare",
    "w3c_validator",
    "whatsapp",
    "flipboard",
    "tumblr",
    "skypeuripreview",
    "nuzzel",
    "discordbot",
    "google page speed",
    "qwantify",
    "chrome-lighthouse",
    "headlesschrome",
    "python-requests",
    "curl/",
    "wget",
    "axios",
    "node-fetch",
];

/**
 * 見回りの機械か。
 *
 * @param userAgent 名乗り。無ければ見回りとみなす
 *   （まともなブラウザは必ず名乗る）
 */
export function looksLikeBot(userAgent: string): boolean {
    if (!userAgent) return true;

    const lower = userAgent.toLowerCase();
    return BOT_WORDS.some((word) => lower.includes(word));
}
