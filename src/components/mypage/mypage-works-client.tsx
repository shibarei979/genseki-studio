/**
 * ============================================================
 * 原石航路 Studio
 * MypageWorksClient — 作品管理
 *
 * 自分の作品を並べ、どこへ行くかを選ぶ。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useState } from "react";

import { formatNumber } from "@/lib/utils/text";

interface Props {
    novels: any[];
    likeById: Record<string, number>;
    episodeById: Record<string, number>;
}

type Filter = "all" | "public" | "draft";

const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "すべて" },
    { key: "public", label: "公開中" },
    { key: "draft", label: "下書き" },
];

export default function MypageWorksClient({
    novels,
    likeById,
    episodeById,
}: Props) {
    const [filter, setFilter] = useState<Filter>("all");

    const shown = novels.filter((novel) => {
        if (filter === "all") return true;

        const isPublic = novel.visibility === "public" || novel.published;
        return filter === "public" ? isPublic : !isPublic;
    });

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
                {FILTERS.map((row) => (
                    <button
                        key={row.key}
                        type="button"
                        onClick={() => setFilter(row.key)}
                        aria-pressed={filter === row.key}
                        className={[
                            "rounded-full border px-3.5 py-1.5 text-xs",
                            filter === row.key
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line text-muted hover:text-ink",
                        ].join(" ")}
                    >
                        {row.label}
                    </button>
                ))}

                <Link
                    href="/post"
                    className="ml-auto rounded-lg bg-forest px-5 py-2 text-xs text-white hover:bg-forest-dark"
                >
                    ＋ 新しく書く
                </Link>
            </div>

            {shown.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-faint">
                    作品がありません。
                </p>
            ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                    {shown.map((novel) => {
                        const isPublic =
                            novel.visibility === "public" || novel.published;

                        return (
                            <li key={novel.id} className="px-5 py-4">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <Link
                                        href={`/workspace/${novel.id}`}
                                        className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink hover:text-forest"
                                    >
                                        {novel.title || "名前のない作品"}
                                    </Link>

                                    <span
                                        className={[
                                            "shrink-0 rounded px-2 py-0.5 text-[10px]",
                                            isPublic
                                                ? "bg-forest-tint text-forest"
                                                : "bg-canvas text-faint",
                                        ].join(" ")}
                                    >
                                        {isPublic ? "公開中" : "下書き"}
                                    </span>
                                </div>

                                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
                                    <span>全{episodeById[novel.id] ?? 0}話</span>
                                    <span className="text-faint">·</span>
                                    <span>
                                        ♡ {formatNumber(likeById[novel.id] ?? 0)}
                                    </span>
                                    <span className="text-faint">·</span>
                                    <span>{formatNumber(novel.views ?? 0)}回読まれた</span>
                                    <span className="text-faint">·</span>
                                    <span className="text-faint">
                                        {novel.updated_at.slice(0, 10).replace(/-/g, "/")}
                                    </span>
                                </p>

                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                    <Link
                                        href={`/workspace/${novel.id}`}
                                        className="rounded-md border border-line px-3 py-1 text-[11px] text-ink hover:border-forest-line hover:text-forest"
                                    >
                                        執筆
                                    </Link>
                                    <Link
                                        href={`/workspace/${novel.id}/post`}
                                        className="rounded-md border border-line px-3 py-1 text-[11px] text-ink hover:border-forest-line hover:text-forest"
                                    >
                                        投稿
                                    </Link>
                                    <Link
                                        href={`/workspace/${novel.id}/settings`}
                                        className="rounded-md border border-line px-3 py-1 text-[11px] text-ink hover:border-forest-line hover:text-forest"
                                    >
                                        設定
                                    </Link>
                                    {isPublic && (
                                        <Link
                                            href={`/novel/${novel.id}`}
                                            className="rounded-md border border-line px-3 py-1 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                                        >
                                            読者から見る
                                        </Link>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
