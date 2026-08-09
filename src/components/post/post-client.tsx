/**
 * ============================================================
 * 原石航路 Studio
 * PostClient — 作品を書く
 *
 * ここから始めるための入口。
 *   左  … 新しく書き始める
 *   右  … 前の続きから
 *
 * 何をすればよいかを、2 つに絞って見せる。
 * 一覧をいきなり出すと、どれを開くかで手が止まる。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { getRepository } from "@/lib/repository";
import { formatDateTime, formatNumber } from "@/lib/utils/text";
import type { CoverTile, Episode, WorkWithStats } from "@/types";
import { COVER_TILES, tileOf } from "@/types";

export default function PostClient() {
    const router = useRouter();

    const [works, setWorks] = useState<WorkWithStats[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isBusy, setIsBusy] = useState(false);

    const reload = useCallback(async () => {
        const repository = getRepository();
        const rows = await repository.listWorks();
        setWorks(rows);

        /* 続きを出すために、話も読む */
        /* まとめて頼む。1 本ずつ順に待たない */
        const lists = await Promise.all(
            rows.slice(0, 3).map((work) => repository.listEpisodes(work.id)),
        );

        setEpisodes(lists.flat());
        setIsLoading(false);
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    /** 表紙の札を選び直す */
    const changeTile = useCallback(
        async (workId: string, tile: CoverTile) => {
            // 先に手元を書き換える。押した瞬間に変わってほしい
            setWorks((rows) =>
                rows.map((row) =>
                    row.id === workId ? { ...row, cover_tile: tile } : row,
                ),
            );
            await getRepository().updateWork(workId, { cover_tile: tile });
        },
        [],
    );

    async function createWork() {
        setIsBusy(true);
        try {
            /*
             * 名前も分類も空で作る。
             * 書き始める前に決めさせると、そこで手が止まる。
             */
            const repository = getRepository();
            const created = await repository.createWork({
                title: "",
                genre: "",
            });

            /*
             * 資料の常設ページも作っておく。
             * 空の資料画面を渡されても、何をすればよいか分からない。
             */
            await repository.setupPages(created.id, []);
            /*
             * 執筆ではなく設定へ送る。
             *
             * 題名・分類・あらすじだけは先に決めてほしい。
             * ただし書かせるのではなく、
             * 「まだ空である」と分かる形で見せて、判断は書き手に委ねる。
             */
            router.push(`/workspace/${created.id}/settings?new=1`);
        } catch {
            setIsBusy(false);
        }
    }

    /** 最近さわった順に 3 つ */
    const recent = [...works]
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
        .slice(0, 3);

    return (
        <div className="leaf-page">
            <Header />

            <main className="leaf-page__content">
                {/* 見出し */}
                <div className="leaf-page__hero">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/icons/hero-feather.png"
                        alt=""
                        width={62}
                        height={62}
                        className="leaf-page__hero-icon mx-auto block"
                    />

                    {/*
                     * 明朝で組む。
                     * 「書く」場所の入口なので、
                     * 道具らしさより本らしさを前に出す。
                     */}
                    <h1
                        className="text-[40px] font-semibold tracking-[0.12em]"
                        style={{
                            fontFamily: "var(--font-serif), serif",
                            color: "var(--color-forest-dark)",
                        }}
                    >
                        作品を書く
                    </h1>
                    <p className="text-[14px] text-muted">
                        新しく書き始めるか、前回の続きから再開できます。
                    </p>
                </div>

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
                    {/* ---- 新しく ---- */}
                    <section className="rounded-2xl border border-line bg-surface px-8 py-11 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/icons/book-quill.png"
                            alt=""
                            width={96}
                            height={92}
                            className="mx-auto block"
                        />

                        <h2 className="mt-6 text-[18px] font-semibold text-ink">
                            新しく書き始める
                        </h2>
                        <p className="mt-3.5 text-[13px] leading-loose text-muted">
                            新しい物語をゼロから始めます。
                            <br />
                            タイトルやジャンルは後から設定できます。
                        </p>

                        <button
                            type="button"
                            onClick={() => void createWork()}
                            disabled={isBusy}
                            className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                            style={{ background: "var(--color-forest-dark)" }}
                        >
                            <span className="text-base leading-none">＋</span>
                            {isBusy ? "作っています…" : "新しい作品を作る"}
                        </button>

                        <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-canvas px-4 py-3.5 text-left text-[12px] leading-loose text-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/icons/bulb.png"
                                alt=""
                                width={16}
                                height={19}
                                className="mt-0.5 shrink-0"
                            />
                            <span>
                                タイトル・ジャンル・あらすじなどは、
                                書き始めてからいつでも設定できます。
                            </span>
                        </p>
                    </section>

                    {/* ---- 続きから ---- */}
                    <section className="rounded-2xl border border-line bg-surface px-7 py-7">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                                <h2 className="text-[18px] font-semibold text-ink">
                                    最近編集した作品
                                </h2>
                                <p className="mt-1.5 text-[13px] text-muted">
                                    最近編集した作品から、続きの執筆を再開できます。
                                </p>
                            </div>

                            <Link
                                href="/works"
                                className="flex items-center gap-1 text-xs text-forest hover:underline"
                            >
                                すべての作品へ
                                <ChevronIcon />
                            </Link>
                        </div>

                        {isLoading ? (
                            <p className="py-16 text-center text-sm text-faint">
                                読み込んでいます
                            </p>
                        ) : recent.length === 0 ? (
                            <p className="py-16 text-center text-sm text-faint">
                                まだ作品がありません。左から始められます。
                            </p>
                        ) : (
                            <ul className="mt-6 space-y-2">
                                {recent.map((work) => (
                                    <li key={work.id}>
                                        <RecentRow
                                            work={work}
                                            episodes={episodes.filter(
                                                (row) => row.work_id === work.id,
                                            )}
                                            onChangeTile={changeTile}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                {/* 締め */}
                <div className="mt-12 flex flex-col items-center gap-1.5 text-center">
                    <p className="flex items-center gap-2.5 text-[13px] text-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/icons/footer-feather.png"
                            alt=""
                            width={22}
                            height={24}
                            className="shrink-0"
                        />
                        執筆はあとから自由に編集できます。まずは思いついたことを書き留めてみましょう。
                    </p>
                    <p className="text-[13px] text-muted">
                        あなたの物語が、ここから始まります。
                    </p>
                </div>
            </main>

            <Footer />
        </div>
    );
}

/**
 * ============================================================
 * 一件ぶん
 * ============================================================
 */

function RecentRow({
    work,
    episodes,
    onChangeTile,
}: {
    work: WorkWithStats;
    episodes: Episode[];
    onChangeTile: (workId: string, tile: CoverTile) => void;
}) {
    /** どこまで進んでいるか */
    const progress = (() => {
        if (episodes.length === 0) return "プロット作成中";

        const done = episodes.filter((row) => row.status === "done").length;
        if (done === episodes.length) return `第${episodes.length}話まで完成`;
        return `第${episodes.length}話まで作成`;
    })();

    return (
        <div className="flex flex-wrap items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-canvas">
            <Cover
                work={work}
                onChange={(tile) => void onChangeTile(work.id, tile)}
            />

            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[16px] font-medium text-ink">
                        {work.title || "名前のない作品"}
                    </span>
                    <StateChip work={work} />
                </p>

                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                    <span className="flex items-center gap-1">
                        <ListIcon />
                        {progress}
                    </span>
                    <span className="text-faint">·</span>
                    <span>{formatNumber(work.total_char_count)}文字</span>
                    <span className="text-faint">·</span>
                    <span className="flex items-center gap-1">
                        <ClockIcon />
                        最終編集：{formatDateTime(work.updated_at)}
                    </span>
                </p>
            </div>

            <Link
                href={`/workspace/${work.id}`}
                className="shrink-0 rounded-lg border border-forest-line px-6 py-2.5 text-[13px] font-medium text-forest hover:bg-forest-tint"
            >
                続きを書く
            </Link>
        </div>
    );
}

/**
 * 表紙。
 *
 * まだ絵を入れていない作品が多いので、
 * 進み具合に合わせた札を出す。
 *   書き始めた … 本
 *   話だけある … 羽根
 *   まだ空    … きらめき
 *
 * 札は縦横の比が少しずつ違うので、
 * 正方形の枠に入れて中で収める。
 * 直に高さを揃えると、幅がばらついて並びが崩れる。
 */
/**
 * 表紙の札。
 *
 * 押すと選び直せる。
 * 絵を用意していない作品でも、
 * 並んだときに自分のものだと分かるようにする。
 */
function Cover({
    work,
    onChange,
}: {
    work: WorkWithStats;
    onChange: (tile: CoverTile) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const tile = tileOf(work);

    return (
        <span className="relative shrink-0">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-label="表紙の絵を選ぶ"
                title="表紙の絵を選ぶ"
                className="flex h-14 w-14 items-center justify-center rounded-xl transition-shadow hover:shadow-sm"
                style={{ background: tile.bg }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tile.src} alt="" className="h-9 w-9 object-contain" />
            </button>

            {isOpen && (
                <>
                    {/* 外を押したら閉じる */}
                    <span
                        className="fixed inset-0 z-30"
                        onClick={() => setIsOpen(false)}
                    />

                    <span className="absolute left-0 top-full z-40 mt-1.5 flex gap-1.5 rounded-xl border border-line bg-surface p-2 shadow-lg">
                        {COVER_TILES.map((row) => (
                            <button
                                key={row.key}
                                type="button"
                                onClick={() => {
                                    onChange(row.key);
                                    setIsOpen(false);
                                }}
                                aria-label={row.label}
                                title={row.label}
                                className="flex h-11 w-11 items-center justify-center rounded-lg transition-transform hover:scale-105"
                                style={{
                                    background: row.bg,
                                    outline:
                                        tile.key === row.key
                                            ? "2px solid var(--color-forest)"
                                            : "none",
                                    outlineOffset: 1,
                                }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={row.src}
                                    alt=""
                                    className="h-7 w-7 object-contain"
                                />
                            </button>
                        ))}
                    </span>
                </>
            )}
        </span>
    );
}

function StateChip({ work }: { work: WorkWithStats }) {
    const isPublic = work.visibility === "public";

    return (
        <span
            className={[
                "rounded px-2 py-0.5 text-[11px]",
                isPublic
                    ? "bg-forest-tint text-forest"
                    : "bg-canvas text-faint",
            ].join(" ")}
        >
            {isPublic ? "公開中" : "下書き"}
        </span>
    );
}

function FeatherIcon({ small = false }: { small?: boolean }) {
    const size = small ? 14 : 22;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M20.5 3.5c-6 0-11 3-13.5 8L4 20l8.5-3c5-2.5 8-7.5 8-13.5Z" />
            <path d="M4 20 15 9" />
        </svg>
    );
}

function ListIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </svg>
    );
}

/**
 * 右向きの矢印。
 *
 * 「›」の記号だと書体まかせで、平たく見える。
 * 線で描けば太さと角の丸みを決められる。
 */
function ChevronIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m9 5 7 7-7 7" />
        </svg>
    );
}
