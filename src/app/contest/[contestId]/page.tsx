/**
 * ============================================================
 * 原石航路 Studio
 * /contest/[contestId] — コンテストの詳しい説明
 * ============================================================
 */

import ContestDetailClient from "@/components/home/contest-detail-client";
import Footer from "@/components/layout/footer";

export default function ContestDetailPage({
    params,
}: {
    params: { contestId: string };
}) {
    return (
        <>
            {/*
              * どのページからでも、決まりや問い合わせへ行けるようにする。
              * 下まで読んだ人が、そこで行き止まりにならない。
              */}
            <ContestDetailClient contestId={params.contestId} />
            <Footer />
        </>
    );
}
