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
import { useCallback, useEffect, useRef, useState } from "react";
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
    /* いま何話ぶん処理しているか。押し具に出す */
    const [bulkDoing, setBulkDoing] = useState(0);

    /*
     * 出せない話。
     *
     * ★ 名前の無い話があったら、1 話も出さない。
     *
     *   前は窓で「名前の無い話が3話あります」と言うだけだった。
     *   どれのことか分からず、探しに行くことになる。
     *
     *   その話を赤くして、そこまで画面を送る。
     *   直す場所まで連れていく。
     */
    const [blocked, setBlocked] = useState<string[]>([]);

    /* 何が起きたかの知らせ。窓は使わない */
    const [bulkNote, setBulkNote] = useState("");

    /* 押す前の、最後の確かめ */
    const [asking, setAsking] = useState<null | { publish: boolean; count: number }>(null);

    /*
     * まとめて消す。
     *
     * 執筆画面と同じ形。投稿の一覧を見ながら
     * 「これは要らない」と気づくことが多い。
     */
    const [isPicking, setIsPicking] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);

    /*
     * 最後に押した話。
     *
     * Shift を押しながら次を押したとき、
     * ここから先までをまとめて選ぶ。
     */
    const lastPickedRef = useRef<string | null>(null);

    /**
     * 話を選ぶ／外す。
     *
     * ★ Shift を押しながらだと、前に押した話からここまで。
     *
     *   30 話を選ぶのに 30 回押させない。
     *   一覧のある画面では、どこでもこの押し方ができる。
     *   知らない人は、ふつうに一つずつ押せばよい。
     *
     * ★ 範囲を選ぶときは、外さずに足すだけ。
     *   途中に選び済みのものが混ざっていても、
     *   まとめて外れると驚く。
     */
    function togglePicked(id: string, withShift = false) {
        const all = orderedIds();

        if (withShift && lastPickedRef.current) {
            const from = all.indexOf(lastPickedRef.current);
            const to = all.indexOf(id);

            if (from >= 0 && to >= 0) {
                const [head, tail] = from < to ? [from, to] : [to, from];
                const span = all.slice(head, tail + 1);

                setPicked((list) => Array.from(new Set([...list, ...span])));
                lastPickedRef.current = id;
                return;
            }
        }

        lastPickedRef.current = id;
        setPicked((list) =>
            list.includes(id) ? list.filter((at) => at !== id) : [...list, id],
        );
    }

    /**
     * 画面に並んでいる順の、話の id。
     *
     * ★ ep_number ではなく、見えている順で数える。
     *   章をまたいで選んだとき、画面で挟まれた話が
     *   選ばれるほうが、押した人の思ったとおりになる。
     */
    function orderedIds() {
        return [...episodes]
            .sort((a, b) => a.ep_number - b.ep_number)
            .map((row) => row.id);
    }

    /**
     * 選んだ話を、まとめて投稿する／非公開にする。
     *
     * 投稿するときは名前が要る。
     * 名前の無い話があれば、何もせずに知らせる。
     */
    /**
     * 出せるかどうかを、先に全部調べる。
     *
     * ★ 1 話でも出せなければ、1 話も出さない。
     *
     *   途中まで出てから止まると、
     *   出したものを非公開に戻す手間がかかる。
     *   出す前に分かるものは、出す前に言う。
     *
     * ★ 駄目な話を赤くして、そこまで連れていく。
     *   「3話あります」と言われても、探しに行くのが大変。
     */
    function checkBeforePost(): string[] {
        const targets = episodes.filter((row) => picked.includes(row.id));
        return targets.filter((row) => !row.title.trim()).map((row) => row.id);
    }

    /** その話まで画面を送る */
    function scrollToEpisode(id: string) {
        window.setTimeout(() => {
            const el = document.querySelector(`[data-ep-id="${id}"]`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60);
    }

    /**
     * 選んだ話を、まとめて投稿する／非公開にする。
     *
     * ★ 確かめの窓は使わない。
     *   画面から浮いた素っ気ない窓が出ると、
     *   そこだけ他所の作りに見える。
     *   投稿は嬉しい瞬間なので、なおさら。
     */
    function askBulk(publish: boolean) {
        if (picked.length === 0) return;

        setBulkNote("");

        if (publish) {
            const bad = checkBeforePost();

            if (bad.length > 0) {
                setBlocked(bad);
                setBulkNote(
                    `名前の無い話が${bad.length}話あります。` +
                        "赤くしてある話に、名前を入れてください。",
                );
                scrollToEpisode(bad[0]);
                return;
            }
        }

        setBlocked([]);
        setAsking({ publish, count: picked.length });
    }

    async function bulkSet(publish: boolean) {
        setAsking(null);

        const targets = episodes.filter((row) => picked.includes(row.id));
        if (targets.length === 0) return;

        /*
         * ★ 話の順に出す。
         *
         *   出した順が、そのまま「新着」の順になる。
         *   並べずに出すと、30話目が1話目より先に出て、
         *   読者の側で順番が入れ替わって見える。
         */
        const ordered = [...targets].sort((a, b) => a.ep_number - b.ep_number);

        /*
         * ★ 1 話でも失敗したら、そこで止まっていた。
         *
         *   途中まで出て、残りが出ない。
         *   どこまで出たかも分からない。
         *   失敗したものは覚えておいて、残りは続ける。
         */
        const failed: string[] = [];
        const repository = getRepository();

        setBulkDoing(ordered.length);

        for (const row of ordered) {
            try {
                await repository.updateEpisode(row.id, {
                    is_published: publish,
                    /*
                     * ★ 予約の時刻は両方とも消す。
                     *   非公開に戻したとき scheduled_at が残っていると、
                     *   その時刻は過ぎているので、すぐまた公開される。
                     */
                    publish_at: null,
                    scheduled_at: null,
                });
            } catch {
                failed.push(row.id);
            }
            setBulkDoing((left) => left - 1);
        }

        setBulkDoing(0);
        await reload();

        if (failed.length > 0) {
            const numbers = ordered
                .filter((row) => failed.includes(row.id))
                .map((row) => `${row.ep_number}話目`);

            setBlocked(failed);
            setPicked(failed);
            setBulkNote(
                `${ordered.length - failed.length}話を${publish ? "投稿" : "非公開に"}しました。` +
                    `${failed.length}話はできませんでした（` +
                    numbers.slice(0, 5).join("・") +
                    (numbers.length > 5 ? " ほか" : "") +
                    "）。赤くしてある話を、もう一度お試しください。",
            );
            scrollToEpisode(failed[0]);
            return;
        }

        setBlocked([]);
        setPicked([]);
        setIsPicking(false);
        setBulkNote(
            `${ordered.length}話を${publish ? "投稿しました" : "非公開にしました"}。`,
        );
        window.setTimeout(() => setBulkNote(""), 4000);
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

    /*
     * 予約したことの知らせ。
     *
     * ★ 親が持つ。
     *
     *   投稿の側に置くと、次の話へ進んだ時点で
     *   その部品ごと作り直され、知らせも消える。
     *   何が起きたのか分からないまま画面が変わる。
     */
    /*
     * 自動で進んできた話。
     *
     * ★ この話でだけ、いま出す前に一度聞く。
     *
     *   予約したあと画面が次の話へ移る。
     *   移った先は日時の欄が空なので、押し具の名前も
     *   「この話を投稿する」に変わっている。
     *   それでも流れで押す人はいて、実際に
     *   出すつもりのなかった話が公開された。
     *
     * ★ 自分で話を選んだときは聞かない。
     *   その人は自分の意思でその話を開いている。
     */
    const [autoMovedId, setAutoMovedId] = useState<string | null>(null);

    const [postNotice, setPostNotice] = useState<{
        text: string;
        /** 次のまだ出していない話。あれば「次の話へ」を出す */
        nextId: string | null;
        nextLabel: string;
    } | null>(null);

    useEffect(() => {
        if (!postNotice) return;
        /*
         * 消すまでの間を長めに取る。
         * 「次の話へ」を押すかどうかを、読んで決める時間が要る。
         */
        const timer = window.setTimeout(() => setPostNotice(null), 12000);
        return () => window.clearTimeout(timer);
    }, [postNotice]);

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
    /*
     * 予約の一覧。
     *
     * ★ 時刻は 2 つの列にある。両方を見る。
     *
     *   publish_at    この画面が書く
     *   scheduled_at  見回りが見る
     *
     *   ふだんは同じ値だが、片方だけ入っている行が
     *   できたときに、publish_at だけを見ていると
     *   一覧に出ないまま時間が来て公開される。
     *   作者からは「勝手に出た」に見える。
     */
    const scheduled = episodes
        .filter((row) => !row.is_published && (row.publish_at || row.scheduled_at))
        .sort((a, b) =>
            String(a.publish_at ?? a.scheduled_at).localeCompare(
                String(b.publish_at ?? b.scheduled_at),
            ),
        );

    /**
     * 開く話を変える。
     *
     * ★ 住所（?ep=）も一緒に変える。
     *
     *   前は画面の中だけで切り替えていた。
     *   読み直すと住所の話に戻るので、
     *   「F5 したら前の話に戻る」と言われていた。
     *
     *   履歴は増やさない（replace）。
     *   戻るを押したときに、話の選び直しを一つずつ
     *   遡らされると、投稿の画面から出られなくなる。
     */
    function selectEpisode(episodeId: string) {
        /*
         * 自分で選び直したら、聞く印は外す。
         * 入れるのは、予約のあと自動で進んだときだけ。
         */
        setAutoMovedId(null);
        setSelectedId(episodeId);
        router.replace(`/workspace/${workId}/post?ep=${episodeId}`);
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
                                            onClick={() => selectEpisode(row.id)}
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
                            {/*
                             * 話を選んで、まとめて何かする。
                             *
                             * ★ 道は 1 つだけにする。
                             *
                             *   前は「数字で範囲を指す」ものと
                             *   「印を付けて選ぶ」ものが両方あった。
                             *   同じことをする道が 2 つあると、
                             *   どちらを使えばよいのか分からない。
                             *
                             *   「難しすぎる」という声は、これ。
                             *   見ながら選べるほうだけ残す。
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
                                            話を選んで、まとめて投稿する
                                        </button>
                                    ) : (
                                        <div className="rounded-md border border-line bg-canvas px-2.5 py-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] text-ink">
                                                    {picked.length > 0
                                                        ? `${picked.length}話を選んでいます`
                                                        : "下の一覧から、話を選んでください"}
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

                                                {/*
                                                  * ★ いちばん使う選び方を、一押しで。
                                                  *
                                                  *   出していない話だけを出したい、
                                                  *   というのがほとんど。
                                                  *   一つずつ押させない。
                                                  */}
                                                {episodes.some((row) => !row.is_published) && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPicked(
                                                                episodes
                                                                    .filter((row) => !row.is_published)
                                                                    .map((row) => row.id),
                                                            )
                                                        }
                                                        className="rounded border border-forest-line px-2 py-0.5 text-[10px] text-forest hover:bg-forest-tint"
                                                    >
                                                        まだ投稿していない話を選ぶ
                                                    </button>
                                                )}
                                            </div>

                                            {/*
                                              * ★ 使い方は、その場に書く。
                                              *
                                              *   Shift を押しながら、は知っている人しか使わない。
                                              *   help を探しに行く人はいない。
                                              *   選んでいる最中の、目の前に置く。
                                              */}
                                            <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
                                                Shift を押しながら押すと、前に押した話からここまでをまとめて選べます。
                                            </p>

                                            {/*
                                              * 何が起きたかの知らせ。
                                              * 窓を出さず、選んでいる場所のすぐ下に置く。
                                              */}
                                            {bulkNote && (
                                                <p
                                                    className={[
                                                        "mt-2 rounded border-l-2 px-2.5 py-2 text-[10.5px] leading-relaxed",
                                                        blocked.length > 0
                                                            ? "border-[var(--color-danger)] bg-[var(--color-danger-tint,#fdf4f4)] text-[var(--color-danger)]"
                                                            : "border-forest bg-forest-tint text-forest",
                                                    ].join(" ")}
                                                >
                                                    {bulkNote}
                                                </p>
                                            )}

                                            {/*
                                              * 押す前の、最後の確かめ。
                                              *
                                              * ★ 窓を出さない。
                                              *   画面から浮いた素っ気ない窓が出ると、
                                              *   そこだけ他所の作りに見える。
                                              */}
                                            {asking && (
                                                <div className="mt-2 rounded border border-forest-line bg-forest-tint px-2.5 py-2">
                                                    <p className="text-[11px] leading-relaxed text-ink">
                                                        {asking.count}話を
                                                        {asking.publish
                                                            ? "投稿します。読者に公開されます。"
                                                            : "非公開にします。読者から見えなくなります。"}
                                                    </p>

                                                    <div className="mt-2 flex gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAsking(null)}
                                                            className="rounded border border-line bg-surface px-3 py-1 text-[10.5px] text-muted hover:text-ink"
                                                        >
                                                            やめる
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void bulkSet(asking.publish)
                                                            }
                                                            className="flex-1 rounded bg-forest py-1 text-[10.5px] font-medium text-white hover:bg-forest-dark"
                                                        >
                                                            {asking.publish
                                                                ? "投稿する"
                                                                : "非公開にする"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 選んだ話にできること */}
                                            {picked.length > 0 && !asking && (
                                                <div className="mt-2 border-t border-line pt-2">
                                                    <p className="text-[10px] text-faint">
                                                        選んだ{picked.length}話を
                                                    </p>

                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => askBulk(true)}
                                                            disabled={bulkDoing > 0}
                                                            className="rounded-full border border-forest-line px-2.5 py-1 text-[10px] text-forest hover:bg-forest-tint disabled:opacity-40"
                                                        >
                                                            {bulkDoing > 0
                                                                ? `投稿しています…（残り${bulkDoing}）`
                                                                : "投稿する"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => askBulk(false)}
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
                            {/*
                              * ★ 話の順に沿って並べ、章が変わったところで見出しを出す。
                              *
                              *   前は「章に入っていない話」を必ず先頭に置き、
                              *   そのあと章を作った順に並べていた。
                              *
                              *   序章をあとから作ると、いちばん最初に出す話が
                              *   いちばん下に来る。執筆室では正しく並ぶのに、
                              *   ここと目次だけ逆になっていた。
                              *
                              *   読む順は話の番号で決まる。それに従えば、
                              *   どの画面でも同じ並びになる。
                              */}
                            {(() => {
                                const groups: {
                                    id: string | null;
                                    label: string;
                                    own: Episode[];
                                }[] = [];

                                for (const episode of episodes) {
                                    const id = episode.chapter_id ?? null;
                                    const last = groups[groups.length - 1];

                                    if (last && last.id === id) {
                                        last.own.push(episode);
                                        continue;
                                    }

                                    /*
                                     * 見出しの番号は、章の並び順のまま。
                                     * 出てきた順で数え直すと、
                                     * 章の設定で付けた番号と食い違う。
                                     */
                                    const at = chapters.findIndex((one) => one.id === id);
                                    const chapter = at >= 0 ? chapters[at] : null;

                                    groups.push({
                                        id,
                                        label: chapter
                                            ? formatChapterLabel(chapter, at)
                                            : "",
                                        own: [episode],
                                    });
                                }

                                return groups;
                            })().map((group, groupAt) => {
                                const own = group.own;
                                if (own.length === 0) return null;

                                return (
                                    <div
                                        key={`${group.id ?? "loose"}-${groupAt}`}
                                        className="mb-1"
                                    >
                                        {group.label &&
                                            (isPicking ? (
                                                /*
                                                  * ★ 章ごと、まとめて選べるようにする。
                                                  *
                                                  *   章で区切って出す人には、これがいちばん早い。
                                                  *   一つずつ押させない。
                                                  *
                                                  * ★ 全部選ばれていたら、外す。
                                                  *   押し間違えたときに、同じ所を押せば戻せる。
                                                  */
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const ids = own.map((row) => row.id);
                                                        const allPicked = ids.every((id) =>
                                                            picked.includes(id),
                                                        );

                                                        setPicked((list) =>
                                                            allPicked
                                                                ? list.filter(
                                                                      (id) => !ids.includes(id),
                                                                  )
                                                                : Array.from(
                                                                      new Set([...list, ...ids]),
                                                                  ),
                                                        );
                                                    }}
                                                    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-medium text-ink hover:text-forest"
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className="text-[9px] text-forest"
                                                    >
                                                        ☑
                                                    </span>
                                                    {group.label}
                                                    <span className="text-[9.5px] font-normal text-faint">
                                                        まとめて選ぶ
                                                    </span>
                                                </button>
                                            ) : (
                                                <p className="px-2 py-1.5 text-[11px] font-medium text-ink">
                                                    {group.label}
                                                </p>
                                            ))}

                                        <ul className={group.label ? "pl-1" : ""}>
                                            {own.map((episode) => (
                                                <li
                                                    key={episode.id}
                                                    data-ep-id={episode.id}
                                                    className={[
                                                        "flex items-center gap-1.5 rounded",
                                                        /*
                                                         * ★ 出せなかった話を、赤くする。
                                                         *   「3話あります」と言われても探せない。
                                                         *   その話まで連れていって、色で示す。
                                                         */
                                                        blocked.includes(episode.id)
                                                            ? "bg-[var(--color-danger-tint,#fdf4f4)] ring-1 ring-[var(--color-danger)]"
                                                            : "",
                                                    ].join(" ")}
                                                >
                                                    {/* 選んでいる間だけ四角を出す */}
                                                    {isPicking && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) =>
                                                                togglePicked(
                                                                    episode.id,
                                                                    e.shiftKey,
                                                                )
                                                            }
                                                            aria-pressed={picked.includes(episode.id)}
                                                            className={[
                                                                "ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px]",
                                                                /*
                                                                 * ★ 選んだ印は緑。
                                                                 *   もとは「消す」ために作った四角で、
                                                                 *   赤かった。投稿しようとしている人に
                                                                 *   赤は怖い。
                                                                 */
                                                                picked.includes(episode.id)
                                                                    ? "border-forest bg-forest text-white"
                                                                    : "border-line text-transparent hover:border-forest",
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
                                                                : selectEpisode(episode.id)
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
                    {/*
                      * 予約したことの知らせ。
                      * 次の話へ進んでも消えないよう、ここに出す。
                      */}
                    {postNotice && (
                        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-forest-line bg-forest-tint px-4 py-2.5">
                            <p className="text-[12px] text-ink">{postNotice.text}</p>

                            {postNotice.nextLabel && (
                                <span className="text-[11.5px] text-muted">
                                    {postNotice.nextLabel}。
                                </span>
                            )}
                        </div>
                    )}

                    {selected ? (
                        <PostForm
                            key={selected.id}
                            episode={selected}
                            chapters={chapters}
                            publish={publish}
                            /* 約束を返す。控え終わるのを、投稿の側で待てるように */
                            onChange={(patch) => change(selected.id, patch)}
                            onPosted={(info) => {
                                const didSchedule = info.scheduled;
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
                                 * 予約したときは、この話に留まる。
                                 *
                                 * ★ 次の話へ勝手に移さない。
                                 *
                                 *   一度は移していた。何話も続けて予約する人の
                                 *   手間を減らすためだが、危なかった。
                                 *
                                 *   移った先の話は予約が入っていないので、
                                 *   日時の欄が空になり、同じ場所にある同じ押し具が
                                 *   「予約する」から「いま出す」に変わる。
                                 *   流れで押すと、その話が即座に公開される。
                                 *   実際に、それで出てしまった人がいる。
                                 *
                                 *   進むかどうかは、読む人が決める。
                                 *   知らせの中に「次の話へ」を置いた。
                                 */
                                const next = [...episodes]
                                    .sort((a, b) => a.ep_number - b.ep_number)
                                    .find(
                                        (row) =>
                                            row.ep_number > selected.ep_number &&
                                            !row.is_published &&
                                            !row.publish_at,
                                    );

                                /*
                                 * ★ 次の話へ進む。欄は空のまま。
                                 *
                                 *   一度、次の予定を入れて進む形にしたが、
                                 *   勝手に日時が入るのは要らない、となった。
                                 *
                                 *   代わりに押し具の名前を、欄の中身で
                                 *   決めるようにしてある。
                                 *   欄が空なら「この話を投稿する」と出るので、
                                 *   予約のつもりで押して即座に出る、
                                 *   という取り違えは起きにくい。
                                 */
                                setPostNotice({
                                    text: info.at
                                        ? `${formatAt(info.at)} に予約しました。`
                                        : "",
                                    nextId: null,
                                    nextLabel: next
                                        ? `次の話へ進みました。日時を入れて予約してください`
                                        : "",
                                });

                                if (next) {
                                    setAutoMovedId(next.id);
                                    selectEpisode(next.id);
                                }
                            }}
                            work={work}
                            /*
                             * 最後に予約した話の時刻。
                             * 次の予定を組み立てるのに使う。
                             */
                            /* この話へは自動で進んできたか。いま出す前に一度聞く */
                            askBeforePublish={autoMovedId === selected.id}
                            lastScheduledAt={
                                scheduled.length > 0
                                    ? scheduled[scheduled.length - 1].publish_at ??
                                      scheduled[scheduled.length - 1].scheduled_at ??
                                      null
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
    askBeforePublish = false,
}: {
    /** 最後に予約した話の時刻。次の予定を組み立てるのに使う */
    lastScheduledAt?: string | null;
    /**
     * いま出す前に、一度聞くか。
     *
     * 予約したあと自動で進んできた話にだけ立てる。
     * 自分で選んだ話では聞かない。
     */
    askBeforePublish?: boolean;
    /**
     * 投稿し終えたとき。
     *
     * ★ 予約したのか、いま出したのかを渡す。
     *   いま出したときは書いていた所へ戻し、
     *   予約したときはこの画面に留まる。
     *   予約は何話も続けて入れる作業なので、
     *   1 話ごとに戻されると、そのたびに来直すことになる。
     */
    onPosted?: (info: { scheduled: boolean; at: string | null }) => void;
    episode: Episode;
    chapters: Chapter[];
    publish: PublishSettings | null;
    onChange: (patch: Partial<Episode>) => void | Promise<void>;
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

    /* 予約を取り消すか、確かめている最中か */
    const [isCancelling, setIsCancelling] = useState(false);

    const [at, setAt] = useState(
        toLocalInput(episode.publish_at ?? episode.scheduled_at),
    );
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

    /* 予約が入っているか。時刻はどちらの列にあってもよい */
    const isScheduled =
        Boolean(episode.publish_at || episode.scheduled_at) &&
        !episode.is_published;

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

        /*
         * ★ 控えは 1 回にまとめる。
         *
         *   前は「先に書いたものを残す」で 1 回、
         *   そのあと公開の状態で 1 回、計 2 回書いていた。
         *
         *   親は 1 回ごとに話を読み直す。
         *   先に頼んだほうの読み直しが、あとから返ってくると、
         *   予約を入れる前の並びで画面を上書きしてしまう。
         *   「予約を変えたのに変わらない」の元。
         *
         *   触る列は重ならないので、1 つの頼みで足りる。
         */
        const patch: Partial<Episode> = {
            title: title.trim(),
            preface: preface.trim() || null,
            episode_summary: summary.trim() || null,
            afterword: afterword.trim() || null,
            chapter_id: chapterId || null,
            /* 挿絵も一緒に。別に押させると忘れられる */
            illust_url: illustUrl || null,
            illust_is_ai: illustIsAi,
        };

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

            /* ★ 控え終わるのを待ってから、次へ進む */
            const when = floorTo5Min(target).toISOString();

            void (async () => {
                await onChange({
                    ...patch,
                    is_published: false,
                    /*
                     * ★ 予約の時刻は 2 つの列に持っている。必ず両方書く。
                     *
                     *   publish_at    この画面が書くもの
                     *   scheduled_at  読む側と定時の見回りが見るもの
                     *
                     *   前はこちらだけ書いていた。
                     *   scheduled_at に前の予約が残っていると、
                     *   その時刻はもう過ぎているので、
                     *   誰かが作品を開いた瞬間に公開されてしまう。
                     *   「勝手に投稿された」の元。
                     */
                    publish_at: when,
                    scheduled_at: when,
                });
                onPosted?.({ scheduled: true, at: when });
            })();
            return;
        }

        /*
         * ★ 自動で進んできた話だけ、一度聞く。
         *
         *   予約したあと画面が次の話へ移る。
         *   移った先は日時の欄が空なので、
         *   押すとその話は即座に公開される。
         *   流れで押して、出すつもりのなかった話が出た人がいる。
         *
         *   自分で選んだ話では聞かない。
         *   毎回聞かれると、普通に出したい人の邪魔になる。
         */
        if (askBeforePublish) {
            if (
                !window.confirm(
                    `「${title.trim()}」を、いますぐ公開します。\n\n` +
                        "予約したいときは、この下の「予約公開」に日時を入れてから押してください。",
                )
            ) {
                return;
            }
        }

        setError("");

        void (async () => {
            await onChange({
                ...patch,
                is_published: true,
                /* 出したら、予約の時刻は両方とも消す */
                publish_at: null,
                scheduled_at: null,
            });
            onPosted?.({ scheduled: false, at: null });
        })();
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

                        {/*
                          * 作品の設定。
                          *
                          * ★ 置き場所は、作品の題名のすぐ下。
                          *   ここから上が「作品そのもの」、
                          *   下が「この話」。境目が一本になる。
                          *
                          * ★ 畳んで置く。
                          *   ジャンルも年齢も、毎回は触らない。
                          *   ひらいたまま並べると、話の欄が押し下がる。
                          *
                          *   ただ「いま何になっているか」は出す前に
                          *   確かめたい。だから折り目の所に値を並べる。
                          *   開かなくても分かる。
                          *
                          * ★ ここで直したぶんは、その場で控える。
                          *   「保存」を押させない。押し忘れて出すと、
                          *   直したつもりのまま古い形で並ぶ。
                          */}
                        <div className="mb-3.5 rounded-md border border-line bg-canvas px-3 py-2.5">
                        <p className="text-[11px] leading-relaxed text-muted">
                            {work.genre || "ジャンル未設定"}
                            {" ／ "}
                            {AGE_RATING_LABEL[work.age_rating] ?? "全年齢"}
                            {" ／ "}
                            {work.format
                                ? WORK_FORMAT_LABEL[work.format]
                                : "長編（未選択）"}
                            {" ／ "}
                            タグ {work.tags?.length ?? 0} 個
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
                                        {GENRES_R18_ONLY.join("・")} は、
                                        年齢の区分を R18 にすると出ます。
                                    </p>
                                </div>

                                {/* タグ */}
                                <div>
                                    <span className="text-xs font-medium text-ink">
                                        タグ
                                    </span>
                                    <div className="mt-1.5">
                                        {/*
                                          * ★ 列は tags。keywords ではない。
                                          *
                                          *   novels には tags と keywords の
                                          *   2 つがある。作品の設定が読み書きして
                                          *   いるのは tags のほう。
                                          *   keywords に書いても、設定の画面にも
                                          *   作品の頁にも出ない。
                                          */}
                                        <TagInput
                                            id="post-tags"
                                            tags={work.tags ?? []}
                                            onChange={(tags) =>
                                                onChangeWorkInfo?.({ tags })
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
                        </div>

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

                            <div className="mt-1 flex items-baseline justify-between gap-2">
                                <p className="text-[10px] text-faint">
                                    空のままなら、押した時点で投稿します。
                                </p>

                                {/*
                                  * ★ 入れた時刻を消す道を置く。
                                  *
                                  *   入れてから「やっぱり今すぐ出す」と
                                  *   思い直したとき、消す手が無かった。
                                  *   欄を空にする押し方は端末によって違い、
                                  *   携帯では消せないことがある。
                                  *
                                  *   入っているときだけ出す。
                                  */}
                                {at && (
                                    <button
                                        type="button"
                                        onClick={() => setAt("")}
                                        className="shrink-0 text-[10px] text-muted underline hover:text-ink"
                                    >
                                        時刻を消す
                                    </button>
                                )}
                            </div>

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
                                {/*
                                  * ★ 窓を出さない。
                                  *   押したら、その場で確かめを出す。
                                  */}
                                {!isCancelling ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsCancelling(true)}
                                        className="mt-2 text-[11px] text-[var(--color-danger)] hover:underline"
                                    >
                                        予約を取り消す
                                    </button>
                                ) : (
                                    <div className="mt-2 rounded border border-line bg-surface px-2.5 py-2">
                                        <p className="text-[11px] leading-relaxed text-ink">
                                            予約を取り消します。この話は下書きに戻ります。
                                        </p>

                                        <div className="mt-2 flex gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setIsCancelling(false)}
                                                className="rounded border border-line px-3 py-1 text-[10.5px] text-muted hover:text-ink"
                                            >
                                                やめる
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCancelling(false);
                                                    setAt("");
                                                    onChange({
                                                        is_published: false,
                                                        /* 取り消しも、両方とも消す */
                                                        publish_at: null,
                                                        scheduled_at: null,
                                                    });
                                                }}
                                                className="flex-1 rounded bg-[var(--color-danger)] py-1 text-[10.5px] font-medium text-white hover:opacity-90"
                                            >
                                                取り消す
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
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
                        {/*
                          * ★ 名前は、欄の中身で決める。
                          *
                          *   前は話の状態だけを見ていた。
                          *   日時が入っているのに
                          *   「この話を投稿する」と出ることがあり、
                          *   押すと予約になる。逆も起きる。
                          *   押す前に何が起きるか分からなかった。
                          */}
                        {at
                            ? isScheduled
                                ? "予約を変える"
                                : "この話を予約する"
                            : "この話を投稿する"}
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
    /* 予約が入っているか。時刻はどちらの列にあってもよい */
    const isScheduled =
        Boolean(episode.publish_at || episode.scheduled_at) &&
        !episode.is_published;

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
