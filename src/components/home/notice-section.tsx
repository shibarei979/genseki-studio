import type { HomeNotice } from "@/types/home";

/**
 * お知らせ（デザイン home_10 の section.notice）
 *
 * - タブ: すべて / お知らせ / コンテスト（切替は home.js の notice_tab.js 由来コード）
 * - data-n-fold="on": 4件表示 + もっと見るボタン → "off" で8件表示
 * - 左側の重なり画像アニメーションは notice_img.js 由来コードが担当
 */
function NoticeList({ items }: { items: HomeNotice[] }) {
    return (
        <ul>
            {items.map((n) => (
                <li key={n.id}>
                    <a href={n.href}>
                        <img className="n_img" src={n.image} alt="" />
                        <p className="n_time">{n.time}</p>
                        <p className="n_title">{n.title}</p>
                        <p className="n_detail">{n.detail}</p>
                    </a>
                </li>
            ))}
        </ul>
    );
}

export default function NoticeSection({
    all,
    notices,
    contests,
}: {
    all: HomeNotice[];
    notices: HomeNotice[];
    contests: HomeNotice[];
}) {
    return (
        <section className="notice" data-n-fold="on" data-n-tab="all">
            <div className="n_pick">
                <h2>すべてのお知らせ</h2>
                <NoticeList items={all} />
            </div>
            <div>
                <h2>お知らせ</h2>
                <NoticeList items={notices} />
            </div>
            <div>
                <h2>コンテスト</h2>
                <NoticeList items={contests} />
            </div>
            <button id="n_fold">さらに見る</button>
            <a href="/announcements">さらに見る</a>
        </section>
    );
}
