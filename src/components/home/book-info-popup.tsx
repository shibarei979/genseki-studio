/**
 * 作品情報ポップアップの器（デザイン home_10 の div.book_info）
 * 中身の流し込み・開閉は home.js の book_info.js 由来コードが担当。
 */
export default function BookInfoPopup() {
    return (
        <div className="book_info" aria-hidden="true">
            <div className="bi_overlay"></div>
            <div className="bi_book" role="dialog" aria-modal="true" aria-label="作品情報">
                <button className="bi_close oct_fill" aria-label="閉じる"><span className="icn icn_close"></span></button>
                <div className="bi_page bi_left">
                    <p className="bi_head"></p>
                    <div className="bi_quote">
                        <p className="bi_excerpt"></p>
                        <p className="bi_comment"></p>
                    </div>
                </div>
                <div className="bi_page bi_right">
                    <div className="bi_v">
                        <p className="bi_title"></p>
                        <p className="bi_author"></p>
                    </div>
                    <ul className="bi_tags"></ul>
                    <p className="bi_likes">0</p>
                    <a className="bi_read oct_fill" href="#">この本を読む　→</a>
                </div>
            </div>
        </div>
    );
}
