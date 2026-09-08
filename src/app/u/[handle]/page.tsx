/**
 * ============================================================
 * 原石航路 Studio
 * /u/〈呼び名〉 — 作者ページ（短い住所）
 *
 * ★ こちらが本物。中身をそのまま出す。
 *
 *   前は長い住所へ送っていたが、
 *   貼った住所が押した先で長いものに変わってしまい、
 *   短くした意味が薄れていた。
 *
 * ★ 番号の住所（/author/〈番号〉）も、これまでどおり開ける。
 *   そちらは、呼び名を決めている人だけこちらへ送る。
 *
 * ★ 中身は 1 か所にまとめてある（author/[id]/page.tsx）。
 *   二重に持つと、直したときに片方だけ古くなる。
 * ============================================================
 */

import { notFound } from "next/navigation";

import AuthorPage from "@/app/author/[id]/page";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** 呼び名から、その人の番号を引く */
async function findUserId(handle: string): Promise<string | null> {
    const { data } = await createAdminClient()
        .from("profiles")
        .select("user_id")
        .ilike("handle", handle)
        .maybeSingle();

    return (data?.user_id as string) ?? null;
}

function tidy(raw: string): string {
    return decodeURIComponent(raw).replace(/^@/, "").toLowerCase();
}

export async function generateMetadata({
    params,
}: {
    params: { handle: string };
}) {
    const handle = tidy(params.handle);

    return {
        /*
         * 正しい住所は、こちらの短いほう。
         * 長いほうは、ここへ送るだけの扱いにする。
         */
        alternates: { canonical: `/u/${handle}` },
    };
}

export default async function ShortAuthorPage({
    params,
}: {
    params: { handle: string };
}) {
    const userId = await findUserId(tidy(params.handle));
    if (!userId) notFound();

    /* viaHandle を付けて、送り返しの輪を止める */
    return <AuthorPage params={{ id: userId, viaHandle: true }} />;
}
