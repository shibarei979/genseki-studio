/**
 * ============================================================
 * 原石航路 Studio
 * /workspace/[workId]/post — 話の投稿
 * ============================================================
 */

import PostClient from "@/components/post/work-post-client";

export default function Page({ params }: { params: { workId: string } }) {
    return <PostClient workId={params.workId} />;
}
