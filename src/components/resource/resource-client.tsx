/**
 * ============================================================
 * 原石航路 Studio
 * ResourceClient — 資料
 *
 * 執筆 / 設定 と並ぶ 3 つめの場所。
 * 設定（作品の見せ方）と資料（作品の中身）は別のものなので分けている。
 * ============================================================
 */

"use client";

import { useRouter } from "next/navigation";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Header from "@/components/layout/header";
import AddPagePanel from "@/components/resource/add-page-panel";
import EntryView from "@/components/resource/entry-view";
import NotesView from "@/components/resource/notes-view";
import ResourceIcon from "@/components/resource/resource-icons";
import ResourceTop from "@/components/resource/resource-top";
import DeleteButton from "@/components/common/delete-button";
import PlotView from "@/components/resource/plot-view";
import RelationsView from "@/components/resource/relations-view";
import TimelineView from "@/components/resource/timeline-view";
import WorkspaceNav from "@/components/workspace/workspace-nav";
import {
    CANDIDATE_KIND_TO_PAGE,
    getExtractor,
    KIND_FALLBACK_PAGE,
} from "@/lib/ai/extractor";
import type { CandidateKind } from "@/lib/ai/extractor";
import { getImageGenerator } from "@/lib/ai/image-generator";
import { appendLeftover, mapAttributes } from "@/lib/resource/attribute-map";
import {
    hasSubstance,
    isPersonName,
    isRoleName,
    nextRoleName,
} from "@/lib/resource/reject";
import {
    FULL_SCAN_LIMIT,
    nextResetLabel,
    remainingFullScans,
    recordFullScan,
} from "@/lib/resource/full-scan-quota";
import { mergeInto } from "@/lib/resource/dedupe";
import { isSamePerson } from "@/lib/resource/honorific";
import { deleteImage, putImage } from "@/lib/storage/image-store";
import { getRepository } from "@/lib/repository";
import { useAiStatus } from "@/hooks/use-ai-status";
import { formatNumber } from "@/lib/utils/text";
import { IMAGE_QUOTA } from "@/types";
import type {
    AiSettings,
    Episode,
    EntryMention,
    PlotScene,
    PlotStage,
    ResourceEntry,
    ResourceField,
    ResourcePage,
    ResourceRelation,
    TimelineMode,
    Work,
    WritingLog,
} from "@/types";

/** 行数を数える。差分を送るときの行番号の起点に使う */
function countLines(text: string): number {
    return text.split("\n").length;
}

/**
 * 同じものを指す項目を、すでにある中から探す。
 * 名前だけでなく別名とも照らし合わせる。
 *
 * 人物は呼称のちがいまで見る。「リオ」と「リオさん」は同じ人。
 * それ以外は、揺れをならした形が一致するかで見る。
 * 場所や用語に「さん」は付かないので、そこまで踏み込むと外れる。
 */
function findSameEntry(
    name: string,
    entries: ResourceEntry[],
    kind: string,
): ResourceEntry | null {
    const target = normalizeName(name);

    for (const entry of entries) {
        if (entry.candidate_status === "rejected") continue;
        const names = [entry.name, ...(entry.aliases ?? [])].filter(Boolean);

        if (kind === "character") {
            if (names.some((row) => isSamePerson(name, row))) return entry;
            continue;
        }

        if (names.some((row) => normalizeName(row) === target)) return entry;
    }
    return null;
}

/**
 * 名前の揺れをならす。
 * 中黒・空白・記号の有無だけの違いを、同じものとして扱えるようにする。
 */
function normalizeName(name: string): string {
    return name
        .trim()
        .replace(/[\s　・．。、,.\-—―ー]/g, "")
        .toLowerCase();
}

/**
 * まだ読ませていない部分を返す。
 *
 * 読んだ長さと本文の長さが同じなら、書き足されていないので空を返す。
 * ここを「読んだ長さより長いか」で見てしまうと、
 * ちょうど読み終わっているときに本文全部が返り、
 * 変更が無いのに毎回送ることになる。
 */
function unreadPart(episode: Episode): string {
    const read = episode.scanned_length ?? 0;
    if (read <= 0) return episode.body;
    // 書き直されて短くなっていたら、頭から読み直す
    if (episode.body.length < read) return episode.body;
    return episode.body.slice(read);
}

/**
 * 待ち時間の目安。10 秒単位に丸める。
 *
 * 秒単位で出しても当たらないし、細かい数字は読む手間になる。
 * 「10秒ほど」「30秒ほど」で足りる。
 */
function estimateSeconds(chars: number): number {
    const raw = (chars / 10000) * 8 + 4;
    return Math.max(10, Math.ceil(raw / 10) * 10);
}

/** ページ以外に表示する場所 */
type SpecialView = "top" | "add";

interface Props {
    workId: string;
}

export default function ResourceClient({ workId }: Props) {
    const router = useRouter();
    const [work, setWork] = useState<Work | null>(null);
    /* 地図から「この項目をくわしく」と指名されたときの覚え */
    const [jumpEntryId, setJumpEntryId] = useState<string | null>(null);
    const [pages, setPages] = useState<ResourcePage[]>([]);
    const [entries, setEntries] = useState<ResourceEntry[]>([]);
    const [relations, setRelations] = useState<ResourceRelation[]>([]);
    const [stages, setStages] = useState<PlotStage[]>([]);
    const [scenes, setScenes] = useState<PlotScene[]>([]);
    const [logs, setLogs] = useState<WritingLog[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [mentions, setMentions] = useState<EntryMention[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [ai, setAi] = useState<AiSettings | null>(null);
    const [view, setView] = useState<SpecialView | string>("top");
    const [isScanning, setIsScanning] = useState(false);
    const [scanNotice, setScanNotice] = useState("");
    /** 読ませる範囲。全話を毎回送ると、長編ほど負担が増える */
    const [scanScope, setScanScope] = useState<"all" | "recent">("recent");

    /* 全文の残り回数。月が変われば戻る */
    const [fullLeft, setFullLeft] = useState(FULL_SCAN_LIMIT);

    useEffect(() => {
        setFullLeft(remainingFullScans());
    }, []);
    const aiStatus = useAiStatus();

    const reload = useCallback(async () => {
        const repository = getRepository();

        /*
         * まとめて頼む。
         *
         * 10 回を順に待っていた。
         * 互いに関わらないので、同時に頼んでよい。
         */
        const [
            workData, pageData, entryData, relationData,
            stageData, sceneData, logData, episodeData, mentionData, aiData,
        ] = await Promise.all([
            repository.getWork(workId),
            repository.listPages(workId),
            repository.listEntries(workId),
            repository.listRelations(workId),
            repository.listPlotStages(workId),
            repository.listPlotScenes(workId),
            repository.listWritingLogs(workId),
            repository.listEpisodes(workId),
            repository.listMentions(workId),
            repository.getAiSettings(workId),
        ]);

        setWork(workData);

        /*
         * ページが 1 つも無ければ、常設のものを作る。
         *
         * 端末の中だけで動いていたときは作品を作る所で用意していたが、
         * 接続先に移してから抜けていた。
         * 空の資料画面を渡されても、何をすればよいか分からない。
         */
        setPages(
            pageData.length === 0
                ? await repository.setupPages(workId, [])
                : pageData,
        );

        setEntries(entryData);
        setRelations(relationData);
        setStages(stageData);
        setScenes(sceneData);
        setLogs(logData);
        setEpisodes(episodeData);
        setMentions(mentionData);
        setAi(aiData);
        setIsLoading(false);
    }, [workId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header />
                <p className="py-24 text-center text-sm text-faint">読み込んでいます</p>
            </div>
        );
    }

    if (!work) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header breadcrumbs={[{ label: "作品一覧", href: "/" }]} />
                <div className="py-24 text-center">
                    <p className="text-sm text-ink">この作品は見つかりませんでした。</p>
                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark"
                    >
                        作品一覧へ戻る
                    </Link>
                </div>
            </div>
        );
    }

    const repository = getRepository();
    const currentPage = pages.find((page) => page.id === view) ?? null;
    const countByPage = (pageId: string) =>
        entries.filter((entry) => entry.page_id === pageId && entry.candidate_status === "none")
            .length;
    /**
     * 実際に送る文字数。
     * すでに読んだところは送らないので、書き足したぶんだけになる。
     */
    const scanChars =
        scanScope === "all"
            ? episodes.reduce((sum, episode) => sum + episode.char_count, 0)
            : episodes
                  .slice(-3)
                  .reduce((sum, episode) => sum + unreadPart(episode).length, 0);

    const pendingByPage = (pageId: string) =>
        entries.filter(
            (entry) => entry.page_id === pageId && entry.candidate_status === "pending",
        ).length;

    /**
     * 本文を読み直して候補を並べる。
     *
     * すでにある名前と、拒否された名前は候補にしない。
     * 拒否を覚えないと、読み直すたびに同じものが戻ってくる。
     */
    async function handleScan() {
        if (!ai?.is_enabled || isScanning) return;
        setIsScanning(true);
        setScanNotice("");

        const targets: CandidateKind[] = [];
        if (ai.extract_characters) targets.push("character");
        if (ai.extract_places) targets.push("place");
        if (ai.extract_organizations) targets.push("organization");
        if (ai.extract_terms) {
            targets.push("term");
            // 道具は用語と同じ枠で扱う。別に切り替えを増やしても迷うだけ
            targets.push("item");
        }
        if (ai.extract_events) targets.push("event");

        /*
         * 2 つの読ませ方がある。
         *
         *   最近の話 … 末尾 3 話の、前回から書き足したぶんだけ。
         *              書きながら小まめに押す使い方。安く速い。
         *   全話 … すべての話を、頭から読み直す。
         *          拾い漏れを探すときや、設定を変えて拾い直すとき。
         *
         * 全話で「書き足されていない」と断ると、
         * 読み直したいときに手が無くなる。全話は必ず全部を送る。
         */
        const isFull = scanScope === "all";

        /*
         * 全文は 1 か月に 3 回まで。
         *
         * 本文をまるごと送るので、長編ほど重い。
         * 最新は書き足したぶんだけなので、何度でも使える。
         */
        if (isFull && remainingFullScans() === 0) {
            setScanNotice(
                `全文の読み直しは今月ぶんを使い切りました。${nextResetLabel()}から、また3回使えます。`,
            );
            return;
        }

        const target = isFull ? episodes : episodes.slice(-3);

        const pieces = target
            .map((episode) => ({
                episode,
                body: isFull ? episode.body : unreadPart(episode),
            }))
            .filter((piece) => piece.body.trim().length > 0);

        if (pieces.length === 0) {
            setIsScanning(false);
            setScanNotice(
                episodes.length === 0
                    ? "本文がありません。"
                    : "前回から書き足されたところがありません。全話を選ぶと読み直せます。",
            );
            return;
        }

        /*
         * 話ごとに見出しを付けて送る。
         * 「どの話のどこに書いてあったか」を返させるため。
         * 目印が無いと、あとから根拠を探せない。
         */
        const text = pieces
            .map((piece) => {
                const label = `第${piece.episode.ep_number}話`;
                // 差分のときは、本文の途中から送っているので開始行をずらす
                const offset = isFull
                    ? 0
                    : countLines(piece.episode.body) - countLines(piece.body);
                return [
                    `=== ${label} ===`,
                    piece.body
                        .split("\n")
                        .map((line, index) => `${offset + index + 1}|${line}`)
                        .join("\n"),
                ].join("\n");
            })
            .join("\n\n");
        const excluded = entries
            .flatMap((entry) => [entry.name, ...(entry.aliases ?? [])])
            .filter(Boolean);

        const extractor = getExtractor(aiStatus.connected);
        const result = extractor.extractWithMeta
            ? await extractor.extractWithMeta(text, excluded, targets)
            : {
                  candidates: await extractor.extract(text, excluded, targets),
                  usedModel: false,
                  fallbackReason: undefined as string | undefined,
              };
        const found = result.candidates;

        /*
         * 拾ったものの行き先が無いときは、その場でページを作る。
         * 「アイテム」ページを作っていない作品でも、
         * 道具が見つかったなら置き場が要る。
         */
        let pageList = pages;
        const neededKeys = new Set(
            found.map((candidate) => CANDIDATE_KIND_TO_PAGE[candidate.kind]),
        );
        for (const key of Array.from(neededKeys)) {
            if (pageList.some((page) => page.builtin_key === key)) continue;
            // 組み込みページとして用意があるものだけ作る
            if (!["item", "organization", "term"].includes(key)) continue;
            await repository.addBuiltinPage(workId, key);
            pageList = await repository.listPages(workId);
        }

        const pageByKey = new Map(pageList.map((page) => [page.builtin_key, page]));
        let added = 0;

        /** 名前から、作ったばかりの項目を引くための控え */
        const createdByName = new Map<string, string>();
        const wantedRelations: {
            from: string;
            rows: { to: string; label: string }[];
        }[] = [];
        /** 説明を入れ終えたもの。二度書きしない */
        const filledNames = new Set<string>();

        for (const candidate of found) {
            const page =
                pageByKey.get(CANDIDATE_KIND_TO_PAGE[candidate.kind]) ??
                pageByKey.get(KIND_FALLBACK_PAGE[candidate.kind]) ??
                pageByKey.get("term");
            if (!page) continue;

            /*
             * 同じ人物を指す名前がすでにあれば、新しく作らず別名に足す。
             * 「リオ」と「リオさん」が別々の項目として並ぶと、
             * 書き手が毎回まとめ直すことになる。
             */
            {
                /*
                 * 同じものがすでにあれば、新しく作らず別名に足す。
                 * 人物だけでなく、場所も用語も出来事も同じ。
                 * 「東の森」「東の森」が二つ並ぶ資料は使いものにならない。
                 */
                /*
                 * 同じ名前のものは必ず一つにまとめる。
                 * 拾ったばかりのものも含めて見る。
                 * 一度の抽出で「出会い」が五つ返ることがあり、
                 * それをそのまま並べると年表が使いものにならない。
                 */
                const alreadyMade = createdByName.get(normalizeName(candidate.name));
                if (alreadyMade) {
                    /*
                     * 説明が空のまま残っていたら、後から来たほうで埋める。
                     * 先に来たものが名前だけということがある。
                     */
                    if (candidate.summary.trim() && !filledNames.has(alreadyMade)) {
                        await repository.updateEntry(alreadyMade, {
                            summary: candidate.summary,
                        });
                        filledNames.add(alreadyMade);
                    }
                    continue;
                }

                const existing = findSameEntry(candidate.name, entries, candidate.kind);
                if (existing) {
                    const aliases = Array.isArray(existing.aliases)
                        ? existing.aliases
                        : [];
                    if (
                        existing.name !== candidate.name &&
                        !aliases.includes(candidate.name)
                    ) {
                        await repository.updateEntry(existing.id, {
                            aliases: [...aliases, candidate.name],
                        });
                    }
                    createdByName.set(normalizeName(candidate.name), existing.id);
                    continue;
                }
            }

            /*
             * 拾った項目を、そのページの入力欄へ振り分けておく。
             * 名前だけ入った空の項目を並べても、書き手が一つずつ
             * 埋め直すことになり、拾った意味が薄い。
             */
            const { values, leftover } = mapAttributes(
                candidate.attributes ?? {},
                page.fields,
            );

            /*
             * 関係は、先に集めておく。
             *
             * ここから下で候補を落とすことがあるが、
             * すでにある人物との関わりは残したい。
             * 落としてから集めると、線が引かれないまま終わる。
             */
            if (candidate.relations?.length) {
                wantedRelations.push({
                    from: candidate.name,
                    rows: candidate.relations,
                });
            }

            /*
             * 名前でないものを落とす。
             *
             * 「わたし」「彼女」「お母さん」まで人物にすると、
             * 中身の無い項目が並んで資料が信用されなくなる。
             */
            if (candidate.kind === "character" && !isPersonName(candidate.name)) {
                continue;
            }

            /*
             * 「少年」のような役どころは、別人が同じ呼び名になる。
             * 2 人目からは「少年B」と分ける。
             */
            let entryName = candidate.name;
            if (candidate.kind === "character" && isRoleName(candidate.name)) {
                entryName = nextRoleName(
                    candidate.name,
                    entries
                        .filter((row) => row.page_id === page.id)
                        .map((row) => row.name),
                );
            }

            /*
             * 中身の無いものを落とす。
             *
             * 名前しか無い項目は、資料として役に立たない。
             * とくに出来事は、何があったかが書かれていないと年表にならない。
             */
            if (
                !hasSubstance({
                    summary: candidate.summary,
                    values: values as Record<string, unknown>,
                })
            ) {
                continue;
            }

            const created = await repository.createEntry(workId, page.id, {
                name: entryName,
                summary: appendLeftover(candidate.summary, leftover),
                values,
                candidate_source: candidate.context,
                source_ref: candidate.sourceRef ?? "",
                // 設定によっては、承認を挟まず下書きとして入れる
                candidate_status: ai.approval_mode === "draft" ? "none" : "pending",
            });

            // あとで関係を結ぶために、名前から引けるようにしておく
            createdByName.set(normalizeName(candidate.name), created.id);
            /* 役どころで名前を分けたときも引けるように */
            if (entryName !== candidate.name) {
                createdByName.set(normalizeName(entryName), created.id);
            }
            added += 1;
        }

        /*
         * 本文から読み取れた関わりを結ぶ。
         * 相手が見つからないものは捨てる。
         * 名前だけの関係を作っても、関係図で行き先が無い線になる。
         */
        const nameToId = new Map(createdByName);
        for (const entry of entries) {
            const key = normalizeName(entry.name);
            if (!nameToId.has(key)) nameToId.set(key, entry.id);
        }

        for (const wanted of wantedRelations) {
            const fromId = nameToId.get(normalizeName(wanted.from));
            if (!fromId) continue;

            for (const row of wanted.rows) {
                const toId = nameToId.get(normalizeName(row.to));
                if (!toId || toId === fromId) continue;
                // すでにある組は増やさない
                const exists = relations.some(
                    (relation) =>
                        (relation.from_entry_id === fromId &&
                            relation.to_entry_id === toId) ||
                        (relation.from_entry_id === toId &&
                            relation.to_entry_id === fromId),
                );
                if (exists) continue;

                await repository.createRelation(workId, {
                    from_entry_id: fromId,
                    to_entry_id: toId,
                    label: row.label,
                });
            }
        }

        /* 全文を通したので、1 回ぶん使う */
        if (isFull) {
            recordFullScan();
            setFullLeft(remainingFullScans());
        }

        // どこまで読んだかを覚える。次はここから先だけを送る
        for (const piece of pieces) {
            await repository.updateEpisode(piece.episode.id, {
                scanned_length: piece.episode.body.length,
            });
        }

        await reload();
        setIsScanning(false);
        const base =
            added === 0
                ? "新しい候補は見つかりませんでした。"
                : `${added}件を候補に加えました。`;
        setScanNotice(
            result.fallbackReason ? `${base}（${result.fallbackReason}）` : base,
        );
    }

    /**
     * 項目に図案を作る。
     *
     * 出来上がった画像は IndexedDB へ入れ、項目には目印だけを持たせる。
     * localStorage に画像を入れると、数枚で上限に当たって
     * 原稿ごと書き込めなくなる。
     */
    async function handleGenerateImage(
        entry: ResourceEntry,
        page: ResourcePage,
        hint: string,
        era: string,
    ) {
        if (!ai?.generate_images || !page.image_style) return;
        if ((ai.generated_image_count ?? 0) >= IMAGE_QUOTA) return;

        const dataUrl = await getImageGenerator(aiStatus.connected).generate(
            entry.name,
            page.image_style,
            [hint, entry.summary].filter(Boolean).join("。"),
            era,
        );

        const ref = await putImage(dataUrl);
        if (entry.image_url) await deleteImage(entry.image_url);
        try {
            await repository.updateEntry(entry.id, { image_url: ref });
        } catch (error) {
            // 保存の上限に当たったら、作った画像は捨てて理由を出す
            await deleteImage(ref);
            setScanNotice(
                error instanceof Error ? error.message : "保存できませんでした。",
            );
            return;
        }

        // 使った枚数を数える。手元の簡易版で作ったものは数えない
        if (aiStatus.connected) {
            setAi(
                await repository.saveAiSettings(workId, {
                    generated_image_count: (ai.generated_image_count ?? 0) + 1,
                }),
            );
        }
        await reload();
    }

    return (
        <div className="min-h-screen bg-canvas">
            <Header
                breadcrumbs={[
                    { label: "作品一覧", href: "/" },
                    { label: "ワークスペース", href: `/workspace/${workId}` },
                    { label: "資料" },
                ]}
            />

            {/* 狭い画面では縦に積む。理由は設定画面と同じ */}
            <div className="flex flex-col gap-4 p-4 lg:flex-row">
                <aside className="w-full shrink-0 lg:w-56">
                    <WorkspaceNav workId={workId} current="resource" />

                    <div className="mt-4 rounded-lg border border-line bg-surface">
                        <div className="border-b border-line px-4 py-4">
                            <h1 className="truncate text-[15px] font-medium text-ink">
                                {work.title}
                            </h1>
                            <p className="mt-1 text-xs text-muted">
                                {episodes.length}話・
                                {formatNumber(
                                    episodes.reduce((sum, ep) => sum + ep.char_count, 0),
                                )}
                                文字
                            </p>
                        </div>

                        <nav className="p-2">
                            <NavItem
                                label="資料トップ"
                                icon={<ResourceIcon builtinKey="home" size={16} />}
                                isActive={view === "top"}
                                onClick={() => setView("top")}
                            />

                            {pages.map((page) => (
                                <NavItem
                                    key={page.id}
                                    label={page.label}
                                    icon={<ResourceIcon builtinKey={page.builtin_key} size={16} />}
                                    count={
                                        page.kind === "plot"
                                            ? stages.length
                                            : page.kind === "relations"
                                              ? relations.length
                                              : countByPage(page.id)
                                    }
                                    pending={pendingByPage(page.id)}
                                    isActive={view === page.id}
                                    onClick={() => setView(page.id)}
                                />
                            ))}

                            <div className="my-2 border-t border-line" />

                            <NavItem
                                label="ページを追加"
                                isActive={view === "add"}
                                onClick={() => setView("add")}
                            />
                        </nav>

                        <div className="border-t border-line px-4 py-4">
                            {ai?.is_enabled ? (
                                <>
                                    {/* 読ませる範囲 */}
                                    <div className="mb-2 flex gap-0.5 rounded-md border border-line p-0.5">
                                        {(
                                            [
                                                { value: "recent", label: "最新" },
                                                { value: "all", label: "全文" },
                                            ] as const
                                        ).map((row) => (
                                            <button
                                                key={row.value}
                                                type="button"
                                                onClick={() => setScanScope(row.value)}
                                                aria-pressed={scanScope === row.value}
                                                className={[
                                                    "flex-1 rounded px-2 py-1 text-[11px]",
                                                    scanScope === row.value
                                                        ? "bg-forest text-white"
                                                        : "text-muted hover:text-ink",
                                                ].join(" ")}
                                            >
                                                {row.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/*
                                     * 全文の残り回数。
                                     * 押してから断られるより、先に見えていたほうがよい。
                                     */}
                                    {scanScope === "all" && (
                                        <p
                                            className={[
                                                "mb-2 text-[10px]",
                                                fullLeft === 0
                                                    ? "text-[var(--color-danger)]"
                                                    : "text-faint",
                                            ].join(" ")}
                                        >
                                            {fullLeft > 0
                                                ? `全文は今月あと${fullLeft}回`
                                                : `今月ぶんを使い切りました（${nextResetLabel()}に戻ります）`}
                                        </p>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => void handleScan()}
                                        disabled={
                                            isScanning ||
                                            episodes.length === 0 ||
                                            (scanScope === "all" && fullLeft === 0)
                                        }
                                        className="w-full rounded-md bg-forest px-3 py-2 text-sm text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {isScanning ? "読んでいます" : "本文から資料を集める"}
                                    </button>

                                    <p className="mt-1.5 text-xs leading-relaxed text-faint">
                                        {isScanning ? (
                                            <>
                                                {estimateSeconds(scanChars)}秒ほどかかります。
                                                <br />
                                                この画面を離れても構いません。
                                            </>
                                        ) : (
                                            scanNotice || (
                                                <>
                                                    {scanScope === "recent" ? (
                                                        <>
                                                            最後の
                                                            {Math.min(3, episodes.length)}
                                                            話の、書き足した
                                                            {formatNumber(scanChars)}文字
                                                        </>
                                                    ) : (
                                                        <>
                                                            {episodes.length}話すべて・
                                                            {formatNumber(scanChars)}文字
                                                        </>
                                                    )}
                                                    <br />
                                                    {estimateSeconds(scanChars)}秒ほど
                                                    {scanScope === "all" &&
                                                        "・拾い漏れを探すときに"}
                                                </>
                                            )
                                        )}
                                    </p>

                                    {/* 繋がり先 */}
                                    {!aiStatus.isChecking && (
                                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
                                            <span
                                                className={[
                                                    "h-1.5 w-1.5 rounded-full",
                                                    aiStatus.connected
                                                        ? "bg-forest"
                                                        : "bg-[var(--color-faint)]",
                                                ].join(" ")}
                                            />
                                            {aiStatus.connected
                                                ? "モデルに接続中"
                                                : "簡易版で動作中"}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-xs text-faint">
                                    AI補助はオフです。
                                    <br />
                                    設定から切り替えられます。
                                </p>
                            )}
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1">
                    {view === "top" && (
                        <ResourceTop
                            workTitle={work.title}
                            pages={pages}
                            onOpenEntry={(pageId, entryId) => {
                                setJumpEntryId(entryId);
                                setView(pageId);
                            }}
                            entries={entries}
                            relations={relations}
                            stages={stages}
                            logs={logs}
                            onOpen={(pageId) => {
                                // ふつうに開くときは、前の指名を持ち越さない
                                setJumpEntryId(null);
                                setView(pageId);
                            }}
                            onOpenAdd={() => setView("add")}
                        />
                    )}

                    {view === "add" && (
                        <AddPagePanel
                            pages={pages}
                            onAddBuiltin={async (key) => {
                                const page = await repository.addBuiltinPage(workId, key);
                                await reload();
                                setView(page.id);
                            }}
                            onCreateCustom={async (input: {
                                label: string;
                                description: string;
                                fields: ResourceField[];
                            }) => {
                                const page = await repository.createCustomPage(workId, input);
                                await reload();
                                setView(page.id);
                            }}
                        />
                    )}

                    {currentPage && (
                        <>
                            {currentPage.kind === "plot" ? (
                                <PlotView
                                    stages={stages}
                                    scenes={scenes}
                                    entries={entries.filter(
                                        (entry) => entry.candidate_status === "none",
                                    )}
                                    onApplyTemplate={async (template) => {
                                        /*
                                         * 見本から、段と場面をまとめて作る。
                                         * 中身は空。埋めるのは書き手。
                                         */
                                        for (const stage of template.stages) {
                                            const created =
                                                await repository.createPlotStage(workId);

                                            await repository.updatePlotStage(created.id, {
                                                title: stage.title,
                                                description: stage.description,
                                            });

                                            for (const sceneTitle of stage.scenes) {
                                                const scene =
                                                    await repository.createPlotScene(
                                                        workId,
                                                        created.id,
                                                    );
                                                await repository.updatePlotScene(scene.id, {
                                                    title: sceneTitle,
                                                });
                                            }
                                        }

                                        await reload();
                                    }}
                                    onCreateStage={async () => {
                                        await repository.createPlotStage(workId);
                                        await reload();
                                    }}
                                    onUpdateStage={async (stageId, patch) => {
                                        await repository.updatePlotStage(stageId, patch);
                                        await reload();
                                    }}
                                    onDeleteStage={async (stage) => {
                                        await repository.deletePlotStage(stage.id);
                                        await reload();
                                    }}
                                    onReorderStages={async (ids) => {
                                        await repository.reorderPlotStages(workId, ids);
                                        await reload();
                                    }}
                                    onCreateScene={async (stageId) => {
                                        await repository.createPlotScene(workId, stageId);
                                        await reload();
                                    }}
                                    onUpdateScene={async (sceneId, patch) => {
                                        await repository.updatePlotScene(sceneId, patch);
                                        await reload();
                                    }}
                                    onDeleteScene={async (scene) => {
                                        await repository.deletePlotScene(scene.id);
                                        await reload();
                                    }}
                                />
                            ) : currentPage.kind === "relations" ? (
                                <RelationsView
                                    relations={relations}
                                    entries={entries.filter(
                                        (entry) => entry.candidate_status === "none",
                                    )}
                                    pages={pages}
                                    episodes={episodes}
                                    onCreate={async (fromId, toId, label) => {
                                        await repository.createRelation(workId, {
                                            from_entry_id: fromId,
                                            to_entry_id: toId,
                                            label,
                                        });
                                        await reload();
                                    }}
                                    onUpdate={async (relationId, patch) => {
                                        await repository.updateRelation(relationId, patch);
                                        await reload();
                                    }}
                                    onDelete={async (relation) => {
                                        await repository.deleteRelation(relation.id);
                                        await reload();
                                    }}
                                    /*
                                     * 丸を離した所を覚える。
                                     *
                                     * 読み直しはしない。
                                     * 動かすたびに資料を全部読み直すと、
                                     * 図がその場で跳ねて置きにくい。
                                     * 手元の一覧だけ書き換える。
                                     */
                                    onMoveNode={async (entryId, position) => {
                                        setEntries((list) =>
                                            list.map((entry) =>
                                                entry.id === entryId
                                                    ? { ...entry, graph_pos: position }
                                                    : entry,
                                            ),
                                        );
                                        try {
                                            await repository.updateEntry(entryId, {
                                                graph_pos: position,
                                            });
                                        } catch {
                                            /* 置き場所が残らなくても、図は動いている */
                                            await reload();
                                        }
                                    }}
                                    onUpdatePage={async (patch) => {
                                        await repository.updatePage(currentPage.id, patch);
                                        await reload();
                                    }}
                                />
                            ) : currentPage.kind === "timeline" ? (
                                <TimelineView
                                    page={currentPage}
                                    onOpenEpisode={(episodeId) => {
                                        /* 出来事から本文へ戻る */
                                        router.push(
                                            `/workspace/${workId}?episode=${episodeId}`,
                                        );
                                    }}
                                    onMergeDuplicates={async (group) => {
                                        await repository.updateEntry(
                                            group.keep.id,
                                            mergeInto(group),
                                        );
                                        for (const row of group.drop) {
                                            await repository.deleteEntry(row.id);
                                        }
                                        await reload();
                                    }}
                                    entries={entries.filter(
                                        (entry) => entry.page_id === currentPage.id,
                                    )}
                                    allEntries={entries.filter(
                                        (entry) => entry.candidate_status === "none",
                                    )}
                                    episodes={episodes}
                                    onCreate={async (name) => {
                                        await repository.createEntry(
                                            workId,
                                            currentPage.id,
                                            name ? { name } : undefined,
                                        );
                                        await reload();
                                    }}
                                    onUpdate={async (entryId, patch) => {
                                        await repository.updateEntry(entryId, patch);
                                        await reload();
                                    }}
                                    onDelete={async (entry) => {
                                        await repository.deleteEntry(entry.id);
                                        await reload();
                                    }}
                                    onChangeMode={async (mode: TimelineMode) => {
                                        await repository.updatePage(currentPage.id, {
                                            timeline_mode: mode,
                                        });
                                        await reload();
                                    }}
                                />
                            ) : currentPage.kind === "notes" ? (
                                <NotesView
                                    page={currentPage}
                                    entries={entries.filter(
                                        (entry) => entry.page_id === currentPage.id,
                                    )}
                                    episodes={episodes}
                                    onCreate={async (name, category) => {
                                        await repository.createEntry(workId, currentPage.id, {
                                            name,
                                            values: { category },
                                        });
                                        await reload();
                                    }}
                                    onUpdate={async (entryId, patch) => {
                                        await repository.updateEntry(entryId, patch);
                                        await reload();
                                    }}
                                    onDelete={async (entry) => {
                                        await repository.deleteEntry(entry.id);
                                        await reload();
                                    }}
                                />
                            ) : (
                                <EntryView
                                    page={currentPage}
                                    pages={pages}
                                    initialEntryId={jumpEntryId}
                                    entries={entries.filter(
                                        (entry) => entry.page_id === currentPage.id,
                                    )}
                                    allEntries={entries.filter(
                                        (entry) => entry.candidate_status === "none",
                                    )}
                                    episodes={episodes}
                                    relations={relations}
                                    mentions={mentions}
                                    onMerge={async (keepId, mergeId) => {
                                        await repository.mergeEntries(keepId, mergeId);
                                        await reload();
                                    }}
                                    onCreate={async (name) => {
                                        await repository.createEntry(
                                            workId,
                                            currentPage.id,
                                            name ? { name } : undefined,
                                        );
                                        await reload();
                                    }}
                                    onUpdate={async (entryId, patch) => {
                                        await repository.updateEntry(entryId, patch);
                                        await reload();
                                    }}
                                    onDelete={async (entry) => {
                                        await repository.deleteEntry(entry.id);
                                        await reload();
                                    }}
                                    onGenerateImage={(entry, hint, era) =>
                                        handleGenerateImage(entry, currentPage, hint, era)
                                    }
                                    canGenerateImage={Boolean(
                                        ai?.is_enabled &&
                                            ai.generate_images &&
                                            currentPage.image_style,
                                    )}
                                    imageUsedCount={ai?.generated_image_count ?? 0}
                                    onMergeDuplicates={async (group) => {
                                        /*
                                         * 中身を残すほうへ移してから消す。
                                         * 先に消すと、書いた内容が失われる。
                                         */
                                        await repository.updateEntry(
                                            group.keep.id,
                                            mergeInto(group),
                                        );
                                        for (const row of group.drop) {
                                            await repository.deleteEntry(row.id);
                                        }
                                        await reload();
                                    }}
                                    onJump={(episodeId, line) => {
                                        /*
                                         * 執筆ページへ、話と行を添えて移る。
                                         * 開いたあと自分で探し直すのでは、
                                         * 辿れるうちに入らない。
                                         */
                                        router.push(
                                            `/workspace/${workId}?ep=${episodeId}&line=${line}`,
                                        );
                                    }}
                                />
                            )}

                            {!currentPage.is_pinned && (
                                <div className="mt-4 text-right">
                                    <DeleteButton
                                        label={currentPage.label}
                                        note="このページと、その中の項目をすべて削除します。元に戻せません。"
                                        onDelete={async () => {
                                            await repository.deletePage(currentPage.id);
                                            setView("top");
                                            await reload();
                                        }}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

function NavItem({
    label,
    icon,
    count,
    pending = 0,
    isActive,
    onClick,
}: {
    label: string;
    icon?: React.ReactNode;
    count?: number;
    pending?: number;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={isActive ? "page" : undefined}
            className={[
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                isActive ? "bg-forest-tint text-forest" : "text-ink hover:bg-canvas",
            ].join(" ")}
        >
            <span className="flex min-w-0 items-center gap-2">
                {icon && (
                    <span className={isActive ? "text-forest" : "text-faint"}>{icon}</span>
                )}
                <span className="truncate">{label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
                {pending > 0 && (
                    <span
                        className="rounded-full bg-forest px-1.5 py-0.5 text-[10px] text-white"
                        title={`${pending}件の候補が未処理`}
                    >
                        {pending}
                    </span>
                )}
                {/*
                 * 件数は丸い札で出す。
                 * 数字を裸で置くより、目が拾いやすい。
                 */}
                {count !== undefined && count > 0 && (
                    <span
                        className={[
                            "rounded-full px-2 py-0.5 text-[10px]",
                            isActive
                                ? "bg-forest text-white"
                                : "bg-canvas text-muted",
                        ].join(" ")}
                    >
                        {count}
                    </span>
                )}
            </span>
        </button>
    );
}
