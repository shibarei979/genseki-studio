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
import { useSearchParams } from "next/navigation";

import Header from "@/components/layout/header";
import EpisodeEditor from "@/components/workspace/episode-editor";
import EpisodeList from "@/components/workspace/episode-list";
import MentionPanel from "@/components/workspace/mention-panel";
import ProofreadPanel from "@/components/workspace/proofread-panel";
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
    /*
     * 住所の問い符から後ろ。
     *
     * 投稿から戻ってきたときは、画面はそのままで
     * ここだけが変わる。見張っていないと気づけない。
     */
    const searchParams = useSearchParams();

    /*
     * 蛍光ペンの足す先の名前。
     * 何に足しているか分からないまま押させない。
     */
    const [pickEntryName, setPickEntryName] = useState("この資料");

    useEffect(() => {
        const pickId = searchParams.get("pick");
        if (!pickId) return;

        void (async () => {
            try {
                const entries = await getRepository().listEntries(workId);
                setPickEntryName(
                    entries.find((one) => one.id === pickId)?.name || "この資料",
                );
            } catch {
                /* 引けなくても、既定の言葉で足りる */
            }
        })();
    }, [searchParams, workId]);

    const [work, setWork] = useState<Work | null>(null);
    const [settings, setSettings] = useState<DisplaySettings | null>(null);
    const [isWorkLoading, setIsWorkLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    /**
     * 資料から飛んできたときの行番号。
     * 一度使ったら消す。話を切り替えるたびに飛ぶと邪魔になる。
     */
    const [jumpLine, setJumpLine] = useState<number | null>(null);
    /* 章。話をまとめるための束 */
    const [chapters, setChapters] = useState<Chapter[]>([]);
    /*
     * 末尾へ寄せたか。
     *
     * 開いた最初の一度だけにする。
     * これが無いと、書くたびに episodes が新しくなって
     * この判定が何度も走り、そのはずみで末尾へ飛ばされる。
     * 矢印や BS を押している最中に飛ぶのはこれ。
     */
    const didJumpToTailRef = useRef(false);
    /** URL で指定された行き先。話が読み込まれるまで持っておく */
    const wantedEpisodeRef = useRef<string | null>(null);
    const wantedLineRef = useRef<number | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isMentionsOpen, setIsMentionsOpen] = useState(false);
    const [selection, setSelection] = useState("");
    const [isProofreadOpen, setIsProofreadOpen] = useState(false);
    const [isReadOpen, setIsReadOpen] = useState(false);

    /*
     * 窓がどれか開いているか。
     *
     * 狭い画面では、本文と窓のどちらかだけを出す。
     */
    const isAnyPanelOpen = isReadOpen || isMentionsOpen || isHistoryOpen;
    const aiStatus = useAiStatus();
    /** 推敲パネルが読む本文と、直した結果を戻す口 */
    const [draft, setDraft] = useState<{ body: string; apply: (next: string) => void }>({
        body: "",
        apply: () => {},
    });

    const registerBody = useCallback((body: string, apply: (next: string) => void) => {
        setDraft({ body, apply });
    }, []);
    /** 集中モード。左の一覧を隠して本文だけにする */
    const [isFocusMode, setIsFocusMode] = useState(false);

    /*
     * 話の一覧を出しているか。
     *
     * 狭い画面でだけ使う。
     * 広い画面では、いつも出ている。
     */
    const [isListOpen, setIsListOpen] = useState(false);

    /**
     * 章に入れて、その章の最後へ動かす。
     *
     * ★ 章に入れるだけでは、並びは変わらない。
     *
     *   並びを決めるのは話の番号だけ。
     *   あとから作った話は番号が最後なので、
     *   章に入れても離れた場所に残る。
     *   その結果、同じ章の見出しが 2 回出て
     *   分裂したように見えていた。
     *
     * ★ 章から出すときは動かさない。
     *   どこへ置きたいかが分からないため。
     */
    async function assignChapterAndSort(
        episodeId: string,
        chapterId: string | null,
    ) {
        await updateEpisode(episodeId, { chapter_id: chapterId });

        if (!chapterId) return;

        /* その章の話（いま入れたものを除く） */
        const inChapter = episodes.filter(
            (one) => one.chapter_id === chapterId && one.id !== episodeId,
        );
        if (inChapter.length === 0) return;

        /* 章の最後の話 */
        const last = inChapter[inChapter.length - 1];

        const order = episodes.map((one) => one.id);
        const from = order.indexOf(episodeId);
        if (from < 0) return;

        const next = [...order];
        next.splice(from, 1);

        const to = next.indexOf(last.id);
        if (to < 0) return;
        next.splice(to + 1, 0, episodeId);

        await reorderEpisodes(next);
    }

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
            setWork(await repository.getWork(workId));
            setSettings(await repository.getDisplaySettings(workId));
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
        /*
         * 住所の後ろを片付ける。
         *
         * ★ pick は残す。
         *
         *   蛍光ペンで来たときの「どの資料に足すか」が
         *   ここに入っている。
         *   丸ごと消すと、開いた瞬間に蛍光ペンが解ける。
         *
         * ep と line は、もう読み取ったので消してよい。
         * 残すと、読み込み直すたびにその話へ飛ぶ。
         */
        const pickId = params.get("pick");
        window.history.replaceState(
            {},
            "",
            pickId
                ? `${window.location.pathname}?pick=${pickId}`
                : window.location.pathname,
        );

        /*
         * すでに読み込みが終わっていれば、その場で選び直す。
         *
         * 投稿から戻ってきたときは、同じ画面のまま住所だけが変わる。
         * 下の「選び直す」は話が読み込まれた時にしか走らないので、
         * ここで直に選ばないと 1 話目のままになる。
         */
        setSelectedId((current) => (current === episodeId ? current : episodeId));
    }, [searchParams]);

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
            /*
             * 最後にさわった話を開く。
             *
             * 以前は必ず第 1 話だった。
             * 続きを書きに来た人は、そこから毎回目当ての話を
             * 探し直すことになる。話が増えるほど手間が増える。
             *
             * 日付が無い（古い話）ときは、いちばん後ろの話にする。
             * 何も分からないなら、新しいほうが目当てに近い。
             */
            const latest = [...episodes].sort((a, b) => {
                const at = a.updated_at ?? "";
                const bt = b.updated_at ?? "";
                if (at && bt && at !== bt) return bt.localeCompare(at);
                return b.ep_number - a.ep_number;
            })[0];

            setSelectedId(latest.id);

            /*
             * 本文の末尾に置く。開いた最初の一度だけ。
             *
             * 続きを書くのだから、頭ではなく終わりから始めたい。
             * ただし書いている最中に走らせてはいけない。
             * 999999 は「どの本文より後ろ」の意味。
             */
            if (!didJumpToTailRef.current) {
                didJumpToTailRef.current = true;
                setJumpLine(999999);
            }
        }
    }, [episodes, selectedId]);

    /* 章を読む。作品を開いたときと、章を足したとき */
    const reloadChapters = useCallback(async () => {
        setChapters(await getRepository().listChapters(workId));
    }, [workId]);

    useEffect(() => {
        void reloadChapters();
    }, [reloadChapters]);

    const selected = episodes.find((ep) => ep.id === selectedId) ?? null;
    const totalChars = episodes.reduce((sum, ep) => sum + ep.char_count, 0);

    async function handleCreate() {
        const episode = await createEpisode();
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
            <div className="min-h-screen bg-page">
                <Header />
                <p className="py-24 text-center text-[13px] text-faint">読み込んでいます</p>
            </div>
        );
    }

    if (!work || !settings) {
        return (
            <div className="min-h-screen bg-page">
                <Header breadcrumbs={[{ label: "作品一覧", href: "/" }, { label: "見つかりません" }]} />
                <div className="py-24 text-center">
                    <p className="text-[13px] text-ink">この作品は見つかりませんでした。</p>
                    <p className="mt-1 text-[13px] text-muted">
                        削除されたか、別のブラウザで作られた可能性があります。
                    </p>
                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-md bg-forest px-5 py-2 text-[13px] text-white hover:bg-forest-dark"
                    >
                        作品一覧へ戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        /*
         * 画面の高さちょうどに収める。
         * dvh にするのは、携帯で住所欄が出入りしても
         * 高さが狂わないようにするため。
         */
        <div className="flex h-dvh flex-col overflow-hidden bg-page">
            {/*
             * 集中モードでは、ヘッダーごと消す。
             *
             * 「書く所だけを映す」がこのモードの約束。
             * 周りの余白も詰めて、画面の端まで紙にする。
             * 戻る道は道具の列の拡大の印（同じボタン）。
             */}
            {!isFocusMode && (
                /*
                 * ヘッダーは縮ませず、貼り付きも切る。
                 *
                 * 執筆画面は画面の高さに収める作り。
                 * 貼り付いたままだと場所を取らず、
                 * 下の段が上に詰まってパンくずと重なる。
                 *
                 * 打ち消し（[&>header]:static）ではなく引数で切る。
                 * static と sticky はどちらも position なので、
                 * どちらが効くかが生成順しだいで揺れる。
                 */
                <div className="shrink-0">
                    <Header
                        sticky={false}
                        breadcrumbs={[
                            { label: "作品一覧", href: "/" },
                            { label: "ワークスペース" },
                            { label: "執筆" },
                        ]}
                    />
                </div>
            )}

            <div
                className={[
                    "flex min-h-0 flex-1",
                    isFocusMode ? "" : "gap-2.5 p-2.5 sm:gap-4 sm:p-3",
                ].join(" ")}
            >
                {/*
                 * 話の一覧。
                 *
                 * 狭い画面では隠す。
                 * 本文と並べると、どちらも読めない幅になる。
                 * 上の「話一覧」を押すと出る。
                 */}
                <aside
                    className={[
                        /*
                         * 出す・隠すは 1 か所で決める。
                         *
                         * 以前は "lg:flex" と "flex"／"hidden" が
                         * 混ざっていて、どちらが効くかが揺れていた。
                         * 隠れきらないと本文の上に重なり、
                         * パンくずと押し具が同じ行に見える。
                         *
                         *   集中モード       いつも隠す
                         *   一覧を開いた     出す
                         *   広い画面         いつも出す
                         *   それ以外         隠す
                         */
                        "w-full shrink-0 flex-col lg:w-72",
                        isFocusMode
                            ? "hidden"
                            : isListOpen
                              ? "flex"
                              : "hidden lg:flex",
                    ].join(" ")}
                >
                    <WorkspaceNav workId={workId} current="write" episodeId={selectedId} alwaysOpen />

                    {/* 一覧を閉じる。狭い画面だけ */}
                    <button
                        type="button"
                        onClick={() => setIsListOpen(false)}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface py-2 text-[13px] text-muted hover:text-ink lg:hidden"
                    >
                        本文にもどる
                    </button>

                    <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-surface">
                        <div className="border-b border-line px-3.5 py-3">
                            <h1 className="truncate text-[14px] font-medium text-ink">
                                {work.title}
                            </h1>
                            <p className="mt-1 text-xs text-muted">
                                {episodes.length}話・{formatNumber(totalChars)}文字
                            </p>
                        </div>

                        <div className="min-h-0 flex-1">
                            <EpisodeList
                                episodes={episodes}
                                selectedId={selectedId}
                                onSelect={(id) => {
                                    setSelectedId(id);
                                    /*
                                     * 選び直したときも末尾から書ける。
                                     * ここは押した瞬間にしか走らないので、
                                     * 書いている最中に飛ぶことはない。
                                     */
                                    if (id !== selectedId) setJumpLine(999999);
                                    /*
                                     * 狭い画面では、選んだらそのまま本文へ。
                                     *
                                     * 以前は一覧に留まり、「本文にもどる」を
                                     * 自分で押す必要があった。
                                     * 話を選ぶのは本文を書くためなので、
                                     * その二度手間を無くす。
                                     *
                                     * 広い画面は一覧と本文が並んでいるので、
                                     * 閉じても何も起きない（isListOpen を見ていない）。
                                     */
                                    setIsListOpen(false);
                                }}
                                onCreate={handleCreate}
                                onDelete={(id) => void deleteEpisode(id)}
                                onToggleStatus={(ep) => void handleToggleStatus(ep)}
                                onReorder={(ids) => void reorderEpisodes(ids)}
                                chapters={chapters}
                                onRenameEpisode={(episodeId, title) =>
                                    void updateEpisode(episodeId, { title })
                                }
                                onAssignChapter={(episodeId, chapterId) =>
                                    void assignChapterAndSort(episodeId, chapterId)
                                }
                                onDeleteMany={(ids) => {
                                    void (async () => {
                                        await getRepository().deleteEpisodes(ids);
                                        await reload();
                                    })();
                                }}
                                onReorderChapters={(ids) => {
                                    void (async () => {
                                        await getRepository().reorderChapters(
                                            workId,
                                            ids,
                                        );
                                        await reloadChapters();
                                    })();
                                }}
                                onRenameChapter={(chapterId, title) => {
                                    void (async () => {
                                        await getRepository().updateChapter(
                                            chapterId,
                                            { title },
                                        );
                                        await reloadChapters();
                                    })();
                                }}
                                onDeleteChapter={(chapterId) => {
                                    void (async () => {
                                        /*
                                         * 中の話は消さない。
                                         * 章から出して「章に入れていない」へ戻す。
                                         * 話まで消えると、書いたものが失われる。
                                         */
                                        await Promise.all(
                                            episodes
                                                .filter(
                                                    (ep) =>
                                                        ep.chapter_id ===
                                                        chapterId,
                                                )
                                                .map((ep) =>
                                                    updateEpisode(ep.id, {
                                                        chapter_id: null,
                                                    }),
                                                ),
                                        );
                                        await getRepository().deleteChapter(
                                            chapterId,
                                        );
                                        await reloadChapters();
                                    })();
                                }}
                                onCreateChapter={(episodeId) => {
                                    void (async () => {
                                        /*
                                         * 名前だけを聞く。
                                         *
                                         * 「第◯章」は並び順から自動で付くので、
                                         * ここで入れると「第2章 第二章」になる。
                                         * 聞くのは「出会い」のような題だけ。
                                         */
                                        const title = window.prompt(
                                            `第${chapters.length + 1}章の名前を入れてください（例：出会い）\n空のままでも作れます`,
                                            "",
                                        );
                                        if (title === null) return;

                                        const chapter = await getRepository()
                                            .createChapter(
                                                workId,
                                                title.trim(),
                                            );
                                        await reloadChapters();

                                        /*
                                         * 話を指定して呼ばれたときだけ、
                                         * 作った章にその話を入れる。
                                         * 見出しの「＋ 章」からは章を作るだけ。
                                         */
                                        if (episodeId) {
                                            await updateEpisode(episodeId, {
                                                chapter_id: chapter.id,
                                            });
                                        }
                                    })();
                                }}
                            />
                        </div>
                    </div>
                </aside>

                {/*
                 * min-h-0 はここに付ける。
                 *
                 * 執筆画面は画面の高さちょうどに収める作り。
                 * これが無いと中身の高さが親を押し広げ、
                 * 上の帯（通し読みなどのボタン）と本文の頭が
                 * 画面の外へ出てしまう。
                 * 縦書きは横へ送るので、送り戻すこともできない。
                 *
                 * 中の箱に付けると、その箱の高さが 0 と見なされ、
                 * 本文そのものが潰れて消える。
                 */}
                <main
                    className={[
                        /*
                         * 横並び。
                         *
                         * 本文の箱と、通し読みなどの窓を左右に置く。
                         *
                         * 以前は "lg:flex" と "flex" が混ざっていて、
                         * どちらが効くかが揺れていた。
                         * 効かないと 2 つが同じ場所に重なり、
                         * あとから描かれる窓が本文を覆ってしまう。
                         *
                         * 狭い画面で一覧を開いているときだけ隠す。
                         * それ以外は、広さに関わらず横に並べる。
                         */
                        "min-h-0 min-w-0 flex-1 gap-4",
                        isListOpen ? "hidden lg:flex" : "flex",
                    ].join(" ")}
                >
                    {/*
                     * 高さの鎖を通す。
                     *
                     * min-h-0 が無いと、flex の既定（min-height:auto）で
                     * 中身の高さまで膨らみ、親を突き抜けて上へはみ出す。
                     * 実測では親 754 に対し箱が 1128、上端が -17 だった。
                     * 上の帯と本文の頭が画面の外へ出ていたのはこれ。
                     *
                     * flex-col は箱の「中」の並び。
                     * 通し読みなどの窓は main 直下の兄弟なので、
                     * 横並びには影響しない。
                     */}
                    {/*
                     * 本文の箱。
                     *
                     * 狭い画面で窓（通し読み・資料リンク・履歴）を開いたときは隠す。
                     * 並べる幅が無いので、そのままだと本文が下へ回り、
                     * 窓と本文を行き来するたびに画面を大きく送ることになる。
                     * 広い画面では今までどおり横に並べる。
                     */}
                    <div
                        className={[
                            "flex min-h-0 min-w-0 flex-1 flex-col",
                            isAnyPanelOpen ? "hidden lg:flex" : "flex",
                        ].join(" ")}
                    >
                    {/*
                     * 話を選ぶ。
                     *
                     * 狭い画面だけ。広い画面では左に一覧が出ている。
                     *
                     * いま何話を見ているかも出す。
                     * 「一覧をひらく」とだけ書いても、
                     * それが話を選ぶ所だと分からない。
                     */}
                    {!isFocusMode && (
                        <button
                            type="button"
                            onClick={() => setIsListOpen(true)}
                            /*
                             * 押せると分かる見た目にする。
                             *
                             * 白地に細字だと、いま開いている話の
                             * 見出しにしか見えず、ここから話を選べると
                             * 気づかれない。
                             * 枠の色を付け、右端は札の形にする。
                             */
                            /*
                             * shrink-0 を付ける。
                             *
                             * 箱は縦並びの flex。付けないと高さが足りないとき
                             * この押し具が潰され、上の行に食い込んで
                             * パンくずと重なって見える。
                             */
                            className="mb-2 flex w-full shrink-0 items-center justify-between gap-2 rounded-md border border-forest-line bg-forest-tint/40 px-3.5 py-2.5 text-[13px] text-ink hover:bg-forest-tint lg:hidden"
                        >
                            <span className="min-w-0 truncate font-medium">
                                {selected
                                    ? selected.title || `${selected.ep_number}話`
                                    : "話を選ぶ"}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] text-forest">
                                話を切りかえる
                                <span aria-hidden="true">▾</span>
                            </span>
                        </button>
                    )}

                    {selected ? (
                        <EpisodeEditor
                            pickEntryId={searchParams.get("pick")}
                            pickEntryName={pickEntryName}
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
                            isFocusMode={isFocusMode}
                            onToggleFocus={() => setIsFocusMode((on) => !on)}
                            onOpenHistory={() => {
                                setIsHistoryOpen((open) => !open);
                                setIsMentionsOpen(false);
                                setIsProofreadOpen(false);
                                setIsReadOpen(false);
                            }}
                            isHistoryOpen={isHistoryOpen}
                            onOpenMentions={() => {
                                setIsMentionsOpen((open) => !open);
                                setIsHistoryOpen(false);
                                setIsProofreadOpen(false);
                                setIsReadOpen(false);
                            }}
                            isMentionsOpen={isMentionsOpen}
                            onSelectionChange={setSelection}
                            onOpenProofread={() => {
                                setIsProofreadOpen((open) => !open);
                                setIsHistoryOpen(false);
                                setIsMentionsOpen(false);
                                setIsReadOpen(false);
                            }}
                            isProofreadOpen={isProofreadOpen}
                            onOpenRead={() => {
                                setIsReadOpen((open) => !open);
                                setIsHistoryOpen(false);
                                setIsMentionsOpen(false);
                                setIsProofreadOpen(false);
                            }}
                            isReadOpen={isReadOpen}
                            onRegisterBody={registerBody}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line bg-surface">
                            <div className="text-center">
                                <p className="text-[13px] text-ink">まだ話がありません。</p>
                                <button
                                    type="button"
                                    onClick={() => void handleCreate()}
                                    className="mt-5 rounded-md bg-forest px-5 py-2 text-[13px] text-white hover:bg-forest-dark"
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

                    {selected && isProofreadOpen && (
                        <ProofreadPanel
                            body={draft.body}
                            onApplyFix={(next) => draft.apply(next)}
                            onClose={() => setIsProofreadOpen(false)}
                        />
                    )}

                    {selected && isMentionsOpen && (
                        <MentionPanel
                            workId={workId}
                            episodeId={selected.id}
                            selection={selection}
                            onClose={() => setIsMentionsOpen(false)}
                            onJumpToWord={(word) => {
                                /*
                                 * 本文からその語を探し、行番号で飛ぶ。
                                 *
                                 * 見つからなければ何もしない。
                                 * 勝手に先頭へ戻すと、いま書いている所を
                                 * 見失わせてしまう。
                                 */
                                const at = selected.body.indexOf(word);
                                if (at < 0) return;

                                const line = selected.body.slice(0, at).split("\n").length;
                                setJumpLine(line);
                            }}
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
        </div>
    );
}
