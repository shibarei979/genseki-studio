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

import { useCallback, useEffect, useState } from "react";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import LoadError from "@/components/common/load-error";
import HomeSideCards from "@/components/home/home-side-cards";
import type { SideNotice } from "@/components/home/home-side-cards";
import HomeBannerCarousel from "@/components/home/home-banner-carousel";
import HomeHero from "@/components/home/home-hero";
import HomeWorkTable from "@/components/home/home-work-table";
import { getRepository } from "@/lib/repository";
import { compareDate, NOTICES } from "@/types";
import type { Contest, Episode, WorkWithStats } from "@/types";


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
        /*
         * 並べ直さない。listNotices が
         * 「運営の決めた順 → 新しい順」で返してくる。
         * ここで日付で並べ直すと、決めた順が消える。
         */
        const published = (await repository.listNotices()).filter(
            (row) => row.is_published && row.published_at <= today,
        );

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

    const side = (
        <HomeSideCards
            contests={contests}
            notices={notices}
            works={works}
            episodes={episodes}
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
                    {/*
                     * 白い地と縦の線は外側の aside に持たせ、
                     * 頁の下（フッターの手前）まで伸ばす。
                     * 貼りつくのは中の箱だけ。
                     * 貼りつく箱に地を持たせると、中身の高さで白が切れて、
                     * 柱の下だけ灰色が覗く。
                     */}
                    {/*
                     * after: の帯は、フッター手前の余白（footer-below-fold の
                     * 18rem = h-72）を白でまたぐためのもの。
                     * これが無いと、柱とフッターの間だけ頁の灰色が挟まる。
                     * 余白の rem を変えたら h-72 も揃えること。
                     */}
                    <aside className="relative hidden w-[300px] shrink-0 border-r border-line bg-surface after:absolute after:-right-px after:top-full after:h-72 after:w-[calc(100%+1px)] after:border-r after:border-line after:bg-surface xl:block">
                        <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto px-5 py-5">
                            {side}
                        </div>
                    </aside>

                    {/* 右 */}
                    <div className="flex min-w-0 flex-1 flex-col">
                        <main className="min-w-0 flex-1 space-y-3.5 px-5 py-4 sm:px-6">
                            {error && (
                                <LoadError message={error} onRetry={() => void reload()} />
                            )}

                            <HomeHero />

                            {/*
                             * 流れる帯。
                             *
                             * コンテストと運営のお知らせの絵をここで流す。
                             * 「新しく書く」の札は柱に移したので、
                             * 棚の上は知らせる場所に使う。
                             */}
                            <HomeBannerCarousel contests={contests} />

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
