/**
 * ============================================================
 * 原石航路 Studio
 * HomeClient — ホーム
 *
 * ヘッダーを画面の端から端まで通し、その下を縦に二つに割る。
 *
 *   左（固定）… 書きはじめる入口・コンテスト・お知らせ
 *   右（流れる）… 導入・はじめる・書いた本
 *
 * 執筆室はここに出さない。
 * 上の段に「執筆室」が常にあるので、同じ入口が 2 つになる。
 *
 * 左の柱はヘッダーの下に収める。
 * 柱を画面の一番上まで伸ばすとロゴが二つ並ぶことになり、
 * どちらがこのサイトの名前なのか分からなくなる。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import LoadError from "@/components/common/load-error";
import HomeSideCards from "@/components/home/home-side-cards";
import type { SideNotice } from "@/components/home/home-side-cards";
import HomeHero from "@/components/home/home-hero";
import HomeWorkTable from "@/components/home/home-work-table";
import { getRepository } from "@/lib/repository";
import { compareDate, NOTICES } from "@/types";
import type { Contest, Episode, WorkWithStats } from "@/types";

function PlusIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M12 5.5v13M5.5 12h13" />
        </svg>
    );
}

export default function HomeClient() {
    const [works, setWorks] = useState<WorkWithStats[]>([]);
    const [error, setError] = useState("");
    const [contests, setContests] = useState<Contest[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [notices, setNotices] = useState<SideNotice[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        const repository = getRepository();

        setError("");
        let rows;
        try {
            rows = await repository.listWorks();
        } catch (caught) {
            /*
             * 読めなかったことを伝える。
             * 空の一覧を出すと、作品が消えたように見える。
             */
            setError(caught instanceof Error ? caught.message : "読み込めませんでした");
            setIsLoading(false);
            return;
        }

        setWorks(rows);

        /*
         * 話は進み具合を出すために読む。
         * 「完成した話 ÷ 全話数」を作品ごとに出したい。
         */
        /*
         * 話とコンテストを、まとめて頼む。
         * 作品ごとに順に待つと、そのぶん積み上がる。
         */
        const [lists, contestList] = await Promise.all([
            Promise.all(rows.map((work) => repository.listEpisodes(work.id))),
            repository.listContests(),
        ]);

        setEpisodes(lists.flat());

        // 準備中のものは書き手に見せない
        setContests(contestList.filter((row) => row.status !== "draft"));

        /*
         * お知らせ。
         * 運営が立てたもののうち、公開されていて表に出す日が来たものだけ。
         * まだ何も立てていなければ、組み込みの案内で埋める。
         */
        const today = new Date().toISOString().slice(0, 10);
        const published = (await repository.listNotices())
            .filter((row) => row.is_published && row.published_at <= today)
            .sort((a, b) => compareDate(b.published_at, a.published_at));

        setNotices(
            published.length > 0
                ? published.map((row) => ({
                      id: row.id,
                      date: row.published_at,
                      label: row.title,
                      link: row.link || undefined,
                  }))
                : NOTICES.map((row) => ({
                      id: row.id,
                      date: row.date,
                      label: row.label,
                  })),
        );

        setIsLoading(false);
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const latest = [...works].sort((a, b) =>
        compareDate(b.updated_at, a.updated_at),
    )[0];

    const side = (
        <HomeSideCards
            contests={contests}
            notices={notices}
            latestWorkId={latest?.id ?? null}
        />
    );

    return (
        <div className="page-with-footer bg-canvas">
            {/* ヘッダーは端から端まで */}
            <Header />

            {isLoading ? (
                <p className="py-24 text-center text-sm text-faint">読み込んでいます</p>
            ) : (
                <div className="flex">
                    {/*
                     * 左の柱。
                     *
                     * ヘッダー（高さ 56px）のすぐ下に貼りつけ、
                     * 柱の中身が画面より長くなったときは柱の中だけを送る。
                     */}
                    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[300px] shrink-0 overflow-y-auto border-r border-line bg-surface px-5 py-5 xl:block">
                        {side}
                    </aside>

                    {/* 右 */}
                    <div className="flex min-w-0 flex-1 flex-col">
                        <main className="min-w-0 flex-1 space-y-3.5 px-5 py-4 sm:px-6">
                            {error && (
                                <LoadError message={error} onRetry={() => void reload()} />
                            )}

                            <HomeHero />

                            {/*
                             * はじめる。
                             *
                             * 棚の上に置く。
                             * 棚は「もう書いたもの」の場所なので、
                             * 新しく始める入口を混ぜると、
                             * 1 冊目を作るのに棚を探すことになる。
                             *
                             * 白い枠で囲まない。
                             * 中身が札 1 枚しかないのに全幅の枠を引くと、
                             * 右側が丸ごと空いて、置き忘れのように見える。
                             */}
                            <section>
                                <h2 className="text-[13px] font-semibold tracking-wide text-ink">
                                    はじめる
                                </h2>

                                <Link
                                    href="/post"
                                    className="mt-2 flex w-[176px] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-surface py-5 text-center hover:border-forest-line hover:bg-canvas"
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-tint text-forest">
                                        <PlusIcon />
                                    </span>
                                    <span className="text-[13px] font-semibold text-ink">
                                        新しく書く
                                    </span>
                                    <span className="text-[10px] leading-relaxed text-muted">
                                        新しい物語を
                                        <br />
                                        はじめましょう
                                    </span>
                                </Link>
                            </section>

                            {/*
                             * 作品を先に出す。
                             * ホームに来る用は「続きを書く」がほとんどで、
                             * 部屋を選ぶのはそのあと。
                             */}
                            <HomeWorkTable
                                works={works}
                                episodes={episodes}
                                onDelete={async (work) => {
                                    await getRepository().deleteWork(work.id);
                                    await reload();
                                }}
                            />

                        </main>

                        {/*
                         * 柱が消える幅では、同じ中身を下に回す。
                         * 出さないと、コンテストとお知らせへの入口が無くなる。
                         */}
                        <div className="border-t border-line bg-surface px-5 py-6 sm:px-6 xl:hidden">
                            {side}
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
