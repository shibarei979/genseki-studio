/**
 * ============================================================
 * 原石航路 Studio
 * PagedReader — ページ送りで読む表示
 *
 * ページは左へ送る。日本語の本は右綴じで、
 * めくった紙が左へ流れていくのと同じ向きに合わせている。
 * 横書きでも向きは変えない。同じ作品の中で送り方が変わると迷うため。
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { estimateMetrics, paginate } from "@/lib/utils/pagination";
import type { DisplaySettings } from "@/types";
import { LINE_HEIGHT_VALUE } from "@/types";

interface Props {
    settings: DisplaySettings;
    text: string;
    /** 余白の詰め方。携帯プレビューでは狭くする */
    density?: "normal" | "compact";
    /** ページ番号を出す */
    showPager?: boolean;
    /** ページが変わったときに呼ぶ。外側で進捗を出すために使う */
    onPageChange?: (pageIndex: number, pageCount: number) => void;
}

export default function PagedReader({
    settings,
    text,
    density = "normal",
    showPager = true,
    onPageChange,
}: Props) {
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [pageIndex, setPageIndex] = useState(0);
    /** めくり中の向き。null なら静止している */
    const [turning, setTurning] = useState<"next" | "previous" | null>(null);

    const isVertical = settings.writing_mode === "vertical";

    // 表示領域の大きさが変わったらページの区切りを計算し直す
    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;

        const observer = new ResizeObserver((entries) => {
            const rect = entries[0].contentRect;
            setSize({ width: rect.width, height: rect.height });
        });
        observer.observe(box);
        return () => observer.disconnect();
    }, []);

    const padding = density === "compact" ? 16 : 28;

    const pages = useMemo(() => {
        if (size.width === 0 || size.height === 0) return [[""]];
        const metrics = estimateMetrics(
            size.width - padding * 2,
            size.height - padding * 2,
            settings.font_size,
            LINE_HEIGHT_VALUE[settings.line_height],
            isVertical,
        );
        return paginate(text, metrics);
    }, [text, size, settings.font_size, settings.line_height, isVertical, padding]);

    // ページ数が減ったときに、存在しないページを指したままにしない
    useEffect(() => {
        setPageIndex((current) => Math.min(current, pages.length - 1));
    }, [pages.length]);

    useEffect(() => {
        onPageChange?.(pageIndex, pages.length);
    }, [pageIndex, pages.length, onPageChange]);

    function turn(direction: "next" | "previous") {
        const target =
            direction === "next"
                ? Math.min(pageIndex + 1, pages.length - 1)
                : Math.max(pageIndex - 1, 0);
        if (target === pageIndex) return;

        setTurning(direction);
        // 紙が動く時間ぶんだけ待ってから中身を入れ替える
        window.setTimeout(() => {
            setPageIndex(target);
            setTurning(null);
        }, 180);
    }

    const current = pages[pageIndex] ?? [""];

    /**
     * 次へ進むときは中身が左へ抜ける。
     * 戻るときはその逆で右へ抜ける。
     */
    const turnStyle =
        turning === "next"
            ? { transform: "translateX(-12%)", opacity: 0 }
            : turning === "previous"
              ? { transform: "translateX(12%)", opacity: 0 }
              : { transform: "translateX(0)", opacity: 1 };

    return (
        <div
            data-manuscript-theme={settings.theme}
            className="manuscript-surface relative flex h-full w-full flex-col"
            onKeyDown={(e) => {
                if (e.key === "ArrowLeft") turn("next");
                if (e.key === "ArrowRight") turn("previous");
            }}
            tabIndex={0}
            role="application"
            aria-label="ページ送り表示"
        >
            <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden">
                <div
                    className="manuscript absolute inset-0 transition-all duration-150 ease-out"
                    style={{
                        padding: `${padding}px`,
                        fontSize: `${settings.font_size}px`,
                        lineHeight: LINE_HEIGHT_VALUE[settings.line_height],
                        writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
                        textOrientation: "mixed",
                        ...turnStyle,
                    }}
                >
                    {current.map((line, index) => (
                        <div key={index}>{line === "" ? "\u00a0" : line}</div>
                    ))}
                </div>

                {/* 左半分で次へ、右半分で前へ。右綴じの本と同じ操作にする */}
                <button
                    type="button"
                    aria-label="次のページ"
                    onClick={() => turn("next")}
                    className="absolute inset-y-0 left-0 w-2/5"
                />
                <button
                    type="button"
                    aria-label="前のページ"
                    onClick={() => turn("previous")}
                    className="absolute inset-y-0 right-0 w-2/5"
                />
            </div>

            {showPager && (
                <div className="flex items-center justify-center gap-2.5 py-2 text-xs opacity-60">
                    <button
                        type="button"
                        onClick={() => turn("next")}
                        disabled={pageIndex >= pages.length - 1}
                        aria-label="次のページ"
                        className="px-2 disabled:opacity-30"
                    >
                        ‹
                    </button>
                    <span>
                        {pageIndex + 1} / {pages.length}
                    </span>
                    <button
                        type="button"
                        onClick={() => turn("previous")}
                        disabled={pageIndex === 0}
                        aria-label="前のページ"
                        className="px-2 disabled:opacity-30"
                    >
                        ›
                    </button>
                </div>
            )}
        </div>
    );
}
