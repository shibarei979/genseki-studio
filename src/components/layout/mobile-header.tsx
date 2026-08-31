"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AccountMenu from "@/components/layout/account-menu";

/**
 * ============================================================
 * 原石航路 Studio
 * MobileHeader — 携帯だけのヘッダー
 *
 * ロゴ・ベル・自分の絵の 3 つだけ。
 * 行き先は下の帯（MobileTabBar）にある。
 *
 * ★ 既存のヘッダーとは別物。
 *
 *   既存のヘッダーは、行き先の並び・パンくず・入室中の帯を
 *   ぶら下げていて、携帯では隠しても高さが残っていた。
 *   何度直しても白い部分が伸びたままだったので、
 *   携帯では丸ごと差し替える。
 *
 *   既存には手を入れないので、パソコンには影響しない。
 *
 * ★ 中身は既存の部品を使い回す。
 *   ベルの一覧やアカウントの押し具を作り直すと、
 *   同じ動きを二重に持つことになり、片方だけ古くなる。
 * ============================================================
 */

export default function MobileHeader() {
    const pathname = usePathname() || "/";

    /*
     * 本文を書く画面だけ、出さない。
     *
     * ★ /workspace 全部を外してはいけない。
     *   設定・資料・下読みも同じ道の下にあり、
     *   丸ごと外すと、そこから戻る術が無くなる。
     *
     * 本文を書くのは /workspace/…/post だけ。
     */
    if (/^\/workspace\/[^/]+\/post/.test(pathname)) return null;

    return (
        <header className="mh">
            <Link href="/" className="mh_logo" aria-label="原石航路 ホームへ">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.svg" alt="原石航路" />
            </Link>

            <div className="mh_right">
                {/*
                  * ベル。
                  *
                  * 押すとお知らせの頁へ行く。
                  * 既存のヘッダーは、その場で一覧を開く作りだが、
                  * 携帯では画面が狭く、開いた一覧が入りきらない。
                  * 頁へ送るほうが読みやすい。
                  */}
                <Link href="/notices" className="mh_bell" aria-label="お知らせ">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.9"
                        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7" />
                        <path d="M13.7 20a2 2 0 0 1-3.4 0" />
                    </svg>
                </Link>

                <AccountMenu isCurrent={pathname.startsWith("/mypage")} />
            </div>
        </header>
    );
}
