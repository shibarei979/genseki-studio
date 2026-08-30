/**
 * ============================================================
 * 原石航路 Studio
 * /notices — お知らせ
 * ============================================================
 */

import NoticesClient from "@/components/home/notices-client";
import Footer from "@/components/layout/footer";

export default function NoticesPage() {
    return (
        <>
            {/*
              * どのページからでも、決まりや問い合わせへ行けるようにする。
              * 下まで読んだ人が、そこで行き止まりにならない。
              */}
            <NoticesClient />
            <Footer />
        </>
    );
}
