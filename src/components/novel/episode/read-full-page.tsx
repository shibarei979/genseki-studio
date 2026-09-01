"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

/** 1 頁に入れる文字数。画面の大きさから決める */
function charsPerPage(w: number, h: number, fontSize: number) {
    /*
     * 縦書きは、高さが 1 行の文字数、幅が行数になる。
     *
     * 余白を引いてから、字の大きさで割る。
     * 行の間は 1.9 倍で見ておく。
     */
    /*
     * ★ 余白を大きめに引く。
     *
     *   上下は帯（56px × 2）と余白。
     *   左右は端に文字が触れないぶん。
     *
     *   引き足りないと、入りきらない文字が
     *   画面の外へこぼれて読めなくなる。
     */
    const perLine = Math.max(6, Math.floor((h - 150) / fontSize));
    const lines = Math.max(3, Math.floor((w - 60) / (fontSize * 1.9)));
    return perLine * lines;
}

export default function ReadFullPage({
    title,
    workTitle,
    body,
    backHref,
}: {
    title: string;
    workTitle: string;
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

    /* 頁に分ける。大きさか字の大きさが変わったら分け直す */
    const pages = useMemo(() => {
        if (size.w === 0) return [body];

        const per = charsPerPage(size.w, size.h, fontSize);
        const out: string[] = [];

        for (let i = 0; i < body.length; i += per) {
            out.push(body.slice(i, i + per));
        }
        return out.length > 0 ? out : [""];
    }, [body, size, fontSize]);

    /* 分け直したとき、行き過ぎていたら戻す */
    useEffect(() => {
        setPage((p) => Math.min(p, pages.length - 1));
    }, [pages.length]);

    function turn(step: 1 | -1) {
        setPage((p) => Math.min(Math.max(p + step, 0), pages.length - 1));
    }

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "ArrowLeft") turn(1);
            if (e.key === "ArrowRight") turn(-1);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pages.length]);

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
                    {workTitle && <span style={{ opacity: 0.5 }}>{workTitle}　</span>}
                    {title}
                </span>

                {/* 字の大きさ */}
                <button
                    type="button"
                    onClick={() => setFontSize((v) => Math.max(12, v - 2))}
                    style={barBtn}
                >
                    小
                </button>
                <button
                    type="button"
                    onClick={() => setFontSize((v) => Math.min(26, v + 2))}
                    style={barBtn}
                >
                    大
                </button>

                {/* 縦書きと横書き */}
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
                style={{
                    position: "absolute",
                    /*
                     * ★ 帯のぶんを空ける。
                     *
                     *   帯は隠れているときも、
                     *   出したときに本文の上に重なる。
                     *   はじめから場所を空けておけば、
                     *   出しても文字が隠れない。
                     *
                     *   左右も広めに取る。
                     *   端に文字が触れると読みにくい。
                     */
                    top: 56,
                    bottom: 46,
                    left: 0,
                    right: 0,
                    padding: "10px 30px",
                    fontSize,
                    lineHeight: 1.9,
                    letterSpacing: ".03em",
                    color: "#2b2b2b",
                    fontFamily: "'Noto Serif JP', serif",
                    writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
                    textOrientation: "mixed",
                    whiteSpace: "pre-wrap",
                    overflow: "hidden",
                }}
            >
                {pages[page] ?? ""}
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
                {page + 1} / {pages.length}
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
                        width: `${((page + 1) / pages.length) * 100}%`,
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
