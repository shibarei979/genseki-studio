/**
 * ============================================================
 * 原石航路 Studio
 * EntryReport — 資料の報告書（会員）
 *
 * ★ 探した相手のことを、1 枚にまとめて見せる。
 *
 *   これまでは名前と一言が並ぶだけで、
 *   その人が何話に出たか、誰とどういう間柄か、
 *   どの欄がまだ空いているかは、あちこち開かないと分からなかった。
 *
 *   書いている途中に確かめたいのは、たいてい次の 4 つ。
 *   ・どんな人か（書いた設定）
 *   ・いつ出たか（初登場・最後に出た話）
 *   ・誰と関わっているか（関係図）
 *   ・まだ決めていないことは何か（空いている欄）
 *
 * ★ 数えるのは、手元の本文から。
 *   名前と別名が本文に何回出てくるかを数える。
 *   手で結んだリンクがある話も「登場」に含める。
 *
 * ★ 何も書き替えない。見るだけの画面。
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { getRepository } from "@/lib/repository";
import { applyLineMarks, scanMentions } from "@/lib/resource/mention-scan";
import ProBadge from "@/components/common/pro-badge";
import type {
    Episode,
    EntryMention,
    FieldValue,
    ResourceEntry,
    ResourcePage,
    ResourceRelation,
} from "@/types";

interface Props {
    workId: string;
    entryId: string;
    /** いま開いている話。この話に出てくるときだけ「探す」を出す */
    episodeId?: string;
    /** 検索で打った言葉。資料の名前と本文の書き方が違うとき（「律さん」を「律」で）に使う */
    typed?: string;
    onBack: () => void;
    /** 本文のその語へ飛ぶ。いま開いている話のときだけ効く */
    onJumpToWord?: (word: string) => void;
}

interface Loaded {
    pages: ResourcePage[];
    entries: ResourceEntry[];
    relations: ResourceRelation[];
    episodes: Episode[];
    mentions: EntryMention[];
    /** 資料の頁で外した行・足した行 */
    marks: { episode_id: string; line: number; kind: string; text: string }[];
}

/** 話の呼び名。「第3話 旅立ち」 */
function episodeName(episode: Episode): string {
    const title = episode.title?.trim();
    return title ? `第${episode.ep_number}話「${title}」` : `第${episode.ep_number}話`;
}

export default function EntryReport({
    workId,
    entryId,
    episodeId,
    typed,
    onBack,
    onJumpToWord,
}: Props) {
    const [data, setData] = useState<Loaded | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        const repository = getRepository();

        void Promise.all([
            repository.listPages(workId),
            repository.listEntries(workId),
            repository.listRelations(workId),
            repository.listEpisodes(workId),
            repository.listMentions(workId),
        ])
            .then(async ([pages, entries, relations, episodes, mentions]) => {
                const marks = await repository.listLineMarks(entryId).catch(() => []);
                if (alive) setData({ pages, entries, relations, episodes, mentions, marks });
            })
            .catch(() => {
                if (alive) setFailed(true);
            });

        return () => {
            alive = false;
        };
    }, [workId, entryId]);

    const report = useMemo((): Report | null => {
        if (!data) return null;

        const entry = data.entries.find((one) => one.id === entryId);
        if (!entry) return null;

        const page = data.pages.find((one) => one.id === entry.page_id) ?? null;
        const entryById = new Map(data.entries.map((one) => [one.id, one]));
        const pageById = new Map(data.pages.map((one) => [one.id, one]));

        /*
         * ★ 書いた設定。
         *   その資料の欄の順に並べる。空の欄は下で「未記入」に回す。
         *   登場する話の欄は、下の「登場」で数えるので、ここには出さない。
         */
        const filled: { label: string; value: FieldValue; type: string }[] = [];
        const empty: string[] = [];

        for (const field of page?.fields ?? []) {
            if (field.type === "relation_episode") continue;

            const value = entry.values?.[field.key];
            const isEmpty =
                value === undefined ||
                value === null ||
                value === "" ||
                (Array.isArray(value) && value.length === 0);

            if (isEmpty) empty.push(field.label);
            else filled.push({ label: field.label, value, type: field.type });
        }

        if (!entry.summary.trim()) empty.unshift("一言説明");

        /*
         * ★ 登場。
         *   名前と別名を、長いものから先に探す。
         *   「リオン」の中の「リオ」を二度数えないため。
         */
        /*
         * ★ 数え方は、資料の頁の「本文での登場」と同じもの（mention-scan）。
         *   前はここだけ別の数え方で、資料の頁と件数が合わなかった。
         *   資料の頁で「外した」行・「足した」行も同じように当てる。
         */
        const episodes = data.episodes
            .slice()
            .sort((a, b) => a.ep_number - b.ep_number);

        const scanned = applyLineMarks(
            scanMentions(entry, episodes, typed ? [typed] : []),
            episodes,
            data.marks.filter((row) => row.kind === "hidden"),
            data.marks.filter((row) => row.kind === "picked"),
        );

        const linkedEpisodes = new Set(
            data.mentions
                .filter((mention) => mention.entry_id === entry.id)
                .map((mention) => mention.episode_id),
        );

        const words = [entry.name, ...(entry.aliases ?? []), typed ?? ""]
            .map((word) => word.trim())
            .filter((word) => word.length > 0)
            .sort((a, b) => b.length - a.length);

        /* 行の中で、どの呼び方で出てきたか。本文で探すときに使う */
        const wordIn = (text: string) => words.find((word) => text.includes(word)) ?? "";
        const clip = (text: string) => (text.length > 90 ? `${text.slice(0, 90)}…` : text);

        const perEpisode = episodes.map((episode): EpisodeRow => {
            const rows = scanned.filter((row) => row.episodeId === episode.id);
            const first = rows[0];
            const last = rows[rows.length - 1];

            return {
                episode,
                count: rows.length,
                linked: linkedEpisodes.has(episode.id),
                first: first ? clip(first.text) : "",
                last: last ? clip(last.text) : "",
                firstWord: first ? wordIn(first.text) : "",
            };
        });

        const kindCounts = {
            speech: scanned.filter((row) => row.kind === "speech").length,
            action: scanned.filter((row) => row.kind === "action").length,
        };

        const appeared = perEpisode.filter((row) => row.count > 0 || row.linked);
        const totalCount = perEpisode.reduce((sum, row) => sum + row.count, 0);
        const firstRow = appeared[0] ?? null;
        const lastRow = appeared.length ? appeared[appeared.length - 1] : null;
        const latestEpisode = episodes.length ? episodes[episodes.length - 1] : null;
        const sinceLast =
            lastRow && latestEpisode
                ? latestEpisode.ep_number - lastRow.episode.ep_number
                : null;

        /*
         * ★ 関係。関係図に結んだもの。
         *   いちばん新しい変化があれば、それも添える。
         */
        const relations = data.relations
            .filter(
                (relation) =>
                    relation.from_entry_id === entry.id || relation.to_entry_id === entry.id,
            )
            .map((relation) => {
                const isFrom = relation.from_entry_id === entry.id;
                const otherId = isFrom ? relation.to_entry_id : relation.from_entry_id;
                const other = entryById.get(otherId);
                const latest = relation.changes?.length
                    ? relation.changes[relation.changes.length - 1]
                    : null;

                return {
                    id: relation.id,
                    otherName: other?.name || "（名前未設定）",
                    otherKind: other ? pageById.get(other.page_id)?.label ?? "" : "",
                    label: relation.label,
                    arrow:
                        relation.line_style === "arrow" ? (isFrom ? "→" : "←") : "—",
                    latest,
                    note: relation.note,
                };
            });

        /*
         * ★ 名前が載っている、ほかの資料。
         *   組織の「所属する人」、出来事の「関わる人」など。
         */
        const referencedBy: { name: string; kind: string; field: string }[] = [];
        for (const other of data.entries) {
            if (other.id === entry.id || other.candidate_status !== "none") continue;

            const otherPage = pageById.get(other.page_id);
            for (const field of otherPage?.fields ?? []) {
                if (field.type !== "relation_entry") continue;

                const raw = other.values?.[field.key];
                if (Array.isArray(raw) && raw.includes(entry.id)) {
                    referencedBy.push({
                        name: other.name || "（名前未設定）",
                        kind: otherPage?.label ?? "",
                        field: field.label,
                    });
                }
            }
        }

        return {
            entry,
            page,
            entryById,
            filled,
            empty,
            perEpisode,
            appeared,
            totalCount,
            kindCounts,
            firstRow,
            lastRow,
            sinceLast,
            episodeCount: episodes.length,
            relations,
            referencedBy,
        };
    }, [data, entryId, typed]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="text-xs text-muted hover:text-ink"
                >
                    ← 一覧へ戻る
                </button>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted">
                    報告書
                    <ProBadge />
                </span>
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
                {failed ? (
                    <p className="py-6 text-center text-xs text-faint">
                        読み込めませんでした。開き直してください。
                    </p>
                ) : !data ? (
                    <p className="py-6 text-center text-xs text-faint">まとめています…</p>
                ) : !report ? (
                    <p className="py-6 text-center text-xs text-faint">
                        この資料は見つかりませんでした。
                    </p>
                ) : (
                    <ReportBody
                        report={report}
                        /*
                         * ★ いま開いている話に出てこないなら、探す押し具は出さない。
                         *   押しても何も起きないと、壊れているように見える。
                         */
                        jumpWord={
                            report.perEpisode.find(
                                (row) => row.episode.id === episodeId && row.count > 0,
                            )?.firstWord ?? ""
                        }
                        onJumpToWord={onJumpToWord}
                    />
                )}
            </div>
        </div>
    );
}

interface EpisodeRow {
    episode: Episode;
    count: number;
    linked: boolean;
    first: string;
    last: string;
    /** その話で最初に見つかった呼び方。別名のこともある */
    firstWord: string;
}

/** 報告書の中身。まとめた結果 */
interface Report {
    entry: ResourceEntry;
    page: ResourcePage | null;
    entryById: Map<string, ResourceEntry>;
    filled: { label: string; value: FieldValue; type: string }[];
    empty: string[];
    perEpisode: EpisodeRow[];
    appeared: EpisodeRow[];
    totalCount: number;
    /** 台詞・行動の数。残りは言及 */
    kindCounts: { speech: number; action: number };
    firstRow: EpisodeRow | null;
    lastRow: EpisodeRow | null;
    sinceLast: number | null;
    episodeCount: number;
    relations: {
        id: string;
        otherName: string;
        otherKind: string;
        label: string;
        arrow: string;
        latest: { at: string; label: string } | null;
        note: string;
    }[];
    referencedBy: { name: string; kind: string; field: string }[];
}

/** 見出し。小さな字で、間を空けて */
function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mt-4 first:mt-0">
            <h3 className="mb-1.5 border-b border-line pb-1 text-[11px] font-medium tracking-wide text-muted">
                {title}
            </h3>
            {children}
        </section>
    );
}

function ValueText({
    value,
    type,
    entryById,
}: {
    value: FieldValue;
    type: string;
    entryById: Map<string, ResourceEntry>;
}) {
    if (type === "checkbox") return <span>{value ? "はい" : "いいえ"}</span>;

    if (Array.isArray(value)) {
        const items =
            type === "relation_entry"
                ? value.map((id) => entryById.get(id)?.name || "（名前未設定）")
                : value;

        return (
            <span className="flex flex-wrap gap-1">
                {items.map((item, index) => (
                    <span
                        key={`${item}-${index}`}
                        className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-ink"
                    >
                        {item}
                    </span>
                ))}
            </span>
        );
    }

    return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

function ReportBody({
    report,
    jumpWord,
    onJumpToWord,
}: {
    report: Report;
    /*
     * いま開いている話で見つかった呼び方。
     * 本文では別名で書かれていることが多いので、名前ではなくこちらで探す。
     */
    jumpWord: string;
    onJumpToWord?: (word: string) => void;
}) {
    const { entry, page } = report;

    return (
        <div className="text-[12.5px] leading-relaxed text-ink">
            {/* ===== 表紙 ===== */}
            <div className="flex gap-3">
                {entry.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={entry.image_url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-md border border-line object-cover"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-forest-tint px-1.5 py-0.5 text-[10px] text-forest">
                            {page?.label ?? "資料"}
                        </span>
                        {entry.is_major && (
                            <span className="rounded border border-forest-line px-1.5 py-0.5 text-[10px] text-forest">
                                主要
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-base font-medium leading-snug">{entry.name}</p>
                    {entry.aliases?.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-muted">
                            別名：{entry.aliases.join("、")}
                        </p>
                    )}
                </div>
            </div>

            {entry.summary.trim() && (
                <p className="mt-2.5 rounded-md bg-canvas px-3 py-2 text-[12.5px]">
                    {entry.summary}
                </p>
            )}

            {/* ===== ひと目で ===== */}
            {/*
              * ★ grid-cols-3 は使わない。
              *   スマホ幅では、サイト全体の決まりで 1 列に畳まれてしまう。
              */}
            <div className="mt-3 flex gap-1.5 text-center">
                <Stat
                    label="登場した話"
                    value={`${report.appeared.length}`}
                    sub={`全${report.episodeCount}話中`}
                />
                <Stat
                    label="本文に出た回数"
                    value={`${report.totalCount}`}
                    sub={`台詞${report.kindCounts.speech}・行動${report.kindCounts.action}`}
                />
                <Stat label="関係" value={`${report.relations.length}`} sub="関係図" />
            </div>

            {/* ===== 設定 ===== */}
            <Section title="設定">
                {report.filled.length === 0 ? (
                    <p className="text-xs text-faint">まだ書かれていません。</p>
                ) : (
                    <dl className="space-y-1.5">
                        {report.filled.map((row) => (
                            <div key={row.label} className="grid grid-cols-[5.5em_1fr] gap-2">
                                <dt className="text-[11px] text-muted">{row.label}</dt>
                                <dd className="min-w-0">
                                    <ValueText
                                        value={row.value}
                                        type={row.type}
                                        entryById={report.entryById}
                                    />
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </Section>

            {/* ===== 登場 ===== */}
            <Section title="登場">
                {report.appeared.length === 0 ? (
                    <p className="text-xs text-faint">本文にはまだ出てきていません。</p>
                ) : (
                    <>
                        {/*
                          * ★ 話ごとの帯。出た話だけ色が付く。
                          *   長く出ていない、がひと目で分かる。
                          */}
                        <div className="flex flex-wrap gap-[3px]" aria-label="話ごとの登場">
                            {report.perEpisode.map((row) => {
                                const on = row.count > 0 || row.linked;
                                return (
                                    <span
                                        key={row.episode.id}
                                        title={`${episodeName(row.episode)}：${row.count}回`}
                                        className={[
                                            "h-3.5 w-3.5 rounded-sm",
                                            on ? "bg-forest" : "border border-line bg-canvas",
                                        ].join(" ")}
                                        style={
                                            on && row.count > 0
                                                ? { opacity: Math.min(1, 0.7 + row.count / 20) }
                                                : undefined
                                        }
                                    />
                                );
                            })}
                        </div>
                        <p className="mt-1 text-[10px] text-faint">
                            第1話〜第{report.episodeCount}話　色の付いた話に登場
                        </p>

                        <dl className="mt-2.5 space-y-2">
                            {report.firstRow && (
                                <div>
                                    <dt className="text-[11px] text-muted">
                                        初登場　{episodeName(report.firstRow.episode)}
                                    </dt>
                                    {report.firstRow.first && (
                                        <dd className="mt-0.5 border-l-2 border-line pl-2 text-[12px] text-ink">
                                            {report.firstRow.first}
                                        </dd>
                                    )}
                                </div>
                            )}

                            {report.lastRow &&
                                report.firstRow &&
                                report.lastRow.episode.id !== report.firstRow.episode.id && (
                                    <div>
                                        <dt className="text-[11px] text-muted">
                                            最後に出た話　{episodeName(report.lastRow.episode)}
                                        </dt>
                                        {report.lastRow.last && (
                                            <dd className="mt-0.5 border-l-2 border-line pl-2 text-[12px] text-ink">
                                                {report.lastRow.last}
                                            </dd>
                                        )}
                                    </div>
                                )}
                        </dl>

                        {report.sinceLast !== null && report.sinceLast >= 3 && (
                            <p className="mt-2 rounded-md bg-canvas px-2.5 py-1.5 text-[11px] text-muted">
                                最新話まで{report.sinceLast}話、本文に出てきていません。
                            </p>
                        )}

                        {onJumpToWord && jumpWord && (
                            <button
                                type="button"
                                onClick={() => onJumpToWord(jumpWord)}
                                className="mt-2 text-[11px] text-forest hover:underline"
                            >
                                いま開いている話で「{jumpWord}」を探す
                            </button>
                        )}
                    </>
                )}
            </Section>

            {/* ===== 関係 ===== */}
            <Section title="関係">
                {report.relations.length === 0 ? (
                    <p className="text-xs text-faint">関係図にはまだ結ばれていません。</p>
                ) : (
                    <ul className="space-y-1.5">
                        {report.relations.map((relation) => (
                            <li key={relation.id}>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 shrink-0 text-center text-[11px] text-faint">
                                        {relation.arrow}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">
                                        {relation.otherName}
                                        {relation.otherKind && (
                                            <span className="ml-1 text-[10px] text-faint">
                                                {relation.otherKind}
                                            </span>
                                        )}
                                    </span>
                                    <span className="shrink-0 rounded bg-forest-tint px-1.5 py-0.5 text-[10.5px] text-forest">
                                        {relation.label || "（名前なし）"}
                                    </span>
                                </div>
                                {relation.latest && (
                                    <p className="ml-[1.1rem] mt-0.5 text-[11px] text-muted">
                                        いま：{relation.latest.label}
                                        {relation.latest.at && `（${relation.latest.at}）`}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* ===== ほかの資料 ===== */}
            {report.referencedBy.length > 0 && (
                <Section title="名前が載っている資料">
                    <ul className="space-y-1">
                        {report.referencedBy.map((row, index) => (
                            <li key={`${row.name}-${index}`} className="flex items-baseline gap-1.5">
                                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                                <span className="shrink-0 text-[10.5px] text-faint">
                                    {row.kind}・{row.field}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* ===== まだ決めていないこと ===== */}
            {report.empty.length > 0 && (
                <Section title="まだ書かれていない欄">
                    <p className="flex flex-wrap gap-1">
                        {report.empty.map((label) => (
                            <span
                                key={label}
                                className="rounded border border-dashed border-line px-1.5 py-0.5 text-[11px] text-faint"
                            >
                                {label}
                            </span>
                        ))}
                    </p>
                </Section>
            )}
        </div>
    );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div className="min-w-0 flex-1 rounded-md border border-line px-1 py-1.5">
            <p className="text-[10px] text-muted">{label}</p>
            <p className="text-base font-medium leading-tight text-ink">{value}</p>
            <p className="text-[9.5px] text-faint">{sub}</p>
        </div>
    );
}
