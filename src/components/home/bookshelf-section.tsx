import BookCard from "@/components/home/book-card";

import type { HomeBook } from "@/types/home";

/**
 * 本棚ループ（デザイン home_10 の .bookshelf-loop）
 * ランダムに選ばれた作品を回転表示する。
 * 回転・配置は public/home/home.js（bookshelf_loop.js 由来）が担当。
 */
export default function BookshelfSection({ books }: { books: HomeBook[] }) {
    return (
        /*
         * ★ 最初から見えない状態で配る。
         *
         *   CSS で隠すと、その CSS が届くまでの隙に見えてしまう。
         *   HTML そのものに書いておけば、最初の1枚目から隠れる。
         *
         *   位置が決まったら外す（home-effects.tsx）。
         */
        <div className="bookshelf-loop" style={{ opacity: 0 }}>
            <div className="bsl_track">
                {books.map((book, i) => (
                    <BookCard key={book.id} book={book} variant="shelf" index={i} />
                ))}
            </div>
        </div>
    );
}
