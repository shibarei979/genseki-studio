/**
 * ============================================================
 * 原石航路 Studio
 * 携帯：話を読む画面の、話の題の帯
 *
 *   ‹（作品の目次へ） ｜ 作品名（小さく）・話の題 ｜ 保存の印
 *
 * ★ サイトの上ヘッダーはそのまま残し、その下に置く。
 * ★ 前は「ホーム › 作品 › 話」のパンくずだった。細くて押しにくく、
 *   いま何を読んでいるかが目に入らなかった。
 * ★ 1024px 未満でだけ出す（mobile-read.css）。
 * ============================================================
 */

import Link from "next/link";

import BookmarkMark from "@/components/home/bookmark-mark";

export default function MobileEpisodeHead({
    novelId,
    novelTitle,
    episodeTitle,
}: {
    novelId: string;
    novelTitle: string;
    episodeTitle: string;
}) {
    return (
        <div className="mrh">
            <Link href={`/novel/${novelId}`} className="mrh-ib" aria-label="作品の目次へ戻る">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                </svg>
            </Link>
            <Link href={`/novel/${novelId}`} className="mrh-ttl">
                <span className="mrh-w">{novelTitle}</span>
                <span className="mrh-e">{episodeTitle}</span>
            </Link>
            {/* 作品を保存する（あとで読む）。一覧の印と同じもの */}
            <span className="mrh-ib mrh-save">
                <BookmarkMark novelId={novelId} />
            </span>
        </div>
    );
}
