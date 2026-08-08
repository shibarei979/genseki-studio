/**
 * ============================================================
 * 原石航路 Studio
 * MobilePreview — 携帯で読んだときの見え方
 *
 * 枠を細くしただけでは意味がない。
 * 携帯には状態バー・見出し・進捗・下部の操作列があり、
 * 本文に使える高さはPCよりずっと狭くなる。
 * その狭さごと確かめられるように作る。
 * ============================================================
 */

"use client";

import { useCallback, useState } from "react";

import ManuscriptSurface from "@/components/workspace/manuscript-surface";
import PagedReader from "@/components/workspace/paged-reader";
import type { DisplaySettings } from "@/types";

interface Props {
    settings: DisplaySettings;
    workTitle: string;
    episodeTitle: string;
    text: string;
}

export default function MobilePreview({
    settings,
    workTitle,
    episodeTitle,
    text,
}: Props) {
    const [progress, setProgress] = useState(0);

    const handlePageChange = useCallback((pageIndex: number, pageCount: number) => {
        setProgress(pageCount <= 1 ? 1 : (pageIndex + 1) / pageCount);
    }, []);

    const isPaged = settings.page_mode_mobile === "paged";

    return (
        <div className="rounded-[34px] border-[6px] border-[#24282a] bg-[#24282a] shadow-lg">
            <div
                data-manuscript-theme={settings.theme}
                className="manuscript-surface relative flex h-[500px] w-[248px] flex-col overflow-hidden rounded-[26px]"
            >
                {/* 状態バー */}
                <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-2 text-[10px] opacity-60">
                    <span>9:41</span>
                    <span className="flex items-center gap-1">
                        <BarsIcon />
                        <span>100%</span>
                    </span>
                </div>

                {/* 見出し */}
                <div className="shrink-0 border-b border-current/10 px-4 pb-2">
                    <p className="truncate text-[10px] opacity-50">{workTitle}</p>
                    <p className="truncate text-[12px] font-medium">
                        {episodeTitle || "第1話"}
                    </p>
                </div>

                {/* 進捗 */}
                <div className="h-[2px] shrink-0 bg-current/10">
                    <div
                        className="h-full bg-current/40 transition-all duration-200"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                </div>

                {/* 本文 */}
                <div className="min-h-0 flex-1">
                    {isPaged ? (
                        <PagedReader
                            settings={settings}
                            text={text}
                            density="compact"
                            showPager={false}
                            onPageChange={handlePageChange}
                        />
                    ) : (
                        <ManuscriptSurface settings={settings} value={text} readOnly />
                    )}
                </div>

                {/* 下部の操作列 */}
                <div className="flex shrink-0 items-center justify-around border-t border-current/10 px-2 py-2 text-[10px] opacity-60">
                    <span>前の話</span>
                    <span>
                        {isPaged ? `${Math.round(progress * 100)}%` : "目次"}
                    </span>
                    <span>次の話</span>
                </div>
            </div>
        </div>
    );
}

function BarsIcon() {
    return (
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
            <rect x="0" y="5" width="2" height="3" fill="currentColor" />
            <rect x="3" y="3" width="2" height="5" fill="currentColor" />
            <rect x="6" y="1" width="2" height="7" fill="currentColor" />
            <rect x="9" y="0" width="2" height="8" fill="currentColor" />
        </svg>
    );
}
