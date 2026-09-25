/**
 * ============================================================
 * 原石航路 Studio
 * SceneSearch — 「誰」と「何」で場面を探す（会員）
 *
 * ★ 「リオ 投げる」と打ったときに使う。
 *
 *   名前に当たる言葉を「誰」、残りを「何」として分ける。
 *   報告書を丸ごと出すと、知りたい「投げる場面」が
 *   設定や関係図に埋もれてしまう。
 *   ここでは、当てはまる場面だけを並べる。
 *
 * ★ 場面の決め方。
 *   「何」はその行に、「誰」は前後 2 行以内にあればよい。
 *   「リオは縄を掴んだ。そのまま甲板へ投げた。」のように、
 *   名前と動きが別の行に分かれることが多いため。
 *
 * ★ 言葉の形の揺れ。
 *   「投げる」は終わりの 1 字を落とした「投げ」で探す。
 *   「投げた」「投げて」「投げられ」も拾える。
 *   「走る」→「走っ」のように形が大きく変わる言葉は拾えない。
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import { getRepository } from "@/lib/repository";
import ProBadge from "@/components/common/pro-badge";
import type { Episode, FieldValue, ResourceEntry, ResourcePage } from "@/types";

/** 「誰」の前後、何行までを同じ場面とみなすか */
const NEAR_LINES = 2;

/** 並べる数の上限。これより多ければ、もう少し言葉を足してもらう */
const MAX_HITS = 60;

/** 一行が長いときに、前後をどこまで見せるか */
const AROUND = 34;

/**
 * 探すときの形。
 *
 * ★ ひらがなで終わる 3 字以上の言葉は、終わりの 1 字を落とす。
 *   「投げる」→「投げ」。
 *   2 字の言葉（「見る」）は落とさない。「見」だけだと何でも当たる。
 */
export function stemOf(word: string): string {
    const text = word.trim();
    if (text.length >= 3 && /[ぁ-ん]$/.test(text)) return text.slice(0, -1);
    return text;
}

/** 正規表現で特別な意味を持つ字を、ただの字にする */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** その資料を本文で探すときの呼び方。長いものから */
function wordsOf(entry: ResourceEntry): string[] {
    return [entry.name, ...(entry.aliases ?? [])]
        .map((word) => word.trim())
        .filter((word) => word.length > 0)
        .sort((a, b) => b.length - a.length);
}

interface Hit {
    episode: Episode;
    lineNo: number;
    /** 行そのもの。本文で探すときに使う */
    line: string;
    /** 見せる部分。長い行は、当たった所の前後だけ */
    shown: string;
    /**
     * 「誰」が別の行にいたときの、その行。
     * 当たった行に名前が無いと、誰の場面か分からないため、薄く添える。
     */
    context: string;
}

interface Props {
    workId: string;
    episodeId: string;
    who: ResourceEntry[];
    what: string[];
    pages: ResourcePage[];
    /** 会員でないとき。中身を数えず、案内だけ出す */
    locked: boolean;
    onJumpToWord?: (word: string) => void;
    onOpenReport?: (entryId: string) => void;
}

export default function SceneSearch({
    workId,
    episodeId,
    who,
    what,
    pages,
    locked,
    onJumpToWord,
    onOpenReport,
}: Props) {
    const [episodes, setEpisodes] = useState<Episode[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (locked) return;
        let alive = true;

        getRepository()
            .listEpisodes(workId)
            .then((list) => {
                if (alive) setEpisodes(list);
            })
            .catch(() => {
                if (alive) setFailed(true);
            });

        return () => {
            alive = false;
        };
    }, [workId, locked]);

    const stems = useMemo(() => what.map(stemOf).filter((stem) => stem.length > 0), [what]);

    /** 見出し。「リオ × 投げる」 */
    const title = [...who.map((entry) => entry.name), ...what].join(" × ");

    const result = useMemo(() => {
        if (!episodes) return null;

        const whoPatterns = who.map(
            (entry) => new RegExp(wordsOf(entry).map(escapeRegExp).join("|")),
        );

        const hits: Hit[] = [];
        let total = 0;

        const sorted = episodes.slice().sort((a, b) => a.ep_number - b.ep_number);

        for (const episode of sorted) {
            const lines = (episode.body ?? "").split("\n");

            lines.forEach((line, index) => {
                if (!line.trim()) return;
                if (!stems.every((stem) => line.includes(stem))) return;

                /*
                 * ★ 名前だけで探すとき（「何」が無い）は、その行に名前があること。
                 *   前後の行まで見ると、同じ場面が何度も並んでしまう。
                 */
                if (stems.length === 0) {
                    if (!whoPatterns.some((pattern) => pattern.test(line))) return;
                } else if (whoPatterns.length > 0) {
                    const from = Math.max(0, index - NEAR_LINES);
                    const near = lines.slice(from, index + NEAR_LINES + 1).join("\n");
                    if (!whoPatterns.every((pattern) => pattern.test(near))) return;
                }

                total += 1;
                if (hits.length >= MAX_HITS) return;

                /* 長い行は、当たった言葉の前後だけを見せる */
                let at = 0;
                let hitLength = 0;
                if (stems.length > 0) {
                    at = line.indexOf(stems[0]);
                    hitLength = stems[0].length;
                } else {
                    for (const pattern of whoPatterns) {
                        const found = line.match(pattern);
                        if (found && found.index !== undefined) {
                            at = found.index;
                            hitLength = found[0].length;
                            break;
                        }
                    }
                }
                const start = Math.max(0, at - AROUND);
                const end = Math.min(line.length, at + hitLength + AROUND);
                const shown =
                    (start > 0 ? "…" : "") +
                    line.slice(start, end).trim() +
                    (end < line.length ? "…" : "");

                /*
                 * ★ 当たった行に「誰」がいなければ、近くの行を添える。
                 *   前の行を先に見る。名前は動きより先に出ることが多い。
                 */
                let context = "";
                if (whoPatterns.length > 0 && !whoPatterns.every((pattern) => pattern.test(line))) {
                    const order = [];
                    for (let step = 1; step <= NEAR_LINES; step += 1) {
                        order.push(index - step, index + step);
                    }
                    for (const at of order) {
                        const other = lines[at];
                        if (other && whoPatterns.some((pattern) => pattern.test(other))) {
                            const one = other.trim();
                            context = one.length > 44 ? `${one.slice(0, 44)}…` : one;
                            break;
                        }
                    }
                }

                hits.push({ episode, lineNo: index + 1, line, shown, context });
            });
        }

        /*
         * ★ 書いた設定に、その言葉があれば添える。
         *   「特技：ナイフ投げ」のように、本文より先に決めてあることがある。
         */
        const pageById = new Map(pages.map((page) => [page.id, page]));
        const notes: { who: string; label: string; text: string }[] = [];

        for (const entry of who) {
            const page = pageById.get(entry.page_id);
            const fields = [
                { label: "一言説明", value: entry.summary as FieldValue },
                ...(page?.fields ?? [])
                    .filter((field) => field.type !== "relation_entry" && field.type !== "relation_episode")
                    .map((field) => ({ label: field.label, value: entry.values?.[field.key] })),
            ];

            for (const field of fields) {
                const text = Array.isArray(field.value)
                    ? field.value.join("、")
                    : typeof field.value === "string"
                      ? field.value
                      : "";
                if (text && stems.some((stem) => text.includes(stem))) {
                    const one = text.replace(/\s+/g, " ");
                    notes.push({
                        who: entry.name,
                        label: field.label,
                        text: one.length > 60 ? `${one.slice(0, 60)}…` : one,
                    });
                }
            }
        }

        const episodeCount = new Set(hits.map((hit) => hit.episode.id)).size;

        return { hits, total, notes, episodeCount };
    }, [episodes, who, stems, pages]);

    /* 当たった所を太くする。「誰」と「何」の両方 */
    const marker = useMemo(() => {
        const words = [...stems, ...who.flatMap(wordsOf)]
            .filter((word) => word.length > 0)
            .sort((a, b) => b.length - a.length);
        return words.length ? new RegExp(`(${words.map(escapeRegExp).join("|")})`, "g") : null;
    }, [stems, who]);

    function marked(text: string) {
        if (!marker) return <>{text}</>;
        const parts = text.split(marker);
        return (
            <>
                {parts.map((part, index) =>
                    index % 2 === 1 ? (
                        <mark key={index} className="rounded-sm bg-forest-tint px-0.5 text-forest">
                            {part}
                        </mark>
                    ) : (
                        <span key={index}>{part}</span>
                    ),
                )}
            </>
        );
    }

    return (
        <div className="px-1.5 py-1">
            <div className="flex items-baseline gap-2 px-1.5">
                <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium text-ink">
                    <span className="truncate">{title}</span>
                    <ProBadge />
                </p>
                {result && !locked && (
                    <span className="shrink-0 text-[11px] text-muted">
                        {result.total}件{result.episodeCount > 0 && `・${result.episodeCount}話`}
                    </span>
                )}
            </div>
            <p className="mt-0.5 px-1.5 text-[10.5px] text-faint">
                {who.length > 0 && what.length === 0
                    ? `${who.map((entry) => entry.name).join("・")}が出てくる行（名前・別名）`
                    : who.length > 0
                    ? `${who.map((entry) => entry.name).join("・")}が近くにいて「${what.join("」「")}」が出てくる場面`
                    : `「${what.join("」「")}」が出てくる場面`}
                {stems.some((stem, index) => stem !== what[index]) &&
                    `（「${stems.join("」「")}」で探しています）`}
            </p>

            {locked ? (
                <div className="mx-1.5 mt-2.5 rounded-md border border-forest-line bg-forest-tint px-3 py-2">
                    <p className="text-[11.5px] text-forest">
                        場面探しは<ProBadge className="mx-0.5" />の機能です。サブスクに入ると使えます。
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                        「リオ 投げる」のように、人の名前と言葉を並べて打つと、その人がそうしている場面だけを全話から集めます。
                    </p>
                </div>
            ) : failed ? (
                <p className="px-1.5 py-4 text-xs text-faint">読み込めませんでした。開き直してください。</p>
            ) : !result ? (
                <p className="px-1.5 py-4 text-xs text-faint">探しています…</p>
            ) : (
                <>
                    {result.notes.length > 0 && (
                        <div className="mx-1.5 mt-2.5 rounded-md bg-canvas px-2.5 py-1.5">
                            <p className="text-[10.5px] text-muted">設定に書いてあること</p>
                            <ul className="mt-0.5 space-y-0.5">
                                {result.notes.map((note, index) => (
                                    <li key={index} className="text-[12px] text-ink">
                                        {who.length > 1 && (
                                            <span className="text-faint">{note.who}・</span>
                                        )}
                                        <span className="text-muted">{note.label}：</span>
                                        {marked(note.text)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {result.hits.length === 0 ? (
                        <p className="px-1.5 py-4 text-xs leading-relaxed text-faint">
                            当てはまる場面は見つかりませんでした。
                            <br />
                            言葉を短くするか、別の言い方で試してください。
                        </p>
                    ) : (
                        <ul className="mt-2">
                            {result.hits.map((hit, index) => {
                                const isHere = hit.episode.id === episodeId;
                                const showHead =
                                    index === 0 || result.hits[index - 1].episode.id !== hit.episode.id;

                                return (
                                    <li key={`${hit.episode.id}-${hit.lineNo}`}>
                                        {showHead && (
                                            <p className="mt-2 flex items-baseline gap-1.5 px-1.5 text-[11px] text-muted first:mt-0">
                                                <span className="font-medium text-ink">
                                                    第{hit.episode.ep_number}話
                                                </span>
                                                <span className="min-w-0 truncate">
                                                    {hit.episode.title}
                                                </span>
                                                {isHere && (
                                                    <span className="shrink-0 rounded bg-forest-tint px-1 text-[10px] text-forest">
                                                        開いている話
                                                    </span>
                                                )}
                                            </p>
                                        )}
                                        <button
                                            type="button"
                                            disabled={!isHere || !onJumpToWord}
                                            onClick={() => onJumpToWord?.(hit.line)}
                                            title={isHere ? "本文のこの行へ移動します" : undefined}
                                            className="flex w-full gap-2 rounded-md px-1.5 py-1 text-left enabled:hover:bg-canvas disabled:cursor-default"
                                        >
                                            <span className="w-9 shrink-0 pt-px text-right text-[10.5px] text-faint">
                                                {hit.lineNo}行
                                            </span>
                                            <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink">
                                                {hit.context && (
                                                    <span className="mb-0.5 block text-[11px] leading-snug text-faint">
                                                        {hit.context}
                                                    </span>
                                                )}
                                                {marked(hit.shown)}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {result.total > result.hits.length && (
                        <p className="px-1.5 pt-2 text-[11px] text-faint">
                            ほかに{result.total - result.hits.length}件あります。言葉を足すと絞れます。
                        </p>
                    )}

                    {onOpenReport && who.length === 1 && (
                        <button
                            type="button"
                            onClick={() => onOpenReport(who[0].id)}
                            className="mx-1.5 mt-3 text-[11px] text-forest hover:underline"
                        >
                            {who[0].name}の報告書を開く
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
