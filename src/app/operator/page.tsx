import Link from 'next/link'

import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'

export const metadata = {
    title: '運営について｜原石航路',
    description: '原石航路を運営している者と、この場所を作った理由について。',
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

export default function OperatorPage() {
    return (
        <div className="page-with-footer bg-canvas">
            <Header breadcrumbs={[{ label: '運営について' }]} />

            <main className="mx-auto w-full max-w-[720px] px-6 py-12 sm:px-8">
                <h1 className="font-serif text-[26px] font-bold leading-relaxed tracking-wide text-ink">
                    運営について
                </h1>

                {/* ---- なぜ作ったか ---- */}
                <section className="mt-10">
                    <h2 className="font-serif text-[18px] font-bold tracking-wide text-ink">
                        この場所を作った理由
                    </h2>

                    <div className="mt-4 space-y-4 text-[13.5px] leading-[2.1] text-muted">
                        <p>
                            小説の投稿サイトを見ていて、ずっと引っかかっていたことがあります。
                        </p>
                        <p>
                            ランキングの上位が、いつも似た作品で埋まっている。
                            特定のジャンルが強く、そこから外れた物語は、
                            どれだけ丁寧に書かれていても人の目に触れない。
                        </p>
                        <p>
                            流行のジャンルが読まれること自体は、悪いことではありません。
                            読みたい人がいて、書きたい人がいる。それだけのことです。
                        </p>
                        <p>
                            ただ、<strong className="font-bold text-ink">
                                そこから外れた作品が「無かったこと」になるのは、おかしい
                            </strong>と感じました。
                        </p>
                        <p>
                            誰にも読まれないまま埋もれている物語が、たしかにある。
                            それを掘り出す場所があってもいいはずだ、と思って作ったのが原石航路です。
                        </p>
                    </div>
                </section>

                {/* ---- そのために何をしているか ---- */}
                <section className="mt-12">
                    <h2 className="font-serif text-[18px] font-bold tracking-wide text-ink">
                        そのためにしていること
                    </h2>

                    <ul className="mt-4 space-y-5">
                        {[
                            {
                                title: 'まだ読まれていない作品を、前に出す',
                                body: 'ホームには「ここからの作品」という枠があります。人目に触れていない作品を、そこに置いています。',
                            },
                            {
                                title: 'ジャンルで順位を分ける',
                                body: 'ランキングをジャンルごとに分けています。ひとつの物差しで全部を並べると、強いジャンルだけが残ります。',
                            },
                            {
                                title: '読者が見つけた作品を残す',
                                body: '「発掘」の仕組みがあります。運営が選ぶだけでなく、読者が良いと思った作品を残せます。',
                            },
                        ].map((one) => (
                            <li key={one.title}>
                                <p className="text-[14px] font-bold text-ink">{one.title}</p>
                                <p className="mt-1.5 text-[13px] leading-[2] text-muted">
                                    {one.body}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* ---- 誰が運営しているか ---- */}
                <section className="mt-12">
                    <h2 className="font-serif text-[18px] font-bold tracking-wide text-ink">
                        運営者
                    </h2>

                    <dl className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
                        {[
                            { label: 'サイト名', value: '原石航路' },
                            { label: '運営者', value: '芝崎レイ' },
                            { label: '運営形態', value: '個人' },
                        ].map((row, at) => (
                            <div
                                key={row.label}
                                className={`flex gap-4 px-5 py-3.5 text-[13px] ${
                                    at === 0 ? '' : 'border-t border-line'
                                }`}
                            >
                                <dt className="w-24 shrink-0 text-muted">{row.label}</dt>
                                <dd className="text-ink">{row.value}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                {/* ---- 連絡先 ---- */}
                <section className="mt-12">
                    <h2 className="font-serif text-[18px] font-bold tracking-wide text-ink">
                        お問い合わせ
                    </h2>

                    <p className="mt-4 text-[13px] leading-[2] text-muted">
                        ご意見、不具合の報告、権利にかかわるご連絡は、
                        お問い合わせフォームからお願いします。
                        <br />
                        いただいた内容は運営者本人が読んでいます。
                    </p>

                    <Link
                        href="/contact"
                        className="mt-5 inline-block rounded-full bg-forest px-6 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                    >
                        お問い合わせフォームへ
                    </Link>
                </section>
            </main>

            <Footer tight />
        </div>
    )
}
