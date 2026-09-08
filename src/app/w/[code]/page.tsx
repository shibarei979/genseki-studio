/**
 * ============================================================
 * 原石航路 Studio
 * /w/〈短い番号〉 — 作品ページ（短い住所）
 *
 * ★ こちらが本物。中身をそのまま出す。
 *
 * ★ 長い住所（/novel/〈番号〉）も、これまでどおり開ける。
 *   そちらは、こちらへ送るだけ。
 *
 * ★ 中身は 1 か所にまとめてある（novel/[id]/page.tsx）。
 * ============================================================
 */

import { notFound } from "next/navigation";

import NovelPage from "@/app/novel/[id]/page";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function findNovelId(code: string): Promise<string | null> {
    const { data } = await createAdminClient()
        .from("novels")
        .select("id")
        .eq("short_code", code)
        .maybeSingle();

    return (data?.id as string) ?? null;
}

export async function generateMetadata({
    params,
}: {
    params: { code: string };
}) {
    return {
        alternates: {
            canonical: `/w/${decodeURIComponent(params.code).toLowerCase()}`,
        },
    };
}

export default async function ShortNovelPage({
    params,
}: {
    params: { code: string };
}) {
    const id = await findNovelId(decodeURIComponent(params.code).toLowerCase());
    if (!id) notFound();

    /* viaCode を付けて、送り返しの輪を止める */
    return <NovelPage params={{ id, viaCode: true }} />;
}
