/**
 * ============================================================
 * 原石航路 Studio
 * WorksClient — 作品の一覧
 *
 * ホームにも一覧はあるが、あちらは近況を見せる場所。
 * ここは「全部を並べて探す」ための場所にする。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import WorkGrid from "@/components/home/work-grid";
import { getRepository } from "@/lib/repository";
import type { Episode, WorkWithStats } from "@/types";

export default function WorksClient() {
    const [works, setWorks] = useState<WorkWithStats[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        const repository = getRepository();
        const rows = await repository.listWorks();
        setWorks(rows);

        const all: Episode[] = [];
        for (const work of rows) {
            all.push(...(await repository.listEpisodes(work.id)));
        }
        setEpisodes(all);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    return (
        <div className="page-with-footer bg-canvas">
            <Header breadcrumbs={[{ label: "作品" }]} />

            <main className="px-6 py-7 sm:px-10">
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold tracking-wide text-ink">
                            すべての作品
                        </h1>
                        <p className="mt-1 text-xs text-muted">
                            {isLoading ? "読み込んでいます" : `${works.length}作品`}
                        </p>
                    </div>

                    <Link
                        href="/post"
                        className="rounded-full bg-forest px-5 py-2 text-xs text-white hover:bg-forest-dark"
                    >
                        ＋ 新しい作品
                    </Link>
                </div>

                {isLoading ? (
                    <p className="py-20 text-center text-sm text-faint">
                        読み込んでいます
                    </p>
                ) : works.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-faint">
                        まだ作品がありません。
                    </p>
                ) : (
                    <WorkGrid
                        works={works}
                        episodes={episodes}
                        onDelete={async (work) => {
                            await getRepository().deleteWork(work.id);
                            await reload();
                        }}
                    />
                )}
            </main>

            <Footer />
        </div>
    );
}
