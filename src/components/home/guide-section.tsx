/**
 * ユーザーガイド（デザイン home_10 の section.guide）
 */
export default function GuideSection() {
    return (
        <section className="guide">
            <h2>ユーザーガイド</h2>
            <a href="/search">お気に入りの小説をみつける</a>
            <a href="/post" data-set-view="writer">オリジナルの小説を投稿する</a>
        </section>
    );
}
