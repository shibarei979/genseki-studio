/**
 * ============================================================
 * 原石航路 Studio
 * LandingClient — ログインする前の案内
 *
 * まだ何も知らない人に、上から順に読ませる。
 *
 *   顔      … 何のサイトか、一文で
 *   できること … 4 つだけ。並べすぎると何も残らない
 *   機能    … 道具の中身
 *   コンテスト … 書いたあとに何があるか
 *   理由    … なぜこの場所を作ったか
 *   締め    … もう一度だけ入口を出す
 *
 * ------------------------------------------------------------
 * 色について
 *
 * ここだけ紺を基調にする。アプリの中は橙だが、
 * ロゴが紺で、案内は「海と航路」の顔で見せたい。
 * 押してほしいボタンだけ橙にして、紺の中で 1 か所だけ光らせる。
 *
 * 紺はこのファイルの中だけで持つ。
 * トークンに足すとアプリ全体に影響するが、
 * 使うのはこの 1 枚だけなので、ここに閉じておく。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** 案内でだけ使う紺 */
const NAVY = {
    deep: "#12294a",
    base: "#1e3a5f",
    soft: "#2c4d78",
    line: "#c7d5e6",
    tint: "#eef3f9",
    ink: "#1a3557",
};

interface Props {
    /**
     * 「無料で始める」を押したときの行き先。
     *
     * 渡されなければ /login へ送る。
     * 渡されたときは、その場で棚へ入れる。
     * Supabase に繋いでいないとログインの仕組みが無いので、
     * ログイン画面へ送っても行き止まりになる。
     */
    onStart?: () => void;
}

export default function LandingClient({ onStart }: Props) {
    return (
        <div className="min-h-screen bg-white">
            <Nav onStart={onStart} />
            <Hero onStart={onStart} />
            <WhatYouCanDo />
            <Features />
            <Contests />
            <Why />
            <Closing onStart={onStart} />
            <Footer />
        </div>
    );
}

/**
 * 「無料で始める」。
 *
 * 行き先が 2 通りあるので、押す先だけを差し替えられるようにする。
 * 3 か所に同じ分岐を書くと、片方を直し忘れる。
 */
function StartButton({
    onStart,
    className,
    style,
    children,
}: {
    onStart?: () => void;
    className: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}) {
    if (onStart) {
        return (
            <button type="button" onClick={onStart} className={className} style={style}>
                {children}
            </button>
        );
    }

    return (
        <Link href="/login" className={className} style={style}>
            {children}
        </Link>
    );
}

/**
 * ============================================================
 * 上の帯
 *
 * 下へ送ると白い地になるので、最初から白で貼り付ける。
 * 透明から白へ変えると、境目で文字の色が入れ替わって
 * 一瞬読めなくなる。
 * ============================================================
 */

function Nav({ onStart }: { onStart?: () => void }) {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        function onScroll() {
            setIsScrolled(window.scrollY > 8);
        }
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className="sticky top-0 z-40 bg-white/95 backdrop-blur transition-shadow"
            style={{ boxShadow: isScrolled ? "0 1px 0 rgba(0,0,0,0.07)" : "none" }}
        >
            <div className="mx-auto flex h-[72px] max-w-6xl items-center px-5 sm:px-8">
                <Link href="/" aria-label="原石航路" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.svg" alt="原石航路" className="h-[64px] w-auto" />
                </Link>

                <div className="ml-auto flex items-center gap-2">
                    <StartButton
                        onStart={onStart}
                        className="rounded-md px-4 py-2 text-[12px] font-medium text-white hover:opacity-90"
                        style={{ background: NAVY.deep }}
                    >
                        無料で始める
                    </StartButton>
                    {/*
                     * ログインの仕組みが無いときは出さない。
                     * 押しても何もできない画面へ送ることになる。
                     */}
                    {!onStart && (
                        <Link
                            href="/login"
                            className="rounded-md border px-4 py-2 text-[12px] hover:bg-black/[0.03]"
                            style={{ borderColor: NAVY.line, color: NAVY.ink }}
                        >
                            ログイン
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}

/**
 * ============================================================
 * 顔
 *
 * 左に言葉、右に絵。
 * 絵の左端は白へ溶かす。境目をはっきり切ると、
 * 貼り付けた四角に見えて安っぽくなる。
 * ============================================================
 */

/**
 * ============================================================
 * 案内に置く絵
 *
 * public/images/lp/ に、下の名前で置く。
 * 置けばそのまま出る。コードを直す必要はない。
 *
 *   hero    … 顔の右側に敷く大きな絵
 *   editor  … 執筆エディターの画面写し
 *   plot    … プロット機能の画面写し
 *   room    … 執筆室の画面写し
 *
 * 拡張子は png / jpg / jpeg / webp のどれでもよい。
 * 上から順に探して、見つかったものを使う。
 * 毎回ここを直さずに済むよう、候補を並べてある。
 *
 * どれも無ければ、線で描いた見立てが出る。
 * 空白にはしない。何が入る場所なのか分からなくなる。
 * ============================================================
 */
const LP_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

function lpImages(name: string): string[] {
    return LP_IMAGE_EXTENSIONS.map((ext) => `/images/lp/${name}.${ext}`);
}

/** 顔に敷く絵。無ければ手元の水彩を使う */
const HERO_IMAGES = [...lpImages("hero"), "/images/hero-lighthouse.webp"];

function Hero({ onStart }: { onStart?: () => void }) {
    const [heroIndex, setHeroIndex] = useState(0);

    return (
        <section className="relative overflow-hidden bg-white">
            {/*
             * 顔の絵。
             *
             * 背景ではなく img で敷く。
             * background-image は読めなくても何も知らせてこないので、
             * 次の候補へ送れない。
             */}
            {/*
             * 絵。
             *
             * 広い画面では右半分に敷く。
             * 右へ寄せすぎると、字と絵の境目が
             * 画面の真ん中より左に来る。半分でちょうどよい。
             *
             * 狭い画面では全体に敷き、その上に字を載せる。
             * 横に並べる幅が無いので、重ねる。
             */}
            <div
                className="absolute inset-0 overflow-hidden md:inset-y-0 md:left-auto md:right-0 md:w-1/2"
                /*
                 * 広い画面では、絵の左端をなだらかに消す。
                 *
                 * 真ん中でぷつりと切ると、写真を貼った境目が見える。
                 * mask で左 22% までを透明から立ち上げ、
                 * 白い地へ溶け込ませる。
                 * 覆いではなく mask なのは、下の地の色が
                 * 何色でも同じに効くようにするため。
                 */
                style={{
                    maskImage:
                        "linear-gradient(to right, transparent 0%, black 22%)",
                    WebkitMaskImage:
                        "linear-gradient(to right, transparent 0%, black 22%)",
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={HERO_IMAGES[heroIndex]}
                    alt=""
                    draggable={false}
                    onError={() =>
                        setHeroIndex((current) =>
                            Math.min(current + 1, HERO_IMAGES.length - 1),
                        )
                    }
                    className="h-full w-full object-cover"
                    aria-hidden="true"
                />
            </div>
            <div
                className="absolute inset-0 md:hidden"
                style={{
                    /*
                     * 狭い画面。
                     *
                     * 絵の上に字を載せるので、白を薄く敷く。
                     * 敷かないと、絵の明るい所で字が消える。
                     */
                    background:
                        "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.88) 55%, rgba(255,255,255,0.8) 100%)",
                }}
                aria-hidden="true"
            />
            <div
                className="absolute inset-0 hidden md:block"
                style={{
                    background:
                        "linear-gradient(90deg, #ffffff 0%, #ffffff 42%, rgba(255,255,255,0.85) 54%, rgba(255,255,255,0) 78%)",
                }}
                aria-hidden="true"
            />

            <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-24">
                {/*
                 * 見出し。
                 *
                 * 改行は広い画面だけ。
                 * 狭い画面で同じ所で折ると、1 行に 2 文字だけ残る
                 * ような割れ方をする。
                 */}
                <h1
                    className="text-[19px] leading-[1.55] tracking-[0.02em] sm:text-[34px] sm:leading-[1.65]"
                    style={{ color: NAVY.ink }}
                >
                    物語を生み出すすべての人のための、
                    <br />
                    創作活動プラットフォーム
                </h1>

                <p className="mt-4 text-[12px] leading-[1.9] text-[#4a5a6e] sm:mt-7 sm:text-[13px] sm:leading-[2.2]">
                    原石航路は、あなたのアイデアを形にし、
                    <br className="hidden sm:inline" />
                    物語を深め、作品を飛躍させるための場所です。
                    <br className="hidden sm:inline" />
                    書くことに集中できる環境と、
                    <br className="hidden sm:inline" />
                    仲間やチャンスに出会える仕組みをそろえました。
                </p>

                {/*
                 * ボタン。
                 *
                 * 狭い画面では幅いっぱいに。
                 * 指で押すものなので、小さいと外す。
                 */}
                <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-9 sm:flex sm:flex-wrap sm:gap-3">
                    <StartButton
                        onStart={onStart}
                        className="rounded-md py-2.5 text-center text-[12px] font-medium text-white hover:opacity-90 sm:py-3.5 sm:px-9 sm:text-[13px]"
                        style={{ background: NAVY.deep }}
                    >
                        無料で始める
                    </StartButton>
                    {!onStart && (
                        <Link
                            href="/login"
                            className="rounded-md border bg-white py-2.5 text-center text-[12px] hover:bg-black/[0.03] sm:py-3.5 sm:px-9 sm:text-[13px]"
                            style={{ borderColor: NAVY.line, color: NAVY.ink }}
                        >
                            ログイン
                        </Link>
                    )}
                </div>
            </div>
        </section>
    );
}

/**
 * ============================================================
 * できること
 *
 * 4 つに絞る。
 * 全部を並べると、どれも同じ重さになって何も残らない。
 * ============================================================
 */

function WhatYouCanDo() {
    const items = [
        {
            icon: <QuillIcon />,
            title: "書く",
            body: "シンプルで集中できる執筆環境で、物語の世界を自由に描けます。",
        },
        {
            icon: <BoxIcon />,
            title: "整理する",
            body: "プロットや設定、メモを整理して、創作の全体像を見わたせます。",
        },
        {
            icon: <PeopleIcon />,
            title: "コミュニティー",
            body: "執筆仲間とつながり、刺激し合いながら創作を続けられます。",
        },
        {
            icon: <TrophyIcon />,
            title: "イベント（コンテスト）",
            body: "定期的にコンテストを開催。あなたの物語が評価され、新しいチャンスにつながります。",
        },
    ];

    return (
        <section id="about" className="scroll-mt-16 bg-white py-20">
            <SectionTitle>原石航路でできること</SectionTitle>

            {/*
             * 4 つ。
             *
             * 狭い画面では 2 × 2 に置く。
             * 縦に 4 つ並べると、画面 1 つぶん送ることになり、
             * 「何ができるか」が一目で分からない。
             */}
            <ul className="mx-auto mt-8 grid max-w-6xl grid-cols-2 gap-2.5 px-4 sm:mt-12 sm:gap-x-0 sm:gap-y-10 sm:px-8 lg:grid-cols-4">
                {items.map((item, index) => (
                    <li
                        key={item.title}
                        /*
                         * 狭い画面では正方形の枠に収める。
                         * 高さが揃うので、2 × 2 が整って見える。
                         */
                        /*
                         * 狭い画面では正方形に収める。
                         * 枠線は引かない。4 つが箱に見えて、
                         * 押せるものだと受け取られる。
                         */
                        className="flex aspect-square flex-col items-center justify-center px-2 text-center sm:aspect-auto sm:block sm:px-6 lg:border-l"
                        style={{
                            /* 1 つ目の左には線を引かない */
                            borderColor: index === 0 ? "transparent" : NAVY.line,
                        }}
                    >
                        <span
                            className="mx-auto flex h-9 w-9 items-center justify-center rounded-full sm:h-16 sm:w-16"
                            style={{ background: NAVY.tint, color: NAVY.base }}
                        >
                            {item.icon}
                        </span>
                        <h3
                            className="mt-2 text-[12px] tracking-[0.04em] sm:mt-5 sm:text-[15px] sm:tracking-[0.08em]"
                            style={{ color: NAVY.ink }}
                        >
                            {item.title}
                        </h3>
                        <p className="mt-1.5 text-[9.5px] leading-[1.6] text-[#5a6a7c] sm:mt-3 sm:text-[12px] sm:leading-[2]">
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
 * 機能
 *
 * 上に説明と画面写し、下に 4 つ並べる。
 * ============================================================
 */

function Features() {
    const items = [
        {
            icon: <PenIcon />,
            title: "執筆エディター",
            body: "見やすく、書きやすいエディターで思考を止めずに執筆できます。",
            figure: <Figure name="editor" label="執筆エディター" fallback={<PaneMock rows={9} />} />,
        },
        {
            icon: <GridIcon />,
            title: "プロット機能",
            body: "物語の流れや構成を整理し、視点を俯瞰も管理できます。",
            figure: <Figure name="plot" label="プロット機能" fallback={<CardsMock />} />,
        },
        {
            icon: <PeopleIcon small />,
            title: "執筆室（オンラインスペース）",
            body: "仲間と集まり、静かな空間で一緒に執筆できます。",
            /*
             * 執筆室だけは、置かなくても実物の部屋の絵が出る。
             * 画面写しを置けばそちらが優先される。
             */
            figure: (
                <Figure
                    name="room"
                    fallback={
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src="/images/rooms/room-medium.png"
                            alt="執筆室の中"
                            className="h-full w-full object-cover"
                            style={{ objectPosition: "center 40%" }}
                        />
                    }
                />
            ),
        },
        {
            icon: <CloudIcon />,
            title: "自動保存機能",
            body: "大切な原稿を自動で安全に保存。いつでも復元できます。",
            figure: <SavedMock />,
        },
    ];

    return (
        <section
            id="features"
            className="scroll-mt-16 py-20"
            style={{ background: NAVY.tint }}
        >
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-2">
                <div>
                    <h2
                        className="text-[24px] leading-[1.6] tracking-[0.03em] sm:text-[27px]"
                        style={{ color: NAVY.ink }}
                    >
                        充実の機能で、
                        <br />
                        創作を支える
                    </h2>
                    <p className="mt-5 text-[13px] leading-[2.1] text-[#4a5a6e]">
                        原稿の執筆から管理、共存、公開まで、
                        <br />
                        創作活動に必要な機能をひとつにまとめました。
                    </p>

                    <a
                        href="#features"
                        className="mt-7 inline-flex items-center gap-2 rounded-md border bg-white px-6 py-3 text-[12px] hover:bg-black/[0.03]"
                        style={{ borderColor: NAVY.line, color: NAVY.ink }}
                    >
                        機能をすべて見る
                        <span aria-hidden="true">→</span>
                    </a>
                </div>

                <DeviceFrame />
            </div>

            {/* 4 つの機能 */}
            <ul className="mx-auto mt-12 grid max-w-6xl gap-y-9 rounded-xl bg-white px-5 py-10 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
                {items.map((item, index) => (
                    <li
                        key={item.title}
                        className="px-6 text-center lg:border-l"
                        style={{
                            borderColor: index === 0 ? "transparent" : NAVY.line,
                        }}
                    >
                        <span
                            className="mx-auto flex h-10 w-10 items-center justify-center"
                            style={{ color: NAVY.base }}
                        >
                            {item.icon}
                        </span>
                        <h3
                            className="mt-3 text-[13px] tracking-[0.06em]"
                            style={{ color: NAVY.ink }}
                        >
                            {item.title}
                        </h3>
                        <p className="mt-2.5 text-[11px] leading-[1.9] text-[#5a6a7c]">
                            {item.body}
                        </p>

                        {/*
                         * 図。
                         *
                         * 高さを揃える。中身の縦幅がまちまちだと、
                         * 4 つ並べたときに下端が階段になる。
                         */}
                        <div
                            className="mt-4 overflow-hidden rounded-md"
                            style={{ height: 122, background: NAVY.tint }}
                        >
                            {item.figure}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * ============================================================
 * 小さな図
 *
 * 画面写しの代わり。実物を撮るまでのつなぎ。
 *
 * 中身の文字は書かない。読める字を入れると、
 * 実物に無い文言を約束したことになる。
 * 形だけを見せて、何の画面かが分かればよい。
 * ============================================================
 */

/**
 * 画面写しの枠。
 *
 * public/images/lp/ にその名前の絵があれば出す。
 * 無ければ、線で描いた見立てを出す。
 *
 * 拡張子ちがいを順に試すのは、
 * png で置いたか jpg で置いたかを気にせずに済ませるため。
 */
function Figure({
    name,
    fallback,
    label = "",
}: {
    name: string;
    fallback: React.ReactNode;
    /** 大きく出したときの説明 */
    label?: string;
}) {
    const candidates = lpImages(name);
    const [index, setIndex] = useState(0);
    const [hasFailed, setHasFailed] = useState(false);

    /* 押すと大きく見られる */
    const [isOpen, setIsOpen] = useState(false);

    if (hasFailed) return <>{fallback}</>;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                title="押すと大きく見られます"
                className="h-full w-full cursor-zoom-in"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={candidates[index]}
                    alt={label}
                    draggable={false}
                    onError={() => {
                        if (index + 1 < candidates.length) setIndex(index + 1);
                        else setHasFailed(true);
                    }}
                    className="h-full w-full object-cover"
                />
            </button>

            {/*
             * 大きく出す。
             *
             * 小さいままだと何の画面か分からない。
             * 押したら全体が見えるようにする。
             */}
            {isOpen && (
                <div
                    role="dialog"
                    aria-label={label || "画面の写し"}
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/70 p-6"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={candidates[index]}
                        alt={label}
                        draggable={false}
                        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                    />

                    {label && (
                        <span className="absolute bottom-6 text-[12px] text-white/80">
                            {label}
                        </span>
                    )}
                </div>
            )}
        </>
    );
}

function PaneMock({ rows }: { rows: number }) {
    return (
        <div className="flex h-full w-full gap-2 bg-white p-3">
            <div
                className="w-[22%] shrink-0 rounded-sm"
                style={{ background: NAVY.tint }}
            />
            <div className="flex min-w-0 flex-1 flex-col justify-start gap-[5px] pt-1">
                {Array.from({ length: rows }).map((_, index) => (
                    <span
                        key={index}
                        className="block h-[4px] rounded-full"
                        style={{
                            background: NAVY.line,
                            /* 行末を揃えない。揃うと表に見える */
                            width: `${[92, 78, 88, 62, 84, 70, 90][index % 7]}%`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function CardsMock() {
    return (
        <div className="grid h-full w-full grid-cols-3 gap-2 bg-white p-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
                <span
                    key={index}
                    className="rounded-sm"
                    style={{
                        background: index % 3 === 1 ? NAVY.line : NAVY.tint,
                        border: `1px solid ${NAVY.line}`,
                    }}
                />
            ))}
        </div>
    );
}

function SavedMock() {
    return (
        <div className="flex h-full w-full items-center justify-center bg-white px-3">
            <div
                className="flex w-full items-center gap-2.5 rounded-lg border bg-white px-3.5 py-3 shadow-sm"
                style={{ borderColor: NAVY.line }}
            >
                <span className="min-w-0 flex-1">
                    <span
                        className="block text-[11px]"
                        style={{ color: NAVY.ink }}
                    >
                        自動保存しました
                    </span>
                    <span className="mt-1 block text-[10px] text-[#8a97a6]">
                        最終保存 10:23
                    </span>
                </span>
                <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: "var(--color-leaf)" }}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" {...stroke(3)}>
                        <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                </span>
            </div>
        </div>
    );
}

/**
 * 画面写しの枠。
 *
 * 中身の絵はまだ無い。
 * 作っていない画面を描いて見せると、入ったあとで違うことになる。
 * 枠だけ置いて、写しが撮れたら差し替える。
 */
function DeviceFrame() {
    /*
     * 画面の写し。
     *
     * 無ければ「準備中」と出す。
     * 空の枠だけ置くと、壊れているように見える。
     */
    const [hasDesktop, setHasDesktop] = useState(true);
    const [hasMobile, setHasMobile] = useState(true);

    return (
        <div className="relative">
            {/* ノート型 */}
            <div
                className="relative rounded-xl border-[10px] border-b-[16px] bg-white shadow-xl"
                style={{ borderColor: "#2b3440", aspectRatio: "16 / 10" }}
            >
                <div
                    className="flex h-full w-full items-center justify-center overflow-hidden rounded-sm"
                    style={{ background: NAVY.tint }}
                >
                    {hasDesktop ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src="/images/lp/desktop.jpg"
                            alt="執筆画面"
                            draggable={false}
                            onError={() => setHasDesktop(false)}
                            className="h-full w-full object-cover object-top"
                        />
                    ) : (
                        <span className="text-[11px]" style={{ color: NAVY.soft }}>
                            執筆画面（準備中）
                        </span>
                    )}
                </div>
            </div>

            {/* 手のひら型。右下に重ねる */}
            <div
                className="absolute -bottom-6 -right-2 hidden w-[22%] overflow-hidden rounded-[14px] border-[6px] bg-white shadow-lg sm:block"
                style={{ borderColor: "#2b3440", aspectRatio: "9 / 17" }}
            >
                {hasMobile ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src="/images/lp/mobile.png"
                        alt="スマートフォンでの画面"
                        draggable={false}
                        onError={() => setHasMobile(false)}
                        className="h-full w-full rounded-[6px] object-cover object-top"
                    />
                ) : (
                    <div
                        className="h-full w-full rounded-[6px]"
                        style={{ background: NAVY.tint }}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * ============================================================
 * コンテスト
 * ============================================================
 */

function Contests() {
    const cards = [
        {
            title: "新人賞コンテスト",
            latin: "Rookie Award",
            body: "未来のヒット作家を発掘する登竜門。大賞には豪華特典をご用意。",
            notes: ["年2回開催", "大賞・各賞あり", "上位は特設ページで紹介"],
        },
        {
            title: "テーマ別コンテスト",
            latin: "Theme Contest",
            body: "毎月変わるテーマで、あなたの創作を試そう。",
            notes: ["毎月開催", "短編／長編／エッセイなど多彩", "参加は自由、誰でも挑戦可能"],
        },
    ];

    return (
        <section id="contest" className="scroll-mt-16 bg-white py-20">
            <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                <div>
                    <h2
                        className="text-[24px] leading-[1.6] tracking-[0.03em] sm:text-[27px]"
                        style={{ color: NAVY.ink }}
                    >
                        創作を加速させる、
                        <br />
                        イベントとコンテスト
                    </h2>
                    <p className="mt-5 text-[13px] leading-[2.1] text-[#4a5a6e]">
                        新人賞やテーマ別コンテストを定期開催。
                        あなたの物語が評価されるチャンスが、ここにはたくさんあります。
                    </p>

                    <Link
                        href="/contest"
                        className="mt-7 inline-flex items-center gap-2 rounded-md border bg-white px-6 py-3 text-[12px] hover:bg-black/[0.03]"
                        style={{ borderColor: NAVY.line, color: NAVY.ink }}
                    >
                        コンテスト一覧を見る
                        <span aria-hidden="true">→</span>
                    </Link>
                </div>

                <div>
                    <ul className="grid gap-5 sm:grid-cols-2">
                        {cards.map((card) => (
                            <li
                                key={card.title}
                                /*
                                 * 押せる。押すとコンテスト一覧へ。
                                 * 見て終わりの箱にしない。
                                 */
                                className="group relative overflow-hidden rounded-2xl px-7 py-8 transition-transform hover:-translate-y-0.5"
                                style={{
                                    background: `linear-gradient(160deg, ${NAVY.base} 0%, ${NAVY.deep} 100%)`,
                                    boxShadow:
                                        "0 2px 8px rgba(31,78,107,0.18), 0 12px 32px rgba(31,78,107,0.14)",
                                }}
                            >
                                {/* 遠くの灯り。紺だけだと沈む */}
                                <span
                                    className="absolute inset-0"
                                    style={{
                                        background:
                                            "radial-gradient(70% 50% at 80% 15%, rgba(255,214,150,0.22) 0%, rgba(255,214,150,0) 60%)",
                                    }}
                                    aria-hidden="true"
                                />

                                <div className="relative">
                                    {/*
                                     * 見出しの上に細い線。
                                     * 紺一色だと、どこから読むか目が迷う。
                                     */}
                                    <span
                                        className="mb-4 block h-px w-10"
                                        style={{ background: "#e8b769" }}
                                        aria-hidden="true"
                                    />

                                    <p className="text-[10px] tracking-[0.2em] text-white/40">
                                        {card.latin}
                                    </p>

                                    <h3 className="mt-1.5 text-[18px] tracking-[0.04em] text-white">
                                        {card.title}
                                    </h3>

                                    <p className="mt-4 text-[12px] leading-[2] text-white/70">
                                        {card.body}
                                    </p>

                                    <ul className="mt-6 space-y-3 border-t border-white/10 pt-5">
                                        {card.notes.map((note) => (
                                            <li
                                                key={note}
                                                className="flex gap-2.5 text-[11px] leading-relaxed text-white/70"
                                            >
                                                <span
                                                    className="mt-1 h-1 w-1 shrink-0 rounded-full"
                                                    style={{ background: "#e8b769" }}
                                                />
                                                {note}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <p className="mt-6 text-center">
                        <Link
                            href="/contest"
                            className="inline-flex items-center gap-2 text-[12px] hover:opacity-70"
                            style={{ color: NAVY.ink }}
                        >
                            すべてのコンテストを見る
                            <span aria-hidden="true">→</span>
                        </Link>
                    </p>
                </div>
            </div>
        </section>
    );
}

/**
 * ============================================================
 * この場所をつくった理由
 *
 * 機能の話をやめて、なぜ作ったかを書く。
 * 道具は他にもあるので、選ぶ理由はここにしか無い。
 * ============================================================
 */

function Why() {
    const points = [
        {
            icon: <CompassIcon />,
            title: "埋もれた原石を見つける",
            body: "優れた作品や才能を持つ書き手を、発掘・応援します。",
        },
        {
            icon: <LighthouseIcon />,
            title: "創作を支える、最高の環境",
            body: "書くことに集中できるツールと、仲間とつながる場を提供します。",
        },
        {
            icon: <TelescopeIcon />,
            title: "物語が未来をつくる",
            body: "あなたの物語が、誰かの心を動かし、世界を変える一歩になる。",
        },
    ];

    return (
        <section
            id="why"
            className="scroll-mt-16 py-20"
            /* 地よりわずかに濃くして、前後の節と切る */
            style={{ background: "linear-gradient(180deg, #f6f6f4 0%, #ecedea 100%)" }}
        >
            <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-2">
                <div>
                    <SectionTitle align="left">この場所をつくった理由</SectionTitle>

                    <div
                        className="mt-8 border-l-2 pl-6 text-[13px] leading-[2.3]"
                        style={{ borderColor: NAVY.line, color: "#4a5a6e" }}
                    >
                        <p>
                            才能は、正しい場所に出会えれば、必ず開ける。
                            <br />
                            けれど現実には、埋もれてしまう作品や、
                            <br />
                            誰にも届かないまま諦め続けている人がたくさんいます。
                        </p>
                        <p className="mt-6">
                            原石航路は、そんな &quot;原石&quot; を見つけ、育て、
                            <br />
                            次の時代へつないでいくために生まれました。
                        </p>
                        <p className="mt-6">
                            ここが、あなたの物語を渡る航路の始まりになりますように。
                        </p>
                    </div>
                </div>

                <ul className="space-y-8">
                    {points.map((point) => (
                        <li key={point.title} className="flex gap-5">
                            <span
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white"
                                style={{ color: NAVY.base }}
                            >
                                {point.icon}
                            </span>
                            <div className="min-w-0">
                                <h3
                                    className="text-[15px] tracking-[0.05em]"
                                    style={{ color: NAVY.ink }}
                                >
                                    {point.title}
                                </h3>
                                <p className="mt-2 text-[12px] leading-[2] text-[#5a6a7c]">
                                    {point.body}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

/**
 * ============================================================
 * 締め
 *
 * ここだけ橙のボタンを置く。
 * 紺の面に紺のボタンでは沈むし、
 * 画面の中で 1 か所だけ違う色があると、そこへ目が行く。
 * ============================================================
 */

function Closing({ onStart }: { onStart?: () => void }) {
    return (
        <section
            className="relative overflow-hidden py-16"
            style={{
                background: `linear-gradient(160deg, ${NAVY.base} 0%, ${NAVY.deep} 100%)`,
            }}
        >
            <span
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(60% 60% at 82% 20%, rgba(255,214,150,0.24) 0%, rgba(255,214,150,0) 60%)",
                }}
                aria-hidden="true"
            />

            <div className="relative mx-auto max-w-2xl px-5 text-center sm:px-8">
                <h2 className="text-[22px] leading-[1.7] tracking-[0.04em] text-white sm:text-[26px]">
                    さあ、あなたの物語の航海をはじめよう。
                </h2>
                <p className="mt-4 text-[12px] leading-relaxed text-white/70">
                    原石航路で、すべての機能をすぐに体験できます。
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <StartButton
                        onStart={onStart}
                        className="rounded-md px-10 py-3.5 text-[13px] font-medium text-white hover:opacity-90"
                        style={{ background: "var(--color-forest-dark)" }}
                    >
                        無料で始める
                    </StartButton>
                    {!onStart && (
                        <Link
                            href="/login"
                            className="rounded-md border border-white/40 px-10 py-3.5 text-[13px] text-white/90 hover:bg-white/10"
                        >
                            ログイン
                        </Link>
                    )}
                </div>
            </div>
        </section>
    );
}

/**
 * ============================================================
 * 足元
 * ============================================================
 */

/**
 * ============================================================
 * 足元
 *
 * 濃い地に白抜き。
 * 本文と同じ白のまま終わると、どこまでが読むところか
 * 分からないまま画面が切れる。色を変えて終わりを示す。
 *
 * ------------------------------------------------------------
 * 行き先が無い項目について
 *
 * 規約も問い合わせも、まだ中身がない。
 * 押しても何も起きないものは、少し薄くして押せなくする。
 *
 * 隠さないのは、これから用意するものが分かるほうが
 * 見る人にとって親切だから。
 * 中身ができたら href を足すだけで、そのまま押せるようになる。
 * ============================================================
 */

interface FootLink {
    label: string;
    /** 無ければ準備中として薄く出す */
    href?: string;
}

const FOOT_COLUMNS: { title: string; links: FootLink[] }[] = [
    {
        title: "はじめての方へ",
        links: [
            { label: "原石航路とは", href: "#about" },
            { label: "投稿ガイド" },
            { label: "よくある質問" },
        ],
    },
    {
        title: "サポート",
        links: [
            { label: "ヘルプ・FAQ" },
            { label: "お問い合わせ" },
            { label: "ご意見・ご要望" },
        ],
    },
    {
        title: "規約・ガイドライン",
        links: [
            { label: "利用規約" },
            { label: "プライバシーポリシー" },
            { label: "投稿ガイドライン" },
        ],
    },
];

function Footer() {
    return (
        <footer className="px-6 py-16 sm:px-10" style={{ background: "#33302b" }}>
            <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                <div>
                    {/*
                     * ロゴ。
                     * 濃い地なので、白抜きにして少しだけ落とす。
                     * 真っ白だと、見出しより強く光る。
                     */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logo.svg"
                        alt="原石航路"
                        className="h-12 w-auto"
                        style={{ filter: "brightness(0) invert(1)", opacity: 0.92 }}
                    />

                    <p className="mt-6 text-[13px] leading-[2.1] text-white/70">
                        原石航路は、書き手と読み手をつなぐ場所。
                        <br />
                        あなたの物語が、誰かの心を照らします。
                    </p>
                </div>

                <div className="grid gap-10 sm:grid-cols-3">
                    {FOOT_COLUMNS.map((column) => (
                        <div key={column.title}>
                            <h3 className="text-[13px] font-semibold text-white">
                                {column.title}
                            </h3>

                            <ul className="mt-5 space-y-4">
                                {column.links.map((link) => (
                                    <li key={link.label}>
                                        {link.href ? (
                                            <Link
                                                href={link.href}
                                                className="text-[13px] text-white/75 hover:text-white"
                                            >
                                                {link.label}
                                            </Link>
                                        ) : (
                                            /*
                                             * 行き先がまだ無い項目。
                                             *
                                             * 押せる見た目にはしない。
                                             * 押して何も起きないと、壊れていると受け取られる。
                                             *
                                             * ただし落としすぎない。
                                             * 薄すぎると、そこに何が来るのかも読めなくなる。
                                             */
                                            <span
                                                title={`${link.label}（準備中）`}
                                                className="cursor-default text-[13px] text-white/45"
                                            >
                                                {link.label}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            <div
                className="mx-auto mt-14 max-w-6xl border-t pt-6"
                style={{ borderColor: "rgba(255,255,255,0.14)" }}
            >
                <p className="text-[12px] text-white/40">
                    © {new Date().getFullYear()} 原石航路 All Rights Reserved.
                </p>
            </div>
        </footer>
    );
}

/**
 * ============================================================
 * 節の見出し
 *
 * 下に細い線と菱形を置く。
 * 文字だけだと、どこで話が変わったのかが分かりにくい。
 * ============================================================
 */

function SectionTitle({
    children,
    align = "center",
}: {
    children: React.ReactNode;
    align?: "center" | "left";
}) {
    return (
        <div className={align === "center" ? "text-center" : "text-left"}>
            <h2
                className="text-[20px] tracking-[0.1em] sm:text-[23px]"
                style={{ color: NAVY.ink }}
            >
                {children}
            </h2>

            <span
                className={`mt-4 flex items-center gap-2 ${
                    align === "center" ? "justify-center" : ""
                }`}
                aria-hidden="true"
            >
                <span className="h-px w-10" style={{ background: NAVY.line }} />
                <span
                    className="h-1.5 w-1.5 rotate-45"
                    style={{ background: NAVY.soft }}
                />
                <span className="h-px w-10" style={{ background: NAVY.line }} />
            </span>
        </div>
    );
}

/**
 * ============================================================
 * 図案
 *
 * 線を細めにして、紺の細い明朝と釣り合わせる。
 * 太い線だと、図案だけが前に出てくる。
 * ============================================================
 */

function stroke(width = 1.4) {
    return {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: width,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };
}

function QuillIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke()}>
            <path d="M4 20c0-7 4-12 12-14 1 8-3 13-9 13H4Z" />
            <path d="M4 20c2-3 5-5 8-6.5" />
        </svg>
    );
}

function BoxIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke()}>
            <path d="M12 3.5 20.5 8v8L12 20.5 3.5 16V8Z" />
            <path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" />
        </svg>
    );
}

function PeopleIcon({ small = false }: { small?: boolean }) {
    const size = small ? 22 : 26;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke()}>
            <circle cx="9" cy="8.5" r="3" />
            <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
            <path d="M16 6a3 3 0 0 1 0 5M17.5 14.5c2 .6 3.5 2.3 3.5 4.5" />
        </svg>
    );
}

function TrophyIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke()}>
            <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
            <path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3" />
            <path d="M12 14v3.5M8.5 20.5h7" />
        </svg>
    );
}

function PenIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...stroke()}>
            <path d="M4.5 19.5h3.6L19.4 8.2a2.6 2.6 0 0 0-3.6-3.6L4.5 15.9Z" />
            <path d="m14.6 5.8 3.6 3.6" />
        </svg>
    );
}

function GridIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...stroke()}>
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
            <path d="M3.5 9h17M9 9v10.5M14.5 9v10.5" />
        </svg>
    );
}

function CloudIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...stroke()}>
            <path d="M7 18.5h10a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6-1A3.75 3.75 0 0 0 7 18.5Z" />
        </svg>
    );
}

function CompassIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...stroke()}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="m15.5 8.5-2 5.5-5 2 2-5.5Z" />
        </svg>
    );
}

function LighthouseIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...stroke()}>
            <path d="M9.5 9h5l1 11h-7Z" />
            <path d="M9 9V6.5h6V9M12 3.5v3" />
            <path d="M6 6.5 4 5M18 6.5 20 5" />
            <path d="M6.5 20.5h11" />
        </svg>
    );
}

function TelescopeIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...stroke()}>
            <path d="m3.5 13 12-6.5 3 4.5-12 6.5Z" />
            <path d="M9 16.5 7.5 20.5M14 14l2 6.5" />
        </svg>
    );
}
