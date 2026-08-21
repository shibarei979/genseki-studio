/**
 * ============================================================
 * 原石航路 Studio
 * Footer — サイト共通のフッター
 *
 * GENSEKIKORO のものを移した。
 * 並びと文言はそのまま。色と組みだけ Studio に合わせる。
 *
 * 「作品を探す」「ランキング」は投稿サイト側の道なので、
 * まだ無いものは出さない。開いても何も無い道は、
 * 出さないほうが親切。
 * ============================================================
 */

import Link from "next/link";

/** フッターに並べる道 */
const SECTIONS = [
    {
        title: "はじめての方へ",
        links: [
            { href: "/about", label: "原石航路とは" },
            { href: "/guide", label: "投稿ガイド" },
            { href: "/faq", label: "よくある質問" },
        ],
    },
    {
        title: "サポート",
        links: [
            { href: "/help", label: "ヘルプ・FAQ" },
            { href: "/contact", label: "お問い合わせ" },
            { href: "/feedback", label: "ご意見・ご要望" },
        ],
    },
    {
        title: "規約・ガイドライン",
        links: [
            { href: "/terms", label: "利用規約" },
            { href: "/privacy", label: "プライバシーポリシー" },
            { href: "/guidelines", label: "投稿ガイドライン" },
        ],
    },
];

export default function Footer({
    /**
     * 上の余白を詰めるか。
     *
     * ふだんは本文とのあいだを大きく空ける。
     * ただし中身が画面より長いページでは、
     * その空きがそのまま無駄な隙間になる。
     */
    tight = false,
}: { tight?: boolean } = {}) {
    /*
     * 左右の余白は本体と同じ（px-6 / sm:px-10）。
     * ここだけ内側に寄せると、下で急にすぼまったように見える。
     */
    /*
     * 最初の画面には入れない。
     *
     * 中身が短いページだと、開いた瞬間に
     * 黒い帯が目に入る。読む前に終わりが見えると、
     * そのページが空っぽに感じられる。
     *
     * 上に空きを置くのではなく、
     * 「画面の高さより下」から始まるようにする。
     * 中身が長ければ、そのまま続きに出る。
     */
    return (
        <footer className={`${tight ? "" : "footer-below-fold"} bg-[#2f2b26] px-6 py-11 text-white sm:px-10`}>
                    <div>
                        {/*
                         * 名乗りと道を横に並べる。
                         * 縦に積むと、下に長い帯ができて重い。
                         */}
                        <div className="grid gap-10 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
                            <div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/logo.svg"
                                    alt="原石航路"
                                    className="h-9 w-auto brightness-0 invert"
                                />

                                <p className="mt-3.5 text-[12px] leading-relaxed text-white/60">
                                    原石航路は、書き手と読み手をつなぐ場所。
                                    <br />
                                    あなたの物語が、誰かの心を照らします。
                                </p>
                            </div>

                            <nav className="grid gap-8 sm:grid-cols-3">
                                {SECTIONS.map((section) => (
                                    <div key={section.title}>
                                        <h2 className="text-[13px] font-semibold">
                                            {section.title}
                                        </h2>

                                        <ul className="mt-3 space-y-2">
                                            {section.links.map((link) => (
                                                <li key={link.href}>
                                                    <Link
                                                        href={link.href}
                                                        className="text-[12px] text-white/60 transition-colors hover:text-white"
                                                    >
                                                        {link.label}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </nav>
                        </div>

                        {/* 区切ってから年を出す */}
                        <p className="mt-9 border-t border-white/10 pt-5 text-[11px] text-white/35">
                            <small>© 2026 原石航路 All Rights Reserved.</small>
                        </p>
                    </div>
                </footer>
    );
}
