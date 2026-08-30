import Footer from '@/components/layout/footer'

/**
 * ============================================================
 * 原石航路 Studio
 * FooterOnWhite — 白いページ用のフッター
 *
 * フッターの上には 18rem の余白がある（footer-below-fold）。
 * 下まで読み切った人にだけ見えるようにするためのもの。
 *
 * ただし、余白には背景が塗られない。
 * ページの地の色がそのまま出る。
 *
 * 白いページに置くと、白い本文とフッターのあいだに
 * 灰色の帯ができてしまう。
 *
 * ここで白い箱に入れて、余白ごと白く塗る。
 *
 * ★ flow-root が要る。
 *   これが無いと、中の margin-top が箱の外へすり抜けて
 *   （マージンの相殺）、白く塗られない。
 * ============================================================
 */

export default function FooterOnWhite() {
    return (
        <div style={{ display: 'flow-root', background: '#fff' }}>
            <Footer />
        </div>
    )
}
