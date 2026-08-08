/**
 * ============================================================
 * 原石航路 Studio
 * useWorks — 作品一覧の取得と操作
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { getRepository } from "@/lib/repository";
import { WORK_TEMPLATES } from "@/lib/resource/builtin-pages";
import type { WorkCreateInput, WorkWithStats } from "@/types";

export function useWorks() {
    const [works, setWorks] = useState<WorkWithStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        const rows = await getRepository().listWorks();
        setWorks(rows);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const createWork = useCallback(
        async (input: WorkCreateInput, templateKey: string) => {
            const repository = getRepository();
            const work = await repository.createWork(input);

            // テンプレートに沿って資料ページを用意する
            const template = WORK_TEMPLATES.find((row) => row.key === templateKey);
            await repository.setupPages(work.id, template?.extraPages ?? []);

            await reload();
            return work;
        },
        [reload],
    );

    const deleteWork = useCallback(
        async (workId: string) => {
            await getRepository().deleteWork(workId);
            await reload();
        },
        [reload],
    );

    return { works, isLoading, reload, createWork, deleteWork };
}
