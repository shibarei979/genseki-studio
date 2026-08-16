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

import Header from "@/components/layout/header";
import WorkspaceNav from "@/components/workspace/workspace-nav";
import { getRepository } from "@/lib/repository";
import { formatNumber } from "@/lib/utils/text";
import type {
    AiUsage,
    Chapter,
    Episode,
    PublishSettings,
    Work,
    WorkFormat,
} from "@/types";
import {
    AI_USAGE_LABEL,
    WORK_FORMAT_DESCRIPTION,
    WORK_FORMAT_LABEL,
    formatChapterLabel,
} from "@/types";

export default function WorkPostClient({ workId }: { workId: string }) {
    const router = useRouter();
    const [work, setWork] = useState<Work | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [publish, setPublish] = useState<PublishSettings | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
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

    const selected = episodes.find((row) => row.id === selectedId) ?? null;
    const posted = episodes.filter((row) => row.is_published).length;

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
                        label: selected
                            ? `第${selected.ep_number}話の投稿`
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
                                                <li key={episode.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedId(episode.id)
                                                        }
                                                        className={[
                                                            "block w-full rounded-md px-2.5 py-2 text-left",
                                                            episode.id === selectedId
                                                                ? "bg-forest-tint"
                                                                : "hover:bg-canvas",
                                                        ].join(" ")}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <span className="shrink-0 text-[11px] text-faint">
                                                                第{episode.ep_number}話
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
                            onPosted={() => {
                                /*
                                 * 投稿したら、書いていた所へ戻る。
                                 *
                                 * 出したあとは、たいてい続きを書くか
                                 * 直しに戻る。投稿の画面に留まっても
                                 * 次にすることが無い。
                                 */
                                router.push(
                                    `/workspace/${workId}?ep=${selected.id}`,
                                );
                            }}
                            work={work}
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
                        <p className="rounded-lg border border-dashed border-line py-24 text-center text-sm text-faint">
                            まだ話がありません。
                        </p>
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
    onPosted,
    work,
}: {
    /** 投稿し終えたとき。書いていた所へ戻すのに使う */
    onPosted?: () => void;
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
    work: Work;
}) {
    const [title, setTitle] = useState(episode.title);
    const [preface, setPreface] = useState(episode.preface ?? "");
    const [summary, setSummary] = useState(episode.episode_summary ?? "");
    const [afterword, setAfterword] = useState(episode.afterword ?? "");
    const [chapterId, setChapterId] = useState(episode.chapter_id ?? "");

    const [at, setAt] = useState(toLocalInput(episode.publish_at));
    const [error, setError] = useState("");

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
            onPosted?.();
            return;
        }

        setError("");
        onChange({ is_published: true, publish_at: null });
        onPosted?.();
    }

    return (
        <div>
            <h1 className="text-lg font-medium text-ink">
                第{episode.ep_number}話を投稿
            </h1>
            <p className="mt-1 text-xs text-muted">
                公開内容を確認して、この話を投稿します。
            </p>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
                {/* ---- 左：投稿する話 ---- */}
                <div className="space-y-4">
                    <Card title="投稿する話">
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

                        <Field label="後書き（任意）">
                            <textarea
                                value={afterword}
                                rows={2}
                                onChange={(e) => setAfterword(e.target.value)}
                                placeholder="本文のあとに出る言葉"
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
                        </Field>

                        {isScheduled && (
                            <p className="rounded-md bg-[var(--color-amber-tint)] px-3 py-2 text-[11px] text-ink">
                                {formatAt(episode.publish_at)}に投稿されます。
                            </p>
                        )}

                        {error && (
                            <p className="mt-2 text-[11px] text-[var(--color-danger)]">
                                {error}
                            </p>
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
                     * 作品の形。
                     *
                     * 基本情報にもあるが、出す直前にここでも直せるようにする。
                     * 出してから「長編になっている」と気づいても遅い。
                     */}
                    <Card title="作品の形">
                        <ul className="space-y-1.5">
                            {(Object.keys(WORK_FORMAT_LABEL) as WorkFormat[]).map(
                                (key) => (
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
                                ),
                            )}
                        </ul>

                        {!work.format && (
                            <p className="mt-2 text-[10px] leading-relaxed text-amber">
                                まだ選ばれていません。
                                選ばないと「長編」として扱われます。
                            </p>
                        )}
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
 * 公開の見回りが 5 分ごとなので、7 分や 13 分を選べても
 * 実際に出るのは次の見回りのとき。
 * 選んだ時刻と出る時刻を合わせるため、切り捨てて揃える。
 * （切り上げにすると、選んだ時刻より後になって驚く）
 */
function floorTo5Min(date: Date): Date {
    const at = new Date(date);
    at.setMinutes(Math.floor(at.getMinutes() / 5) * 5, 0, 0);
    return at;
}
