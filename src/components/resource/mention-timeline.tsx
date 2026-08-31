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
    /**
     * 消した行。
     *
     * 「言及・行動・台詞」は本文を読んで毎回数え直しているので、
     * 消したことは別に覚えておく必要がある。
     */
    hidden?: { episode_id: string; line: number; text: string }[];
    /** ゴミ箱を押したとき */
    onHide?: (episodeId: string, line: number, text: string) => void;
    /** 蛍光ペンで自分で足した行 */
    picked?: { episode_id: string; line: number; text: string }[];
    /** 本文のその場所へ飛ぶ */
    onJump?: (episodeId: string, line: number) => void;
}

export default function MentionTimeline({ entry, episodes, onJump, hidden = [], picked = [], onHide }: Props) {
    const [filter, setFilter] = useState<Filter>("all");
    const [limit, setLimit] = useState(20);

    // 本文を全部走査する。項目か本文が変わったときだけ数え直す
    const mentions = useMemo(() => {
        const found = scanMentions(entry, episodes);

        if (hidden.length === 0) return found;

        /*
         * 消した行を外す。
         *
         * ★ 行の番号だけでは足りない。
         *
         *   消したあとで作者が前のほうに段落を足すと、
         *   その行の番号がずれる。
         *   番号だけで判断すると、別の行を消してしまう。
         *
         *   本文も照らし合わせて、同じときだけ外す。
         *   違っていたら、その覚え書きはもう合っていない。
         */
        /*
         * 自分で足した行を混ぜる。
         *
         * 数え直しでは見つからなかったが、
         * 本文を読んで手で入れたもの。
         */
        for (const one of picked) {
            const already = found.some(
                (row) => row.episodeId === one.episode_id && row.line === one.line,
            );
            if (already) continue;

            const ep = episodes.find((e) => e.id === one.episode_id);
            found.push({
                episodeId: one.episode_id,
                epNumber: ep?.ep_number ?? 0,
                line: one.line,
                kind: "mention",
                text: one.text,
                speech: "",
            } as Mention);
        }

        found.sort((a, b) => a.epNumber - b.epNumber || a.line - b.line);

        return found.filter((row) => {
            const mark = hidden.find(
                (h) => h.episode_id === row.episodeId && h.line === row.line,
            );
            if (!mark) return true;

            const now = (row.speech || row.text || "").trim();
            return mark.text.trim() !== now.trim();
        });
    }, [entry, episodes, hidden, picked]);
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
                        <MentionRow mention={row} onJump={onJump} onHide={onHide} />
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
    onHide,
}: {
    mention: Mention;
    onJump?: (episodeId: string, line: number) => void;
    onHide?: (episodeId: string, line: number, text: string) => void;
}) {
    const label = `第${mention.epNumber}話 ${mention.line}行目`;

    return (
        <div className="group flex items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-canvas">
            {/*
              * 消す押し具。
              *
              * ★ 行の左に置く。
              *   数え違いに気づくのは、その行を読んだとき。
              *   目で追う先に押し具があるほうが早い。
              *
              * ★ 確認は出さない。
              *   資料から外すだけで、本文は変わらない。
              *   間違えても、また数え直せば戻る。
              */}
            {onHide && (
                <button
                    type="button"
                    onClick={() =>
                        onHide(
                            mention.episodeId,
                            mention.line,
                            (mention.speech || mention.text || "").trim(),
                        )
                    }
                    title="この行を資料から外す"
                    aria-label="この行を資料から外す"
                    className="mt-0.5 shrink-0 text-faint opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 6h16" />
                        <path d="M9 6V4h6v2" />
                        <path d="M6.5 6.5 7.5 20h9l1-13.5" />
                        <path d="M10 10v6M14 10v6" />
                    </svg>
                </button>
            )}

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
