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
                            lineHeight: `${lineHeightPx}px`,
                            writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
                            // 縦書きは右から始まるので、目盛りも右端から
                            direction: isVertical ? "rtl" : "ltr",
                        }}
                        className={isVertical ? "h-6" : "pr-2"}
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
