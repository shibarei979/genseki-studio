/**
 * ============================================================
 * 原石航路 Studio
 * PreviewClient — 読者から見た姿
 *
 * 投稿サイトはまだ無いので、これは下書きの確認。
 * 「出したらこう見える」を確かめるためのもの。
 *
 * 作品のページと話のページを行き来できる。
 * 投稿していない話は出さない。読者には見えないものだから。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import RenderedText from "@/components/manuscript/rendered-text";
import Header from "@/components/layout/header";
import { getRepository } from "@/lib/repository";
import { formatDateTime, formatNumber } from "@/lib/utils/text";
import type {
    DisplaySettings,
    Episode,
    Profile,
    PublishSettings,
    Work,
} from "@/types";
import { AGE_RATING_LABEL, SERIAL_STATUS_LABEL, tileOf } from "@/types";

export default function PreviewClient({ workId }: { workId: string }) {
    const [work, setWork] = useState<Work | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [publish, setPublish] = useState<PublishSettings | null>(null);
    const [display, setDisplay] = useState<DisplaySettings | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);

    /** null なら作品のページ。id があればその話 */
    const [openId, setOpenId] = useState<string | null>(null);

    /* 投稿していない話も見るか */
    const [showAll, setShowAll] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        const repository = getRepository();
        setWork(await repository.getWork(workId));
        setEpisodes(await repository.listEpisodes(workId));
        setPublish(await repository.getPublishSettings(workId));
        setDisplay(await repository.getDisplaySettings(workId));
        setProfile(await repository.getProfile());
        setIsLoading(false);
    }, [workId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    if (isLoading || !work) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header />
                <p className="py-24 text-center text-sm text-faint">
                    読み込んでいます
                </p>
            </div>
        );
    }

    /* 読者に見える話。投稿していないものは出さない */
    const visible = showAll
        ? episodes
        : episodes.filter((row) => row.is_published);

    const open = openId ? (episodes.find((row) => row.id === openId) ?? null) : null;

    return (
        <div className="min-h-screen bg-canvas">
            <Header
                breadcrumbs={[
                    { label: "作品", href: "/works" },
                    { label: work.title || "名前のない作品" },
                    { label: "読者から見る" },
                ]}
            />

            {/*
             * ここが下書きの確認であることを、はっきり伝える。
             * 本物の読者の画面と間違えると、
             * 「投稿したのに違う」という誤解が生まれる。
             */}
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-amber)] bg-[var(--color-amber-tint)] px-6 py-2.5">
                <p className="min-w-0 flex-1 text-xs text-ink">
                    読者から見た姿です。実際の投稿サイトはまだありません。
                </p>

                <label className="flex shrink-0 items-center gap-1.5">
                    <input
                        type="checkbox"
                        checked={showAll}
                        onChange={(e) => setShowAll(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--color-forest)]"
                    />
                    <span className="text-[11px] text-ink">未投稿の話も見る</span>
                </label>

                <Link
                    href={`/workspace/${workId}/post`}
                    className="shrink-0 rounded-md border border-[var(--color-amber)] px-3 py-1 text-[11px] text-ink hover:bg-surface"
                >
                    投稿へ戻る
                </Link>
            </div>

            <main className="mx-auto max-w-3xl px-6 py-10">
                {open ? (
                    <EpisodeView
                        work={work}
                        episode={open}
                        episodes={visible}
                        settings={display}
                        onOpen={setOpenId}
                        onBack={() => setOpenId(null)}
                    />
                ) : (
                    <WorkView
                        work={work}
                        episodes={visible}
                        publish={publish}
                        profile={profile}
                        onOpen={setOpenId}
                    />
                )}
            </main>
        </div>
    );
}

/**
 * ============================================================
 * 作品のページ
 * ============================================================
 */

function WorkView({
    work,
    episodes,
    publish,
    profile,
    onOpen,
}: {
    work: Work;
    episodes: Episode[];
    publish: PublishSettings | null;
    profile: Profile | null;
    onOpen: (id: string) => void;
}) {
    const tile = tileOf(work);
    const totalChars = episodes.reduce((sum, row) => sum + row.char_count, 0);

    return (
        <>
            <div className="flex flex-wrap items-start gap-6">
                <span
                    className="flex h-32 w-24 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: tile.bg }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={tile.src} alt="" className="h-12 w-12 object-contain" />
                </span>

                <div className="min-w-0 flex-1">
                    <h1 className="text-[26px] font-semibold leading-snug text-ink">
                        {work.title || "名前のない作品"}
                    </h1>

                    <p className="mt-1.5 text-sm text-muted">
                        {profile?.display_name ?? "名無しの書き手"}
                    </p>

                    {work.catchphrase && (
                        <p className="mt-3 text-sm text-ink">{work.catchphrase}</p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                        {work.genre && <span>{work.genre}</span>}
                        {publish && (
                            <>
                                <span className="text-faint">·</span>
                                <span>
                                    {SERIAL_STATUS_LABEL[publish.serial_status]}
                                </span>
                            </>
                        )}
                        <span className="text-faint">·</span>
                        <span>全{episodes.length}話</span>
                        <span className="text-faint">·</span>
                        <span>{formatNumber(totalChars)}字</span>
                        {work.age_rating !== "all" && (
                            <>
                                <span className="text-faint">·</span>
                                <span className="text-[var(--color-danger)]">
                                    {AGE_RATING_LABEL[work.age_rating]}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {work.summary && (
                <p className="mt-8 whitespace-pre-wrap text-sm leading-loose text-ink">
                    {work.summary}
                </p>
            )}

            {work.tags.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-1.5">
                    {work.tags.map((tag) => (
                        <li
                            key={tag}
                            className="rounded-full bg-surface px-3 py-1 text-[11px] text-muted"
                        >
                            {tag}
                        </li>
                    ))}
                </ul>
            )}

            {/* 話の一覧 */}
            <h2 className="mt-10 border-b border-line pb-2 text-sm font-medium text-ink">
                目次
            </h2>

            {episodes.length === 0 ? (
                <p className="py-12 text-center text-sm text-faint">
                    まだ投稿された話がありません。
                </p>
            ) : (
                <ul className="divide-y divide-line">
                    {episodes.map((episode) => (
                        <li key={episode.id}>
                            <button
                                type="button"
                                onClick={() => onOpen(episode.id)}
                                className="flex w-full items-baseline gap-3 py-3.5 text-left hover:text-forest"
                            >
                                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                    {episode.title || "（題名なし）"}
                                </span>

                                {!episode.is_published && (
                                    <span className="shrink-0 rounded bg-canvas px-2 py-0.5 text-[10px] text-faint">
                                        未投稿
                                    </span>
                                )}

                                <span className="shrink-0 text-[11px] text-faint">
                                    {formatNumber(episode.char_count)}字
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

/**
 * ============================================================
 * 話のページ
 * ============================================================
 */

function EpisodeView({
    work,
    episode,
    episodes,
    settings,
    onOpen,
    onBack,
}: {
    work: Work;
    episode: Episode;
    episodes: Episode[];
    settings: DisplaySettings | null;
    onOpen: (id: string) => void;
    onBack: () => void;
}) {
    const at = episodes.findIndex((row) => row.id === episode.id);
    const previous = at > 0 ? episodes[at - 1] : null;
    const next = at >= 0 && at < episodes.length - 1 ? episodes[at + 1] : null;

    return (
        <>
            <button
                type="button"
                onClick={onBack}
                className="text-xs text-muted hover:text-forest"
            >
                ← {work.title || "名前のない作品"}
            </button>

            <h1 className="mt-4 text-[22px] font-semibold leading-snug text-ink">
                {/*
                 * 番号は自動で付けない。
                 * 題名に「第1話」と書くかどうかは書き手が決める。
                 */}
                {episode.title || "（題名なし）"}
            </h1>

            <p className="mt-1.5 text-[11px] text-muted">
                {formatNumber(episode.char_count)}字
                {episode.publish_at && episode.is_published && (
                    <span className="ml-2">{formatDateTime(episode.publish_at)}</span>
                )}
            </p>

            {/* 前書き */}
            {episode.preface && (
                <div className="mt-6 rounded-lg bg-surface px-5 py-4">
                    <p className="whitespace-pre-wrap text-[13px] leading-loose text-muted">
                        {episode.preface}
                    </p>
                </div>
            )}

            {/* 本文 */}
            <div
                className="mt-8 whitespace-pre-wrap text-ink"
                style={{
                    fontSize: `${settings?.font_size ?? 16}px`,
                    lineHeight: 1.9,
                }}
            >
                <RenderedText text={episode.body} />
            </div>

            {/* 後書き */}
            {episode.afterword && (
                <div className="mt-10 rounded-lg bg-surface px-5 py-4">
                    <p className="whitespace-pre-wrap text-[13px] leading-loose text-muted">
                        {episode.afterword}
                    </p>
                </div>
            )}

            {/* 前後の話 */}
            <div className="mt-12 flex items-center gap-3 border-t border-line pt-6">
                {previous ? (
                    <button
                        type="button"
                        onClick={() => onOpen(previous.id)}
                        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-left hover:border-forest-line"
                    >
                        <span className="block text-[10px] text-faint">前の話</span>
                        <span className="mt-0.5 block truncate text-xs text-ink">
                            {previous.title || "（題名なし）"}
                        </span>
                    </button>
                ) : (
                    <span className="flex-1" />
                )}

                {next ? (
                    <button
                        type="button"
                        onClick={() => onOpen(next.id)}
                        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-right hover:border-forest-line"
                    >
                        <span className="block text-[10px] text-faint">次の話</span>
                        <span className="mt-0.5 block truncate text-xs text-ink">
                            {next.title || "（題名なし）"}
                        </span>
                    </button>
                ) : (
                    <span className="flex-1" />
                )}
            </div>
        </>
    );
}
