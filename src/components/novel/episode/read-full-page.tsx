"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { VerticalText } from "@/components/novel/episode/mobile-episode-body";
import { illustBox } from "@/config/illust-size";
import { splitIntoSentences } from "@/lib/utils/sentences";

/**
 * ============================================================
 * 原石航路 Studio
 * ReadFullPage — 全画面で読む
 *
 * ★ 何も無い所から建てる。
 *
 *   読む画面の中に浮かせる形をやめた。
 *   あちらには幅の上限や親の transform があり、
 *   画面いっぱいにするのに 7 回外しても足りなかった。
 *
 *   この頁は、この部品しか描かない。
 *   縛るものが無いので、素直に画面いっぱいになる。
 *
 * ★ 頁分けも自前で持つ。
 *   PagedReader は読む画面の作りに合わせてあり、
 *   そちらの余白や上限を引きずる。
 * ============================================================
 */

/**
 * ★ 文字数では切らない。
 *
 *   1 頁に何文字入るかを数えて切っていたが、
 *   数え方と実際の入り方がずれる。
 *   ずれたぶんが画面の外へこぼれ、
 *   次の頁もずれた場所から始まるので、
 *   あいだの文章が抜けて見えていた。
 *
 *   本文は切らずに 1 本のまま置き、
 *   横にずらして見せる場所を変える。
 *   ブラウザが折り返した通りに出るので、
 *   何も抜けない。
 */

/**
 * 全画面で読むときの挿絵。
 *
 * ★ 縦書きの流れの中なので writingMode を戻し、
 *   そのあとに高さいっぱい・幅 0 の仕切りを挟む。
 *   挟まないと、絵の下に本文が入り込んで重なる。
 */
function FullscreenIllust({ url, isAi, size }: { url: string; isAi?: boolean; size?: string | null }) {
    return (
        <>
      {/*
        * ★ 絵の前にも、高さいっぱい・幅 0 の仕切りを挟む。
        *
        *   前は後ろにしか入れていなかったので、
        *   絵は直前の本文が終わった所から始まっていた。
        *   縦書きでは列の途中、下のほうに沈んで見える。
        *
        *   前にも挟むと、絵は次の列の頭から始まる。
        */}
      <span aria-hidden="true" style={{display:'inline-block',height:'100%',width:0,verticalAlign:'top'}}/>
            <span style={{ display: "inline-block", verticalAlign: "top", margin: "0 1em", marginTop: "4.5em", writingMode: "horizontal-tb", position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="挿絵"
                    style={{ maxHeight: illustBox("mobileVertical", size || "large").maxHeight,
                        maxWidth: illustBox("mobileVertical", size || "large").maxWidth,
                        objectFit: "contain", borderRadius: 8, display: "block" }} />
                {isAi && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src="/images/ai-cover-stamp.png" alt="AIで作った挿絵" title="AIで作った挿絵"
                        style={{ position: "absolute", top: -5, right: -5,
                            width: illustBox("mobileVertical", size || "large").stamp,
                            height: illustBox("mobileVertical", size || "large").stamp,
                            transform: "rotate(-8deg)", opacity: 0.55, pointerEvents: "none",
                            filter: "drop-shadow(0 0 2px rgba(255,255,255,.9)) drop-shadow(0 1px 2px rgba(0,0,0,.25))" }} />
                )}
            </span>
            <span aria-hidden="true" style={{ display: "inline-block", height: "100%", width: 0, verticalAlign: "top" }} />
        </>
    );
}

export default function ReadFullPage({
    title,
    body,
    illusts = [],
    backHref,
}: {
    title: string;
    body: string;
    /** 話の中の挿絵。after_sentence は「何文目の後ろか」。0 は本文の頭 */
    illusts?: { id: string; url: string; is_ai: boolean; after_sentence: number; size?: string | null }[];
    backHref: string;
}) {
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [fontSize, setFontSize] = useState(16);
    const [isVertical, setIsVertical] = useState(true);
    const [page, setPage] = useState(0);
    const [isBarOpen, setIsBarOpen] = useState(false);

    useEffect(() => {
        function measure() {
            setSize({ w: window.innerWidth, h: window.innerHeight });
        }
        measure();
        window.addEventListener("resize", measure);
        window.addEventListener("orientationchange", measure);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("orientationchange", measure);
        };
    }, []);

    /*
     * 本文の入れ物と、その中身。
     *
     * 中身は切らずに 1 本のまま。
     * 入れ物からはみ出したぶんが、次の頁になる。
     */
    const bodyRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [pageCount, setPageCount] = useState(1);
    /* 入れ物の幅。1 頁ぶんの動かす量になる */


    /* 何頁ぶんあるかを測る */
    useEffect(() => {
        function measure() {
            const box = bodyRef.current;
            const inner = innerRef.current;
            if (!box || !inner) return;

            const w = box.clientWidth;
            if (w === 0) return;

            /*
             * 中身の幅 ÷ 入れ物の幅 が頁数。
             * 縦書きなので、横に伸びていく。
             */
            /* 送る量と同じ数え方にする。ずれると最後まで行けない */
            const step = isVertical
                ? Math.max(1, Math.floor(w / (fontSize * 1.9))) * (fontSize * 1.9)
                : w;

            const total = Math.max(
                1,
                Math.ceil((inner.scrollWidth - w) / step) + 1,
            );
            setPageCount(total);
            setPage((p) => Math.min(p, total - 1));
        }

        /* 描いたあとに測る。すぐだと 0 が返る */
        const timer = window.setTimeout(measure, 60);
        window.addEventListener("resize", measure);

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("resize", measure);
        };
    }, [body, size, fontSize, isVertical]);

    /*
     * 頁が変わったら、そこへ送る。
     *
     * ★ 縦書きは右から左へ流れる。
     *   文の頭は中身の右端にあるので、
     *   1 頁目はいちばん右まで送った所。
     */
    useEffect(() => {
        const box = bodyRef.current;
        if (!box) return;

        /*
         * ★ 1 画面ぶんではなく、行の幅の倍数で送る。
         *
         *   縦書きの 1 行の幅は、行の高さ（字の大きさ × 1.9）。
         *   入れ物の幅がその倍数とは限らないので、
         *   1 画面ずつ送ると、端の行が半分だけ出る。
         *
         *   入る行数を数えて、そのぶんだけ送れば、
         *   いつも行の切れ目で止まる。
         */
        const step = isVertical
            ? Math.max(1, Math.floor(box.clientWidth / (fontSize * 1.9)))
                * (fontSize * 1.9)
            : box.clientWidth;

        const max = box.scrollWidth - box.clientWidth;
        box.scrollTo({
            left: Math.max(0, max - page * step),
            behavior: "smooth",
        });
    }, [page, pageCount, size, fontSize, isVertical]);

    function turn(step: 1 | -1) {
        setPage((p) => Math.min(Math.max(p + step, 0), pageCount - 1));
    }

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "ArrowLeft") turn(1);
            if (e.key === "ArrowRight") turn(-1);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageCount]);

    const tapStyle = (side: "left" | "center" | "right"): React.CSSProperties => ({
        position: "absolute",
        /* 帯を押せなくならないよう、そのぶん避ける */
        top: 56,
        bottom: 46,
        [side === "left" ? "left" : side === "right" ? "right" : "left"]:
            side === "center" ? "33%" : 0,
        width: side === "center" ? "34%" : "33%",
        zIndex: 5,
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: side === "center" ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent",
    });

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "#fbfaf7",
                overflow: "hidden",
            }}
        >
            {/*
              * 上の帯。
              * 真ん中を触ったときだけ出す。
              */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "#fff",
                    borderBottom: "1px solid #e8e6e0",
                    /*
                     * ★ 隠すのは中身だけ。場所は取ったまま。
                     *
                     *   translateY で外へ逃がすと、
                     *   出したときに本文の上へ重なる。
                     *   本文はもう帯のぶんを空けているので、
                     *   色を消すだけでよい。
                     */
                    opacity: isBarOpen ? 1 : 0,
                    pointerEvents: isBarOpen ? "auto" : "none",
                    transition: "opacity .18s ease",
                }}
            >
                <span
                    style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 13,
                        color: "#2b2b2b",
                    }}
                >
                    {title}
                </span>

                {/*
                  * 読書設定。
                  *
                  * ★ 出すのは、読むあいだに変えたくなるものだけ。
                  *   字の大きさと、縦書き・横書き。
                  */}
                <button
                    type="button"
                    onClick={() => setFontSize((v) => Math.max(12, v - 2))}
                    style={barBtn}
                    aria-label="字を小さく"
                >
                    小
                </button>
                <button
                    type="button"
                    onClick={() => setFontSize((v) => Math.min(26, v + 2))}
                    style={barBtn}
                    aria-label="字を大きく"
                >
                    大
                </button>
                <button
                    type="button"
                    onClick={() => setIsVertical((v) => !v)}
                    style={barBtn}
                >
                    {isVertical ? "横書き" : "縦書き"}
                </button>

                <Link href={backHref} style={{ ...barBtn, textDecoration: "none" }}>
                    閉じる
                </Link>
            </div>

            {/* 本文 */}
            <div
                ref={bodyRef}
                style={{
                    position: "absolute",
                    /*
                     * 帯のぶんを空ける。
                     * 帯を出しても、文字が隠れない。
                     */
                    top: 56,
                    bottom: 46,
                    left: 30,
                    right: 30,
                    /*
                     * ★ 送りで場所を変える。
                     *
                     *   transform で計算してずらしていたが、
                     *   幅を状態に持つと、測る前の 0 のまま
                     *   使われることがあった。
                     *
                     *   送り（scrollLeft）なら、
                     *   そのときの実際の幅で動く。
                     *   指では動かせないよう、送り具は隠す。
                     */
                    overflowX: "hidden",
                    overflowY: "hidden",
                }}
            >
                <div
                    ref={innerRef}
                    style={{
                        /*
                         * ★ 入れ物より少し低くする。
                         *
                         *   100% だと、1 行の高さがぴったり収まらず、
                         *   上下がわずかに切れる。
                         *   行の高さは字の大きさの 1.9 倍なので、
                         *   その半端が上下にこぼれる。
                         *
                         *   少し余らせて、切れないようにする。
                         */
                        height: "calc(100% - 8px)",
                        paddingTop: 4,
                        fontSize,
                        lineHeight: 1.9,
                        letterSpacing: ".03em",
                        color: "#2b2b2b",
                        /* 執筆画面と同じ指定 */
                        fontFamily: "var(--font-serif), 'Noto Serif JP', serif",
                        writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
                        textOrientation: "mixed",
                        whiteSpace: "pre-wrap",

                        /*
                         * ★ 横にずらして、見せる場所を変える。
                         *
                         *   縦書きは右から左へ流れる。
                         *   先へ進むには、中身を左へ動かす。
                         *   だから負の値。
                         *
                         * ★ % ではなく px で動かす。
                         *
                         *   % は中身の幅に対する割合。
                         *   中身は何頁ぶんもあるので、
                         *   1 頁ぶんではなく全体ぶん動いてしまう。
                         *   実際、最後の 2 頁しか開けなかった。
                         */
                        /*
                         * ★ 右へずらす。
                         *
                         *   縦書きは右から左へ流れる。
                         *   文の頭は右端にあり、続きは左に隠れている。
                         *   中身を右へ動かせば、その続きが出てくる。
                         *
                         * ★ ずらす量は入れ物の幅ぶん。
                         *   % だと中身の幅が基準になり、
                         *   1 頁ぶんにならない。
                         *   だから最後の頁とその手前しか出なかった。
                         */
/* ずらしは入れ物の側で行う。ここでは何もしない */
                    }}
                >
                    {/*
                      * ★ そのまま出さない。
                      *
                      *   ルビ（｜漢字《かんじ》）や縦中横は、
                      *   組み立てて初めて形になる。
                      *   素のまま出すと、記号が見えてしまう。
                      *
                      *   携帯の読む画面と同じ部品を使う。
                      *   同じものを二度作ると、片方だけ古くなる。
                      */}
                    {/*
                      * ★ 挿絵があるときだけ、文ごとに分けて挟む。
                      *
                      *   分けるだけ入れ物が増えるので、無いときは
                      *   これまでどおり本文をひと続きで出す。
                      */}
                    {illusts.length > 0 ? (
                        <>
                            {illusts
                                .filter((one) => one.after_sentence === 0)
                                .map((one) => (
                                    <FullscreenIllust key={one.id} url={one.url} isAi={one.is_ai} size={one.size} />
                                ))}

                            {splitIntoSentences(body).map((raw, idx) => {
                                const here = illusts.filter(
                                    (one) => one.after_sentence === idx + 1,
                                );

                                return (
                                    <span key={idx}>
                                        <VerticalText text={raw} />
                                        {here.map((one) => (
                                            <FullscreenIllust key={one.id} url={one.url} isAi={one.is_ai} size={one.size} />
                                        ))}
                                    </span>
                                );
                            })}
                        </>
                    ) : (
                        <VerticalText text={body} />
                    )}
                </div>
            </div>

            {/*
              * 触る場所。
              *
              * ★ 左右 3 分の 1 ずつ。真ん中は空ける。
              *   端まで送りにすると、文字を選べなくなる。
              *
              * ★ 縦書きは右から左へ進む。左が「次」。
              */}
            <button
                type="button"
                aria-label="次の頁へ"
                onClick={() => turn(1)}
                style={tapStyle("left")}
            />
            <button
                type="button"
                aria-label="道具を出す"
                onClick={() => setIsBarOpen((v) => !v)}
                style={tapStyle("center")}
            />
            <button
                type="button"
                aria-label="前の頁へ"
                onClick={() => turn(-1)}
                style={tapStyle("right")}
            />

            {/* 何頁目か。帯を出したときだけ */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    padding: "10px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "#8a8a8a",
                    background: "#fff",
                    borderTop: "1px solid #e8e6e0",
                    opacity: isBarOpen ? 1 : 0,
                    pointerEvents: isBarOpen ? "auto" : "none",
                    transition: "opacity .18s ease",
                }}
            >
                {page + 1} / {pageCount}
            </div>

            {/*
              * 読んだ量の線。
              * 帯を隠していても、これだけは出す。
              */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 2,
                    zIndex: 9,
                    background: "rgba(120,120,120,.12)",
                }}
            >
                {/*
                  * ★ 右から左へ伸ばす。
                  *
                  *   縦書きは右から左へ読み進む。
                  *   線が左から右へ伸びると、
                  *   目の動きと逆になって落ち着かない。
                  */}
                <span
                    style={{
                        display: "block",
                        height: "100%",
                        width: `${((page + 1) / pageCount) * 100}%`,
                        marginLeft: "auto",
                        background: "#1f4e6b",
                        transition: "width .2s ease",
                    }}
                />
            </div>
        </div>
    );
}

const barBtn: React.CSSProperties = {
    flexShrink: 0,
    padding: "5px 11px",
    border: "1px solid #e8e6e0",
    borderRadius: 999,
    background: "transparent",
    color: "#6b6b6b",
    fontSize: 12,
    cursor: "pointer",
};
