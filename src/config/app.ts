/**
 * ============================================================
 * 原石航路 Studio
 * Application Configuration
 * ============================================================
 */

export const appConfig = {
    name: "原石航路",

    title: "原石航路 - 作品制作ワークスペース",

    description: "物語を書き、育て、まとめるための執筆ワークスペース。",

    defaultLocale: "ja",

    defaultTimeZone: "Asia/Tokyo",
    /*
     * 外へ出す URL。
     * 共有の札や、読者へ渡す道筋に使う。
     */
    siteUrl:
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://gensekikoro.vercel.app",
} as const;
