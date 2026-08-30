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

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import Header from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
    href: string;
    label: string;
    note: string;
    /** ログインが要るので、まだ作っていないもの */
    isPending?: boolean;
    /**
     * 未対応の数を出す先。
     *
     * 「問い合わせが来ても気づけない」という声があった。
     * 管理画面を開いても、どこに新しいものがあるか分からない。
     * 並びの横に赤い丸で数を出す。
     */
    badge?: "contacts" | "reports" | "obi";
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
            { href: "/admin/reports", badge: "reports", label: "通報", note: "見かけた振る舞い" },
            { href: "/admin/contacts", badge: "contacts", label: "問い合わせ", note: "受け取りと返信" },
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

/** 未対応の数。開いたときに数え、1分ごとに数え直す */
function usePendingCounts() {
    const [counts, setCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        const supabase = createClient();

        async function count() {
            /*
             * head: true で数だけ頼む。
             * 行を運ばないので、何万件あっても軽い。
             */
            const [contacts, reports, obi] = await Promise.all([
                supabase.from("contact_messages")
                    .select("*", { count: "exact", head: true })
                    .eq("is_read", false),
                supabase.from("reports")
                    .select("*", { count: "exact", head: true })
                    .eq("status", "open"),
                supabase.from("obi_dots")
                    .select("*", { count: "exact", head: true })
                    .eq("approved", false),
            ]);

            setCounts({
                contacts: contacts.count ?? 0,
                reports: reports.count ?? 0,
                obi: obi.count ?? 0,
            });
        }

        void count();

        /*
         * 開いたままにする人がいる。
         * 1 分ごとに数え直さないと、その間に来たものに気づけない。
         */
        const timer = window.setInterval(() => void count(), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    return counts;
}

export default function AdminShell({ title, description, action, children }: Props) {
    const pathname = usePathname();
    const counts = usePendingCounts();

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
                                                            "flex items-center gap-2 text-[13px]",
                                                            isCurrent
                                                                ? "font-medium text-forest"
                                                                : "text-ink",
                                                        ].join(" ")}
                                                    >
                                                        {item.label}
                                                        {/*
                                                          * 未対応の数。
                                                          *
                                                          * 0 のときは何も出さない。
                                                          * いつも出ていると、目が慣れて気づかなくなる。
                                                          */}
                                                        {item.badge && (counts[item.badge] ?? 0) > 0 && (
                                                            <span
                                                                aria-label={`未対応 ${counts[item.badge]} 件`}
                                                                className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                                                            >
                                                                {counts[item.badge] > 99 ? "99+" : counts[item.badge]}
                                                            </span>
                                                        )}
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
