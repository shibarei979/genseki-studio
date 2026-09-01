"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * WorkspaceNav — ワークスペース左上の切り替え
 *
 * 3 つに絞っている。
 * 通し読みは執筆画面の横に出す形にした。
 * 「書く」「読み返す」を行き来するのに画面ごと移るのは遠い。
 * ============================================================
 */

import Link from "next/link";
import { useState } from "react";

interface Props {
    workId: string;
    current: "write" | "settings" | "resource" | "post";
    /** 投稿へ渡す話。書いていた話をそのまま開くため */
    episodeId?: string | null;
}

export default function WorkspaceNav({ workId, current, episodeId }: Props) {
    /*
     * 携帯では畳む。
     *
     * ★ 4 つ縦に並ぶと、それだけで画面の半分を使う。
     *   いま居る所だけ出し、押すと残りが開く。
     */
    const [isOpen, setIsOpen] = useState(false);

    const label =
        current === "write" ? "執筆"
        : current === "settings" ? "設定"
        : current === "resource" ? "資料"
        : "投稿";

    return (
        <div className="space-y-2">
            {/* いま居る所。押すと残りが開く */}
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-forest bg-forest px-4 py-2.5 text-[13px] font-medium text-white lg:hidden"
            >
                <span>{label}</span>
                <span
                    aria-hidden="true"
                    className="text-[11px]"
                    style={{
                        display: "inline-block",
                        transform: isOpen ? "rotate(180deg)" : "none",
                        transition: "transform .15s ease",
                    }}
                >
                    ⌄
                </span>
            </button>

            <div className={`${isOpen ? "" : "hidden"} space-y-2 lg:block`}>
            <div className="grid grid-cols-3 gap-2">
            <NavButton
                href={`/workspace/${workId}`}
                label="執筆"
                isActive={current === "write"}
            />
            <NavButton
                href={`/workspace/${workId}/settings`}
                label="設定"
                isActive={current === "settings"}
            />
                <NavButton
                    href={`/workspace/${workId}/resource`}
                    label="資料"
                    isActive={current === "resource"}
                />
            </div>

            {/*
             * 投稿は、書き終えてから外へ出すもの。
             * 上の 3 つとは目的が違うので、段を分ける。
             */}
            <NavButton
                href={
                    episodeId
                        ? `/workspace/${workId}/post?ep=${episodeId}`
                        : `/workspace/${workId}/post`
                }
                label="投稿"
                isActive={current === "post"}
            />
            </div>
        </div>
    );
}

function NavButton({
    href,
    label,
    isActive,
}: {
    href: string;
    label: string;
    isActive: boolean;
}) {
    return (
        <Link
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={[
                "block rounded-md px-3 py-2 text-center text-[13px]",
                isActive
                    ? "bg-forest text-white"
                    : "border border-line text-muted hover:bg-canvas",
            ].join(" ")}
        >
            {label}
        </Link>
    );
}
