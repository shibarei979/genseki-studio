'use client'

import Link from 'next/link'

import ContestBanner from '@/components/common/contest-banner'
import type { Contest } from '@/types'

/**
 * ============================================================
 * 原石航路
 * ReaderNoticeBoard — コンテストとお知らせを、絵で見せる
 *
 * 柱には文字のお知らせしか出ていない。
 * 絵は柱の幅では小さすぎて、何の告知か伝わらない。
 *
 * 中央に横並びで置き、絵をそのまま見せる。
 * ============================================================
 */

interface NoticeImage {
    id: string
    title: string
    image: string | null
    link: string | null
}

export default function ReaderNoticeBoard({
    contests,
    notices,
}: {
    contests: Contest[]
    notices: NoticeImage[]
}) {
    /* どちらも無ければ、枠ごと出さない */
    if (contests.length === 0 && notices.length === 0) return null

    return (
        <section className="rnb">
            {contests.length > 0 && (
                <div className="rnb_block">
                    <div className="rnb_head">
                        <h2 className="rnb_title">開催中のコンテスト</h2>
                        <Link href="/contest" className="rnb_more">
                            すべて見る <span aria-hidden="true">›</span>
                        </Link>
                    </div>

                    <ul className="rnb_grid">
                        {contests.map((contest) => (
                            <li key={contest.id}>
                                <Link
                                    href={`/contest/${contest.id}`}
                                    title={contest.title || 'コンテスト'}
                                    className="rnb_card"
                                >
                                    <span className="rnb_thumb">
                                        <ContestBanner
                                            contest={contest}
                                            className="h-full w-full"
                                        />
                                    </span>
                                    <span className="rnb_label">{contest.title}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {notices.length > 0 && (
                <div className="rnb_block">
                    <div className="rnb_head">
                        <h2 className="rnb_title">お知らせ</h2>
                        <Link href="/news" className="rnb_more">
                            すべて見る <span aria-hidden="true">›</span>
                        </Link>
                    </div>

                    <ul className="rnb_grid">
                        {notices.map((notice) => (
                            <li key={notice.id}>
                                <Link
                                    href={notice.link || '/news'}
                                    title={notice.title}
                                    className="rnb_card"
                                >
                                    <span className="rnb_thumb">
                                        {notice.image ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={notice.image}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="rnb_blank" />
                                        )}
                                    </span>
                                    <span className="rnb_label">{notice.title}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    )
}
