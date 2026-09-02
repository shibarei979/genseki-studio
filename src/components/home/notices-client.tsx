/**
 * ============================================================
 * 原石航路 Studio
 * NoticesClient — お知らせ
 *
 * ベルの中には数件しか入らない。
 * 全部を落ち着いて読める場所として、この画面を置く。
 *
 * 年ごとに区切って並べる。
 * 数が増えたとき、いつ頃の話かが辿れるようにするため。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import EntryImage from "@/components/common/entry-image";
import Header from "@/components/layout/header";
import { useMyNotifications } from "@/hooks/use-my-notifications";
import { getRepository } from "@/lib/repository";
import type { AdminNotice, NoticeType } from "@/types";
import {
    NOTICE_TYPE_COLOR,
    NOTICE_TYPE_LABEL,
    NOTICES,
    noticeColor,
    noticeLabel,
} from "@/types";

type Filter = "all" | NoticeType;

export default function NoticesClient() {
    const [notices, setNotices] = useState<AdminNotice[] | null>(null);
    const [filter, setFilter] = useState<Filter>("all");
    const { rows: alerts, markRead: markAlertRead } = useMyNotifications();

    useEffect(() => {
        void (async () => {
            const today = new Date().toISOString().slice(0, 10);
            const rows = (await getRepository().listNotices()).filter(
                (row) => row.is_published && row.published_at <= today,
            );

            /*
             * 運営のものが無ければ、組み込みの案内を出す。
             * 空の画面を見せるより、これまでの変更が読めるほうがよい。
             */
            if (rows.length > 0) {
                setNotices(rows);
                return;
            }

            setNotices(
                NOTICES.map((row) => ({
                    id: row.id,
                    type: (row.kind === "release" ? "release" : "info") as NoticeType,
                    title: row.label,
                    body: "",
                    link: "",
                    image_url: null,
                    is_published: true,
                    published_at: row.date,
                    created_at: row.date,
                    updated_at: row.date,
                })),
            );
        })();
    }, []);

    const shown = (notices ?? []).filter(
        (row) => filter === "all" || row.type === filter,
    );

    /* 年ごとに束ねる */
    const byYear = new Map<string, AdminNotice[]>();
    for (const notice of shown) {
        const year = notice.published_at.slice(0, 4);
        byYear.set(year, [...(byYear.get(year) ?? []), notice]);
    }

    return (
        <div className="min-h-screen bg-canvas pb-16">
            <Header breadcrumbs={[{ label: "お知らせ" }]} />

            <main className="mx-auto max-w-3xl px-8 py-8">
                <h1 className="text-xl font-semibold tracking-wide text-ink">
                    お知らせ
                </h1>

                {/*
                  * 自分あての知らせ。
                  *
                  * ★ 携帯はベルを押すとこの頁へ来る。
                  *   ここに出さないと、携帯の人は感想が付いたことに気づけない。
                  */}
                {alerts.length > 0 && (
                    <section className="mt-5">
                        <h2 className="text-xs font-medium tracking-wide text-faint">
                            自分あて
                        </h2>

                        <ul className="mt-3 space-y-2">
                            {alerts.map((alert) => (
                                <li key={alert.id}>
                                    <Link
                                        href={alert.link || "#"}
                                        onClick={() => markAlertRead(alert.id)}
                                        className={[
                                            "flex items-center gap-3 rounded-xl border px-4 py-3 hover:bg-canvas",
                                            alert.is_read
                                                ? "border-line bg-surface"
                                                : "border-forest-line bg-forest-tint/40",
                                        ].join(" ")}
                                    >
                                        <span className="shrink-0 rounded-full bg-forest-tint px-1.5 py-0.5 text-[10px] text-forest">
                                            {alert.type === "reply"
                                                ? "返信"
                                                : alert.type === "like"
                                                  ? "いいね"
                                                  : alert.type === "comment"
                                                    ? "感想"
                                                    : "知らせ"}
                                        </span>
                                        <span className="min-w-0 flex-1 text-[13px] text-ink">
                                            {alert.message}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* 絞り込み */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                    {(["all", "important", "release", "maintenance", "info"] as Filter[])
                        .map((key) => {
                            const count =
                                key === "all"
                                    ? (notices ?? []).length
                                    : (notices ?? []).filter((row) => row.type === key)
                                          .length;
                            if (count === 0 && key !== "all") return null;

                            const tone =
                                key === "all" ? null : NOTICE_TYPE_COLOR[key as NoticeType];
                            const isCurrent = filter === key;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFilter(key)}
                                    aria-pressed={isCurrent}
                                    className="rounded-full border px-3.5 py-1.5 text-[11px] font-medium"
                                    style={{
                                        background: isCurrent
                                            ? (tone?.bg ?? "var(--color-forest-tint)")
                                            : "transparent",
                                        color: isCurrent
                                            ? (tone?.text ?? "var(--color-forest)")
                                            : "#7d867f",
                                        borderColor: isCurrent
                                            ? (tone?.text ?? "var(--color-forest)")
                                            : "var(--color-line)",
                                    }}
                                >
                                    {key === "all"
                                        ? "すべて"
                                        : NOTICE_TYPE_LABEL[key as NoticeType]}
                                    <span className="ml-1.5 opacity-70">{count}</span>
                                </button>
                            );
                        })}
                </div>

                {notices === null ? (
                    <p className="py-20 text-center text-sm text-faint">
                        読み込んでいます
                    </p>
                ) : shown.length === 0 ? (
                    <p className="mt-6 rounded-xl border border-dashed border-line py-20 text-center text-sm text-faint">
                        お知らせはまだありません。
                    </p>
                ) : (
                    Array.from(byYear.entries()).map(([year, rows]) => (
                        <section key={year} className="mt-8">
                            <h2 className="text-xs font-medium tracking-wide text-faint">
                                {year}年
                            </h2>

                            <ul className="mt-3 space-y-2">
                                {rows.map((notice) => (
                                    <li key={notice.id}>
                                        <NoticeCard notice={notice} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))
                )}
            </main>
        </div>
    );
}

/**
 * ============================================================
 * 一件ぶん
 * ============================================================
 */

function NoticeCard({ notice }: { notice: AdminNotice }) {
    const tone = noticeColor(notice.type);

    const inner = (
        <>
            {/* 左端に種類の色。並べたとき目印になる */}
            <span
                className="w-1 shrink-0 rounded-full"
                style={{ background: tone.text }}
            />

            <span className="min-w-0 flex-1 py-0.5">
                <span className="flex flex-wrap items-center gap-2">
                    <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: tone.bg, color: tone.text }}
                    >
                        {noticeLabel(notice.type)}
                    </span>
                    <span className="text-[11px] text-faint">
                        {formatDate(notice.published_at)}
                    </span>
                </span>

                <span className="mt-1.5 block text-sm font-medium leading-snug text-ink">
                    {notice.title || "（題名なし）"}
                </span>

                {notice.body && (
                    <span className="mt-1 block whitespace-pre-wrap text-xs leading-relaxed text-muted">
                        {notice.body}
                    </span>
                )}
            </span>

            {notice.image_url && (
                <EntryImage
                    src={notice.image_url}
                    className="aspect-video w-28 shrink-0 self-start rounded-lg border border-line object-cover"
                />
            )}
        </>
    );

    if (notice.link) {
        return (
            <Link
                href={notice.link}
                className="flex gap-3 rounded-xl bg-surface p-4 hover:shadow-sm"
            >
                {inner}
            </Link>
        );
    }

    return <div className="flex gap-3 rounded-xl bg-surface p-4">{inner}</div>;
}

/** 「2026年8月3日（月）」 */
function formatDate(text: string): string {
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) return text;
    const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${week}）`;
}
