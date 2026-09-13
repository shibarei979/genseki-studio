/**
 * ============================================================
 * 原石航路 Studio
 * /contest/[contestId]/entries — 応募作品の一覧
 *
 * ★ 説明の頁から分ける。
 *
 *   初めはコンテストの説明の途中に挟んだが、
 *   読む流れが切れて見にくかった。
 *   見たい人だけが来る場所にする。
 * ============================================================
 */

import ContestEntriesClient from "@/components/home/contest-entries-client";
import FooterOnWhite from "@/components/layout/footer-on-white";

export default function ContestEntriesPage({
    params,
}: {
    params: { contestId: string };
}) {
    return (
        <>
            <ContestEntriesClient contestId={params.contestId} />
            <FooterOnWhite />
        </>
    );
}
