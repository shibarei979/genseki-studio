import Link from 'next/link'

import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'

export const metadata = {
    title: '運営について｜原石航路',
    description:
        '原石航路を運営している者と、この場所を作った理由について。埋もれた物語が見つかる場所を目指しています。',
}

/**
 * ============================================================
 * 原石航路 Studio
 * /operator  運営について
 *
 * 誰が運営しているかと、なぜ作ったかを書く。
 *
 * ★ 「原石航路とは」（/about）とは役目が違う。
 *   あちらは機能とサイトの案内。
 *   ここは運営者そのものと、作った理由。
 *
 * ★ 出す情報は最小限にした。
 *   個人が運営しているので、住所や電話番号は出さない。
 *   問い合わせはフォームで受ける。
 *
 *   有料の売り買いを始めるときは、
 *   特定商取引法で出すべきものが変わる。
 *   そのときは専門家に確かめること。
 * ============================================================
 */

/** そのためにしていること */
const ACTIONS = [
    {
        no: '01',
        title: 'まだ読まれていない作品を、前に出す',
        body: 'ホームに「ここからの作品」という枠があります。人目に触れていない作品を、そこに置いています。読まれた数の多い順に並べるだけでは、この枠は作れません。',
        href: '/recommend?view=hidden',
        link: '見に行く',
    },
    {
        no: '02',
        title: 'ジャンルで順位を分ける',
        body: 'ランキングをジャンルごとに分けています。ひとつの物差しで全部を並べると、強いジャンルだけが残ります。分けることで、その中でいちばん読まれた物語が見えます。',
        href: '/ranking',
        link: 'ランキングへ',
    },
    {
        no: '03',
        title: '読者が見つけた作品を残す',
        body: '「発掘」の仕組みがあります。運営が選ぶだけでは、結局ひとりの好みになる。読者が良いと思った作品が残るようにしています。',
        href: '/search',
        link: '作品を探す',
    },
]

/** 大事にしていること */
const VALUES = [
    {
        title: '数字で作品を測りきらない',
        body: '読まれた数は、その作品の価値そのものではありません。まだ誰にも見つかっていないだけ、ということがあります。',
    },
    {
        title: '書き手が安心して置ける場所に',
        body: '嫌がらせを受けたときに自衛できること、書きかけが勝手に出ないこと。当たり前のことを、当たり前に守ります。',
    },
    {
        title: '直せるものは、すぐ直す',
        body: '個人で運営しているので、大きなことはできません。そのぶん、届いた声には早く手を動かします。',
    },
]

export default function OperatorPage() {
    return (
        <div className="page-with-footer bg-canvas">
            <Header breadcrumbs={[{ label: '運営について' }]} />

            <main className="mx-auto w-full max-w-[760px] px-6 py-10 sm:px-8">
                {/*
                  * 見出し。
                  *
                  * ★ ここでいちばん言いたいことを、最初に置く。
                  *   下まで読まれるとは限らない。
                  */}
                <section className="overflow-hidden rounded-2xl bg-forest px-7 py-9 text-white sm:px-10 sm:py-11">
                    <p className="text-[11.5px] tracking-[0.18em] text-white/60">
                        運営について
                    </p>
                    <h1 className="mt-3 font-serif text-[22px] font-bold leading-[1.7] tracking-wide sm:text-[26px]">
                        その一冊が、
                        <br />
                        埋もれないように。
                    </h1>
                    <p className="mt-4 max-w-[30em] text-[12.5px] leading-[2.1] text-white/70">
                        原石航路は、まだ読まれていない物語が見つかる場所を目指して、
                        個人で運営しています。
                    </p>
                </section>

                {/* ---- なぜ作ったか ---- */}
                <section className="mt-11">
                    <h2 className="font-serif text-[19px] font-bold tracking-wide text-ink">
                        この場所を作った理由
                    </h2>

                    <div className="mt-5 space-y-4 text-[13.5px] leading-[2.15] text-muted">
                        <p>
                            小説の投稿サイトを見ていて、ずっと引っかかっていたことがあります。
                        </p>
                        <p>
                            ランキングの上位が、いつも似た作品で埋まっている。
                            特定のジャンルが強く、そこから外れた物語は、
                            どれだけ丁寧に書かれていても人の目に触れない。
                        </p>

                        {/*
                          * いちばん言いたい一文。
                          * 段落の中に混ぜず、引用の形で立たせる。
                          */}
                        <blockquote className="my-6 border-l-[3px] border-forest bg-surface py-4 pl-5 pr-4">
                            <p className="font-serif text-[15px] font-bold leading-[1.95] text-ink">
                                流行のジャンルが読まれること自体は、
                                悪いことではありません。
                                <br />
                                ただ、そこから外れた作品が
                                「無かったこと」になるのは、おかしい。
                            </p>
                        </blockquote>

                        <p>
                            読みたい人がいて、書きたい人がいる。それだけのことです。
                            強いジャンルを責めたいわけではありません。
                        </p>
                        <p>
                            ただ、誰にも読まれないまま埋もれている物語が、たしかにある。
                            それを掘り出す場所があってもいいはずだ、と思って作ったのが原石航路です。
                        </p>
                    </div>
                </section>

                {/* ---- そのためにしていること ---- */}
                <section className="mt-12">
                    <h2 className="font-serif text-[19px] font-bold tracking-wide text-ink">
                        そのためにしていること
                    </h2>
                    <p className="mt-2 text-[12.5px] leading-[1.9] text-faint">
                        理由だけでは言葉に終わります。実際にしていることを並べます。
                    </p>

                    <ul className="mt-6 space-y-4">
                        {ACTIONS.map((one) => (
                            <li
                                key={one.no}
                                className="rounded-xl border border-line bg-surface px-6 py-5"
                            >
                                <div className="flex items-baseline gap-3">
                                    <span className="font-serif text-[15px] font-bold text-forest">
                                        {one.no}
                                    </span>
                                    <h3 className="text-[14.5px] font-bold text-ink">
                                        {one.title}
                                    </h3>
                                </div>
                                <p className="mt-2.5 text-[13px] leading-[2.05] text-muted">
                                    {one.body}
                                </p>
                                <Link
                                    href={one.href}
                                    className="mt-3 inline-block text-[12.5px] text-forest hover:opacity-75"
                                >
                                    {one.link} →
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* ---- 大事にしていること ---- */}
                <section className="mt-12">
                    <h2 className="font-serif text-[19px] font-bold tracking-wide text-ink">
                        大事にしていること
                    </h2>

                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                        {VALUES.map((one) => (
                            <div
                                key={one.title}
                                className="rounded-xl border border-line bg-surface px-5 py-5"
                            >
                                <h3 className="text-[13.5px] font-bold leading-[1.7] text-ink">
                                    {one.title}
                                </h3>
                                <p className="mt-2.5 text-[12px] leading-[2] text-muted">
                                    {one.body}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ---- 誰が運営しているか ---- */}
                <section className="mt-12">
                    <h2 className="font-serif text-[19px] font-bold tracking-wide text-ink">
                        運営者
                    </h2>

                    <dl className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
                        {[
                            { label: 'サイト名', value: '原石航路' },
                            { label: '運営者', value: '芝崎レイ' },
                            { label: '運営形態', value: '個人' },
                            /*
                             * X（旧 Twitter）。
                             *
                             * 別の窓で開く。よそへ飛ばすときは、読んでいたページを残す。
                             * noreferrer は、どこから来たかを相手に渡さないため。
                             */
                            {
                                label: 'X',
                                value: '@shibasakirei',
                                href: 'https://x.com/shibasakirei',
                            },
                        ].map((row, at) => (
                            <div
                                key={row.label}
                                className={`flex gap-4 px-5 py-3.5 text-[13px] ${
                                    at === 0 ? '' : 'border-t border-line'
                                }`}
                            >
                                <dt className="w-24 shrink-0 text-muted">{row.label}</dt>
                                <dd className="text-ink">
                                    {row.href ? (
                                        <a
                                            href={row.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-forest underline underline-offset-2 hover:opacity-80"
                                        >
                                            {row.value}
                                        </a>
                                    ) : (
                                        row.value
                                    )}
                                </dd>
                            </div>
                        ))}
                    </dl>

                    <p className="mt-3 text-[11.5px] leading-[1.9] text-faint">
                        個人で運営しているため、住所や電話番号は公開していません。
                        ご連絡はお問い合わせフォームからお願いします。
                    </p>
                </section>

                {/* ---- 連絡先 ---- */}
                <section className="mt-11 rounded-2xl border border-line bg-surface px-7 py-8 text-center">
                    <h2 className="font-serif text-[17px] font-bold tracking-wide text-ink">
                        お問い合わせ
                    </h2>
                    <p className="mx-auto mt-3 max-w-[26em] text-[12.5px] leading-[2.05] text-muted">
                        ご意見、不具合の報告、権利にかかわるご連絡は、
                        お問い合わせフォームからお願いします。
                        いただいた内容は運営者本人が読んでいます。
                    </p>

                    <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                        <Link
                            href="/contact"
                            className="rounded-full bg-forest px-6 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                        >
                            お問い合わせ
                        </Link>
                        <Link
                            href="/feedback"
                            className="rounded-full border border-line px-6 py-2.5 text-[13px] text-muted transition-colors hover:text-ink"
                        >
                            ご意見・ご要望
                        </Link>
                    </div>
                </section>
            </main>

            <Footer tight />
        </div>
    )
}
