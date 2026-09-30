/**
 * ============================================================
 * 原石航路 Studio
 * 携帯：作品の中のページ（資料・設定 など）の上の段
 *
 *   ‹ 戻る ｜ 小さくページ名／大きく作品名 ｜ 投稿（まだ出していない話の数）
 *
 * ★ 1024px 未満でだけ出す（CSS の mwh は携帯でだけ flex になる）。
 * ★ 「投稿」は、どのページでも右上の同じ場所に出す。
 *   どこから投稿するのか分からない、という声への答え。
 * ============================================================
 */

"use client";

import Link from "next/link";

import { MwIcon } from "@/components/workspace/mobile-write-kit";

export default function MobileWorkHeader({
    workId,
    page,
    title,
    backHref,
    unposted = 0,
    right,
}: {
    workId: string;
    /** 小さく出す、いまのページの名前（資料・設定 など） */
    page: string;
    /** 大きく出す名前（ふつうは作品の題） */
    title: string;
    backHref?: string;
    unposted?: number;
    /** 投稿の代わりに右に置くもの（1 人のページの「直す」など） */
    right?: React.ReactNode;
}) {
    return (
        <div className="mwh">
            <Link href={backHref ?? `/workspace/${workId}`} className="mw-iconbtn" aria-label="戻る">
                <MwIcon name="back" />
            </Link>
            <div className="mwh-title">
                <small>{page}</small>
                <b>{title}</b>
            </div>
            {right ?? (
                <Link href={`/workspace/${workId}/post`} className="mw-post">
                    <MwIcon name="send" size={15} />
                    投稿
                    {unposted > 0 && <span className="mw-post-count">{unposted}</span>}
                </Link>
            )}
        </div>
    );
}
