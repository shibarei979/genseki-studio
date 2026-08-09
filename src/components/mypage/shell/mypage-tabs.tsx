/**
 * ============================================================
 * 原石航路 Studio
 * MypageTabs — マイページの行き先
 *
 * ページごとに分けたので、タブは道筋を指すだけ。
 *
 * 1 枚に全部を載せていたときは、開いた瞬間に
 * すべての表を読んでいた。設定を見たいだけの人も、
 * 保存済みも履歴もつぶやきも待つことになる。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TabItem {
    href: string;
    label: string;
    /** 数の札。0 なら出さない */
    badge?: number;
}

const TABS: TabItem[] = [
    { href: "/mypage", label: "マイページ" },
    { href: "/mypage/works", label: "作品管理" },
    { href: "/mypage/series", label: "シリーズ" },
    { href: "/mypage/bookmarks", label: "保存済み" },
    { href: "/mypage/history", label: "閲覧履歴" },
    { href: "/mypage/tweets", label: "つぶやき" },
    { href: "/mypage/missions", label: "ミッション" },
    { href: "/mypage/settings", label: "設定" },
];

export default function MypageTabs({ claimable = 0 }: { claimable?: number }) {
    const pathname = usePathname();

    return (
        <nav className="thin-scroll -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
            {TABS.map((tab) => {
                /*
                 * いまどこにいるか。
                 * /mypage は前方一致にすると全部が光るので、
                 * そこだけ完全一致で見る。
                 */
                const isHere =
                    tab.href === "/mypage"
                        ? pathname === "/mypage"
                        : pathname.startsWith(tab.href);

                const badge = tab.href === "/mypage/missions" ? claimable : 0;

                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={[
                            "relative shrink-0 whitespace-nowrap px-3.5 py-2.5 text-[13px]",
                            isHere
                                ? "border-b-2 border-forest font-semibold text-forest"
                                : "text-muted hover:text-ink",
                        ].join(" ")}
                    >
                        {tab.label}

                        {badge > 0 && (
                            <span className="ml-1.5 rounded-full bg-forest px-1.5 py-0.5 text-[10px] text-white">
                                {badge}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
