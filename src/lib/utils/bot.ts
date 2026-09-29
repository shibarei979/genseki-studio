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

    /*
     * ★ 「bot」と名乗らない見回り（2026-09 に足した）。
     *
     *   Google の広告の見回り（Mediapartners-Google）や
     *   検査の道具（Google-InspectionTool）などは、名前に bot が入っていない。
     *   サイトの地図に本文の頁を載せてから、こうした見回りが
     *   本文を 1 話ずつ開くようになり、閲覧数が跳ねた。
     */
    "mediapartners-google",
    "google-inspectiontool",
    "googleother",
    "google-extended",
    "google-read-aloud",
    "apis-google",
    "feedfetcher",
    "google-safety",
    "chatgpt-user",
    "claude-web",
    "anthropic-ai",
    "perplexity",
    "ccbot",
    "meta-externalagent",
    "meta-externalfetcher",
    "facebookcatalog",
    "applebot",
    "amazonbot",
    "yeti",
    "daum",
    "scrapy",
    "go-http-client",
    "okhttp",
    "java/",
    "libwww",
    "httpclient",
    "python-urllib",
    "aiohttp",
    "httpx",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    "lighthouse",
    "ptst",
    "preview",
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

/**
 * 要求の頭書き（headers）ごと見る。名乗りだけで見分けるより強い。
 *
 * ★ ふつうのブラウザは、必ず「読める言葉」（Accept-Language）を付けて来る。
 *   パソコンでも携帯でも、X や LINE の中の窓でも付く。
 *   付いていないのは、ほぼ機械。ブラウザのふりをした名乗りでも、ここで分かる。
 */
export function looksLikeBotRequest(head: { get(name: string): string | null }): boolean {
    if (looksLikeBot(head.get("user-agent") ?? "")) return true;
    if (!head.get("accept-language")) return true;
    return false;
}
