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

interface Props {
    workId: string;
    current: "write" | "settings" | "resource" | "post";
}

export default function WorkspaceNav({ workId, current }: Props) {
    return (
        <div className="space-y-2">
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
                href={`/workspace/${workId}/post`}
                label="投稿"
                isActive={current === "post"}
            />
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
                "block rounded-md px-3 py-2.5 text-center text-sm",
                isActive
                    ? "bg-forest text-white"
                    : "border border-line text-muted hover:bg-canvas",
            ].join(" ")}
        >
            {label}
        </Link>
    );
}
