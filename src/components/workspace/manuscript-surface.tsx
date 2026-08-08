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
import {
    FONT_SCALE,
    FONT_STACK,
    LETTER_SPACING_VALUE,
    LETTER_SPACING_VALUE_VERTICAL,
    LINE_HEIGHT_VALUE,
    LINE_HEIGHT_VALUE_VERTICAL,
} from "@/types";

interface Props {
    settings: DisplaySettings;
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    placeholder?: string;
    /** 選択された文字列を外へ伝える。資料へのリンクに使う */
    onSelectionChange?: (selected: string) => void;
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
    onRangeChange,
    showLineNumbers = false,
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
        if (!area) return;

        const gutter = gutterRef.current;
        if (gutter) {
            if (isVertical) gutter.scrollLeft = area.scrollLeft;
            else gutter.scrollTop = area.scrollTop;
        }

    }

    const lineCount = value.split("\n").length;

    /*
     * 行の高さと字間は、縦書きと横書きで別に持つ。
     * 同じ数字でも、縦書きのほうが広く見える。
     */
    const lineRatio = isVertical
        ? LINE_HEIGHT_VALUE_VERTICAL[settings.line_height]
        : LINE_HEIGHT_VALUE[settings.line_height];

    const spacingRatio = isVertical
        ? LETTER_SPACING_VALUE_VERTICAL[settings.letter_spacing ?? "normal"]
        : LETTER_SPACING_VALUE[settings.letter_spacing ?? "normal"];

    /* 書体ごとの字面の差を埋める */
    const scale = FONT_SCALE[settings.font_family] ?? 1;
    const fontPx = Math.round(settings.font_size * scale);

    const lineHeightPx = fontPx * lineRatio;

    const style: CSSProperties = {
        fontSize: `${fontPx}px`,
        lineHeight: lineRatio,
        letterSpacing: `${(fontPx * spacingRatio).toFixed(2)}px`,
        writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
        /* 書き手が選んだ書体 */
        fontFamily: FONT_STACK[settings.font_family] ?? FONT_STACK.mincho,
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
                    className={[
                        "shrink-0 select-none overflow-hidden text-faint",
                        isVertical
                            ? "h-6 w-full px-6"
                            : "w-10 border-r border-line/60 py-6 text-right",
                    ].join(" ")}
                >
                    {/*
                     * 行の目盛り。
                     *
                     * 縦書きでは行が右から左へ並ぶので、
                     * 目盛りも右端から並べる。
                     *
                     * 1 行ぶんの幅は、本文の行の高さと同じにする。
                     * 揃えないと、書き進めるほど番号と行がずれる。
                     */}
                    <div
                        style={{
                            fontSize: `${Math.max(9, fontPx - 5)}px`,
                            lineHeight: `${lineHeightPx}px`,
                            writingMode: "horizontal-tb",
                        }}
                        className={
                            isVertical
                                ? "flex h-6 flex-row-reverse"
                                : "pr-2"
                        }
                    >
                        {Array.from({ length: lineCount }, (_, index) => (
                            <div
                                key={index}
                                style={
                                    isVertical
                                        ? {
                                              width: lineHeightPx,
                                              lineHeight: "1.5rem",
                                          }
                                        : { height: lineHeightPx }
                                }
                                className={isVertical ? "shrink-0 text-center" : ""}
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
                    "manuscript thin-scroll h-full w-full resize-none bg-transparent outline-none placeholder:text-faint",
                    isVertical
                        ? "overflow-x-auto overflow-y-hidden px-6 py-8"
                        : "px-8 py-6",
                    // 目盛りを出すときは、そのぶん本文側の余白を詰める
                    showLineNumbers ? (isVertical ? "pt-2" : "pl-3") : "",
                ].join(" ")}
            />
        </div>
    );
}
