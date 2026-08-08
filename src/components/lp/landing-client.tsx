/**
 * ============================================================
 * 原石航路 Studio
 * LandingClient — 案内
 *
 * 作りはコトノハに倣う。
 *   見出し 1 つに、画面写し 1 枚。文章は 3 行まで。
 *   説明を並べるのではなく、実物を見せる。
 *
 * 見出しは「何ができるか」ではなく「どうなるか」を書く。
 *   ×「執筆室は、書くための空間です」
 *   ○「誰かの気配が、書く手を止めない」
 *
 * 画面写しはまだ無いので、ScreenSlot が空の枠を出す。
 * 絵で見立てを描かない。作っていないものを描くのは嘘になる。
 *
 * 航路を主に。夜明けの海の色で通す。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ScreenSlot from "@/components/lp/screen-slot";

export default function LandingClient() {
    return (
        <div className="min-h-screen" style={{ background: "var(--color-chart)" }}>
            <Nav />
            <Hero />

            {/* ---- 売り。1 つずつ、大きく見せる ---- */}
            <Feature
                index="01"
                title={<>誰かの気配が、
書く手を止めない。</>}
                body="同じ時間に、誰かも書いている。それが分かるだけで、机に戻れます。"
                slot={{ label: "執筆室の画面" }}
                notes={[
                    "家具を置いて、自分だけの部屋に",
                    "招く相手を選べます",
                    "集中の時間を区切れます",
                ]}
                isDark
            />

            <Feature
                index="02"
                title={<>設定が、
本文からひとりでに立ち上がる。</>}
                body="人物も、土地も、書いたそばから資料になります。あなたは選ぶだけです。"
                slot={{ label: "資料の候補が出ている画面" }}
                notes={[
                    "人物・場所・組織・用語・アイテム・事件",
                    "「律さん」と「律」をひとつに",
                    "資料から本文の行へ飛べます",
                ]}
                isFlipped
            />

            <Feature
                index="03"
                title={<>誰と誰が、
いつ交わったか。</>}
                body="関係図と時系列。長くなるほど、頭の中だけでは持てなくなります。"
                slot={{ label: "関係図の画面" }}
                notes={["線を引くだけで繋がります", "時系列は物語順と暦順で持てます"]}
            />

            <Feature
                index="04"
                title={<>縦書きのまま、
書き上がりを確かめる。</>}
                body="書きながら横書きへ切り替えられます。ルビも傍点も、記号ひとつで。"
                slot={{ label: "執筆画面（縦書き）" }}
                notes={["30版までさかのぼれます", "推敲チェックは7種類"]}
                isFlipped
            />

            <NoAiOnBody />
            <OtherFeatures />
            <Pricing />
            <Faq />
            <Closing />
            <Footer />
        </div>
    );
}

function Nav() {
    /*
     * 上に貼り付いて付いてくる。
     *
     * 冒頭は暗い海なので、最初は透かして白抜き。
     * 下へ送ると白い面になる。ずっと不透明だと絵を遮る。
     */
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        function onScroll() {
            setIsScrolled(window.scrollY > 80);
        }
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <nav
            className="fixed inset-x-0 top-0 z-40 transition-colors duration-300"
            style={{
                background: isScrolled ? "rgba(247,244,236,0.55)" : "transparent",
                backdropFilter: isScrolled ? "blur(14px)" : undefined,
                borderBottom: isScrolled
                    ? "1px solid rgba(180,206,222,0.5)"
                    : "1px solid transparent",
            }}
        >
            <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4 sm:px-10">
                <Link href="/lp" className="flex shrink-0 items-center gap-2.5">
                    {/*
                     * 暗い海の上では、そのままだとロゴが沈む。
                     * 白に寄せて浮かせ、下げたら元の色へ戻す。
                     */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logo.svg"
                        alt="原石航路"
                        className="h-14 w-auto transition-[filter] duration-300"
                        style={{
                            filter: isScrolled
                                ? "none"
                                : "brightness(0) invert(1) drop-shadow(0 1px 3px rgba(0,0,0,0.35))",
                        }}
                    />
                    <span
                        className="text-[10px] tracking-[0.24em] transition-colors"
                        style={{
                            color: isScrolled
                                ? "var(--color-faint)"
                                : "rgba(255,255,255,0.7)",
                        }}
                    >
                        STUDIO
                    </span>
                </Link>

                <span className="ml-auto flex items-center gap-2">
                    <Link
                        href="/login"
                        className="rounded-full px-4 py-2 text-xs transition-colors"
                        style={{
                            color: isScrolled
                                ? "var(--color-muted)"
                                : "rgba(255,255,255,0.85)",
                        }}
                    >
                        ログイン
                    </Link>

                    <Link
                        href="/login"
                        className="rounded-full px-5 py-2 text-xs font-medium transition-colors"
                        style={
                            isScrolled
                                ? { background: "var(--color-sea)", color: "#fff" }
                                : { background: "#fff", color: "var(--color-sea)" }
                        }
                    >
                        新規登録
                    </Link>
                </span>
            </div>
        </nav>
    );
}

/**
 * ============================================================
 * 冒頭
 *
 * 一文と、大きな画面写し。
 * 説明はここではしない。下で 1 つずつ見せる。
 * ============================================================
 */

function Hero() {
    return (
        <header className="relative overflow-hidden">
            {/* 夜明けの海 */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(180deg, #14384e 0%, #1f4e6b 45%, #3c7fa3 100%)",
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(110% 70% at 80% 12%, rgba(232,183,105,0.5) 0%, rgba(232,183,105,0) 55%)",
                }}
            />
            {/* 水平線 */}
            <div
                className="absolute inset-x-0"
                style={{
                    top: "58%",
                    height: 1,
                    background:
                        "linear-gradient(to right, transparent, rgba(255,255,255,0.45), transparent)",
                }}
            />

            <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-36 text-center sm:px-10">
                <h1 className="text-[32px] font-semibold leading-[1.4] text-white sm:text-[40px]">
                    ひとりで書く時間に、
                    <br />
                    誰かの気配を。
                </h1>

                <p className="mx-auto mt-5 max-w-md text-sm leading-loose text-white/75">
                    書く、調べる、集まる。
                    小説のための制作道具です。
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link
                        href="/login"
                        className="rounded-full bg-white px-8 py-3 text-sm font-medium shadow-lg"
                        style={{ color: "var(--color-sea)" }}
                    >
                        無料ではじめる
                    </Link>
                    <a
                        href="#features"
                        className="rounded-full border border-white/40 px-8 py-3 text-sm text-white/90 hover:bg-white/10"
                    >
                        できることを見る
                    </a>
                </div>

                <p className="mt-4 text-[11px] text-white/45">
                    登録は1分／縦書き・横書き／スマホでも
                </p>

                {/* 大きな画面写し。ここが顔になる */}
                <div className="mt-14">
                    <ScreenSlot label="執筆画面" ratio="16 / 9" onDark />
                </div>
            </div>
        </header>
    );
}

/**
 * ============================================================
 * 売りひとつぶん
 *
 * 見出し・一文・画面写し。それだけ。
 * 細かい話は小さく添えるに留める。
 * ============================================================
 */

function Feature({
    index,
    title,
    body,
    slot,
    notes,
    isDark = false,
    isFlipped = false,
}: {
    index: string;
    title: React.ReactNode;
    body: string;
    slot: { label: string; src?: string };
    notes?: string[];
    /** 濃い面にするか。続くと単調になるので、たまに挟む */
    isDark?: boolean;
    /** 写しを左に置くか */
    isFlipped?: boolean;
}) {
    const text = (
        <div className="min-w-0">
            <p
                className="text-[11px] tracking-[0.28em]"
                style={{ color: isDark ? "rgba(255,255,255,0.45)" : "var(--color-sea-light)" }}
            >
                {index}
            </p>

            <h2
                className="mt-4 whitespace-pre-line text-[24px] font-semibold leading-[1.6] sm:text-[27px]"
                style={{ color: isDark ? "#fff" : "var(--color-ink)" }}
            >
                {title}
            </h2>

            <p
                className="mt-4 text-sm leading-loose"
                style={{ color: isDark ? "rgba(255,255,255,0.75)" : "var(--color-muted)" }}
            >
                {body}
            </p>

            {notes && (
                <ul className="mt-5 space-y-2">
                    {notes.map((note) => (
                        <li
                            key={note}
                            className="flex gap-2.5 text-[12px] leading-relaxed"
                            style={{
                                color: isDark
                                    ? "rgba(255,255,255,0.6)"
                                    : "var(--color-faint)",
                            }}
                        >
                            <span
                                className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                                style={{
                                    background: isDark
                                        ? "var(--color-dawn)"
                                        : "var(--color-sea-light)",
                                }}
                            />
                            {note}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    const picture = <ScreenSlot label={slot.label} src={slot.src} onDark={isDark} />;

    return (
        <section
            id={index === "01" ? "features" : undefined}
            className="relative scroll-mt-16 overflow-hidden py-24"
            style={isDark ? { background: "var(--color-sea)" } : undefined}
        >
            {isDark && (
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(90% 60% at 15% 0%, rgba(232,183,105,0.2) 0%, rgba(232,183,105,0) 60%)",
                    }}
                />
            )}

            <div className="relative mx-auto grid max-w-5xl items-center gap-12 px-6 sm:px-10 lg:grid-cols-2">
                {isFlipped ? (
                    <>
                        <div className="order-2 lg:order-1">{picture}</div>
                        <div className="order-1 lg:order-2">{text}</div>
                    </>
                ) : (
                    <>
                        {text}
                        {picture}
                    </>
                )}
            </div>
        </section>
    );
}

/**
 * ============================================================
 * 約束 — 本文には触らせない
 *
 * ここが一番の差になる。数字より前に置く。
 * ============================================================
 */

function NoAiOnBody() {
    return (
        <section
            className="border-y py-24"
            style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-line)",
            }}
        >
            <div className="mx-auto max-w-xl px-6 text-center sm:px-10">
                <p className="text-[11px] tracking-[0.28em] text-[var(--color-sea-light)]">
                    PROMISE
                </p>

                <h2 className="mt-4 text-[26px] font-semibold leading-relaxed text-ink">
                    本文には、AIを触らせません。
                </h2>

                <p className="mt-5 text-sm leading-loose text-muted">
                    書くのはあなたです。
                    AIが手伝うのは、書いたものを整理することだけ。
                    本文を書く仕組みを、そもそも作っていません。
                </p>

                <div className="mx-auto mt-9 grid max-w-md gap-3 text-left sm:grid-cols-2">
                    <div
                        className="rounded-xl border px-5 py-4"
                        style={{ borderColor: "var(--color-sea-line)" }}
                    >
                        <p className="text-xs font-medium text-[var(--color-sea)]">
                            やること
                        </p>
                        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted">
                            <li>本文から人物や場所を拾う</li>
                            <li>資料に添える図案を作る</li>
                            <li>表記ゆれを見つける</li>
                        </ul>
                    </div>

                    <div
                        className="rounded-xl border px-5 py-4"
                        style={{ borderColor: "var(--color-danger-tint)" }}
                    >
                        <p className="text-xs font-medium text-[var(--color-danger)]">
                            やらないこと
                        </p>
                        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted">
                            <li>本文を書く</li>
                            <li>本文を書き換える</li>
                            <li>文章の良し悪しを言う</li>
                        </ul>
                    </div>
                </div>

                <p className="mt-5 text-[11px] text-faint">
                    推敲チェックも、AIではなく決められた規則で動いています。
                </p>
            </div>
        </section>
    );
}

/**
 * ============================================================
 * そのほか
 * ============================================================
 */

function OtherFeatures() {
    const items = [
        { title: "30版までさかのぼれる", body: "消してしまった一文も戻せます。" },
        { title: "プロットと時系列", body: "骨組みと出来事を分けて持てます。" },
        { title: "コンテスト", body: "書きあがった物語を、そのまま応募。" },
        { title: "集中の時間", body: "15分・25分・45分で区切れます。" },
        { title: "通し読み", body: "全話を続けて読み返せます。" },
        { title: "書き出せる", body: "抱え込みません。いつでも持ち出せます。" },
    ];

    return (
        <section className="mx-auto max-w-4xl px-6 py-24 sm:px-10">
            <h2 className="text-center text-[20px] font-semibold text-ink">
                書き続けるための、細かな道具。
            </h2>

            <ul className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                    <li key={item.title}>
                        <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                            <span
                                className="h-3 w-0.5 rounded-full"
                                style={{ background: "var(--color-sea)" }}
                            />
                            {item.title}
                        </p>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                            {item.body}
                        </p>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * ============================================================
 * 料金
 * ============================================================
 */

function Pricing() {
    return (
        <section
            className="border-y py-20"
            style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-line)",
            }}
        >
            <div className="mx-auto max-w-sm px-6 text-center sm:px-10">
                <h2 className="text-[20px] font-semibold text-ink">料金</h2>

                <div
                    className="mt-7 rounded-2xl border px-8 py-9"
                    style={{ borderColor: "var(--color-sea-line)" }}
                >
                    <p className="text-sm text-muted">いまはすべて</p>
                    <p
                        className="mt-1 text-[42px] font-semibold leading-none"
                        style={{ color: "var(--color-sea)" }}
                    >
                        無料
                    </p>
                    <p className="mt-4 text-[12px] leading-relaxed text-muted">
                        執筆・資料・執筆室・コンテスト。すべて使えます。
                    </p>

                    <Link
                        href="/login"
                        className="mt-7 block rounded-full py-3 text-sm font-medium text-white"
                        style={{ background: "var(--color-sea)" }}
                    >
                        無料ではじめる
                    </Link>
                </div>

                <p className="mt-3 text-[10px] leading-relaxed text-faint">
                    今後、一部の機能が有料になる場合があります。
                    その際も、書いたものは必ず持ち出せます。
                </p>
            </div>
        </section>
    );
}

/**
 * ============================================================
 * よくある問い
 * ============================================================
 */

function Faq() {
    const rows = [
        {
            q: "本当に無料ですか",
            a: "いまは全機能が無料です。今後一部が有料になる場合も、書いたものは必ず書き出せます。",
        },
        {
            q: "AIに小説を書かせますか",
            a: "書かせません。AIが手伝うのは資料の整理と図案だけで、本文を書く仕組みそのものがありません。",
        },
        {
            q: "書いたものは誰かに見られますか",
            a: "作品と資料は本人だけが読めます。執筆室で公開されるのは、いる・書いている、という状態だけです。",
        },
        {
            q: "縦書きで書けますか",
            a: "書けます。書きながら横書きと切り替えられます。ルビと傍点にも対応しています。",
        },
        {
            q: "ほかのサイトに投稿できますか",
            a: "テキストで書き出せます。投稿サイトとの連携も準備しています。",
        },
        {
            q: "スマホでも使えますか",
            a: "使えます。移動中に少し書き足す、という使い方もできます。",
        },
    ];

    return (
        <section className="mx-auto max-w-2xl px-6 py-24 sm:px-10">
            <h2 className="text-center text-[20px] font-semibold text-ink">
                よくある問い
            </h2>

            <ul className="mt-9">
                {rows.map((row) => (
                    <li
                        key={row.q}
                        className="border-t"
                        style={{ borderColor: "var(--color-line)" }}
                    >
                        <details className="group">
                            <summary className="flex cursor-pointer items-center gap-3 py-4 text-[14px] text-ink">
                                {row.q}
                                <span className="ml-auto text-lg text-faint group-open:hidden">
                                    ＋
                                </span>
                                <span className="ml-auto hidden text-lg text-faint group-open:inline">
                                    −
                                </span>
                            </summary>
                            <p className="pb-4 text-[12px] leading-loose text-muted">
                                {row.a}
                            </p>
                        </details>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * ============================================================
 * 締め
 * ============================================================
 */

function Closing() {
    return (
        <section className="relative overflow-hidden py-24">
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(180deg, #14384e 0%, #1f4e6b 60%, #2a6183 100%)",
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(90% 60% at 50% 120%, rgba(232,183,105,0.32) 0%, rgba(232,183,105,0) 60%)",
                }}
            />

            <div className="relative mx-auto max-w-lg px-6 text-center sm:px-10">
                <h2 className="text-[26px] font-semibold leading-relaxed text-white">
                    まずは、一行だけでも。
                </h2>
                <p className="mt-4 text-sm leading-loose text-white/70">
                    登録は1分。書きはじめてから、道具のことは考えてください。
                </p>

                <Link
                    href="/login"
                    className="mt-8 inline-block rounded-full bg-white px-9 py-3.5 text-sm font-medium shadow-lg"
                    style={{ color: "var(--color-sea)" }}
                >
                    無料ではじめる
                </Link>
            </div>
        </section>
    );
}

function Footer() {
    return (
        <footer
            className="px-6 py-8 sm:px-10"
            style={{ background: "var(--color-sea-dark)" }}
        >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3">
                <span className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logo.svg"
                        alt="原石航路"
                        className="h-11 w-auto"
                        style={{ filter: "brightness(0) invert(1)", opacity: 0.85 }}
                    />
                    <span className="text-[10px] tracking-[0.24em] text-white/50">
                        STUDIO
                    </span>
                </span>

                <nav className="flex flex-wrap gap-4 text-[11px] text-white/55">
                    <Link href="/login" className="hover:text-white">
                        ログイン
                    </Link>
                    <Link href="/login" className="hover:text-white">
                        新規登録
                    </Link>
                </nav>

                <span className="ml-auto text-[10px] text-white/35">© 原石航路</span>
            </div>
        </footer>
    );
}
