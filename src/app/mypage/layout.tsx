/**
 * ============================================================
 * 原石航路 Studio
 * /mypage — 共通の枠
 *
 * GENSEKIKORO の組み方をそのまま使う。
 *
 *   広い画面 … 左に縦の一覧、右に中身
 *   狭い画面 … 上に横のタブ、下に中身
 *
 * 両方を書いておき、CSS で片方を隠す。
 * ここでは表を読まないので、どのページも
 * 自分に要るものだけを待てばよい。
 * ============================================================
 */

import { redirect } from "next/navigation";

import Header from "@/components/layout/header";
import {
    MypageSideNav,
    MypageTopTabs,
} from "@/components/mypage/shell/mypage-tabs";
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
        <div style={{ minHeight: "100vh", fontFamily: "'Noto Sans JP',sans-serif" }}>
            <Header />

            {/* 狭い画面 */}
            <div className="mobile-only">
                <MypageTopTabs />
                <div style={{ padding: "16px 16px 80px" }}>{children}</div>
            </div>

            {/* 広い画面 */}
            <div
                className="desktop-only"
                style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}
            >
                <MypageSideNav />

                <div
                    style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "32px 48px",
                        background: "var(--color-bg-card)",
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
