import BookCard from "@/components/home/book-card";

import type { HomeBook } from "@/types/home";

/**
 * ログインユーザー向け 4カラムリスト（デザイン home_10 の section.reading_list）
 * 続きから読む / あなたへのおすすめ / フォローした作者の更新 / フォローした作者の新着
 */
export default function ReadingListSection({
    columns,
}: {
    columns: { title: string; items: HomeBook[] }[];
}) {
    return (
        <section className="reading_list">
            {columns.map((col) => (
                <div className="rl_col" key={col.title}>
                    <h2>{col.title}</h2>
                    <ul>
                        {col.items.map((book) => (
                            <li key={book.id}>
                                <BookCard book={book} />
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </section>
    );
}
