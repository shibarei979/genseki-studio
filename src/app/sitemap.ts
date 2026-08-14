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
import { createAdminClient } from "@/lib/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

    const entries: MetadataRoute.Sitemap = pages.map((page) => ({
        url: `${base}${page.path}`,
        lastModified: now,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
    }));

    /*
     * 公開中の作品も載せる。検索から人が来るのはここ。
     *
     * 並べ替えは created_at で。updated_at は本番の表に
     * 無いことがある（表の列が古い件）。無い列に触れると
     * 1 行も返らないので、有ると確かめた列だけ使う。
     * 読みに失敗しても、入口のページだけは必ず返す。
     */
    try {
        const supabase = createAdminClient();
        const { data } = await supabase
            .from("novels")
            .select("id, created_at")
            .eq("visibility", "public")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(1000);

        for (const novel of data ?? []) {
            entries.push({
                url: `${base}/novel/${novel.id}`,
                lastModified: novel.created_at
                    ? new Date(novel.created_at)
                    : now,
                changeFrequency: "weekly",
                priority: 0.7,
            });
        }
    } catch {
        // 読めない日でも、地図そのものは配る
    }

    return entries;
}
