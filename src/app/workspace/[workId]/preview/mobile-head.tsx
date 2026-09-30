/**
 * ============================================================
 * 原石航路 Studio
 * 携帯：読者の目（/workspace/[workId]/preview）の上の段
 *
 *   ‹ 戻る ｜ 読者の目／作品名 ｜ 投稿（まだ出していない話の数）
 *
 * ★ 1024px 未満でだけ出る（中の MobileWorkHeader が携帯でだけ見える）。
 * ★ 本体（preview-client）には手を入れず、頁の上に足すだけにした。
 *   作品名と話の数は、本体と同じ所から読む。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

import MobileWorkHeader from "@/components/workspace/mobile-work-header";
import { getRepository } from "@/lib/repository";

export default function PreviewMobileHead({ workId }: { workId: string }) {
    const [title, setTitle] = useState("");
    const [unposted, setUnposted] = useState(0);

    useEffect(() => {
        let alive = true;
        void (async () => {
            /*
             * 読めなかったとき・作品が無いときは、題を空のまま出す。
             *
             * ★ 上の段そのものは必ず出す。
             *   この頁ではサイトの上の段を出さないので、
             *   これが無いと「戻る」も「投稿」も無くなる。
             */
            try {
                const repository = getRepository();
                const [work, episodes] = await Promise.all([
                    repository.getWork(workId),
                    repository.listEpisodes(workId),
                ]);
                if (!alive || !work) return;
                setTitle(work.title || "名前のない作品");
                setUnposted(episodes.filter((ep) => ep.is_published === false).length);
            } catch {
                /* 出さないまま */
            }
        })();
        return () => {
            alive = false;
        };
    }, [workId]);

    return (
        <MobileWorkHeader
            workId={workId}
            page="読者の目"
            title={title}
            unposted={unposted}
        />
    );
}
