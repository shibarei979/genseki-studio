/**
 * ============================================================
 * 原石航路 Studio
 * WorkspaceClient — 執筆画面の全体
 *
 * 左：話一覧　右：エディタ
 * 設定タブ（作品情報・公開設定・表示設定・作品世界・原稿管理）は
 * v2 以降でここにタブとして足す。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import Header from "@/components/layout/header";
import EpisodeEditor from "@/components/workspace/episode-editor";
import EpisodeList from "@/components/workspace/episode-list";
import MentionPanel from "@/components/workspace/mention-panel";
import ReplacePanel from "@/components/workspace/replace-panel";
import ReadPanel from "@/components/workspace/read-panel";
import VersionHistoryPanel from "@/components/workspace/version-history-panel";
import WorkspaceNav from "@/components/workspace/workspace-nav";
import { useEpisodes } from "@/hooks/use-episodes";
import {
    CANDIDATE_KIND_TO_PAGE,
    getExtractor,
    KIND_FALLBACK_PAGE,
} from "@/lib/ai/extractor";
import type { CandidateKind } from "@/lib/ai/extractor";
import { AUTO_EXTRACT_INTERVAL_MS } from "@/config";
import { getRepository } from "@/lib/repository";
import { useAiStatus } from "@/hooks/use-ai-status";
import { formatNumber } from "@/lib/utils/text";
import type { Chapter, DisplaySettings, Episode, Work } from "@/types";
import { nextEpisodeStatus } from "@/types";

interface Props {
    workId: string;
}

export default function WorkspaceClient({ workId }: Props) {
    const [work, setWork] = useState<Work | null>(null);
    const [settings, setSettings] = useState<DisplaySettings | null>(null);
    const [isWorkLoading, setIsWorkLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    /**
     * 資料から飛んできたときの行番号。
     * 一度使ったら消す。話を切り替えるたびに飛ぶと邪魔になる。
     */
    const [jumpLine, setJumpLine] = useState<number | null>(null);

    /* 章。作らずに書き始められるので、無い作品もある */
    const [chapters, setChapters] = useState<Chapter[]>([]);

    const reloadChapters = useCallback(async () => {
        setChapters(await getRepository().listChapters(workId));
    }, [workId]);

    useEffect(() => {
        void reloadChapters();
    }, [reloadChapters]);

    async function handleCreateChapter() {
        await getRepository().createChapter(workId);
        await reloadChapters();
    }

    async function handleRenameChapter(chapterId: string, title: string) {
        await getRepository().updateChapter(chapterId, { title });
        await reloadChapters();
    }

    async function handleDeleteChapter(chapterId: string) {
        /*
         * 中の話は消えない。章から外れるだけ。
         * 章を消したつもりで原稿ごと消えるのは、取り返しがつかない。
         */
        await getRepository().deleteChapter(chapterId);
        await reloadChapters();
        await reload();
    }

    async function handleReorderChapters(orderedIds: string[]) {
        await getRepository().reorderChapters(workId, orderedIds);
        await reloadChapters();
    }

    async function handleMoveToChapter(
        episodeId: string,
        chapterId: string | null,
    ) {
        await updateEpisode(episodeId, { chapter_id: chapterId });
    }

    /** 話を複製する。下書きとして作る */
    async function handleDuplicate(episode: Episode) {
        const repository = getRepository();
        const created = await repository.createEpisode(workId);

        await repository.updateEpisode(created.id, {
            title: episode.title ? `${episode.title}（写し）` : "",
            body: episode.body,
            status: "todo",
            chapter_id: episode.chapter_id ?? null,
        });

        await reload();
    }
    /** URL で指定された行き先。話が読み込まれるまで持っておく */
    const wantedEpisodeRef = useRef<string | null>(null);
    const wantedLineRef = useRef<number | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isMentionsOpen, setIsMentionsOpen] = useState(false);
    const [selection, setSelection] = useState("");
    const [isReplaceOpen, setIsReplaceOpen] = useState(false);
    const [isReadOpen, setIsReadOpen] = useState(false);
    const aiStatus = useAiStatus();
    /** 置換の欄が読む本文と、直した結果を戻す口 */
    const [draft, setDraft] = useState<{ body: string; apply: (next: string) => void }>({
        body: "",
        apply: () => {},
    });

    const registerBody = useCallback((body: string, apply: (next: string) => void) => {
        setDraft({ body, apply });
    }, []);
    /** 集中モード。左の一覧を隠して本文だけにする */
    const [isFocusMode, setIsFocusMode] = useState(false);

    const {
        episodes,
        isLoading: isEpisodesLoading,
        reload,
        createEpisode,
        updateEpisode,
        deleteEpisode,
        reorderEpisodes,
    } = useEpisodes(workId);

    useEffect(() => {
        void (async () => {
            const repository = getRepository();

            /* 互いに関わらないので、同時に頼む */
            const [workData, settingsData] = await Promise.all([
                repository.getWork(workId),
                repository.getDisplaySettings(workId),
            ]);

            setWork(workData);
            setSettings(settingsData);
            setIsWorkLoading(false);
        })();
    }, [workId]);

    /*
     * 資料から「第3話 12行目」で飛んできたときの指定を読む。
     *
     * 話が読み込まれる前に控えておく。
     * 読み込みを待ってから読むと、その前に先頭の話が選ばれてしまう。
     */
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const episodeId = params.get("ep");
        const line = Number(params.get("line"));
        if (!episodeId) return;

        wantedEpisodeRef.current = episodeId;
        if (Number.isFinite(line) && line > 0) wantedLineRef.current = line;

        // 印を消す。読み込み直すたびに飛ばないように
        window.history.replaceState({}, "", window.location.pathname);
    }, []);

    // 選択中の話が無くなったら先頭を選ぶ
    useEffect(() => {
        if (episodes.length === 0) {
            setSelectedId(null);
            return;
        }

        // 指定された話があれば、そちらを先に開く
        const wanted = wantedEpisodeRef.current;
        if (wanted && episodes.some((ep) => ep.id === wanted)) {
            wantedEpisodeRef.current = null;
            setSelectedId(wanted);
            if (wantedLineRef.current !== null) {
                setJumpLine(wantedLineRef.current);
                wantedLineRef.current = null;
            }
            return;
        }

        if (!selectedId || !episodes.some((ep) => ep.id === selectedId)) {
            setSelectedId(episodes[0].id);
        }
    }, [episodes, selectedId]);

    const selected = episodes.find((ep) => ep.id === selectedId) ?? null;
    const totalChars = episodes.reduce((sum, ep) => sum + ep.char_count, 0);

    async function handleCreate(chapterId?: string | null) {
        const episode = await createEpisode();

        /* 章の中から作ったなら、その章に入れる */
        if (chapterId) {
            await updateEpisode(episode.id, { chapter_id: chapterId });
        }

        setSelectedId(episode.id);
    }

    /**
     * 本文を保存したあと、自動で資料の候補を拾う。
     *
     * 保存のたびに走らせると本文を送りすぎるので、
     * 前回から一定時間あいたときだけにする。
     * 候補は pending として置くだけで、資料には入れない。
     */
    const lastScanAtRef = useRef(0);
    async function runAutoExtract(episode: Episode) {
        const repository = getRepository();
        const ai = await repository.getAiSettings(workId);
        if (!ai.is_enabled || !ai.auto_extract) return;
        if (Date.now() - lastScanAtRef.current < AUTO_EXTRACT_INTERVAL_MS) return;
        if (episode.body.trim().length < 200) return;
        lastScanAtRef.current = Date.now();

        const targets: CandidateKind[] = [];
        if (ai.extract_characters) targets.push("character");
        if (ai.extract_places) targets.push("place");
        if (ai.extract_organizations) targets.push("organization");
        if (ai.extract_terms) {
            targets.push("term");
            targets.push("item");
        }
        if (ai.extract_events) targets.push("event");
        if (targets.length === 0) return;

        const pages = await repository.listPages(workId);
        const existing = await repository.listEntries(workId);
        const found = await getExtractor(aiStatus.connected).extract(
            episode.body,
            existing.flatMap((entry) => [entry.name, ...(entry.aliases ?? [])]).filter(Boolean),
            targets,
        );

        const pageByKey = new Map(pages.map((page) => [page.builtin_key, page]));
        for (const candidate of found) {
            const page =
                pageByKey.get(CANDIDATE_KIND_TO_PAGE[candidate.kind]) ??
                pageByKey.get(KIND_FALLBACK_PAGE[candidate.kind]);
            if (!page) continue;
            await repository.createEntry(workId, page.id, {
                name: candidate.name,
                summary: candidate.summary,
                candidate_source: candidate.context,
                candidate_status: ai.approval_mode === "draft" ? "none" : "pending",
            });
        }
    }

    /** 保存のたびに、その日の総文字数を記録する */
    async function recordProgress() {
        const repository = getRepository();
        const rows = await repository.listEpisodes(workId);
        await repository.recordProgress(
            workId,
            rows.reduce((sum, episode) => sum + episode.char_count, 0),
        );
    }

    async function handleToggleStatus(episode: Episode) {
        await updateEpisode(episode.id, { status: nextEpisodeStatus(episode.status) });
    }

    /** 執筆中に組み方向を切り替える。設定画面と同じ値を書き換える */
    async function handleToggleWritingMode() {
        if (!settings) return;
        const next = settings.writing_mode === "vertical" ? "horizontal" : "vertical";
        setSettings(await getRepository().saveDisplaySettings(workId, { writing_mode: next }));
    }

    if (isWorkLoading || isEpisodesLoading) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header />
                <p className="py-24 text-center text-sm text-faint">読み込んでいます</p>
            </div>
        );
    }

    if (!work || !settings) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header breadcrumbs={[{ label: "作品一覧", href: "/" }, { label: "見つかりません" }]} />
                <div className="py-24 text-center">
                    <p className="text-sm text-ink">この作品は見つかりませんでした。</p>
                    <p className="mt-1 text-sm text-muted">
                        削除されたか、別のブラウザで作られた可能性があります。
                    </p>
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

    return (
        <div className="flex h-screen flex-col bg-canvas">
            <Header
                breadcrumbs={[
                    { label: "作品一覧", href: "/" },
                    { label: "ワークスペース" },
                    { label: "執筆" },
                ]}
            />

            <div className="flex min-h-0 flex-1 gap-4 p-4">
                <aside
                    className={[
                        "flex w-72 shrink-0 flex-col",
                        isFocusMode ? "hidden" : "",
                    ].join(" ")}
                >
                    <WorkspaceNav workId={workId} current="write" />

                    <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-surface">
                        <div className="border-b border-line px-4 py-4">
                            <h1 className="truncate text-[15px] font-medium text-ink">
                                {work.title}
                            </h1>
                            <p className="mt-1 text-xs text-muted">
                                {episodes.length}話・{formatNumber(totalChars)}文字
                            </p>
                        </div>

                        <div className="min-h-0 flex-1">
                            <EpisodeList
                                episodes={episodes}
                                chapters={chapters}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                onCreate={(chapterId) =>
                                    void handleCreate(chapterId)
                                }
                                onDelete={(id) => void deleteEpisode(id)}
                                onDuplicate={(ep) => void handleDuplicate(ep)}
                                onToggleStatus={(ep) => void handleToggleStatus(ep)}
                                onReorder={(ids) => void reorderEpisodes(ids)}
                                onMoveToChapter={(id, chapterId) =>
                                    void handleMoveToChapter(id, chapterId)
                                }
                                onCreateChapter={() => void handleCreateChapter()}
                                onRenameChapter={(id, title) =>
                                    void handleRenameChapter(id, title)
                                }
                                onDeleteChapter={(id) => void handleDeleteChapter(id)}
                                onReorderChapters={(ids) =>
                                    void handleReorderChapters(ids)
                                }
                            />
                        </div>

                    </div>
                </aside>

                <main className="flex min-w-0 flex-1 gap-4">
                    <div className="min-w-0 flex-1">
                    {selected ? (
                        <EpisodeEditor
                            key={selected.id}
                            episode={selected}
                            settings={settings}
                            jumpToLine={jumpLine}
                            onJumped={() => setJumpLine(null)}
                            onSave={async ({ title, body }) => {
                                const saved = await updateEpisode(selected.id, { title, body });
                                                        void runAutoExtract(saved);
                                void recordProgress();
                            }}
                            onToggleWritingMode={() => void handleToggleWritingMode()}
                            onSetFontSize={(size) =>
                                void (async () => {
                                    setSettings(
                                        await getRepository().saveDisplaySettings(
                                            workId,
                                            { font_size: size },
                                        ),
                                    );
                                })()
                            }
                            onSetFont={(font) =>
                                void (async () => {
                                    setSettings(
                                        await getRepository().saveDisplaySettings(
                                            workId,
                                            { font_family: font },
                                        ),
                                    );
                                })()
                            }
                            onSetWritingMode={(mode) =>
                                void (async () => {
                                    setSettings(
                                        await getRepository().saveDisplaySettings(
                                            workId,
                                            { writing_mode: mode },
                                        ),
                                    );
                                })()
                            }
                            onOpenHistory={() => {
                                setIsHistoryOpen((open) => !open);
                                setIsMentionsOpen(false);
                                setIsReplaceOpen(false);
                                setIsReadOpen(false);
                            }}
                            isHistoryOpen={isHistoryOpen}
                            onOpenMentions={() => {
                                setIsMentionsOpen((open) => !open);
                                setIsHistoryOpen(false);
                                setIsReplaceOpen(false);
                                setIsReadOpen(false);
                            }}
                            isMentionsOpen={isMentionsOpen}
                            onSelectionChange={setSelection}
                            onOpenReplace={() => setIsReplaceOpen((open) => !open)}
                            isReplaceOpen={isReplaceOpen}
                            onOpenRead={() => {
                                setIsReadOpen((open) => !open);
                                setIsHistoryOpen(false);
                                setIsMentionsOpen(false);
                                setIsReplaceOpen(false);
                            }}
                            isReadOpen={isReadOpen}
                            onRegisterBody={registerBody}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line bg-surface">
                            <div className="text-center">
                                <p className="text-sm text-ink">まだ話がありません。</p>
                                <button
                                    type="button"
                                    onClick={() => void handleCreate()}
                                    className="mt-5 rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark"
                                >
                                    第1話を作る
                                </button>
                            </div>
                        </div>
                    )}
                    </div>

                    {isReadOpen && (
                        <ReadPanel
                            episodes={episodes}
                            settings={settings}
                            currentEpisodeId={selectedId}
                            onClose={() => setIsReadOpen(false)}
                        />
                    )}

                    {selected && isReplaceOpen && (
                        <div className="w-[340px] shrink-0 border-l border-line bg-surface">
                            <ReplacePanel
                                body={selected.body}
                                onApply={(next) =>
                                    void (async () => {
                                        const saved = await updateEpisode(
                                            selected.id,
                                            { body: next },
                                        );
                                        void runAutoExtract(saved);
                                    })()
                                }
                                onJump={(line) => setJumpLine(line)}
                                onClose={() => setIsReplaceOpen(false)}
                            />
                        </div>
                    )}

                    {selected && isMentionsOpen && (
                        <MentionPanel
                            workId={workId}
                            episodeId={selected.id}
                            selection={selection}
                            onClose={() => setIsMentionsOpen(false)}
                        />
                    )}

                    {selected && isHistoryOpen && (
                        <VersionHistoryPanel
                            episode={selected}
                            onClose={() => setIsHistoryOpen(false)}
                            onRestored={() => void reload()}
                        />
                    )}
                </main>
            </div>

            <button
                type="button"
                onClick={() => setIsFocusMode((on) => !on)}
                className="fixed bottom-5 right-5 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-muted shadow-sm hover:border-forest-line hover:text-forest"
            >
                {isFocusMode ? "集中モードを解除" : "集中モード"}
            </button>
        </div>
    );
}
