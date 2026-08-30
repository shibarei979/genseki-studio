import Link from 'next/link'

import { GENRES } from '@/types'

/**
 * ============================================================
 * 原石航路 Studio
 * RecommendSidebar — 探すための柱
 *
 * ここでは絞り込みをしない。
 * どれを押しても「作品を探す」へ、条件を付けて送るだけ。
 *
 * ★ 同じ絞り込みを 2 か所で作らない。
 *   探す条件は /search が持っている。
 *   ここにも作ると、片方だけ直して食い違う。
 * ============================================================
 */

/** 上の 3 つ。いま見ているものを濃くする */
const VIEWS = [
    { key: 'recommend', label: 'おすすめ', href: '/recommend' },
    { key: 'new', label: '新着作品', href: '/search?sort=new' },
    { key: 'rising', label: '急上昇作品', href: '/ranking' },
]

/** こだわり条件。/search の受け口に合わせる */
const FILTERS = [
    { label: '完結済み', href: '/search?serial=completed' },
    { label: '長編作品', href: '/search?type=長編' },
    { label: '短編作品', href: '/search?type=短編' },
    { label: '連載中', href: '/search?serial=serial' },
]

export default function RecommendSidebar({
    current = 'recommend',
}: {
    current?: string
}) {
    return (
        <aside className="rs">
            <div className="rs_group">
                <p className="rs_label">探す</p>
                <ul>
                    {VIEWS.map((view) => (
                        <li key={view.key}>
                            <Link
                                href={view.href}
                                className={`rs_item${view.key === current ? ' is-on' : ''}`}
                            >
                                {view.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rs_group">
                <p className="rs_label">ジャンルから探す</p>
                <ul>
                    {GENRES.map((genre) => (
                        <li key={genre}>
                            <Link
                                href={`/search?genre=${encodeURIComponent(genre)}`}
                                className="rs_item"
                            >
                                {genre}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rs_group">
                <p className="rs_label">こだわり条件</p>
                <ul>
                    {FILTERS.map((filter) => (
                        <li key={filter.label}>
                            <Link href={filter.href} className="rs_item">
                                {filter.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    )
}
