/**
 * ============================================================
 * 原石航路 Studio
 * /mypage — 共通の枠
 *
 * ヘッダーとタブだけ。
 *
 * 中身は各ページが受け持つ。
 * ここで表を読まないので、どのページも
 * 自分に要るものだけを待てばよい。
 * ============================================================
 */

import { redirect } from "next/navigation";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import MypageTabs from "@/components/mypage/shell/mypage-tabs";
import { createClient } from "@/lib/supabase/server";

export default async function MypageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login?next=/mypage");

    return (
        <div className="page-with-footer bg-canvas">
            <Header breadcrumbs={[{ label: "マイページ" }]} />

            <main className="mx-auto w-full max-w-5xl px-6 py-7">
                <MypageTabs />

                <div className="mt-6">{children}</div>
            </main>

            <Footer />
        </div>
    );
}
