/**
 * ============================================================
 * 原石航路 Studio
 * AppearanceList — 執筆中に見る、その人の登場（Pro）
 *
 * ★ 数え方は、資料の頁の「本文での登場」と同じもの（mention-scan）。
 *
 *   前は執筆中の欄だけ別の数え方をしていて、
 *   資料の頁と件数が合わない、台詞・行動の分け方も無い、
 *   資料の頁で「外した」行がこちらには残る、ということが起きた。
 *   同じ仕組みで数え、外した行・足した行も同じように当てる。
 *
 * ★ 違いは置き場所だけ。
 *   資料の頁：全部を並べて整える場所（外す・足す）。無料
 *   ここ　　：書きながら、その場で確かめる場所。Pro
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import ProBadge from "@/components/common/pro-badge";
import { getRepository } from "@/lib/repository";
import type { LineMark, Mention, MentionKind } from "@/lib/resource/mention-scan";
import { applyLineMarks, MENTION_KIND_LABEL, scanMentions } from "@/lib/resource/mention-scan";
import type { Episode, ResourceEntry } from "@/types";

type Filter = "all" | MentionKind;

/** 一度に並べる数。多い人は「もっと見る」で足す */
const STEP = 40;

interface Props {
    workId: string;
    episodeId: string;
    entry: ResourceEntry;
    /** 打った言葉。資料の名前と違っても、これでも探す */
    typed?: string;
    onJumpToWord?: (word: string) => void;
    onOpenReport?: (entryId: string) => void;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function AppearanceList({
    workId,
    episodeId,
    entry,
    typed,
    onJumpToWord,
    onOpenReport,
}: Props) {
    const [episodes, setEpisodes] = useState<Episode[] | null>(null);
    const [hidden, setHidden] = useState<LineMark[]>([]);
    const [picked, setPicked] = useState<LineMark[]>([]);
    const [filter, setFilter] = useState<Filter>("all");
    const [limit, setLimit] = useState(STEP);

    useEffect(() => {
        let alive = true;
        const repository = getRepository();

        void (async () => {
            try {
                const list = await repository.listEpisodes(workId);
                if (alive) setEpisodes(list);
            } catch {
                if (alive) setEpisodes([]);
            }
            try {
                const marks = await repository.listLineMarks(entry.id);
                if (!alive) return;
                setHidden(marks.filter((row) => row.kind === "hidden"));
                setPicked(marks.filter((row) => row.kind === "picked"));
            } catch {
                /* 読めなくても、数え直した一覧は出す */
            }
        })();

        return () => {
            alive = false;
        };
    }, [workId, entry.id]);

    useEffect(() => {
        setFilter("all");
        setLimit(STEP);
    }, [entry.id, typed]);

    const mentions = useMemo(() => {
        if (!episodes) return null;
        const found = scanMentions(entry, episodes, typed ? [typed] : []);
        return applyLineMarks(found, episodes, hidden, picked);
    }, [episodes, entry, typed, hidden, picked]);

    /* 当たった呼び方に色を付ける */
    const marker = useMemo(() => {
        const words = [entry.name, ...(entry.aliases ?? []), typed ?? ""]
            .map((word) => word.trim())
            .filter((word) => word.length > 0)
            .sort((a, b) => b.length - a.length);
        return words.length ? new RegExp(`(${words.map(escapeRegExp).join("|")})`, "g") : null;
    }, [entry, typed]);

    function marked(text: string) {
        if (!marker) return text;
        return text.split(marker).map((part, index) =>
            index % 2 === 1 ? (
                <mark key={index} className="rounded-sm bg-forest-tint px-0.5 font-medium text-forest">
                    {part}
                </mark>
            ) : (
                <span key={index}>{part}</span>
            ),
        );
    }

    const title = `${entry.name}が出てくる行`;

    if (!mentions) {
        return <p className="px-2.5 py-4 text-xs text-faint">探しています…</p>;
    }

    const counts: Record<Filter, number> = {
        all: mentions.length,
        speech: mentions.filter((row) => row.kind === "speech").length,
        action: mentions.filter((row) => row.kind === "action").length,
        mention: mentions.filter((row) => row.kind === "mention").length,
    };
    const filtered = mentions.filter((row) => filter === "all" || row.kind === filter);
    const shown = filtered.slice(0, limit);
    const episodeCount = new Set(mentions.map((row) => row.episodeId)).size;

    /* 話ごとにまとめる */
    const groups: { key: string; epNumber: number; title: string; rows: Mention[] }[] = [];
    for (const row of shown) {
        const last = groups[groups.length - 1];
        if (last && last.key === row.episodeId) last.rows.push(row);
        else
            groups.push({
                key: row.episodeId,
                epNumber: row.epNumber,
                title: row.episodeTitle,
                rows: [row],
            });
    }

    return (
        <div className="px-1.5 py-1">
            <div className="flex items-baseline gap-2 px-1.5">
                <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium text-ink">
                    <span className="truncate">{title}</span>
                    <ProBadge />
                </p>
                <span className="shrink-0 text-[11px] text-muted">
                    {mentions.length}件・{episodeCount}話
                </span>
            </div>
            <p className="mt-0.5 px-1.5 text-[10.5px] text-faint">
                資料の頁の「本文での登場」と同じ数え方です。外した行は出ません。
            </p>

            {mentions.length === 0 ? (
                <p className="px-1.5 py-4 text-xs text-faint">本文にはまだ出てきていません。</p>
            ) : (
                <>
                    {/* 絞り込み。資料の頁と同じ 4 つ */}
                    <div className="mt-2 flex flex-wrap gap-1 px-1.5">
                        {(["all", "speech", "action", "mention"] as Filter[]).map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => {
                                    setFilter(key);
                                    setLimit(STEP);
                                }}
                                disabled={counts[key] === 0}
                                aria-pressed={filter === key}
                                className={[
                                    "rounded-full px-2.5 py-0.5 text-[11px]",
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

                    <div className="mt-2 space-y-2 px-1">
                        {groups.map((group) => {
                            const isHere = group.key === episodeId;
                            return (
                                <section
                                    key={group.key}
                                    className={[
                                        "overflow-hidden rounded-lg border",
                                        isHere ? "border-forest-line" : "border-line",
                                    ].join(" ")}
                                >
                                    <header
                                        className={[
                                            "flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]",
                                            isHere ? "bg-forest-tint" : "bg-canvas",
                                        ].join(" ")}
                                    >
                                        <span className="shrink-0 font-medium text-ink">
                                            第{group.epNumber}話
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-muted">
                                            {group.title}
                                        </span>
                                        {isHere && (
                                            <span className="shrink-0 text-[10px] text-forest">
                                                開いている話
                                            </span>
                                        )}
                                        <span className="shrink-0 text-[10px] text-faint">
                                            {group.rows.length}か所
                                        </span>
                                    </header>

                                    <ul className="divide-y divide-line bg-surface">
                                        {group.rows.map((row, index) => (
                                            <li key={`${row.line}-${index}`}>
                                                <button
                                                    type="button"
                                                    disabled={!isHere || !onJumpToWord}
                                                    onClick={() => onJumpToWord?.(row.text)}
                                                    title={isHere ? "本文のこの行へ移動します" : undefined}
                                                    className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left enabled:hover:bg-canvas disabled:cursor-default"
                                                >
                                                    <span className="mt-0.5 min-w-[3.4rem] shrink-0 whitespace-nowrap rounded border border-line px-1 py-px text-center text-[10px] text-muted">
                                                        {row.line}行目
                                                    </span>
                                                    <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink">
                                                        {row.text.length > 90
                                                            ? marked(`${row.text.slice(0, 90)}…`)
                                                            : marked(row.text)}
                                                    </span>
                                                    <span
                                                        className={[
                                                            "mt-0.5 shrink-0 rounded px-1.5 py-px text-[10px]",
                                                            row.kind === "speech"
                                                                ? "bg-forest-tint text-forest"
                                                                : row.kind === "action"
                                                                  ? "bg-[var(--color-amber-tint)] text-[var(--color-amber)]"
                                                                  : "bg-canvas text-faint",
                                                        ].join(" ")}
                                                    >
                                                        {MENTION_KIND_LABEL[row.kind]}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            );
                        })}
                    </div>

                    {shown.length < filtered.length && (
                        <button
                            type="button"
                            onClick={() => setLimit((value) => value + STEP)}
                            className="mx-1 mt-2 w-[calc(100%-0.5rem)] rounded-md border border-line py-1.5 text-[11px] text-muted hover:text-ink"
                        >
                            もっと見る（あと{filtered.length - shown.length}件）
                        </button>
                    )}
                </>
            )}

            {onOpenReport && (
                <button
                    type="button"
                    onClick={() => onOpenReport(entry.id)}
                    className="mx-1.5 mt-3 text-[11px] text-forest hover:underline"
                >
                    {entry.name}の報告書を開く
                </button>
            )}
        </div>
    );
}
