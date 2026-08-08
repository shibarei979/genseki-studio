/**
 * ============================================================
 * 原石航路 Studio
 * /workspace/[workId]/preview — 読者から見た姿
 * ============================================================
 */

import PreviewClient from "@/components/post/preview-client";

export default function Page({ params }: { params: { workId: string } }) {
    return <PreviewClient workId={params.workId} />;
}
