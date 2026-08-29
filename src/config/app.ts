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
     *
     * ★ 既定値は、必ず本番の住所にしておくこと。
     *
     *   ここが gensekikoro.vercel.app になっていた。
     *   実際の本番は genseki-studio-bay.vercel.app で、
     *   前者は存在しない。
     *
     *   環境変数さえ入っていれば使われない値だが、
     *   入れ忘れると OGP の絵も sitemap も
     *   まるごと存在しない住所を指す。
     *   そのとき検索にも SNS にも出なくなる。
     *
     *   公式ドメインを取ったら、ここも一緒に直す。
     */
    siteUrl:
        process.env.NEXT_PUBLIC_SITE_URL ??
        "https://genseki-studio-bay.vercel.app",
} as const;
