/**
 * ============================================================
 * 原石航路 Studio
 * AdminShell — 運営の画面の枠
 *
 * 左に行き先、右に中身。マイページと同じ作り。
 *
 * ログインができるまでは誰でも開ける。
 * 保存先ができたら、ここへ入れるのは運営だけにする。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import Header from "@/components/layout/header";

interface NavItem {
    href: string;
    label: string;
    note: string;
    /** ログインが要るので、まだ作っていないもの */
    isPending?: boolean;
}

const NAV: { group: string; items: NavItem[] }[] = [
    {
        group: "見る",
        items: [
            { href: "/admin", label: "ダッシュボード", note: "今どうなっているか" },
            { href: "/admin/analytics", label: "分析", note: "読まれ方の推移" },
        ],
    },
    {
        group: "出す",
        items: [
            { href: "/admin/notices", label: "お知らせ（ベル）", note: "利用者に届く通知" },
            { href: "/admin/contest", label: "コンテスト", note: "立てて、選ぶ" },
            { href: "/admin/banners", label: "バナー", note: "ホームに出す帯" },
            { href: "/admin/rooms", label: "公式の部屋", note: "誰でも入れる執筆室" },
            { href: "/admin/announcements", label: "お知らせ（サイト）", note: "ホームに並ぶもの" },
        ],
    },
    {
        group: "決める",
        items: [
            { href: "/admin/features", label: "機能の入切", note: "出す・隠す" },
            { href: "/admin/ng-words", label: "使わない言葉", note: "推敲で知らせる" },
        ],
    },
    {
        group: "人",
        items: [
            { href: "/admin/users", label: "利用者", note: "権限・停止" },
        ],
    },
    {
        group: "受け取る",
        items: [
            { href: "/admin/reports", label: "通報", note: "見かけた振る舞い" },
            { href: "/admin/contacts", label: "問い合わせ", note: "受け取りと返信" },
            { href: "/admin/novels", label: "作品の確認", note: "公開されたもの" },
            { href: "/admin/discovers", label: "発掘", note: "読者が見つけたもの" },
        ],
    },
    {
        group: "送る",
        items: [
            { href: "/admin/messages", label: "個別のお知らせ", note: "特定の人へ送る" },
        ],
    },
];

interface Props {
    title: string;
    description?: string;
    /** 見出しの右に置くもの */
    action?: React.ReactNode;
    children: React.ReactNode;
}

export default function AdminShell({ title, description, action, children }: Props) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-canvas">
            <Header breadcrumbs={[{ label: "運営" }, { label: title }]} />

            <div className="grid items-start xl:grid-cols-[240px_minmax(0,1fr)]">
                {/* 左 */}
                <aside className="border-line px-4 py-6 xl:border-r">
                    <p className="px-2 text-[11px] font-medium tracking-wide text-faint">
                        運営
                    </p>

                    <nav className="mt-3 space-y-4">
                        {NAV.map((group) => (
                            <div key={group.group}>
                                <p className="px-2 text-[10px] text-faint">
                                    {group.group}
                                </p>

                                <ul className="mt-1 space-y-0.5">
                                    {group.items.map((item) => {
                                        const isCurrent = pathname === item.href;

                                        if (item.isPending) {
                                            return (
                                                <li key={item.label}>
                                                    <span
                                                        className="block cursor-not-allowed rounded-lg px-2.5 py-1.5 opacity-45"
                                                        title="ログインの仕組みができてからになります"
                                                    >
                                                        <span className="block text-[13px] text-ink">
                                                            {item.label}
                                                        </span>
                                                        <span className="block text-[10px] text-faint">
                                                            {item.note}
                                                        </span>
                                                    </span>
                                                </li>
                                            );
                                        }

                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    aria-current={
                                                        isCurrent ? "page" : undefined
                                                    }
                                                    className={[
                                                        "block rounded-lg px-2.5 py-1.5",
                                                        isCurrent
                                                            ? "bg-forest-tint"
                                                            : "hover:bg-surface",
                                                    ].join(" ")}
                                                >
                                                    <span
                                                        className={[
                                                            "block text-[13px]",
                                                            isCurrent
                                                                ? "font-medium text-forest"
                                                                : "text-ink",
                                                        ].join(" ")}
                                                    >
                                                        {item.label}
                                                    </span>
                                                    <span className="block text-[10px] text-faint">
                                                        {item.note}
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* 右 */}
                <main className="min-w-0 px-6 py-6 sm:px-8">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-xl font-semibold tracking-wide text-ink">
                                {title}
                            </h1>
                            {description && (
                                <p className="mt-1 text-xs text-muted">{description}</p>
                            )}
                        </div>

                        {action}
                    </div>

                    {children}
                </main>
            </div>
        </div>
    );
}
