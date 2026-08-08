/**
 * ============================================================
 * 原石航路 Studio
 * /contest/[contestId] — コンテストの詳しい説明
 * ============================================================
 */

import ContestDetailClient from "@/components/home/contest-detail-client";

export default function ContestDetailPage({
    params,
}: {
    params: { contestId: string };
}) {
    return <ContestDetailClient contestId={params.contestId} />;
}
