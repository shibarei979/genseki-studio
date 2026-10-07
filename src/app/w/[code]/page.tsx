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

import NovelPage, { generateMetadata as novelMetadata } from "@/app/novel/[id]/page";
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

/*
 * ★ 題名・あらすじ・表紙の共有カードも、作品ページと同じものを出す。
 *   前は正規の住所（canonical）しか返しておらず、題名と説明がサイト共通のままだった。
 *   どの作品の頁も同じ題名・同じ説明に見え、検索に「重複」と扱われる元になっていた。
 */
export async function generateMetadata({
    params,
}: {
    params: { code: string };
}) {
    const code = decodeURIComponent(params.code).toLowerCase();
    const id = await findNovelId(code);
    const base = id ? await novelMetadata({ params: { id } }) : {};
    return {
        ...base,
        alternates: {
            canonical: `/w/${code}`,
        },
        openGraph: base && "openGraph" in base && base.openGraph
            ? { ...base.openGraph, url: `/w/${code}` }
            : undefined,
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
