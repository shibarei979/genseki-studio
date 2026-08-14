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
                ],
            },
        ],
        sitemap: `${appConfig.siteUrl}/sitemap.xml`,
    };
}
