/**
 * ============================================================
 * 原石航路 Studio
 * HomeHero — ホームの導入
 *
 * 画面の顔になる場所なので、閉じられないようにした。
 * 以前は localStorage で閉じられたが、
 * 一度閉じると二度と戻せず、ホームが唐突に始まってしまう。
 *
 * ボタンは置かない。
 * 「作品を描く」「続きを書く」は左の柱に常に出ているので、
 * ここに同じものを並べると、画面の上半分が導線だけで埋まる。
 * ここは名乗るだけの場所にして、縦を短く保つ。
 *
 * 絵は右に置き、文字が乗る左側は白で伏せる。
 * 絵の上に直に文字を置くと、絵の濃淡で読みにくさが変わる。
 * ============================================================
 */

"use client";

import { useState } from "react";

/**
 * 背景に敷く絵の候補。
 *
 * public/images/ の下にあるものを、上から順に試す。
 * 読めたところで止まる。
 *
 * 拡張子ちがいを並べてあるのは、
 * 置いたファイルが png か jpg か webp かで
 * 毎回ここを直すのを避けるため。
 * 使うものが決まったら、1 行に減らしてよい。
 */
const HERO_IMAGES = [
    "/images/HERO_IMAGE.png",
    "/images/HERO_IMAGE.jpg",
    "/images/HERO_IMAGE.jpeg",
    "/images/HERO_IMAGE.webp",
    /* どれも無かったときの控え。同梱してあるので必ず読める */
    "/images/hero-voyage.webp",
];

/**
 * 絵の切り取り位置。
 *
 * 横長の絵を帯に収めるので、どこを残すかで印象が変わる。
 * 人物や建物が右にある絵なら右寄せ、
 * 空を見せたい絵なら上寄せにする。
 */
const HERO_POSITION = "right 40%";

export default function HomeHero() {
    /*
     * いま試している絵。
     * 読めなければ次の候補へ送る。
     */
    const [index, setIndex] = useState(0);

    return (
        <section className="relative overflow-hidden rounded-xl border border-line bg-surface">
            {/*
             * 背景。
             *
             * 読めたかどうかを知りたいので、背景ではなく img で敷く。
             * background-image は失敗しても何も知らせてこないので、
             * 次の候補へ送れない。
             */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={HERO_IMAGES[index]}
                alt=""
                draggable={false}
                onError={() =>
                    setIndex((current) =>
                        Math.min(current + 1, HERO_IMAGES.length - 1),
                    )
                }
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: HERO_POSITION }}
                aria-hidden="true"
            />

            {/*
             * 文字側を白く伏せる。
             * 見出しが明朝の大きな字なので、
             * 以前より広く・濃く伏せないと画と競る。
             */}
            <div
                className="absolute inset-0"
                style={{
                    /*
                     * 文字側を白く伏せる。
                     *
                     * 絵が明るく色数も多いので、以前より濃く広く伏せる。
                     * 薄いままだと空の水色に明朝の細い線が沈む。
                     */
                    background:
                        "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface) 42%, rgba(255,255,255,0.92) 56%, rgba(255,255,255,0) 78%)",
                }}
                aria-hidden="true"
            />

            <div className="relative px-8 py-7 sm:px-10 sm:py-9">
                {/*
                 * 見出しだけ明朝にする。
                 * 小説を書く場所なので、いちばん大きな字は本文と同じ顔にしたい。
                 *
                 * 「景色」だけ灯りの色にする。
                 * 全部を主色で書くと画面の中でいちばん強い塊になり、
                 * すぐ下のボタンや行き先より目立ってしまう。
                 * 一語だけ差せば、読ませたい所へ目が行く。
                 */}
                <h1 className="font-serif text-[24px] leading-[1.4] tracking-[0.06em] text-ink sm:text-[32px]">
                    書くことが、
                    <br />
                    あなたの<span className="text-forest">物語</span>になる。
                </h1>

                <p className="mt-3.5 max-w-[30em] text-[12px] leading-[1.9] text-muted sm:text-[13px]">
                    ここは、書く人のための場所。
                    <br />
                    思いついた言葉を、物語に育てていく。
                </p>

                {/*
                 * 手書き風の一行。
                 *
                 * 意味は上の 2 行と重なるので、読ませるためではなく
                 * 余白を締めるために置いている。
                 * 小さく、薄く、斜めに。読み飛ばして構わない字にする。
                 */}
                <p className="mt-3 font-serif text-[13px] italic tracking-wide text-forest/70">
                    Write your story.
                </p>

                {/*
                 * 絵の作者。
                 *
                 * 借りている絵なので、使っている場所には必ず出す。
                 * 読ませるためではないので、薄い灰色で小さく、
                 * 文の下に添える。
                 */}
                <p className="mt-4 text-[10px] text-faint">
                    Illustration: @猫月ユキ
                </p>
            </div>
        </section>
    );
}
