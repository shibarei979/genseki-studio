/**
 * ============================================================
 * 原石航路 Studio
 * sitemap — 検索エンジンに渡すページの地図
 *
 * Next がこのファイルから /sitemap.xml を作る。
 *
 * 載せるのは、誰が開いても見られる入口のページだけ。
 * 作品の各ページは数が動くので、まずは入口から拾わせる。
 * （作品が増えてきたら、ここで一覧を読んで足すこともできる）
 * ============================================================
 */

import type { MetadataRoute } from "next";

import { appConfig } from "@/config";

export default function sitemap(): MetadataRoute.Sitemap {
    const base = appConfig.siteUrl;

    /** 入口のページと、その変わりやすさ */
    const pages: {
        path: string;
        changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
        priority: number;
    }[] = [
        { path: "/", changeFrequency: "daily", priority: 1 },
        { path: "/contest", changeFrequency: "weekly", priority: 0.8 },
        { path: "/notices", changeFrequency: "weekly", priority: 0.5 },
        { path: "/about", changeFrequency: "monthly", priority: 0.5 },
        { path: "/guide", changeFrequency: "monthly", priority: 0.5 },
        { path: "/faq", changeFrequency: "monthly", priority: 0.4 },
        { path: "/help", changeFrequency: "monthly", priority: 0.4 },
        { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
        { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
        { path: "/guidelines", changeFrequency: "yearly", priority: 0.2 },
    ];

    const now = new Date();

    return pages.map((page) => ({
        url: `${base}${page.path}`,
        lastModified: now,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
    }));
}
