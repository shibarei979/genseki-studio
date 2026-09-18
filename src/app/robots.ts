/**
 * ============================================================
 * 原石航路 Studio
 * robots — 検索ロボットへの案内
 *
 * Next がこのファイルから /robots.txt を作る。
 *
 * 塞ぐのは、他人に見せる意味のない所と、本人だけの所。
 * 執筆室（/rooms 配下）は招きの URL で入る場所なので、
 * 検索には載せない。
 * ============================================================
 */

import type { MetadataRoute } from "next";

import { appConfig } from "@/config";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/admin",
                    "/api/",
                    "/workspace",
                    "/mypage",
                    "/messages",
                    "/rooms/",
                    "/login",
                    "/auth/",

                    /*
                     * ★ 絞り込んだ検索結果は、拾わせない。
                     *
                     *   言葉・ジャンル・並び順の組み合わせは
                     *   いくらでも作れるので、中身の薄いページが
                     *   際限なく検索エンジンに溜まる。
                     *   Google は、これを品質の低い作りとして扱う。
                     *
                     *   作品そのものは sitemap で直に渡しているので、
                     *   ここを塞いでも作品が拾われなくなることはない。
                     */
                    "/search?",
                    "/works?",
                    "/ranking?",
                    "/recommend?",
                ],
            },
        ],
        sitemap: `${appConfig.siteUrl}/sitemap.xml`,
    };
}
