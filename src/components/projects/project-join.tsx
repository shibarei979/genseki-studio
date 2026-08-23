"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getRepository } from "@/lib/repository";
import { TAG_MAX_COUNT } from "@/config";
import type { WorkWithStats } from "@/types";

/**
 * ============================================================
 * 原石航路
 * ProjectJoin — 企画に参加する
 *
 * 自分の作品を選ぶと、合言葉のタグが自動で付く。
 *
 * タグを手で打たせると、打ち間違いで参加できない。
 * 「夏の恋2026」と「夏の恋 2026」は別物なので、
 * 一文字違うだけで一覧に出てこない。
 * ここから付ければ、必ず正しく揃う。
 * ============================================================
 */

export default function ProjectJoin({
    tag,
    projectTitle,
}: {
    /** 企画の合言葉 */
    tag: string;
    projectTitle: string;
}) {
    const router = useRouter();

    const [isOpen, setIsOpen] = useState(false);
    const [works, setWorks] = useState<WorkWithStats[] | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState("");

    /* 参加できた作品の名前。知らせを出すのに使う */
    const [joined, setJoined] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || works !== null) return;

        void (async () => {
            try {
                setWorks(await getRepository().listWorks());
            } catch {
                setWorks([]);
                setError("作品を読み込めませんでした。");
            }
        })();
    }, [isOpen, works]);

    async function join(work: WorkWithStats) {
        if (busyId) return;

        /* すでに付いていれば、何もしない */
        if ((work.tags || []).includes(tag)) return;

        if ((work.tags || []).length >= TAG_MAX_COUNT) {
            setError(
                `タグは${TAG_MAX_COUNT}個までです。ほかのタグを外してから参加してください。`,
            );
            return;
        }

        setBusyId(work.id);
        setError("");

        try {
            await getRepository().updateWork(work.id, {
                tags: [...(work.tags || []), tag],
            });

            /*
             * 参加できたことを伝えてから閉じる。
             *
             * 黙って閉じると、押せたのかどうか分からない。
             */
            setJoined(work.title || "無題");
            setIsOpen(false);
            router.refresh();
        } catch (caught) {
            setError(
                caught instanceof Error ? caught.message : "参加できませんでした。",
            );
        }
        setBusyId(null);
    }

    if (!isOpen) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => {
                        setIsOpen(true);
                        setJoined(null);
                    }}
                    className="mt-4 w-full rounded-lg bg-forest py-2.5 text-[13px] font-medium text-white hover:bg-forest-dark"
                >
                    この企画に参加する
                </button>

                {joined && (
                    <p className="mt-2 rounded-lg border border-forest-line bg-forest-tint/40 px-3 py-2 text-[11px] leading-relaxed text-forest">
                        「{joined}」が参加しました。下の一覧に並びます。
                    </p>
                )}
            </>
        );
    }

    return (
        <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[70vh] w-[min(420px,100%)] flex-col overflow-hidden rounded-xl bg-surface"
            >
                <div className="border-b border-line px-4 py-3.5">
                    <p className="text-[13px] font-medium text-ink">参加する作品を選ぶ</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        選んだ作品に
                        <span className="mx-1 rounded bg-canvas px-1.5 py-0.5 text-forest">
                            {tag}
                        </span>
                        が付き、「{projectTitle}」に並びます。
                    </p>
                </div>

                {works === null ? (
                    <p className="px-4 py-10 text-center text-[12px] text-faint">
                        読み込んでいます…
                    </p>
                ) : works.length === 0 ? (
                    <p className="px-4 py-10 text-center text-[12px] text-faint">
                        参加できる作品がありません。
                    </p>
                ) : (
                    <ul className="thin-scroll min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                        {works.map((work) => {
                            const joined = (work.tags || []).includes(tag);
                            return (
                                <li key={work.id}>
                                    <button
                                        type="button"
                                        disabled={joined || busyId !== null}
                                        onClick={() => void join(work)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas disabled:opacity-50"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] text-ink">
                                                {work.title || "無題"}
                                            </span>
                                            <span className="mt-0.5 block text-[11px] text-faint">
                                                {work.genre}
                                            </span>
                                        </span>

                                        <span className="shrink-0 text-[11px] text-forest">
                                            {joined
                                                ? "参加中"
                                                : busyId === work.id
                                                  ? "…"
                                                  : "参加する"}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {error && (
                    <p className="border-t border-line px-4 py-2.5 text-[11px] text-[var(--color-danger)]">
                        {error}
                    </p>
                )}

                <div className="border-t border-line px-4 py-3">
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="w-full rounded-lg border border-line py-2 text-[12px] text-muted hover:text-ink"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
