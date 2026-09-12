import { redirect } from "next/navigation";

import WorkspaceClient from "@/components/workspace/workspace-client";
import { createClient } from "@/lib/supabase/server";

interface Props {
    params: { workId: string };
}

/**
 * ============================================================
 * 原石航路 Studio
 * /workspace/[workId] — 執筆室
 *
 * ★ 持ち主かどうかを、ここで確かめる。
 *
 *   表の決まり（RLS）で書き換えは防げているが、
 *   画面そのものは誰にでも出ていた。
 *
 *   作者がこの住所を人に貼ってしまい、
 *   開いた人に編集画面が出る、ということが起きた。
 *   驚かせるし、貼るべき住所も分からなくなる。
 *
 * ★ 他人なら、読者向けの頁へ送る。
 *
 *   その人が見たかったのは作品のほう。
 *   「権限がありません」と止めるより、
 *   見たかったものへ連れていく。
 *
 * ★ 作り置きしない。
 *   誰が開いたかで出すものが変わる。
 * ============================================================
 */

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: Props) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    /*
     * まだ入っていない人は、入口へ。
     *
     * ★ 戻り先は渡さない。
     *   いまの入口は受け取る作りになっていない。
     *   渡しても、無視されるだけ。
     */
    if (!user) {
        redirect('/login');
    }

    const { data: work } = await supabase
        .from("novels")
        .select("author_id")
        .eq("id", params.workId)
        .maybeSingle();

    /* 無い作品。読者向けの頁が「見つかりません」を出す */
    if (!work) {
        redirect(`/novel/${params.workId}`);
    }

    /* 他人の作品なら、読者向けの頁へ */
    if (work.author_id !== user.id) {
        redirect(`/novel/${params.workId}`);
    }

    return <WorkspaceClient workId={params.workId} />;
}
