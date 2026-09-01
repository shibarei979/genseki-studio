"use client";

import { useEffect, useState } from "react";

import PagedReader from "@/components/workspace/paged-reader";
import type { DisplaySettings } from "@/types";

/**
 * ============================================================
 * 原石航路 Studio
 * FullscreenReader — 全画面で読む
 *
 * 画面いっぱいに本文を出し、左右を触ると頁を送る。
 *
 * ★ 頁の分け方は PagedReader に任せる。
 *   画面に入るぶんで切る仕組みが既にある。
 *   同じものを二度作ると、片方だけ古くなる。
 *
 * ★ 道具は、ふだん隠す。
 *   本を読んでいる最中に帯が出ていると、
 *   そのぶん本文が狭くなる。
 *   真ん中を触ったときだけ出す。
 * ============================================================
 */

export default function FullscreenReader({
    settings,
    title,
    text,
    onClose,
}: {
    settings: DisplaySettings;
    title: string;
    text: string;
    onClose: () => void;
}) {
    /* 道具を出しているか */
    const [isBarOpen, setIsBarOpen] = useState(false);
    const [page, setPage] = useState({ index: 0, count: 1 });

    useEffect(() => {
        /*
         * 開いているあいだ、後ろの頁を動かさない。
         *
         * これが無いと、読んでいる裏で作品ページが送られ、
         * 閉じたときに知らない場所にいることになる。
         */
        const before = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);

        return () => {
            document.body.style.overflow = before;
            window.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    return (
        <div
            className="fsr"
            role="dialog"
            aria-modal="true"
            aria-label="全画面で読む"
        >
            {/*
              * 上の帯。
              * 真ん中を触ったときだけ出す。
              */}
            <div className={`fsr_bar fsr_bar--top${isBarOpen ? " is-open" : ""}`}>
                <span className="fsr_title">{title}</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="fsr_close"
                    aria-label="閉じる"
                >
                    閉じる
                </button>
            </div>

            <div className="fsr_body">
                <PagedReader
                    settings={settings}
                    text={text}
                    density="normal"
                    /* 帯を自前で出すので、既定の送り具は出さない */
                    showPager={false}
                    tapToTurn
                    onTapCenter={() => setIsBarOpen((v) => !v)}
                    onPageChange={(index, count) => setPage({ index, count })}
                />
            </div>

            {/*
              * 下の帯。
              *
              * いま何頁目かだけは、いつでも出す。
              * どこまで来たか分からないまま読むのは落ち着かない。
              */}
            <div className={`fsr_bar fsr_bar--bottom${isBarOpen ? " is-open" : ""}`}>
                <span className="fsr_page">
                    {page.index + 1} / {page.count}
                </span>
            </div>

            {/* 読んだ量の線。いつでも出す */}
            <div className="fsr_progress" aria-hidden="true">
                <span
                    style={{
                        width: `${((page.index + 1) / Math.max(1, page.count)) * 100}%`,
                    }}
                />
            </div>
        </div>
    );
}
