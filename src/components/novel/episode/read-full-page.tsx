"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

export default function ReadFullPage({
    title,
    body,
    backHref,
}: {
    title: string;
    body: string;
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
    const [boxWidth, setBoxWidth] = useState(0);

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
            const total = Math.max(1, Math.ceil(inner.scrollWidth / w));
            setPageCount(total);
            setBoxWidth(w);
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
                    overflow: "hidden",
                }}
            >
                <div
                    ref={innerRef}
                    style={{
                        height: "100%",
                        fontSize,
                        lineHeight: 1.9,
                        letterSpacing: ".03em",
                        color: "#2b2b2b",
                        fontFamily: "'Noto Serif JP', serif",
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
                        transform: `translateX(${page * boxWidth}px)`,
                        transition: "transform .2s ease",
                    }}
                >
                    {body}
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
                <span
                    style={{
                        display: "block",
                        height: "100%",
                        width: `${((page + 1) / pageCount) * 100}%`,
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
