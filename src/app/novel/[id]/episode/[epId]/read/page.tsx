import { notFound } from "next/navigation";

import ReadFullPage from "@/components/novel/episode/read-full-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * ============================================================
 * 原石航路 Studio
 * /novel/[id]/episode/[epId]/read  全画面で読む
 *
 * ★ 読む画面の中で全画面にするのをやめ、別の頁にした。
 *
 *   読む画面には、幅の上限・親の transform・
 *   role="dialog" への指定など、いくつもの縛りがある。
 *   その中で画面いっぱいを作ろうとして 7 回外した。
 *   外すたびに、別の所が狭くなった。
 *
 *   別の頁なら、何も無い所から建てられる。
 *   ヘッダーもフッターも出さない。
 * ============================================================
 */

export async function generateMetadata({
    params,
}: {
    params: { id: string; epId: string };
}) {
    const supabase = await createClient();

    const { data: episode } = await supabase
        .from("episodes")
        .select("title")
        .eq("id", params.epId)
        .maybeSingle();

    return { title: episode?.title || "読む" };
}

export default async function ReadPage({
    params,
}: {
    params: { id: string; epId: string };
}) {
    const supabase = await createClient();

    const [{ data: episode }, { data: novel }] = await Promise.all([
        supabase
            .from("episodes")
            .select("id, title, body, novel_id, is_published")
            .eq("id", params.epId)
            .maybeSingle(),
        supabase
            .from("novels")
            .select("id, title, published, visibility, deleted_at")
            .eq("id", params.id)
            .maybeSingle(),
    ]);

    /*
     * 読めない話は出さない。
     *
     * 作品ページと同じ決まりにする。
     * ここだけ緩いと、この住所を直に叩けば読めてしまう。
     */
    if (!episode || !novel) notFound();
    if (episode.novel_id !== params.id) notFound();
    if (!episode.is_published) notFound();
    if (novel.deleted_at) notFound();
    if (!novel.published || novel.visibility !== "public") notFound();

    /* 話の中の挿絵。置き場所の順に読む */
    const { data: illustRows } = await supabase
        .from("episode_illusts")
        .select("id, url, is_ai, after_sentence, size")
        .eq("episode_id", params.epId)
        .order("after_sentence", { ascending: true });

    return (
        <ReadFullPage
            title={episode.title || "無題"}
            body={episode.body || ""}
            illusts={(illustRows ?? []) as { id: string; url: string; is_ai: boolean; after_sentence: number; size?: string | null }[]}
            backHref={`/novel/${params.id}/episode/${params.epId}`}
        />
    );
}
