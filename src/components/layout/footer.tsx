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
            /* 誰が運営しているかと、作った理由 */
            { href: "/operator", label: "運営について" },
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
    {
        /*
         * サイトの中への道。
         *
         * 説明や規約だけでは、下まで読んだ人の行き先が無い。
         * ここから作品や投稿へ戻れるようにする。
         */
        title: "サービス",
        links: [
            { href: "/post", label: "作品を投稿する" },
            { href: "/search", label: "作品を探す" },
            { href: "/ranking", label: "ランキング" },
            { href: "/mypage", label: "マイページ" },
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
                        {/*
                         * 中央に寄せる。
                         *
                         * 画面いっぱいに広げると、
                         * 左端と右端が遠すぎて一続きに見えない。
                         */}
                        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
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

                                {/*
                                 * 主な道を 2 つだけ。
                                 *
                                 * 下まで読んだ人が、次に何をするかを示す。
                                 * 並べすぎると、どれも押されない。
                                 */}
                                <div className="mt-5 flex flex-wrap gap-2.5">
                                    <Link
                                        href="/post"
                                        className="rounded-full bg-forest px-5 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
                                    >
                                        作品を投稿する
                                    </Link>
                                    <Link
                                        href="/search"
                                        className="rounded-full border border-white/30 px-5 py-2 text-[12.5px] text-white/85 transition-colors hover:border-white/60 hover:text-white"
                                    >
                                        作品を探す
                                    </Link>
                                </div>
                            </div>

                            <nav className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                                {SECTIONS.map((section) => (
                                    <div key={section.title}>
                                        <h2 className="text-[13px] font-semibold">
                                            {section.title}
                                        </h2>

                                        {/*
                                         * 行の間を詰める。
                                         * 空きすぎると、どこまでが一組か分からない。
                                         */}
                                        <ul className="mt-2.5 space-y-1.5">
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
                        {/* 区切ってから、中央に年を出す */}
                        <p className="mx-auto mt-9 max-w-6xl border-t border-white/10 pt-5 text-center text-[11px] text-white/35">
                            <small>© 2026 原石航路 All Rights Reserved.</small>
                        </p>
                    </div>
                </footer>
    );
}
