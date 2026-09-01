/**
 * ============================================================
 * 原石航路 Studio
 * SettingsClient — 設定画面の全体
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Header from "@/components/layout/header";
import DisplaySettingsForm from "@/components/settings/display-settings-form";
import AiSettingsForm from "@/components/settings/ai-settings-form";
import WritingLogForm from "@/components/settings/writing-log-form";
import ManuscriptManager from "@/components/settings/manuscript-manager";
import ChapterStructure from "@/components/settings/chapter-structure";
import PublishSettingsForm from "@/components/settings/publish-settings-form";
import WorkInfoForm from "@/components/settings/work-info-form";
import WorkspaceNav from "@/components/workspace/workspace-nav";
import { useEpisodes } from "@/hooks/use-episodes";
import { getRepository } from "@/lib/repository";
import { formatNumber } from "@/lib/utils/text";
import type {
    AiSettings,
    DisplaySettings,
    PublishSettings,
    Work,
    WorkPreferences,
    WritingLog,
} from "@/types";

type Section = "info" | "display" | "manuscript" | "publish" | "ai" | "log" | "chapters";

const SECTIONS: { key: Section; label: string; isReady: boolean }[] = [
    { key: "info", label: "基本情報", isReady: true },
    { key: "publish", label: "公開・読者設定", isReady: true },
    { key: "display", label: "表示設定", isReady: true },
    { key: "chapters", label: "章の構成", isReady: true },
    { key: "manuscript", label: "原稿・バックアップ", isReady: true },
    { key: "log", label: "執筆ログ", isReady: true },
    { key: "ai", label: "AI補助", isReady: true },
];

interface Props {
    workId: string;
}

export default function SettingsClient({ workId }: Props) {
    /*
     * 携帯で、項目の一覧を開いているか。
     *
     * 既定は畳む。選ぶと自動で畳まれ、
     * すぐ下の中身が見える。
     */
    const [isNavOpen, setIsNavOpen] = useState(false);

    const [work, setWork] = useState<Work | null>(null);
    const [settings, setSettings] = useState<DisplaySettings | null>(null);
    const [publish, setPublish] = useState<PublishSettings | null>(null);
    const [ai, setAi] = useState<AiSettings | null>(null);
    const [preferences, setPreferences] = useState<WorkPreferences | null>(null);
    const [logs, setLogs] = useState<WritingLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [section, setSection] = useState<Section>("info");

    const { episodes, reload: reloadEpisodes } = useEpisodes(workId);

    useEffect(() => {
        void (async () => {
            const repository = getRepository();

            /* 互いに関わらないので、同時に頼む */
            const [
                workData, settingsData, publishData,
                aiData, preferenceData, logData,
            ] = await Promise.all([
                repository.getWork(workId),
                repository.getDisplaySettings(workId),
                repository.getPublishSettings(workId),
                repository.getAiSettings(workId),
                repository.getPreferences(workId),
                repository.listWritingLogs(workId),
            ]);

            setWork(workData);
            setSettings(settingsData);
            setPublish(publishData);
            setAi(aiData);
            setPreferences(preferenceData);
            setLogs(logData);
            setIsLoading(false);
        })();
    }, [workId]);

    async function handleSaveWork(patch: Partial<Work>) {
        const updated = await getRepository().updateWork(workId, patch);
        setWork(updated);
    }

    async function handleChangeDisplay(patch: Partial<Omit<DisplaySettings, "work_id">>) {
        const updated = await getRepository().saveDisplaySettings(workId, patch);
        setSettings(updated);
    }

    async function handleChangePublish(patch: Partial<Omit<PublishSettings, "work_id">>) {
        setPublish(await getRepository().savePublishSettings(workId, patch));
    }

    async function handleChangeAi(patch: Partial<Omit<AiSettings, "work_id">>) {
        setAi(await getRepository().saveAiSettings(workId, patch));
    }

    async function handleChangePreferences(
        patch: Partial<Omit<WorkPreferences, "work_id">>,
    ) {
        setPreferences(await getRepository().savePreferences(workId, patch));
    }

    async function handleImport(
        items: { title: string; body: string; chapterTitle?: string }[],
        mode: "append" | "replace",
    ) {
        const repository = getRepository();

        /*
         * 入れ替えのときは、先に今の話を消す。
         * 足してから消すと、途中で止まったときに二重になる。
         */
        if (mode === "replace") {
            for (const episode of episodes) {
                await repository.deleteEpisode(episode.id);
            }
        }

        const created = await repository.createEpisodes(
            workId,
            items.map((item) => ({ title: item.title, body: item.body })),
        );

        /*
         * 章として取り込んだときは、章も作って結びつける。
         *
         * 名前を持っているだけでは、一覧に章として並ばない。
         * 同じ名前の章は 1 つにまとめる。
         */
        const chapterNames = Array.from(
            new Set(items.map((item) => item.chapterTitle).filter(Boolean)),
        ) as string[];

        if (chapterNames.length > 0) {
            const existing = await repository.listChapters(workId);
            const idByName = new Map(existing.map((c) => [c.title, c.id]));

            for (const name of chapterNames) {
                if (idByName.has(name)) continue;
                const chapter = await repository.createChapter(workId, name);
                idByName.set(name, chapter.id);
            }

            await Promise.all(
                items.map((item, index) => {
                    const episode = created?.[index];
                    const chapterId = item.chapterTitle
                        ? idByName.get(item.chapterTitle)
                        : null;
                    if (!episode || !chapterId) return Promise.resolve();
                    return repository.updateEpisode(episode.id, {
                        chapter_id: chapterId,
                    });
                }),
            );
        }

        await reloadEpisodes();
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header />
                <p className="py-24 text-center text-sm text-faint">読み込んでいます</p>
            </div>
        );
    }

    if (!work || !settings || !publish || !ai || !preferences) {
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

    const totalChars = episodes.reduce((sum, ep) => sum + ep.char_count, 0);

    return (
        <div className="min-h-screen bg-canvas">
            <Header
                breadcrumbs={[
                    { label: "作品一覧", href: "/" },
                    { label: "ワークスペース", href: `/workspace/${workId}` },
                    { label: "設定" },
                ]}
            />

            {/*
             * 狭い画面では縦に積む。
             *
             * 横並びのままだと、柱と本体が幅を奪い合って
             * 「下 書 き」のように文字が 1 文字ずつ縦に割れる。
             * 広い画面は今までどおり横に並べる。
             */}
            <div className="flex flex-col gap-4 p-4 lg:flex-row">
                <aside className="w-full shrink-0 lg:w-64">
                    <WorkspaceNav workId={workId} current="settings" />

                    <div className="mt-4 rounded-lg border border-line bg-surface">
                        <div className="border-b border-line px-4 py-4">
                            <h1 className="truncate text-[15px] font-medium text-ink">
                                {work.title}
                            </h1>
                            <p className="mt-1 text-xs text-muted">
                                {episodes.length}話・{formatNumber(totalChars)}文字
                            </p>
                        </div>

                        {/*
                          * 携帯では、いま選んでいるものだけ出す。
                          *
                          * ★ 7 つ並ぶと、それだけで画面が埋まる。
                          *   設定を触りに来た人は行き先が決まっているので、
                          *   ふだんは畳んでおく。
                          */}
                        <button
                            type="button"
                            onClick={() => setIsNavOpen((v) => !v)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] text-ink lg:hidden"
                        >
                            <span className="font-medium">
                                {SECTIONS.find((one) => one.key === section)?.label}
                            </span>
                            {/*
                              * ★ 押せると分かる形にする。
                              *
                              *   矢印だけだと、飾りに見えて押されない。
                              *   言葉を添えて、丸で囲む。
                              */}
                            {/*
                              * ★ 矢印は使わない。
                              *   言葉だけで、押すと何が起きるか分かる。
                              */}
                            <span className="shrink-0 rounded-full border border-line bg-canvas px-3 py-1 text-[11px] text-muted">
                                {isNavOpen ? "とじる" : "ほかの項目"}
                            </span>
                        </button>

                        <nav className={`p-2 ${isNavOpen ? "" : "hidden"} lg:block`}>
                            {SECTIONS.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    disabled={!item.isReady}
                                    onClick={() => { setSection(item.key); setIsNavOpen(false) }}
                                    className={[
                                        "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm",
                                        section === item.key
                                            ? "bg-forest-tint text-forest"
                                            : item.isReady
                                              ? "text-ink hover:bg-canvas"
                                              : "cursor-not-allowed text-faint",
                                    ].join(" ")}
                                >
                                    <span>{item.label}</span>
                                    {!item.isReady && (
                                        <span className="text-xs text-faint">準備中</span>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                <main className="min-w-0 flex-1">
                    {section === "info" && (
                        <WorkInfoForm
                            work={work}
                            /* 下書きのうちは、ジャンルを何度でも変えられる */
                            isPublished={
                                (publish?.visibility ?? "draft") !== "draft"
                            }
                            onSave={handleSaveWork}
                        />
                    )}
                    {section === "publish" && (
                        <PublishSettingsForm
                            work={work}
                            settings={publish}
                            /* 公開されている話の数。0 なら知らせを出す */
                            livePisodeCount={
                                episodes.filter((one) => one.is_published).length
                            }
                            onChange={(patch) => void handleChangePublish(patch)}
                        />
                    )}
                    {section === "display" && (
                        <DisplaySettingsForm
                            settings={settings}
                            workTitle={work.title}
                            onChange={(patch) => void handleChangeDisplay(patch)}
                        />
                    )}
                    {section === "ai" && (
                        <AiSettingsForm
                            settings={ai}
                            onChange={(patch) => void handleChangeAi(patch)}
                        />
                    )}
                    {section === "log" && (
                        <WritingLogForm
                            preferences={preferences}
                            logs={logs}
                            onChange={(patch) => void handleChangePreferences(patch)}
                        />
                    )}
                    {/*
                     * 章の構成。
                     *
                     * 執筆画面の一覧に足すと入り組んで壊れやすいので、
                     * ここだけで完結させている。
                     */}
                    {section === "chapters" && (
                        <ChapterStructure workId={workId} />
                    )}

                    {section === "manuscript" && (
                        <ManuscriptManager
                            work={work}
                            episodes={episodes}
                            settings={settings}
                            onImport={handleImport}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}
