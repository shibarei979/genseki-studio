/**
 * ローディング画面（デザイン home_10 の #loading）
 * 解除は home.js（loading.js 由来）が #home10 の is_loading を外して行う。
 */
export default function LoadingScreen() {
    return (
        <div id="loading">
            <div className="ld_book" aria-hidden="true">
                <span className="ld_page ld_p1"></span>
                <span className="ld_page ld_p2"></span>
                <span className="ld_page ld_p3"></span>
            </div>
            <p className="ld_text">Loading</p>
        </div>
    );
}
