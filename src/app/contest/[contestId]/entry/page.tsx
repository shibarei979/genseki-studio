/**
 * ============================================================
 * 原石航路 Studio
 * /contest/[contestId]/entry — 応募する
 *
 * 作品を選び、確かめて出す。
 * ============================================================
 */

import ContestEntryClient from "@/components/home/contest-entry-client";

export default function Page({ params }: { params: { contestId: string } }) {
    return <ContestEntryClient contestId={params.contestId} />;
}
