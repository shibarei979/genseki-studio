/**
 * ============================================================
 * 原石航路 Studio
 * /workspace/[workId]/preview — 読者から見た姿
 * ============================================================
 */

import PreviewClient from "@/components/post/preview-client";

import PreviewMobileHead from "./mobile-head";

export default function Page({ params }: { params: { workId: string } }) {
    return (
        <>
            {/* 携帯だけの上の段（‹・読者の目／作品名・投稿）。パソコンでは出ない */}
            <PreviewMobileHead workId={params.workId} />
            <PreviewClient workId={params.workId} />
        </>
    );
}
