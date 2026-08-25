import type { HomeBook } from "@/types/home";
import { genreColor, genreShort } from "@/types";

/**
 * 本の統一フォーマット（デザイン home_10 の book_template.js と同一構造）
 *
 * - variant="grid"  : Pick Up! / New Release! / 4カラムリスト用のフラット構造
 * - variant="shelf" : 本棚ループ用（b_front / b_spine / b_top / b_back / b_shadow）
 *
 * クリック時の作品情報ポップアップ（book_info.js）は
 * この DOM から textContent を収集するため、クラス名を変更しないこと。
 */

function BookFields({ book }: { book: HomeBook }) {
    return (
        <>
            <p className="b_title">{book.title}</p>
            <p className="b_author">{book.author}</p>
            {/*
             * 付箋。
             *
             * ジャンルごとに色を変える。
             * 色を見ただけで、どんな話かの見当がつく。
             */}
            <ul className="b_tags">
                {book.tags.map((tag, i) => (
                    <li
                        key={i}
                        style={{ backgroundColor: genreColor(tag) }}
                        title={tag}
                    >
                        {/*
                         * 名前を 2 つ持たせる。
                         *
                         * 正面の本は幅があるので、そのまま。
                         * 横向きの本は細いので、短いほう。
                         * どちらを出すかは CSS が決める。
                         */}
                        <span className="b_tag-full">{tag}</span>
                        <span className="b_tag-short">{genreShort(tag)}</span>
                    </li>
                ))}
            </ul>
            <p className="b_head">{book.head}</p>
            <p className="b_excerpt">{book.excerpt}</p>
            <p className="b_comment">{book.comment}</p>
            <p className="b_likes">{book.likes}</p>
        </>
    );
}

export default function BookCard({
    book,
    variant = "grid",
    index,
}: {
    book: HomeBook;
    variant?: "grid" | "shelf";
    index?: number;
}) {
    if (variant === "shelf") {
        return (
            <a className="book" href={book.href} data-index={index} data-id={book.id} data-placeholder={book.placeholder ? "1" : undefined}>
                <div className="b_front">
                    <BookFields book={book} />
                </div>
                <div className="b_spine">
                    <p className="b_title">{book.title}</p>
                </div>
                <div className="b_top"></div>
                <div className="b_back"></div>
                <div className="b_shadow"></div>
            </a>
        );
    }

    return (
        <a className="book" href={book.href} data-id={book.id} data-placeholder={book.placeholder ? "1" : undefined}>
            <BookFields book={book} />
        </a>
    );
}
