import BookCard from "@/components/home/book-card";

import type { HomeBook } from "@/types/home";

/**
 * 本棚ループ（デザイン home_10 の .bookshelf-loop）
 * ランダムに選ばれた作品を回転表示する。
 * 回転・配置は public/home/home.js（bookshelf_loop.js 由来）が担当。
 */
export default function BookshelfSection({ books }: { books: HomeBook[] }) {
    return (
        <div className="bookshelf-loop">
            <div className="bsl_track">
                {books.map((book, i) => (
                    <BookCard key={book.id} book={book} variant="shelf" index={i} />
                ))}
            </div>
        </div>
    );
}
