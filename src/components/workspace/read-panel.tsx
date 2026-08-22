/**
 * ============================================================
 * 原石航路 Studio
 * ReadPanel — 通し読み
 *
 * 執筆画面の横に出す。
 * 書いているときは 1 話ずつしか見えないので、
 * 話をまたいだ流れは通して読まないと分からない。
 * 画面ごと移ると「書く」と「読み返す」の往復が遠くなるため、
 * 履歴や資料リンクと同じ場所に置いている。
 *
 * 見え方は表示設定をそのまま使う。ここだけ別の見え方では意味がない。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

import RenderedText from "@/components/manuscript/rendered-text";
import { toFullWidthLatin } from "@/lib/manuscript/notation";
import { formatNumber } from "@/lib/utils/text";
import type { DisplaySettings, Episode } from "@/types";
import { formatEpisodeLabel, LINE_HEIGHT_VALUE } from "@/types";

type Scope = "all" | "done";

interface Props {
    episodes: Episode[];
    settings: DisplaySettings;
    /** いま執筆中の話。開いたときにそこへ寄せる */
    currentEpisodeId: string | null;
    onClose: () => void;
}

export default function ReadPanel({
    episodes,
    settings,
    currentEpisodeId,
    onClose,
}: Props) {
    const [scope, setScope] = useState<Scope>("all");
    const bodyRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<HTMLElement>(null);

    const shown =
        scope === "done"
            ? episodes.filter((episode) => episode.status === "done")
            : episodes;

    const isVertical = settings.writing_mode === "vertical";
    const totalChars = shown.reduce((sum, episode) => sum + episode.char_count, 0);

    // 開いたとき、いま書いている話まで送る
    useEffect(() => {
        currentRef.current?.scrollIntoView({ block: "start" });
    }, [currentEpisodeId, scope]);

    return (
        <div className="flex h-full w-full shrink-0 flex-col rounded-lg border border-line bg-surface lg:w-[420px]">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                <div className="min-w-0">
                    <h2 className="text-[13px] font-medium text-ink">通し読み</h2>
                    <p className="text-xs text-faint">
                        {shown.length}話・{formatNumber(totalChars)}文字
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-0.5 rounded-md border border-line p-0.5">
                        <ScopeTab
                            label="すべて"
                            isActive={scope === "all"}
                            onClick={() => setScope("all")}
                        />
                        <ScopeTab
                            label="完成"
                            isActive={scope === "done"}
                            onClick={() => setScope("done")}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="閉じる"
                        className="px-1 text-[13px] text-faint hover:text-ink"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {shown.length === 0 ? (
                <p className="py-16 text-center text-[13px] text-faint">読む話がありません。</p>
            ) : (
                <div
                    ref={bodyRef}
                    data-manuscript-theme={settings.theme}
                    className="manuscript-surface thin-scroll min-h-0 flex-1 overflow-auto rounded-b-lg"
                >
                    <div
                        className="manuscript px-6 py-6"
                        style={{
                            fontSize: `${Math.max(13, settings.font_size - 2)}px`,
                            lineHeight: LINE_HEIGHT_VALUE[settings.line_height],
                            writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
                            textOrientation: "mixed",
                            height: isVertical ? "100%" : "auto",
                        }}
                    >
                        {shown.map((episode) => {
                            const label = formatEpisodeLabel(episode);
                            return (
                                <section
                                    key={episode.id}
                                    ref={
                                        episode.id === currentEpisodeId
                                            ? currentRef
                                            : undefined
                                    }
                                    className="mb-10"
                                >
                                    <h3 className="mb-4 text-[1.05em] font-medium opacity-90">
                                        {/* 縦書きでは半角数字が倒れるので全角にする */}
                                        {isVertical ? toFullWidthLatin(label) : label}
                                    </h3>
                                    {episode.body.split("\n").map((line, index) => (
                                        <p key={index}>
                                            {line ? <RenderedText text={line} /> : "\u00a0"}
                                        </p>
                                    ))}
                                </section>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function ScopeTab({
    label,
    isActive,
    onClick,
}: {
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isActive}
            className={[
                "rounded px-2.5 py-1 text-xs",
                isActive ? "bg-forest text-white" : "text-muted hover:text-ink",
            ].join(" ")}
        >
            {label}
        </button>
    );
}
