/**
 * ============================================================
 * 原石航路 Studio
 * ManuscriptSurface — 本文の表示面（スクロール式）
 *
 * 執筆用の textarea と、設定画面のプレビューで同じ部品を使う。
 * 別々に作ると「プレビューと実物が違う」が必ず起きるため。
 *
 * 縦書きは className ではなく inline style で指定している。
 * writing-mode はブラウザ間で扱いが揺れやすく、
 * 確実に効かせたい場面ではクラス経由を避けるため。
 * ============================================================
 */

"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

import type { DisplaySettings } from "@/types";
import { LINE_HEIGHT_VALUE } from "@/types";

interface Props {
    /**
     * 縮尺。
     *
     * 1 で元の大きさ。
     * 指でつまむ代わりに、ボタンで変える。
     */
    zoom?: number;

    settings: DisplaySettings;
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    placeholder?: string;
    /** 選択された文字列を外へ伝える。資料へのリンクに使う */
    onSelectionChange?: (selected: string) => void;
    /**
     * 触れた行を、丸ごと選んだ状態にする。
     *
     * 蛍光ペンで来たときだけ。
     * ふだんの執筆では、押した所にカーソルが立つ。
     */
    selectLineOnClick?: boolean;
    /** 選択の位置を外へ伝える。ルビや傍点の挿入に使う */
    onRangeChange?: (range: { start: number; end: number }) => void;
    /**
     * 10 行ごとに行番号を出す。
     * 資料の「第3話 12行目」から本文の場所を探せるように。
     */
    showLineNumbers?: boolean;
}

export default function ManuscriptSurface({
    settings,
    value,
    onChange,
    readOnly = false,
    placeholder,
    onSelectionChange,
    selectLineOnClick = false,
    onRangeChange,
    showLineNumbers = false,
    zoom = 1,
}: Props) {
    const isVertical = settings.writing_mode === "vertical";
    const areaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);

    /**
     * 縦書きは右端が本文の先頭になる。
     * 何もしないと左端（＝本文の末尾側）が見えた状態で始まってしまう。
     */
    useEffect(() => {
        const area = areaRef.current;
        if (!area) return;
        if (isVertical) area.scrollLeft = area.scrollWidth;
        else area.scrollLeft = 0;
    }, [isVertical, settings.font_size, settings.line_height]);

    /*
     * 目盛りを本文と一緒に動かす。
     * 別々に動くと、番号と行がずれて役に立たなくなる。
     */
    function handleScroll() {
        const area = areaRef.current;
        const gutter = gutterRef.current;
        if (!area || !gutter) return;
        if (isVertical) gutter.scrollLeft = area.scrollLeft;
        else gutter.scrollTop = area.scrollTop;
    }

    const lineCount = value.split("\n").length;
    const lineHeightPx =
        settings.font_size * zoom * LINE_HEIGHT_VALUE[settings.line_height];

    /*
     * 字の大きさ。
     *
     * 縮尺を掛ける。
     * transform で拡大すると、指で触った所と
     * 文字の位置がずれて、書けなくなる。
     */
    const scaled = Math.round(settings.font_size * zoom);

    const style: CSSProperties = {
        fontSize: `${scaled}px`,
        lineHeight: LINE_HEIGHT_VALUE[settings.line_height],
        writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
        // upright は指定しない。英数字まで 1 文字ずつ立ってしまい
        // 日本語の縦組みの慣習から外れるため
        textOrientation: "mixed",
    };

    return (
        <div
            data-manuscript-theme={settings.theme}
            className={[
                "manuscript-surface h-full w-full",
                showLineNumbers ? (isVertical ? "flex flex-col" : "flex") : "",
            ].join(" ")}
        >
            {showLineNumbers && (
                <div
                    ref={gutterRef}
                    aria-hidden="true"
                    /*
                     * 縦書きの目盛りは、動かす箱そのものを rtl にする。
                     *
                     * 中身だけ rtl にすると、箱は ltr のまま数を数え、
                     * 本文（右端が 0）と目盛り（左端が 0）で
                     * scrollLeft の基準がずれる。
                     * 目盛りが左端に張り付いて動かなかったのはこれ。
                     */
                    style={isVertical ? { direction: "rtl" } : undefined}
                    className={[
                        "shrink-0 select-none overflow-hidden text-faint",
                        isVertical
                            ? "h-6 w-full px-6"
                            : "w-10 border-r border-line/60 py-6 text-right",
                    ].join(" ")}
                >
                    <div
                        style={{
                            fontSize: `${Math.max(9, scaled - 5)}px`,
                            /*
                             * 数字は縦に組まない。
                             *
                             * 本文と同じ vertical-rl にすると、数字まで縦に流れ、
                             * 高さ 24px の帯の中で潰れて読めなくなる。
                             * 帯は横のまま、並び順だけ右から左（rtl）にすれば、
                             * 1 列目の番号が本文の 1 行目（右端）の上に来る。
                             */
                            lineHeight: isVertical ? "24px" : `${lineHeightPx}px`,
                        }}
                        className={isVertical ? "h-6 whitespace-nowrap" : "pr-2"}
                    >
                        {Array.from({ length: lineCount }, (_, index) => (
                            <div
                                key={index}
                                style={
                                    isVertical
                                        ? { width: lineHeightPx, height: "100%" }
                                        : { height: lineHeightPx }
                                }
                                className={isVertical ? "inline-block text-center" : ""}
                            >
                                {/* 10 行ごとだけ。毎行出すと本文より目立つ */}
                                {(index + 1) % 10 === 0 ? index + 1 : ""}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <textarea
                ref={areaRef}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onScroll={showLineNumbers ? handleScroll : undefined}
                onClick={(e) => {
                    if (!selectLineOnClick) return;

                    /*
                     * 触れた行を丸ごと選ぶ。
                     *
                     * ★ 蛍光ペンで来たときだけ。
                     *   ふだんの執筆でこれをすると、
                     *   打ち始めた瞬間に行が消える。
                     */
                    const area = e.currentTarget;
                    const at = area.selectionStart;
                    const head = area.value.lastIndexOf("\n", at - 1) + 1;
                    const tail = area.value.indexOf("\n", at);
                    area.setSelectionRange(
                        head,
                        tail === -1 ? area.value.length : tail,
                    );

                    onRangeChange?.({
                        start: head,
                        end: tail === -1 ? area.value.length : tail,
                    });
                }}
                onKeyDown={() => {
                    /*
                     * 打ち始めたら、選びを解く。
                     *
                     * 選ばれたまま打つと、その行が消える。
                     * 蛍光ペンで来ていても、本文は直せるようにする。
                     */
                    if (!selectLineOnClick) return;
                    const area = areaRef.current;
                    if (!area) return;
                    if (area.selectionStart !== area.selectionEnd) {
                        area.setSelectionRange(area.selectionStart, area.selectionStart);
                    }
                }}
                onSelect={(e) => {
                    const area = e.currentTarget;
                    onRangeChange?.({
                        start: area.selectionStart,
                        end: area.selectionEnd,
                    });
                    onSelectionChange?.(
                        area.value.slice(area.selectionStart, area.selectionEnd).trim(),
                    );
                }}
                readOnly={readOnly}
                aria-label="本文"
                placeholder={placeholder}
                spellCheck={false}
                wrap="soft"
                style={style}
                className={[
                    "manuscript h-full w-full resize-none bg-transparent outline-none placeholder:text-faint",
                    /*
                     * 送るのは本文欄。
                     * 縦書きは行が右から左へ伸びるので横へ、
                     * 横書きは上から下へ伸びるので縦へ送る。
                     *
                     * 縦書きのつまみは page-scroll（太いもの）。
                     * 細い線だと気づかれず、掴みにくい。
                     */
                    isVertical
                        ? /*
                           * manuscript-vertical は、書き位置の印の色を
                           * 本文と分けるためにも使っている（globals.css）。
                           * 縦書きでは印が横に寝るので、同じ色だと見つからない。
                           */
                          "manuscript-vertical page-scroll overflow-x-auto overflow-y-hidden px-6 py-8"
                        : "thin-scroll overflow-y-auto overflow-x-hidden px-8 py-6",
                    // 目盛りを出すときは、そのぶん本文側の余白を詰める
                    showLineNumbers ? (isVertical ? "pt-2" : "pl-3") : "",
                ].join(" ")}
            />
        </div>
    );
}
