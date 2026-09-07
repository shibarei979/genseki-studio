"use client";

/**
 * ============================================================
 * 原石航路
 * ReaderHero — 読者向けの見出し
 *
 * 執筆向けの HomeHero と対になるもの。
 * 作りと見た目はそちらに揃え、言葉だけ読む人へ向ける。
 *
 *   書く側   書くことが、あなたの物語になる。
 *   読む側   物語との出会いが、人生を変える。
 *
 * 本棚の上に置く。
 * 棚を眺める前に、ここが何をする場所かを一行で伝える。
 * ============================================================
 */

import { useEffect, useRef, useState } from "react";

/**
 * 見出しの絵。
 *
 * 執筆向けと同じものを使う。
 * 上から順に試し、読めなければ次へ送る。
 */
const HERO_IMAGES = [
    /* 置いてあるのは .jpg。先に試す */
    "/images/HERO_IMAGE.jpg",
    "/images/HERO_IMAGE.png",
    "/images/HERO_IMAGE.jpeg",
    "/images/HERO_IMAGE.webp",
    /*
     * どれも無かったときの控え。
     * hero-voyage.webp を挙げていたが、置かれていなかった。
     * 実際にある灯台の絵にする。
     */
    "/images/hero-lighthouse.webp",
];

/** 絵のどこを見せるか。人物が右に寄っているので右端を残す */
const HERO_POSITION = "right 40%";

export default function ReaderHero() {
    const [index, setIndex] = useState(0);
    const imageRef = useRef<HTMLImageElement>(null);

    /*
     * ★ 読めなかったことに、あとから気づく。
     *
     *   onError は、React が画面を受け持つ前に起きた失敗を拾えない。
     *   最初に配る HTML の時点で読み込みが始まるので、
     *   そこで失敗すると、次の候補へ送られないまま止まる。
     *   実際、絵が出ないまま白い帯になっていた。
     *
     *   受け持ったあとに、読めているかを見て、
     *   駄目なら次の候補へ送る。
     */
    useEffect(() => {
        const image = imageRef.current;
        if (!image) return;
        if (image.complete && image.naturalWidth === 0) {
            setIndex((current) =>
                Math.min(current + 1, HERO_IMAGES.length - 1),
            );
        }
    }, [index]);

    return (
        <section className="relative overflow-hidden rounded-xl border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                ref={imageRef}
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
             *
             * 見出しが明朝の大きな字なので、
             * 広く濃く伏せないと絵に負ける。
             */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface) 42%, rgba(255,255,255,0.92) 56%, rgba(255,255,255,0) 78%)",
                }}
                aria-hidden="true"
            />

            <div className="relative px-8 py-7 sm:px-10 sm:py-9">
                {/*
                 * 見出しは明朝。
                 * 小説を読む場所なので、いちばん大きな字は本文と同じ顔にする。
                 *
                 * 「出会い」だけ色を差す。
                 * 全部を主色にすると塊になって、下の棚より目立つ。
                 */}
                <h1 className="font-serif text-[24px] leading-[1.4] tracking-[0.06em] text-ink sm:text-[32px]">
                    物語との<span className="text-forest">出会い</span>が、
                    <br />
                    人生を変える。
                </h1>

                <p className="mt-3.5 max-w-[30em] text-[12px] leading-[1.9] text-muted sm:text-[13px]">
                    まだ見ぬ一冊が、ここにある。
                    <br />
                    誰かが書いた物語を、あなたが見つける。
                </p>

                {/*
                 * 手書き風の一行。
                 *
                 * 読ませるためではなく、余白を締めるために置く。
                 * 小さく、薄く、斜めに。
                 */}
                <p className="mt-3 font-serif text-[13px] italic tracking-wide text-forest/70">
                    Find your story.
                </p>
            </div>

            {/*
             * 絵の作者。
             * 借りている絵なので、使っている場所には必ず出す。
             */}
            <p className="absolute bottom-2 right-3 text-[10px] text-faint">
                Illustration: @猫月ユキ
            </p>
        </section>
    );
}
