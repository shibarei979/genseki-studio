/**
 * ============================================================
 * 原石航路 Studio
 * MentionTimeline — 本文での登場
 *
 * 「このキャラ、こんなこと言ってたな」を辿るための場所。
 *
 * 台詞・行動・言及に分けて並べる。
 * まとめて出すと量が多く、探しているものに辿り着けない。
 *
 * 各行は押すと本文のその場所へ飛ぶ。
 * 見つけたあと自分で探し直すのでは、辿れるうちに入らない。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import type { Mention, MentionKind } from "@/lib/resource/mention-scan";
import { MENTION_KIND_LABEL, scanMentions, summarizeMentions } from "@/lib/resource/mention-scan";
import type { Episode, ResourceEntry } from "@/types";

type Filter = "all" | MentionKind;

interface Props {
    entry: ResourceEntry;
    episodes: Episode[];
    /** 本文のその場所へ飛ぶ */
    onJump?: (episodeId: string, line: number) => void;
}

export default function MentionTimeline({ entry, episodes, onJump }: Props) {
    const [filter, setFilter] = useState<Filter>("all");
    const [limit, setLimit] = useState(20);

    // 本文を全部走査する。項目か本文が変わったときだけ数え直す
    const mentions = useMemo(
        () => scanMentions(entry, episodes),
        [entry, episodes],
    );
    const summary = useMemo(() => summarizeMentions(mentions), [mentions]);

    if (mentions.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-xs text-faint">
                本文にまだ出てきていません。
            </p>
        );
    }

    const shown = mentions
        .filter((row) => filter === "all" || row.kind === filter)
        .slice(0, limit);

    const counts: Record<Filter, number> = {
        all: summary.total,
        speech: summary.speech,
        action: summary.action,
        mention: summary.total - summary.speech - summary.action,
    };

    return (
        <div>
            {/* まとめ */}
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                <span>
                    {summary.episodeCount}話に{summary.total}回
                </span>
                {summary.firstAppearance && (
                    <span>
                        初登場 第{summary.firstAppearance.epNumber}話
                        {summary.firstAppearance.line}行目
                    </span>
                )}
                {summary.lastAppearance &&
                    summary.lastAppearance !== summary.firstAppearance && (
                        <span>
                            最後 第{summary.lastAppearance.epNumber}話
                            {summary.lastAppearance.line}行目
                        </span>
                    )}
            </div>

            {/* 絞り込み */}
            <div className="mb-2 flex flex-wrap gap-1">
                {(["all", "speech", "action", "mention"] as Filter[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => {
                            setFilter(key);
                            setLimit(20);
                        }}
                        disabled={counts[key] === 0}
                        aria-pressed={filter === key}
                        className={[
                            "rounded-full px-2.5 py-1 text-[11px]",
                            filter === key
                                ? "bg-forest text-white"
                                : "border border-line text-muted hover:text-ink",
                            counts[key] === 0 ? "opacity-40" : "",
                        ].join(" ")}
                    >
                        {key === "all" ? "すべて" : MENTION_KIND_LABEL[key]} {counts[key]}
                    </button>
                ))}
            </div>

            <ul className="thin-scroll max-h-96 space-y-1 overflow-y-auto">
                {shown.map((row, index) => (
                    <li key={`${row.episodeId}-${row.line}-${index}`}>
                        <MentionRow mention={row} onJump={onJump} />
                    </li>
                ))}
            </ul>

            {shown.length <
                mentions.filter((row) => filter === "all" || row.kind === filter)
                    .length && (
                <button
                    type="button"
                    onClick={() => setLimit((value) => value + 30)}
                    className="mt-2 w-full rounded-md border border-line py-1.5 text-[11px] text-muted hover:text-ink"
                >
                    もっと見る
                </button>
            )}
        </div>
    );
}

function MentionRow({
    mention,
    onJump,
}: {
    mention: Mention;
    onJump?: (episodeId: string, line: number) => void;
}) {
    const label = `第${mention.epNumber}話 ${mention.line}行目`;

    return (
        <div className="flex items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-canvas">
            <button
                type="button"
                onClick={() => onJump?.(mention.episodeId, mention.line)}
                disabled={!onJump}
                title={onJump ? "本文のこの場所へ移動します" : undefined}
                className={[
                    "shrink-0 rounded border px-1.5 py-0.5 text-[10px] tabular-nums",
                    onJump
                        ? "border-forest-line text-forest hover:bg-forest-tint"
                        : "border-line text-faint",
                ].join(" ")}
            >
                {label}
            </button>

            <span className="min-w-0 flex-1">
                {mention.kind === "speech" && mention.speech ? (
                    <span className="block text-[12px] leading-relaxed text-ink">
                        「{mention.speech}」
                    </span>
                ) : (
                    <span className="block text-[12px] leading-relaxed text-muted">
                        {mention.text.length > 90
                            ? `${mention.text.slice(0, 90)}…`
                            : mention.text}
                    </span>
                )}
            </span>

            <span
                className={[
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px]",
                    mention.kind === "speech"
                        ? "bg-forest-tint text-forest"
                        : mention.kind === "action"
                          ? "bg-[var(--color-amber-tint)] text-[var(--color-amber)]"
                          : "bg-canvas text-faint",
                ].join(" ")}
            >
                {MENTION_KIND_LABEL[mention.kind]}
            </span>
        </div>
    );
}
