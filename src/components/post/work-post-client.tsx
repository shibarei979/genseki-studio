/**
 * ============================================================
 * 原石航路 Studio
 * WorkPostClient — 話の投稿
 *
 * 言葉を分ける。
 *   公開 … 作品そのもの。設定で決める
 *   投稿 … 話を 1 つずつ外へ出すこと。ここで行う
 *
 * 左に話の一覧、右に選んだ話。
 * 縦に積むと入力欄が細くなり、本文も確かめられない。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import EpisodeIllustManager from "@/components/post/episode-illust-manager";
import TagInput from "@/components/works/tag-input";
import Header from "@/components/layout/header";
import WorkspaceNav from "@/components/workspace/workspace-nav";
import { getRepository } from "@/lib/repository";
import { formatNumber } from "@/lib/utils/text";
import type {
    AgeRating,
    AiUsage,
    Chapter,
    Episode,
    PublishSettings,
    Work,
    WorkFormat,
} from "@/types";
import {
    AGE_RATING_DESCRIPTION,
    AGE_RATING_LABEL,
    AI_USAGE_LABEL,
    GENRES_R18_ONLY,
    WORK_FORMAT_DESCRIPTION,
    WORK_FORMAT_LABEL,
    formatChapterLabel,
    selectableGenres,
} from "@/types";

export default function WorkPostClient({ workId }: { workId: string }) {
    const router = useRouter();
    const [work, setWork] = useState<Work | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [publish, setPublish] = useState<PublishSettings | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    /*
     * まとめて投稿。
     *
     * 何十話も貯めてから出す人がいる。
     * 1 話ずつ開いて押していくのは、それだけで日が暮れる。
     */
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkFrom, setBulkFrom] = useState("");
    const [bulkTo, setBulkTo] = useState("");
    const [bulkError, setBulkError] = useState("");
    const [bulkDoing, setBulkDoing] = useState(0);

    /*
     * まとめて消す。
     *
     * 執筆画面と同じ形。投稿の一覧を見ながら
     * 「これは要らない」と気づくことが多い。
     */
    const [isPicking, setIsPicking] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);

    function togglePicked(id: string) {
        setPicked((list) =>
            list.includes(id) ? list.filter((at) => at !== id) : [...list, id],
        );
    }

    /**
     * 選んだ話を、まとめて投稿する／非公開にする。
     *
     * 投稿するときは名前が要る。
     * 名前の無い話があれば、何もせずに知らせる。
     */
    async function bulkSet(publish: boolean) {
        if (picked.length === 0) return;

        const targets = episodes.filter((row) => picked.includes(row.id));

        if (publish) {
            const noTitle = targets.filter((row) => !row.title.trim());
            if (noTitle.length > 0) {
                window.alert(
                    `名前の無い話が${noTitle.length}話あります。\n` +
                        "先に名前を入れてください。",
                );
                return;
            }
        }

        if (
            !window.confirm(
                publish
                    ? `${targets.length}話を投稿します。読者に公開されます。`
                    : `${targets.length}話を非公開にします。`,
            )
        ) {
            return;
        }

        const repository = getRepository();
        for (const row of targets) {
            await repository.updateEpisode(row.id, {
                is_published: publish,
                publish_at: null,
            });
        }
        setPicked([]);
        setIsPicking(false);
        await reload();
    }

    async function deletePicked() {
        if (picked.length === 0) return;

        const names = episodes
            .filter((row) => picked.includes(row.id))
            .slice(0, 5)
            .map((row) => row.title || `${row.ep_number}話`)
            .join("\n");

        if (
            !window.confirm(
                `${picked.length}話を消します。元に戻せません。\n\n` +
                    `${names}${picked.length > 5 ? "\nほか" : ""}`,
            )
        ) {
            return;
        }

        await getRepository().deleteEpisodes(picked);
        setPicked([]);
        setIsPicking(false);
        await reload();
    }
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        const repository = getRepository();
        /* 互いに関わらないので、同時に頼む */
        const [workData, publishData, chapterData, rows] = await Promise.all([
            repository.getWork(workId),
            repository.getPublishSettings(workId),
            repository.listChapters(workId),
            repository.listEpisodes(workId),
        ]);

        setWork(workData);
        setPublish(publishData);
        setChapters(chapterData);
        setEpisodes(rows);

        /*
         * どの話を開くか。
         *
         * 執筆から来たときは、その話を開く（?ep=...）。
         * ただし見るのは開いた最初の一度だけ。
         *
         * 毎回見ると、投稿や非公開を押して読み直すたびに
         * URL の話へ引き戻され、別の話を見ていたのに
         * 勝手に移動する。
         */
        setSelectedId((current) => {
            if (current) return current;

            const wanted =
                typeof window !== "undefined"
                    ? new URLSearchParams(window.location.search).get("ep")
                    : null;

            if (wanted && rows.some((row) => row.id === wanted)) return wanted;
            return rows[0]?.id ?? null;
        });
        setIsLoading(false);
    }, [workId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    /*
     * 予約の時刻が来たら、読み直す。
     *
     * 公開するのは裏の見回りなので、
     * 開いたままの画面は「出た」ことに気づかない。
     * 投稿されたのに予約の札が残って見える。
     *
     * 予約があるときだけ、1 分ごとに見に行く。
     * 無いときは何もしない。
     */
    useEffect(() => {
        /*
         * 30 秒ごとに読み直す。
         *
         * 予約の有無で止めていたが、それだと
         * 「予約が消えた瞬間」にタイマーも止まり、
         * 最後の更新を取り逃すことがあった。
         *
         * 常に見に行き、画面を離れている間は休む。
         */
        function refresh() {
            if (document.hidden) return;
            void reload();
        }

        const timer = window.setInterval(refresh, 30_000);

        /* 別の画面から戻ってきたときも、すぐ読み直す */
        document.addEventListener("visibilitychange", refresh);
        window.addEventListener("focus", refresh);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", refresh);
            window.removeEventListener("focus", refresh);
        };
    }, [reload]);

    const selected = episodes.find((row) => row.id === selectedId) ?? null;
    const posted = episodes.filter((row) => row.is_published).length;

    /*
     * 予約している話。
     *
     * 出る順に並べる。近いものから見たい。
     */
    const scheduled = episodes
        .filter((row) => !row.is_published && row.publish_at)
        .sort((a, b) =>
            String(a.publish_at).localeCompare(String(b.publish_at)),
        );

    /**
     * 範囲でまとめて投稿する。
     *
     * 題名の無い話が 1 つでもあれば、何も投稿せずに止める。
     * 途中まで出して止まると、どこまで出たか分からなくなる。
     */
    async function bulkPost() {
        const from = Number(bulkFrom);
        const to = Number(bulkTo);

        if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) {
            setBulkError("範囲が正しくありません。");
            return;
        }

        const targets = episodes.filter(
            (row) =>
                row.ep_number >= from &&
                row.ep_number <= to &&
                !row.is_published,
        );

        if (targets.length === 0) {
            setBulkError("その範囲に、まだ投稿していない話がありません。");
            return;
        }

        /* 題名の無い話を先に洗う */
        const noTitle = targets.filter((row) => !row.title.trim());
        if (noTitle.length > 0) {
            setBulkError(
                `名前の無い話が${noTitle.length}話あります（${noTitle
                    .slice(0, 3)
                    .map((row) => `${row.ep_number}話目`)
                    .join("・")}${noTitle.length > 3 ? " ほか" : ""}）。` +
                    "先に名前を入れてください。",
            );
            return;
        }

        if (
            !window.confirm(
                `${targets.length}話をまとめて投稿します。\n` +
                    `（${from}話目〜${to}話目のうち、まだ投稿していない分）\n\n` +
                    "投稿すると読者に公開されます。",
            )
        ) {
            return;
        }

        setBulkError("");
        setBulkDoing(targets.length);

        try {
            const repository = getRepository();
            for (const row of targets) {
                await repository.updateEpisode(row.id, {
                    is_published: true,
                    publish_at: null,
                });
                setBulkDoing((left) => left - 1);
            }
            await reload();
            setIsBulkOpen(false);
            setBulkFrom("");
            setBulkTo("");
        } catch (caught) {
            setBulkError(
                caught instanceof Error
                    ? caught.message
                    : "投稿できませんでした。",
            );
        }
        setBulkDoing(0);
    }

    async function change(episodeId: string, patch: Partial<Episode>) {
        await getRepository().updateEpisode(episodeId, patch);
        await reload();
    }

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

    return (
        <div className="min-h-screen bg-canvas">
            <Header
                breadcrumbs={[
                    { label: "作品", href: "/works" },
                    { label: work.title || "名前のない作品" },
                    {
                        /* 話の名前で示す。番号は書き手の数え方と食い違う */
                        label: selected
                            ? `${selected.title || selected.ep_number + "話"}の投稿`
                            : "投稿",
                    },
                ]}
            />

            {/*
             * ほかの画面と同じ組み方にする。
             * 左の上にナビ、その下に中身。
             * 画面ごとに置き場所が違うと、移るたびに探すことになる。
             */}
            {/*
             * 狭い画面では縦に積む。
             * 横に並べると、どちらも読めない幅になる。
             */}
            <div className="flex flex-col gap-4 p-3 sm:p-4 lg:flex-row">
                <aside className="w-full shrink-0 lg:w-64">
                    <WorkspaceNav workId={workId} current="post" />

                    {/*
                     * 予約の一覧。
                     *
                     * 予約した話は、話の一覧の中に紛れて見つけにくい。
                     * いつ何が出るかを、まとめて上に出す。
                     */}
                    {scheduled.length > 0 && (
                        <div className="mt-4 rounded-lg border border-[var(--color-amber)] bg-[var(--color-amber-tint)]/40 px-4 py-3.5">
                            <p className="text-[12px] font-medium text-ink">
                                投稿の予約（{scheduled.length}件）
                            </p>

                            <ul className="mt-2 space-y-1.5">
                                {scheduled.map((row) => (
                                    <li key={row.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedId(row.id)}
                                            className="flex w-full items-baseline gap-2 text-left hover:text-forest"
                                        >
                                            <span className="shrink-0 text-[10px] tabular-nums text-muted">
                                                {formatAt(row.publish_at)}
                                            </span>
                                            <span className="min-w-0 truncate text-[11px] text-ink">
                                                {row.title || "無題"}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/*
                      * ★ 題名が無いと、作品は公開にならない。
                      *
                      *   話は投稿できるが、作品が下書きのまま残り、
                      *   誰にも読まれない。
                      *   投稿してから気づくと、その間ずっと届かない。
                      */}
                    {!work.title?.trim() && (
                        <div className="mt-4 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-tint)] px-4 py-3">
                            {/*
                              * ★ 「作品の」と書く。
                              *
                              *   前は「題名がありません」とだけ出していた。
                              *   この画面には話の題名を入れる欄がある。
                              *   そちらを埋めても消えないので、
                              *   「入れたのに、無いと言われる」と読まれていた。
                              *
                              * ★ 行き先を添える。
                              *   どこで付けるのかを書いても、
                              *   探しに行くのは別の手間になる。
                              */}
                            <p className="text-[13px] font-medium text-[var(--color-danger)]">
                                作品の題名がありません
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-ink">
                                この画面で入れるのは、話ごとの題名です。
                                作品そのものの題名は、まだ空のままです。
                                <br />
                                付けるまで、この作品は公開されません。
                                話を投稿しても、読者には出ません。
                            </p>
                            <Link
                                href={`/workspace/${workId}/settings`}
                                className="mt-2.5 inline-block rounded-md bg-[var(--color-danger)] px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
                            >
                                作品の設定へ
                            </Link>
                        </div>
                    )}

                    <div className="mt-4 rounded-lg border border-line bg-surface">
                        <div className="border-b border-line px-4 py-4">
                            <h1 className="truncate text-[15px] font-medium text-ink">
                                {work.title || "名前のない作品"}
                            </h1>
                            <p className="mt-1 text-xs text-muted">
                                {posted} / {episodes.length}話が投稿済み
                            </p>

                            {/*
                             * 読者から見た姿を確かめる。
                             * 出したあとで気づくより、先に見ておくほうがよい。
                             */}
                            <Link
                                href={`/workspace/${workId}/preview`}
                                className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-line py-2 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                            >
                                <EyeIcon />
                                読者から見る
                            </Link>

                            {/*
                             * 作品が公開されていないと、投稿しても読まれない。
                             * 押す前に気づけるようにする。
                             */}
                            {publish && publish.visibility !== "public" && (
                                <p className="mt-2.5 flex items-start gap-1.5 rounded bg-[var(--color-amber-tint)] px-2.5 py-2 text-[10px] leading-relaxed text-ink">
                                    <span className="text-[var(--color-amber)]">⚠</span>
                                    <span>
                                        この作品はまだ公開されていません。
                                        <Link
                                            href={`/workspace/${workId}/settings`}
                                            className="ml-0.5 underline"
                                        >
                                            公開設定を確認
                                        </Link>
                                    </span>
                                </p>
                            )}
                            {/*
                             * まとめて投稿。
                             *
                             * 話数の多い人のため。
                             * 範囲を指すので、出すつもりの無い話まで
                             * 巻き込まない。
                             */}
                            {episodes.some((row) => !row.is_published) && (
                                <div className="mt-3 border-t border-line pt-3">
                                    {!isBulkOpen ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsBulkOpen(true);
                                                setBulkError("");
                                            }}
                                            className="w-full rounded-md border border-forest-line px-3 py-2 text-[11px] text-forest hover:bg-forest-tint"
                                        >
                                            まとめて投稿する
                                        </button>
                                    ) : (
                                        <div>
                                            <p className="text-[11px] text-ink">
                                                何話目から何話目まで
                                            </p>

                                            <div className="mt-2 flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={bulkFrom}
                                                    onChange={(e) => setBulkFrom(e.target.value)}
                                                    placeholder="1"
                                                    className="w-16 rounded border border-line px-2 py-1 text-[12px] outline-none focus:border-forest"
                                                />
                                                <span className="text-[11px] text-muted">〜</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={bulkTo}
                                                    onChange={(e) => setBulkTo(e.target.value)}
                                                    placeholder={String(episodes.length)}
                                                    className="w-16 rounded border border-line px-2 py-1 text-[12px] outline-none focus:border-forest"
                                                />
                                                <span className="text-[11px] text-muted">話目</span>
                                            </div>

                                            <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
                                                この範囲のうち、まだ投稿していない話だけを出します。
                                                名前の無い話があるときは、何も投稿しません。
                                            </p>

                                            {bulkError && (
                                                <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--color-danger)]">
                                                    {bulkError}
                                                </p>
                                            )}

                                            <div className="mt-2 flex gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsBulkOpen(false);
                                                        setBulkError("");
                                                    }}
                                                    disabled={bulkDoing > 0}
                                                    className="rounded-md border border-line px-3 py-1.5 text-[11px] text-muted hover:text-ink disabled:opacity-40"
                                                >
                                                    やめる
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void bulkPost()}
                                                    disabled={bulkDoing > 0}
                                                    className="flex-1 rounded-md bg-forest py-1.5 text-[11px] font-medium text-white hover:bg-forest-dark disabled:opacity-40"
                                                >
                                                    {bulkDoing > 0
                                                        ? `投稿しています…（残り${bulkDoing}）`
                                                        : "この範囲を投稿する"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/*
                             * まとめて消す。
                             *
                             * 執筆画面と同じ形。
                             * ふだんは四角を出さず、押したときだけ選べる。
                             */}
                            {episodes.length > 0 && (
                                <div className="mt-2 border-t border-line pt-2">
                                    {!isPicking ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsPicking(true);
                                                setPicked([]);
                                            }}
                                            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-surface py-1.5 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                                        >
                                            <span aria-hidden="true">☑</span>
                                            話を選ぶ
                                        </button>
                                    ) : (
                                        <div className="rounded-md border border-line bg-canvas px-2.5 py-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] text-ink">
                                                    {picked.length > 0
                                                        ? `${picked.length}話を選んでいます`
                                                        : "消す話を選んでください"}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsPicking(false);
                                                        setPicked([]);
                                                    }}
                                                    className="shrink-0 text-[11px] text-faint hover:text-ink"
                                                >
                                                    やめる
                                                </button>
                                            </div>

                                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setPicked(
                                                            picked.length === episodes.length
                                                                ? []
                                                                : episodes.map((row) => row.id),
                                                        )
                                                    }
                                                    className="rounded border border-line px-2 py-0.5 text-[10px] text-muted hover:border-forest-line"
                                                >
                                                    {picked.length === episodes.length
                                                        ? "選択を外す"
                                                        : "すべて選ぶ"}
                                                </button>

                                            </div>

                                            {/* 選んだ話にできること */}
                                            {picked.length > 0 && (
                                                <div className="mt-2 border-t border-line pt-2">
                                                    <p className="text-[10px] text-faint">
                                                        選んだ{picked.length}話を
                                                    </p>

                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => void bulkSet(true)}
                                                            className="rounded-full border border-forest-line px-2.5 py-1 text-[10px] text-forest hover:bg-forest-tint"
                                                        >
                                                            投稿する
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void bulkSet(false)}
                                                            className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted hover:border-forest-line"
                                                        >
                                                            非公開にする
                                                        </button>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => void deletePicked()}
                                                        className="mt-2 w-full rounded bg-[var(--color-danger)] py-1.5 text-[10px] text-white hover:opacity-90"
                                                    >
                                                        {picked.length}話を消す
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/*
                         * 章ごとに束ねる。
                         * 話だけを並べると、どこの話か分からない。
                         */}
                        <div className="thin-scroll max-h-[calc(100vh-340px)] overflow-y-auto p-2">
                            {[
                                { id: null, label: "" },
                                ...chapters.map((chapter, index) => ({
                                    id: chapter.id,
                                    label: formatChapterLabel(chapter, index),
                                })),
                            ].map((group) => {
                                const own = episodes.filter(
                                    (row) => (row.chapter_id ?? null) === group.id,
                                );
                                if (own.length === 0) return null;

                                return (
                                    <div key={group.id ?? "loose"} className="mb-1">
                                        {group.label && (
                                            <p className="px-2 py-1.5 text-[11px] font-medium text-ink">
                                                {group.label}
                                            </p>
                                        )}

                                        <ul className={group.label ? "pl-1" : ""}>
                                            {own.map((episode) => (
                                                <li
                                                    key={episode.id}
                                                    className="flex items-center gap-1.5"
                                                >
                                                    {/* 選んでいる間だけ四角を出す */}
                                                    {isPicking && (
                                                        <button
                                                            type="button"
                                                            onClick={() => togglePicked(episode.id)}
                                                            aria-pressed={picked.includes(episode.id)}
                                                            className={[
                                                                "ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px]",
                                                                picked.includes(episode.id)
                                                                    ? "border-[var(--color-danger)] bg-[var(--color-danger)] text-white"
                                                                    : "border-line text-transparent hover:border-[var(--color-danger)]",
                                                            ].join(" ")}
                                                        >
                                                            ✓
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            isPicking
                                                                ? togglePicked(episode.id)
                                                                : setSelectedId(episode.id)
                                                        }
                                                        className={[
                                                            "block min-w-0 flex-1 rounded-md px-2.5 py-2 text-left",
                                                            episode.id === selectedId
                                                                ? "bg-forest-tint"
                                                                : "hover:bg-canvas",
                                                        ].join(" ")}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <span className="shrink-0 text-[11px] text-faint">
                                                                {/* 番号は出さない。題名で見分ける */}
                                                            </span>
                                                            <span
                                                                className={[
                                                                    "min-w-0 flex-1 truncate text-[12px]",
                                                                    episode.id ===
                                                                    selectedId
                                                                        ? "font-medium text-forest"
                                                                        : "text-ink",
                                                                ].join(" ")}
                                                            >
                                                                {episode.title ||
                                                                    "（題名なし）"}
                                                            </span>

                                                            <StateChip
                                                                episode={episode}
                                                            />
                                                        </span>

                                                        <span className="mt-0.5 block pl-11 text-[10px] text-faint">
                                                            {formatNumber(
                                                                episode.char_count,
                                                            )}
                                                            文字
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1">
                    {selected ? (
                        <PostForm
                            key={selected.id}
                            episode={selected}
                            chapters={chapters}
                            publish={publish}
                            onChange={(patch) => void change(selected.id, patch)}
                            onPosted={({ scheduled: didSchedule }) => {
                                /*
                                 * いま出したときは、書いていた所へ戻る。
                                 *
                                 * 出したあとは、たいてい続きを書くか
                                 * 直しに戻る。投稿の画面に留まっても
                                 * 次にすることが無い。
                                 */
                                if (!didSchedule) {
                                    router.push(
                                        `/workspace/${workId}?ep=${selected.id}`,
                                    );
                                    return;
                                }

                                /*
                                 * 予約したときは、この画面に留まる。
                                 *
                                 * ★ 何話も続けて予約する人がいる。
                                 *   他の場所から数十話を移してきたときなど。
                                 *   1 話ごとに戻されると、そのたびに
                                 *   この画面まで来直すことになる。
                                 *
                                 * ★ 次のまだ出していない話へ、選び先を進める。
                                 *   同じ話が開いたままだと、
                                 *   予約できたのかどうかが分かりにくい。
                                 */
                                const next = episodes.find(
                                    (row) =>
                                        row.ep_number > selected.ep_number &&
                                        !row.is_published &&
                                        !row.publish_at,
                                );

                                if (next) setSelectedId(next.id);
                                void reload();
                            }}
                            work={work}
                            /*
                             * 最後に予約した話の時刻。
                             * 次の予定を組み立てるのに使う。
                             */
                            lastScheduledAt={
                                scheduled.length > 0
                                    ? scheduled[scheduled.length - 1].publish_at ?? null
                                    : null
                            }
                            /*
                             * まだ 1 話も出していないか。
                             * 出す前だけ、作品の題名をここで直せるようにする。
                             */
                            canEditWorkTitle={posted === 0}
                            onChangeWorkInfo={(patch) =>
                                void (async () => {
                                    await getRepository().updateWork(workId, patch);
                                    await reload();
                                })()
                            }
                            onChangeSettings={(patch) =>
                                void (async () => {
                                    await getRepository().savePublishSettings(
                                        workId,
                                        patch,
                                    );
                                    await reload();
                                })()
                            }
                            onChangeWork={(visibility) =>
                                void (async () => {
                                    await getRepository().savePublishSettings(
                                        workId,
                                        { visibility },
                                    );
                                    await reload();
                                })()
                            }
                        />
                    ) : (
                        /*
                          * ★ 次にすることを書く。
                          *
                          *   前は「まだ話がありません。」だけだった。
                          *   投稿の画面に来た人は投稿しに来ているので、
                          *   押し具が無いと「投稿ボタンはどこか」と探す。
                          *   投稿する話がまだ無いことと、
                          *   どこで書くのかを、その場に書く。
                          */
                        <div className="rounded-lg border border-dashed border-line py-20 text-center">
                            <p className="text-sm text-faint">
                                投稿できる話がまだありません。
                            </p>
                            <p className="mx-auto mt-2 max-w-[22rem] text-xs leading-relaxed text-muted">
                                話を 1 つ書くと、ここに投稿の押し具が出ます。
                                書いた話は、この画面で 1 話ずつ投稿します。
                            </p>
                            <Link
                                href={`/workspace/${workId}`}
                                className="mt-4 inline-block rounded-md bg-forest-dark px-5 py-2 text-sm font-medium text-white hover:opacity-90"
                            >
                                執筆室で書く
                            </Link>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 選んだ話
 * ============================================================
 */

function PostForm({
    episode,
    chapters,
    publish,
    onChange,
    onChangeWork,
    onChangeSettings,
    onChangeWorkInfo,
    canEditWorkTitle = false,
    onPosted,
    work,
    lastScheduledAt,
}: {
    /** 最後に予約した話の時刻。次の予定を組み立てるのに使う */
    lastScheduledAt?: string | null;
    /**
     * 投稿し終えたとき。
     *
     * ★ 予約したのか、いま出したのかを渡す。
     *   いま出したときは書いていた所へ戻し、
     *   予約したときはこの画面に留まる。
     *   予約は何話も続けて入れる作業なので、
     *   1 話ごとに戻されると、そのたびに来直すことになる。
     */
    onPosted?: (info: { scheduled: boolean }) => void;
    episode: Episode;
    chapters: Chapter[];
    publish: PublishSettings | null;
    onChange: (patch: Partial<Episode>) => void;
    /** 作品の公開範囲を変える */
    onChangeWork?: (visibility: PublishSettings["visibility"]) => void;
    /** 作品の設定を変える */
    onChangeSettings?: (patch: Partial<PublishSettings>) => void;
    /** 作品そのものを変える */
    onChangeWorkInfo?: (patch: Partial<Work>) => void;
    /**
     * 作品の題名を、この画面で直せるか。
     *
     * ★ まだ 1 話も出していないときだけ。
     *
     *   出す前は、題名がまだ決まりきっていない。
     *   付いていないと公開にならないので、
     *   ここで気づいた人がその場で直せるほうがよい。
     *
     *   1 話でも出したあとは、読者が題名で覚えている。
     *   投稿のついでに書き換えられる場所ではない。
     *   そのときは設定から直す。
     */
    canEditWorkTitle?: boolean;
    work: Work;
}) {
    const [title, setTitle] = useState(episode.title);
    const [preface, setPreface] = useState(episode.preface ?? "");
    const [summary, setSummary] = useState(episode.episode_summary ?? "");
    const [afterword, setAfterword] = useState(episode.afterword ?? "");
    const [chapterId, setChapterId] = useState(episode.chapter_id ?? "");

    /*
     * 話ごとの挿絵。
     *
     * ★ 作品の表紙とは別のもの。
     *   表紙は 1 作品に 1 枚、挿絵は話ごとに 1 枚。
     *
     * 読む画面で、本文の前に出る。
     */
    /*
     * ★ 古い列を、そのまま持ち回すだけ。
     *
     *   挿絵は episode_illusts の表へ移した。
     *   ここで書き換えることはもう無いが、
     *   保存のたびに null で上書きしないよう、読んだ値を持っておく。
     *   古い画面が残っているあいだの備え。
     */
    const [illustUrl] = useState(episode.illust_url ?? "");
    const [illustIsAi] = useState(episode.illust_is_ai ?? false);

    const [at, setAt] = useState(toLocalInput(episode.publish_at));
    const [error, setError] = useState("");

    /* 詳細設定を開いているか。畳んで置く */
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    /* 作品の題名。出す前だけ、ここで直せる */
    const [workTitle, setWorkTitle] = useState(work.title ?? "");

    useEffect(() => {
        setWorkTitle(work.title ?? "");
    }, [work.title]);

    /*
     * この話に置いてある挿絵の枚数。
     *
     * ★ 数えるのは、伝えるためだけ。
     *
     *   挿絵は episode_illusts の表にあり、
     *   執筆室で置いた時点でもう頁に出ている。
     *   なのにこの画面は「変更はありません」と出るので、
     *   出せていないと思われていた。
     *
     *   何枚出ているかを見せて、済んでいることを伝える。
     */
    const [illustCount, setIllustCount] = useState<number | null>(null);

    useEffect(() => {
        let alive = true;

        void (async () => {
            try {
                const rows = await getRepository().listEpisodeIllusts(episode.id);
                if (alive) setIllustCount(rows.length);
            } catch {
                /* 数えられなくても、投稿はできる */
                if (alive) setIllustCount(null);
            }
        })();

        return () => {
            alive = false;
        };
    }, [episode.id]);

    const isScheduled = Boolean(episode.publish_at) && !episode.is_published;

    /*
     * 書き換えたところがあるか。
     *
     * 投稿済みの話を直したときは、
     * 「投稿する」ではなく「変更を保存する」を出す。
     * すでに出ているものを、もう一度出すわけではないため。
     */
    const isDirty =
        title !== episode.title ||
        /* 予約の日時も、書き換えたうちに入れる */
        at !== toLocalInput(episode.publish_at) ||
        illustUrl !== (episode.illust_url ?? "") ||
        illustIsAi !== (episode.illust_is_ai ?? false) ||
        preface !== (episode.preface ?? "") ||
        summary !== (episode.episode_summary ?? "") ||
        afterword !== (episode.afterword ?? "") ||
        chapterId !== (episode.chapter_id ?? "");

    /** 投稿の前に確かめること */
    const checks = [
        { label: "話タイトル入力済み", isDone: title.trim().length > 0 },
        { label: "公開範囲を確認", isDone: publish?.visibility === "public" },
        { label: "所属章を確認", isDone: Boolean(chapterId) },
        { label: "本文あり", isDone: episode.body.trim().length > 0 },
    ];

    const [notice, setNotice] = useState("");

    function save(patch: Partial<Episode>) {
        onChange(patch);
        setNotice("保存しました");
        window.setTimeout(() => setNotice(""), 2000);
    }

    function post() {
        if (!title.trim()) {
            setError("話のタイトルを入れてください。");
            return;
        }
        if (!episode.body.trim()) {
            setError("本文がありません。");
            return;
        }

        /* 先に書いたものを残す */
        save({
            title: title.trim(),
            preface: preface.trim() || null,
            episode_summary: summary.trim() || null,
            afterword: afterword.trim() || null,
            chapter_id: chapterId || null,
            /* 挿絵も一緒に保存する。別に押させると忘れられる */
            illust_url: illustUrl || null,
            illust_is_ai: illustIsAi,
        });

        /* 時刻が入っていれば予約 */
        if (at) {
            const target = new Date(at);
            if (Number.isNaN(target.getTime())) {
                setError("日時の形が正しくありません。");
                return;
            }
            if (target.getTime() < Date.now()) {
                setError("過ぎた時刻は選べません。");
                return;
            }

            setError("");
            onChange({
                is_published: false,
                publish_at: floorTo5Min(target).toISOString(),
            });
            onPosted?.({ scheduled: true });
            return;
        }

        setError("");
        /* 挿絵も一緒に保存する。別に押させると忘れられる */
        onChange({
            is_published: true,
            publish_at: null,
            illust_url: illustUrl || null,
            illust_is_ai: illustIsAi,
        });
        onPosted?.({ scheduled: false });
    }

    return (
        <div>
            <h1 className="text-lg font-medium text-ink">
                この話を投稿
            </h1>
            <p className="mt-1 text-xs text-muted">
                公開内容を確認して、投稿します。
            </p>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
                {/* ---- 左：投稿する話 ---- */}
                <div className="space-y-4">
                    <Card title="投稿する話">
                        {/*
                          * 作品の題名。
                          *
                          * ★ 直せない字として出す。
                          *
                          *   すぐ下に「話タイトル」の欄がある。
                          *   どちらの題名を入れる所か分からず、
                          *   話の題名を入れて「作品の題名が無い」と
                          *   言われる人がいた。
                          *
                          *   どの作品の話を出そうとしているのかも、
                          *   ここで分かるようになる。
                          */}
                        {canEditWorkTitle ? (
                            <Field
                                label="作品の題名"
                                note="まだ出していないので、ここで直せます"
                            >
                                <input
                                    type="text"
                                    value={workTitle}
                                    maxLength={100}
                                    onChange={(e) => setWorkTitle(e.target.value)}
                                    /*
                                     * 離れたときに控える。
                                     * 一字ごとに送ると、表を叩きすぎる。
                                     */
                                    onBlur={() => {
                                        const next = workTitle.trim();
                                        if (next === (work.title ?? "").trim()) return;
                                        onChangeWorkInfo?.({ title: next });
                                    }}
                                    placeholder="例：白書の魔女"
                                    className={inputClass}
                                />
                            </Field>
                        ) : (
                            <p className="mb-3.5 rounded-md border border-line bg-canvas px-3 py-2">
                                <span className="block text-[10px] text-faint">
                                    作品の題名
                                </span>
                                <span
                                    className={[
                                        "mt-0.5 block truncate text-[13px]",
                                        work.title?.trim()
                                            ? "text-ink"
                                            : "text-[var(--color-danger)]",
                                    ].join(" ")}
                                >
                                    {work.title?.trim() || "まだ付いていません"}
                                </span>
                            </p>
                        )}

                        <Field label="話タイトル" count={`${title.length} / 100`}>
                            <input
                                type="text"
                                value={title}
                                maxLength={100}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="例：第1話　月夜に光る"
                                className={inputClass}
                            />

                        </Field>

                        <Field label="所属章">
                            <select
                                value={chapterId}
                                onChange={(e) => setChapterId(e.target.value)}
                                className={inputClass}
                            >
                                <option value="">章に入れない</option>
                                {chapters.map((chapter, index) => (
                                    <option key={chapter.id} value={chapter.id}>
                                        {formatChapterLabel(chapter, index)}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        {/*
                          * 話ごとの挿絵。
                          *
                          * ★ 作品の表紙とは別のもの。
                          *   表紙は 1 作品に 1 枚、挿絵は話ごとに 1 枚。
                          *
                          * 読む画面で、本文の前に出る。
                          */}
                        {/*
                          * 話の中の挿絵。
                          *
                          * ★ 1 話に何枚でも、好きな場所へ置ける。
                          *   置き場所の選び方も含めて、別の部品にまとめてある。
                          */}
                        <Field label="挿絵（この話だけ）">
                            <EpisodeIllustManager
                                novelId={work.id}
                                episodeId={episode.id}
                                body={episode.body ?? ""}
                                /*
                                 * ★ 本文へ移る前に、書きかけの設定を保存する。
                                 *
                                 *   予約の日時などは、押すまで表にも入っていない。
                                 *   置き場所を選びに行って戻ると、
                                 *   入れたはずの予約が消えていた。
                                 */
                                onBeforeLeave={() => {
                                    const patch: Record<string, unknown> = {
                                        title,
                                        preface: preface || null,
                                        episode_summary: summary || null,
                                        afterword: afterword || null,
                                        chapter_id: chapterId || null,
                                    };

                                    /* 予約の日時が入っていて、まだ入れていなければ控える */
                                    if (at) {
                                        const target = new Date(at);
                                        if (!Number.isNaN(target.getTime()) && target.getTime() > Date.now()) {
                                            patch.is_published = false;
                                            patch.publish_at = floorTo5Min(target).toISOString();
                                        }
                                    }

                                    onChange(patch);
                                }}
                            />

                            <div className="mt-3 rounded-lg border border-[var(--color-amber)] bg-[color-mix(in_srgb,var(--color-amber)_6%,transparent)] px-3.5 py-3">
                                <p className="text-[11.5px] font-bold text-ink">
                                    ほかの人の絵を無断で使うことはできません。
                                </p>
                                <p className="mt-1.5 text-[11px] leading-[1.9] text-muted">
                                    自分で描いた絵、権利者から許可を得た絵、
                                    または自分で AI に作らせた絵だけを置いてください。
                                    <br />
                                    違反が見つかった場合は、画像の削除や作品の非公開などの
                                    対応をとることがあります。
                                </p>
                            </div>
                        </Field>

                        <Field label="冒頭プレビュー文（任意）">
                            <input
                                type="text"
                                value={preface}
                                maxLength={120}
                                onChange={(e) => setPreface(e.target.value)}
                                placeholder="一覧に出る、最初のひとこと"
                                className={inputClass}
                            />
                        </Field>

                        <Field
                            label="この話のあらすじ（任意）"
                            count={`${summary.length} / 400`}
                        >
                            <textarea
                                value={summary}
                                rows={3}
                                maxLength={400}
                                onChange={(e) => setSummary(e.target.value)}
                                className={inputClass}
                            />
                        </Field>

                        {/* 本文。ここでは直せない */}
                        <div className="rounded-md border border-line bg-surface px-4 py-3">
                            <p className="text-[11px] text-muted">
                                本文　{formatNumber(episode.char_count)}字
                                {episode.body.trim() ? "・本文あり" : "・本文なし"}
                            </p>

                            <p className="thin-scroll mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-ink">
                                {episode.body || "（まだ何も書かれていません）"}
                            </p>

                            <Link
                                href={`/workspace/${episode.work_id}`}
                                className="mt-2 inline-flex items-center gap-1 rounded border border-line bg-surface px-3 py-1.5 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                            >
                                執筆画面で編集
                            </Link>
                        </div>

                        {/*
                          * 後書き。
                          *
                          * ★ 本文のすぐ下に置く。
                          *   本文のあとに出る言葉なので、順として自然。
                          *
                          * ★ 作品の形はここから外し、詳細設定へ移した。
                          *   ジャンル・タグ・年齢と同じ「作品そのもの」の話で、
                          *   話ごとの欄に混ざっていると
                          *   どちらを直しているのか分からなくなる。
                          */}
                        <div className="mt-4">
                            <Field label="後書き（任意）">
                                <textarea
                                    value={afterword}
                                    rows={4}
                                    onChange={(e) => setAfterword(e.target.value)}
                                    placeholder="本文のあとに出る言葉"
                                    className={inputClass}
                                />
                            </Field>

                        </div>
                    </Card>

                </div>

                {/* ---- 右：公開設定とプレビュー ---- */}
                <div className="space-y-4">
                    <Card title="公開設定">
                        {/*
                         * 作品の公開状態も、ここで見えるようにする。
                         * 話を出す直前に確かめたいのは、まずこれ。
                         */}
                        <p className="mb-2 text-xs font-medium text-ink">公開状態</p>

                        <div className="mb-4 space-y-1.5">
                            {(
                                [
                                    {
                                        value: "draft",
                                        label: "下書き",
                                        note: "自分のみ閲覧できます。",
                                    },
                                    {
                                        value: "limited",
                                        label: "限定公開",
                                        note: "URLを知っている人だけが閲覧できます。",
                                    },
                                    {
                                        value: "public",
                                        label: "公開",
                                        note: "すべての人に公開されます。",
                                    },
                                ] as const
                            ).map((row) => (
                                <label
                                    key={row.value}
                                    className={[
                                        "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5",
                                        publish?.visibility === row.value
                                            ? "border-forest bg-forest-tint/50"
                                            : "border-line hover:bg-canvas",
                                    ].join(" ")}
                                >
                                    <input
                                        type="radio"
                                        name="work-visibility"
                                        checked={publish?.visibility === row.value}
                                        onChange={() => onChangeWork?.(row.value)}
                                        className="mt-0.5 accent-[var(--color-forest)]"
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-[13px] text-ink">
                                            {row.label}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                                            {row.note}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>

                        <Field label="予約公開（任意）">
                            <input
                                type="datetime-local"
                        /*
                         * 5 分刻み。
                         *
                         * 公開の見回りが 5 分ごとなので、
                         * 1 分単位で選べても、その間は待つことになる。
                         * 選べる時刻と実際に出る時刻を揃える。
                         */
                        step={300}
                                value={at}
                                onChange={(e) => setAt(e.target.value)}
                                className={inputClass}
                            />
                            <p className="mt-1 text-[10px] text-faint">
                                空のままなら、押した時点で投稿します。
                            </p>

                            {/*
                              * 次の予定を一押しで入れる。
                              *
                              * ★ 何十話もまとめて予約する人がいる。
                              *   1 話ごとに日と時刻を選び直すのは、
                              *   同じ手を何十回も繰り返すことになる。
                              *
                              * ★ 押すまで欄は空のまま。
                              *   初めから入れておくと、いま出したい人が
                              *   気付かず予約してしまう。
                              */}
                            <div className="mt-2 rounded-md border border-line bg-canvas px-2.5 py-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setAt(
                                            toLocalInput(
                                                nextSlot(
                                                    lastScheduledAt,
                                                    work.default_publish_time,
                                                    work.default_publish_days,
                                                ).toISOString(),
                                            ),
                                        )
                                    }
                                    className="text-[11px] text-forest hover:underline"
                                >
                                    次の予定を入れる（
                                    {formatAt(
                                        nextSlot(
                                            lastScheduledAt,
                                            work.default_publish_time,
                                            work.default_publish_days,
                                        ).toISOString(),
                                    )}
                                    ）
                                </button>

                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[10px] text-muted">
                                        いつも出す時刻
                                        <input
                                            type="time"
                                            step={300}
                                            value={work.default_publish_time ?? ""}
                                            onChange={(e) =>
                                                onChangeWorkInfo?.({
                                                    default_publish_time:
                                                        e.target.value || null,
                                                })
                                            }
                                            className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink"
                                        />
                                    </label>

                                    <label className="flex items-center gap-1.5 text-[10px] text-muted">
                                        何日ごと
                                        <input
                                            type="number"
                                            min={1}
                                            max={60}
                                            value={work.default_publish_days ?? 1}
                                            onChange={(e) =>
                                                onChangeWorkInfo?.({
                                                    default_publish_days:
                                                        Math.min(
                                                            60,
                                                            Math.max(
                                                                1,
                                                                Number(e.target.value) || 1,
                                                            ),
                                                        ),
                                                })
                                            }
                                            className="w-14 rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink"
                                        />
                                        日
                                    </label>
                                </div>

                                <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
                                    最後に予約した話の何日あとを、次の予定にするかです。
                                    この作品にだけ効きます。
                                </p>
                            </div>
                        </Field>

                        {isScheduled && (
                            <div className="rounded-md bg-[var(--color-amber-tint)] px-3 py-2.5">
                                <p className="text-[11px] text-ink">
                                    {formatAt(episode.publish_at)}に投稿されます。
                                </p>

                                {/*
                                 * 予約の取り消し。
                                 *
                                 * 日時を消して押し直す道もあるが、
                                 * 分かりにくい。ここに 1 つ置く。
                                 */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (
                                            !window.confirm(
                                                "予約を取り消します。この話は下書きに戻ります。",
                                            )
                                        ) {
                                            return;
                                        }
                                        setAt("");
                                        onChange({
                                            is_published: false,
                                            publish_at: null,
                                        });
                                    }}
                                    className="mt-2 text-[11px] text-[var(--color-danger)] hover:underline"
                                >
                                    予約を取り消す
                                </button>
                            </div>
                        )}

                        {error && (
                            <p className="mt-2 text-[11px] text-[var(--color-danger)]">
                                {error}
                            </p>
                        )}
                    </Card>

                    {/*
                      * 作品の設定。
                      *
                      * ★ 畳んで置く。
                      *
                      *   ジャンルも年齢も、毎回は触らない。
                      *   ひらいたまま並べると、話を出す手が
                      *   作品の設定に埋もれる。
                      *
                      *   ただ「いま何になっているか」は、
                      *   出す前に確かめたい。だから折り目の所に
                      *   いまの値を並べておく。開かなくても分かる。
                      *
                      * ★ ここで直したぶんは、その場で控える。
                      *   「保存」を押させない。押し忘れて出すと、
                      *   直したつもりのまま古い形で並ぶ。
                      */}
                    <Card title="作品の設定">
                        <p className="text-[11px] leading-relaxed text-muted">
                            {work.genre || "ジャンル未設定"}
                            {" ／ "}
                            {AGE_RATING_LABEL[work.age_rating] ?? "全年齢"}
                            {" ／ "}
                            {work.format
                                ? WORK_FORMAT_LABEL[work.format]
                                : "長編（未選択）"}
                            {" ／ "}
                            タグ {work.keywords?.length ?? 0} 個
                        </p>

                        <button
                            type="button"
                            onClick={() => setIsDetailOpen((open) => !open)}
                            aria-expanded={isDetailOpen}
                            className="mt-2.5 w-full rounded-md border border-line px-3 py-2 text-[12px] text-muted hover:border-forest-line hover:text-forest"
                        >
                            詳細設定{isDetailOpen ? "を閉じる" : "（ジャンル・タグ・年齢・形）"}
                        </button>

                        {isDetailOpen && (
                            <div className="mt-3 space-y-4 border-t border-line pt-3">
                                {/* 作品の形 */}
                                <div>
                                    <span className="text-xs font-medium text-ink">
                                        作品の形
                                    </span>
                                    <ul className="mt-1.5 space-y-1.5">
                                        {(
                                            Object.keys(WORK_FORMAT_LABEL) as WorkFormat[]
                                        ).map((key) => (
                                            <li key={key}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onChangeWorkInfo?.({ format: key })
                                                    }
                                                    aria-pressed={work.format === key}
                                                    className={[
                                                        "w-full rounded-md border px-3 py-2 text-left",
                                                        work.format === key
                                                            ? "border-forest bg-forest-tint/50"
                                                            : "border-line hover:border-forest-line",
                                                    ].join(" ")}
                                                >
                                                    <span className="block text-[12px] text-ink">
                                                        {WORK_FORMAT_LABEL[key]}
                                                    </span>
                                                    <span className="mt-0.5 block text-[10px] text-faint">
                                                        {WORK_FORMAT_DESCRIPTION[key]}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* 年齢の区分 */}
                                <div>
                                    <span className="text-xs font-medium text-ink">
                                        年齢の区分
                                    </span>
                                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                                        {(
                                            Object.keys(AGE_RATING_LABEL) as AgeRating[]
                                        ).map((key) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => {
                                                    /*
                                                     * ★ R18 を外したら、R18 だけのジャンルも外す。
                                                     *
                                                     *   残したまま全年齢の棚に並ぶと、
                                                     *   探している人にも探していない人にも
                                                     *   意図と違う出方をする。
                                                     *
                                                     *   こちらで別のジャンルへ移し替えはしない。
                                                     *   どこへ入れるかは書いた人が決めるもの。
                                                     */
                                                    const dropGenre =
                                                        key !== "r18" &&
                                                        GENRES_R18_ONLY.includes(
                                                            work.genre || "",
                                                        );

                                                    onChangeWorkInfo?.({
                                                        age_rating: key,
                                                        ...(dropGenre ? { genre: "" } : {}),
                                                    });
                                                }}
                                                aria-pressed={work.age_rating === key}
                                                className={[
                                                    "rounded-md border px-2 py-2 text-center",
                                                    work.age_rating === key
                                                        ? "border-forest bg-forest-tint/50"
                                                        : "border-line hover:border-forest-line",
                                                ].join(" ")}
                                            >
                                                <span className="block text-[12px] text-ink">
                                                    {AGE_RATING_LABEL[key]}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
                                        {AGE_RATING_DESCRIPTION[work.age_rating] ??
                                            AGE_RATING_DESCRIPTION.all}
                                    </p>
                                </div>

                                {/* ジャンル */}
                                <div>
                                    <span className="text-xs font-medium text-ink">
                                        ジャンル
                                    </span>
                                    <select
                                        value={work.genre || ""}
                                        onChange={(e) =>
                                            onChangeWorkInfo?.({ genre: e.target.value })
                                        }
                                        className={`mt-1.5 ${inputClass}`}
                                    >
                                        <option value="">選んでください</option>
                                        {selectableGenres(work.age_rating).map((one) => (
                                            <option key={one} value={one}>
                                                {one}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
                                        BL・GL は、どの年齢の区分でも選べます。
                                        BL R18・GL R18・官能 R18 は、
                                        年齢の区分を R18 にすると出ます。
                                    </p>
                                </div>

                                {/* タグ */}
                                <div>
                                    <span className="text-xs font-medium text-ink">
                                        タグ
                                    </span>
                                    <div className="mt-1.5">
                                        <TagInput
                                            id="post-tags"
                                            tags={work.keywords ?? []}
                                            onChange={(tags) =>
                                                onChangeWorkInfo?.({ keywords: tags })
                                            }
                                        />
                                    </div>
                                    <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
                                        候補から選ぶほか、打ち込んで作れます（入力して Enter）。
                                    </p>
                                </div>

                                <p className="text-[10px] leading-relaxed text-faint">
                                    ここで直したものは、その場で控わります。
                                    あらすじや表紙は、作品の設定から直せます。
                                </p>
                            </div>
                        )}
                    </Card>

                    <Card title="読者とのやり取り">
                        {/*
                         * 作品ごとの設定だが、投稿の直前に確かめたい。
                         * ここでも変えられるようにする。
                         */}
                        <div className="space-y-2.5">
                            <ToggleLine
                                label="コメントを受け付ける"
                                checked={publish?.allow_comments ?? true}
                                onChange={(next) =>
                                    onChangeSettings?.({ allow_comments: next })
                                }
                            />
                            <ToggleLine
                                label="いいねを受け付ける"
                                checked={publish?.allow_likes ?? true}
                                onChange={(next) =>
                                    onChangeSettings?.({ allow_likes: next })
                                }
                            />

                            {publish?.allow_comments !== false && (
                                <label className="flex items-center gap-2">
                                    <span className="min-w-0 flex-1 text-[11px] text-ink">
                                        コメントの公開方法
                                    </span>
                                    <select
                                        value={
                                            publish?.moderate_comments
                                                ? "moderate"
                                                : "open"
                                        }
                                        onChange={(e) =>
                                            onChangeSettings?.({
                                                moderate_comments:
                                                    e.target.value === "moderate",
                                            })
                                        }
                                        className="shrink-0 rounded border border-line bg-surface px-2 py-1 text-[11px] outline-none focus:border-forest"
                                    >
                                        <option value="open">すべて公開</option>
                                        <option value="moderate">承認後に公開</option>
                                    </select>
                                </label>
                            )}
                        </div>
                    </Card>

                    {/*
                     * AI の使い方。
                     * 出す直前に確かめられるようにする。
                     */}
                    <Card title="AIの使用">
                        <ul className="space-y-1.5">
                            {(Object.keys(AI_USAGE_LABEL) as AiUsage[]).map((key) => (
                                <li key={key}>
                                    <button
                                        type="button"
                                        onClick={() => onChangeWorkInfo?.({ ai_usage: key })}
                                        aria-pressed={(work.ai_usage ?? "none") === key}
                                        className={[
                                            "w-full rounded-md border px-3 py-2 text-left",
                                            (work.ai_usage ?? "none") === key
                                                ? "border-forest bg-forest-tint/50"
                                                : "border-line hover:border-forest-line",
                                        ].join(" ")}
                                    >
                                        <span className="block text-[12px] text-ink">
                                            {AI_USAGE_LABEL[key]}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Card>

                    <Card title="投稿前の確認">
                        <ul className="space-y-1.5">
                            {checks.map((check) => (
                                <li
                                    key={check.label}
                                    className="flex items-center gap-2 text-[11px]"
                                >
                                    <CheckMark isDone={check.isDone} />
                                    <span
                                        className={
                                            check.isDone ? "text-ink" : "text-faint"
                                        }
                                    >
                                        {check.label}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            </div>

            {/*
              * 投稿済みの話に出す知らせ。
              *
              * ★ 挿絵を足しただけの人が、ここで止まっていた。
              *
              *   挿絵は episode_illusts の表にあり、
              *   執筆室で置いた時点でもう頁に出ている。
              *   なのに押し具は「変更はありません」と出るので、
              *   出せていないと読まれていた。
              *
              * ★ 小さな字で添えるのではなく、箱にして押し具の上に置く。
              *   押し具を見る前に、目に入る所でなければ意味がない。
              */}
            {episode.is_published && (
                <div className="mt-5 rounded-lg border border-forest-line bg-forest-tint px-4 py-3">
                    <p className="text-[13px] font-medium text-ink">
                        この話は、もう読者に出ています
                    </p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                        本文と挿絵
                        {illustCount !== null && illustCount > 0
                            ? `（${illustCount}枚）`
                            : ""}
                        は、執筆室で保存した時点で読めるようになっています。
                        投稿し直す必要はありません。
                    </p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                        下の「変更を保存する」で控えるのは、この画面で直したもの
                        （題名・前書き・あとがき・所属章）だけです。
                    </p>
                </div>
            )}

            {/* 下の操作 */}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                {notice && <span className="text-xs text-forest">{notice}</span>}

                {/*
                 * まだ投稿していない話でも、書き換えたなら残せる。
                 * 投稿せずに下書きだけ整えることがある。
                 */}
                {!episode.is_published && isDirty && (
                    <button
                        type="button"
                        onClick={() =>
                            save({
                                title: title.trim(),
                                preface: preface.trim() || null,
                                episode_summary: summary.trim() || null,
                                afterword: afterword.trim() || null,
                                chapter_id: chapterId || null,
                                /* 挿絵も一緒に保存する */
                                illust_url: illustUrl || null,
                                illust_is_ai: illustIsAi,
                            })
                        }
                        className="rounded-md border border-line px-5 py-2.5 text-sm text-ink hover:border-forest-line hover:text-forest"
                    >
                        変更を保存する
                    </button>
                )}

                {episode.is_published || isScheduled ? (
                    <button
                        type="button"
                        onClick={() =>
                            onChange({ is_published: false, publish_at: null })
                        }
                        className="rounded-md border border-line px-5 py-2.5 text-sm text-muted hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                    >
                        非公開にする
                    </button>
                ) : null}

                {episode.is_published ? (
                    <button
                        type="button"
                        onClick={() =>
                            save({
                                title: title.trim(),
                                preface: preface.trim() || null,
                                episode_summary: summary.trim() || null,
                                afterword: afterword.trim() || null,
                                chapter_id: chapterId || null,
                                /* 挿絵も一緒に保存する */
                                illust_url: illustUrl || null,
                                illust_is_ai: illustIsAi,
                            })
                        }
                        disabled={!isDirty}
                        className="rounded-md bg-forest-dark px-7 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                    >
                        {isDirty ? "変更を保存する" : "変更はありません"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={post}
                        className="flex items-center gap-2 rounded-md bg-forest-dark px-7 py-2.5 text-sm font-medium text-white hover:opacity-90"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/icons/send-white.png"
                            alt=""
                            width={18}
                            height={15}
                        />
                        {isScheduled ? "予約を変える" : "この話を投稿する"}
                    </button>
                )}
            </div>

        </div>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-lg border border-line bg-surface px-5 py-4">
            <h2 className="mb-3 text-[13px] font-medium text-ink">{title}</h2>
            {children}
        </section>
    );
}

function CheckMark({ isDone }: { isDone: boolean }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
        >
            <circle
                cx="12"
                cy="12"
                r="10"
                fill={isDone ? "var(--color-forest)" : "var(--color-line)"}
            />
            <path
                d="m7.5 12.5 3 3 6-6.5"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

function StateChip({ episode }: { episode: Episode }) {
    const isScheduled = Boolean(episode.publish_at) && !episode.is_published;

    return (
        <span
            className={[
                "shrink-0 rounded px-2 py-0.5 text-[10px]",
                episode.is_published
                    ? "bg-forest-tint text-forest"
                    : isScheduled
                      ? "bg-[var(--color-amber-tint)] text-[var(--color-amber)]"
                      : "bg-canvas text-faint",
            ].join(" ")}
        >
            {episode.is_published
                ? "投稿済み"
                : isScheduled
                  ? `予約 ${formatAt(episode.publish_at)}`
                  : "未投稿"}
        </span>
    );
}

function Field({
    label,
    note,
    count,
    children,
}: {
    label: string;
    note?: string;
    /** 文字数。右下に小さく出す */
    count?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="mb-3.5 block last:mb-0">
            <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-medium text-ink">{label}</span>
                {note && <span className="text-[11px] text-faint">{note}</span>}
            </span>

            <span className="mt-1.5 block">{children}</span>

            {count && (
                <span className="mt-0.5 block text-right text-[10px] text-faint">
                    {count}
                </span>
            )}
        </label>
    );
}

const inputClass =
    "w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-forest";

function formatAt(iso: string | null | undefined): string {
    if (!iso) return "";
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${at.getMonth() + 1}/${at.getDate()} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function EyeIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

/** 入切の一行 */
function ToggleLine({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2">
            <span className="min-w-0 flex-1 text-[11px] text-ink">{label}</span>

            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={[
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    checked ? "bg-forest" : "bg-line",
                ].join(" ")}
            >
                <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                    style={{ left: checked ? 18 : 2 }}
                />
            </button>
        </label>
    );
}

/**
 * 次の予定の時刻を組み立てる。
 *
 * ★ 入力欄に初めから入れておくことはしない。
 *
 *   入れておくと、いま出したいだけの人が
 *   「この話を投稿する」を押したときに、
 *   気付かないまま予約になってしまう。
 *   押したときだけ入る形にする。
 *
 * ★ 組み立て方
 *
 *   最後に予約した話がある   その◯日あと
 *   まだ 1 つも無い          明日
 *
 *   どちらも、決めた時刻に合わせる。
 *   出来た時刻が過ぎていれば、先へ進める。
 */
function nextSlot(
    lastScheduledAt: string | null | undefined,
    time: string | null | undefined,
    days: number | null | undefined,
): Date {
    const step = Math.min(60, Math.max(1, Number(days) || 1));

    const base = lastScheduledAt ? new Date(lastScheduledAt) : null;
    const at =
        base && !Number.isNaN(base.getTime())
            ? new Date(base.getTime())
            : new Date();

    at.setDate(at.getDate() + (base ? step : 1));

    /* 決めた時刻に合わせる。決めていなければ、その時刻のまま */
    const parts = (time || "").split(":");
    if (parts.length === 2) {
        at.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
    }

    /* 出来た時刻が過ぎていたら、先へ進める */
    while (at.getTime() <= Date.now()) {
        at.setDate(at.getDate() + step);
    }

    return at;
}

/**
 * 保存された時刻を、日時の入力欄に入る形にする。
 *
 * 表には世界標準時で入っている（…T04:27:00Z）。
 * これをそのまま切り出すと、日本時間の欄に 04:27 と出て、
 * 13:27 に予約したはずが 9 時間ずれて見える。
 *
 * 端末の時刻に直してから組み立てる。
 */
function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return "";
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/**
 * 時刻を 5 分単位に丸める。
 *
 * 見回りは 1 分ごと。
 * 選んだ分のとおりに出る。
 */
function floorTo5Min(date: Date): Date {
    /*
     * 秒だけ落とす。
     *
     * 見回りが 1 分ごとになったので、分を丸める必要がなくなった。
     *
     * 丸めていた頃は、12:03 を選ぶと 12:00 になっていた。
     * すでに過ぎた時刻なので、次の見回りで即座に出てしまう。
     * 「3 分後に出すつもりが、すぐ出た」の元。
     */
    const at = new Date(date);
    at.setSeconds(0, 0);
    return at;
}
