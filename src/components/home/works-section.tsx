import BookCard from "@/components/home/book-card";

import type { HomeBook } from "@/types/home";

/**
 * Pick Up! / New Release! カルーセル（デザイン home_10 の section.works）
 *
 * - 左右送り: home.js の works_carousel.js 由来コード
 * - 更新ボタン: works_refresh.js 由来コード
 *   （候補プールは HomeEffects 経由で home.js に渡す）
 */
export default function WorksSection({
    kind,
    title,
    moreHref,
    moreLabel,
    items,
}: {
    kind: "pickup" | "new_release";
    title: string;
    moreHref: string;
    moreLabel: string;
    items: HomeBook[];
}) {
    return (
        <section className="works" data-works={kind}>
            <div className="w_head">
                <h2>{title}</h2>
                <a href={moreHref}>{moreLabel}</a>
                <button className="w_refresh" aria-label="更新">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-3-6.7" />
                        <path d="M21 3v6h-6" />
                    </svg>
                </button>
            </div>
            <div className="w_carousel">
                <button className="w_nav w_prev oct_line icn_chip" aria-label="前の作品へ"><span className="icn icn_chev_l"></span></button>
                <div className="w_view">
                    <ul className="w_grid">
                        {items.map((book) => (
                            <li key={book.id}>
                                <BookCard book={book} />
                            </li>
                        ))}
                    </ul>
                </div>
                <button className="w_nav w_next oct_line icn_chip" aria-label="次の作品へ"><span className="icn icn_chev_r"></span></button>
            </div>
        </section>
    );
}
