/**
 * ============================================================
 * 原石航路 Studio
 * AdminReportsClient — 通報
 *
 * 書き手から届いたものを読み、対応の段階を進める。
 *
 * ------------------------------------------------------------
 * 作りで気をつけたこと
 *
 * 未対応を先頭に固定する。
 * 届いた順に並べると、古い未対応が下に流れて埋もれる。
 *
 * 消すのは最後の手段にする。
 * 「問題なし」で残しておけば、同じ相手が繰り返し
 * 挙げられていることに後から気づける。
 *
 * 同じ人が何回挙げられているかを数えて出す。
 * 1 件ずつ読んでいると、1 回きりの諍いなのか、
 * いつもそうなのかが分からない。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AdminShell from "@/components/admin/admin-shell";
import { getRepository } from "@/lib/repository";
import type { Report, ReportStatus } from "@/types";
import {
    REPORT_REASON_LABEL,
    REPORT_STATUS_LABEL,
    REPORT_TARGET_LABEL,
} from "@/types";

const STATUSES: ReportStatus[] = ["open", "checking", "done", "dismissed"];

/** 未対応を先頭に。あとは新しい順 */
const STATUS_ORDER: Record<ReportStatus, number> = {
    open: 0,
    checking: 1,
    done: 2,
    dismissed: 3,
};

const STATUS_STYLE: Record<ReportStatus, string> = {
    open: "bg-[var(--color-danger-tint)] text-[var(--color-danger)]",
    checking: "bg-amber-tint text-amber",
    done: "bg-[var(--color-leaf-tint)] text-[var(--color-leaf)]",
    dismissed: "bg-canvas text-muted",
};

export default function AdminReportsClient() {
    const [reports, setReports] = useState<Report[] | null>(null);
    const [filter, setFilter] = useState<ReportStatus | "all">("open");

    const reload = useCallback(async () => {
        setReports(await getRepository().listReports());
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    async function patch(reportId: string, next: Partial<Report>) {
        await getRepository().updateReport(reportId, next);
        await reload();
    }

    const all = reports ?? [];

    /** 通報された人ごとの件数。繰り返し挙げられている人に気づくため */
    const countByAccused = new Map<string, number>();
    for (const row of all) {
        countByAccused.set(
            row.accused_id,
            (countByAccused.get(row.accused_id) ?? 0) + 1,
        );
    }

    const shown = all
        .filter((row) => filter === "all" || row.status === filter)
        .sort((a, b) => {
            const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
            return byStatus !== 0
                ? byStatus
                : b.created_at.localeCompare(a.created_at);
        });

    const openCount = all.filter((row) => row.status === "open").length;

    return (
        <AdminShell
            title="通報"
            description="執筆室で見かけたものを、書き手が知らせてきたものです。"
        >
            {/* 絞り込み */}
            <div className="flex flex-wrap items-center gap-1.5">
                <FilterChip
                    label="未対応"
                    count={openCount}
                    isCurrent={filter === "open"}
                    onClick={() => setFilter("open")}
                />
                {STATUSES.filter((key) => key !== "open").map((key) => (
                    <FilterChip
                        key={key}
                        label={REPORT_STATUS_LABEL[key]}
                        count={all.filter((row) => row.status === key).length}
                        isCurrent={filter === key}
                        onClick={() => setFilter(key)}
                    />
                ))}
                <FilterChip
                    label="すべて"
                    count={all.length}
                    isCurrent={filter === "all"}
                    onClick={() => setFilter("all")}
                />
            </div>

            {reports === null ? (
                <p className="py-16 text-center text-sm text-faint">読み込んでいます</p>
            ) : shown.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-line py-16 text-center text-sm text-faint">
                    {filter === "open"
                        ? "未対応の通報はありません。"
                        : "この状態の通報はありません。"}
                </p>
            ) : (
                <ul className="mt-4 space-y-2">
                    {shown.map((report) => {
                        const repeats = countByAccused.get(report.accused_id) ?? 1;

                        return (
                            <li
                                key={report.id}
                                className="rounded-xl border border-line bg-surface px-4 py-3.5"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[report.status]}`}
                                    >
                                        {REPORT_STATUS_LABEL[report.status]}
                                    </span>
                                    <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] text-muted">
                                        {REPORT_TARGET_LABEL[report.target]}
                                    </span>
                                    <span className="rounded-full bg-forest-tint px-2 py-0.5 text-[10px] text-forest">
                                        {REPORT_REASON_LABEL[report.reason]}
                                    </span>

                                    <span className="ml-auto text-[10px] tabular-nums text-faint">
                                        {formatWhen(report.created_at)}
                                    </span>
                                </div>

                                <p className="mt-2 text-[13px] text-ink">
                                    <span className="font-semibold">
                                        {report.accused_name}
                                    </span>
                                    <span className="text-muted"> さんについて</span>

                                    {/*
                                     * 繰り返し挙げられている人に印を付ける。
                                     * 1 件ずつ読んでいると気づけない。
                                     */}
                                    {repeats > 1 && (
                                        <span className="ml-2 rounded bg-amber-tint px-1.5 py-0.5 text-[10px] text-amber">
                                            この人の通報 {repeats}件目
                                        </span>
                                    )}
                                </p>

                                {report.quoted_body && (
                                    <p className="mt-2 rounded-lg bg-canvas px-3.5 py-2.5 text-[12px] leading-relaxed text-ink">
                                        {report.quoted_body}
                                    </p>
                                )}

                                {report.note && (
                                    <p className="mt-2 text-[12px] leading-relaxed text-muted">
                                        補足：{report.note}
                                    </p>
                                )}

                                <p className="mt-2 text-[10px] text-faint">
                                    {report.room_name} で・
                                    {report.reporter_name} さんから
                                </p>

                                {/* 覚え書き。何をしたかを残す */}
                                <textarea
                                    rows={2}
                                    defaultValue={report.memo}
                                    placeholder="対応の記録（運営だけが読みます）"
                                    onBlur={(event) => {
                                        if (event.target.value === report.memo) return;
                                        void patch(report.id, {
                                            memo: event.target.value,
                                        });
                                    }}
                                    className="mt-2.5 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] leading-relaxed outline-none focus:border-forest focus:bg-surface"
                                />

                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {STATUSES.map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() =>
                                                void patch(report.id, { status: key })
                                            }
                                            aria-pressed={report.status === key}
                                            className={[
                                                "rounded-full border px-3 py-1 text-[11px]",
                                                report.status === key
                                                    ? "border-forest bg-forest-tint text-forest"
                                                    : "border-line text-muted hover:text-ink",
                                            ].join(" ")}
                                        >
                                            {REPORT_STATUS_LABEL[key]}
                                        </button>
                                    ))}

                                    <Link
                                        href={`/rooms/${report.room_id}`}
                                        className="rounded-full border border-line px-3 py-1 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        部屋を見る
                                    </Link>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await getRepository().deleteReport(report.id);
                                            await reload();
                                        }}
                                        className="ml-auto px-2 text-[11px] text-faint hover:text-[var(--color-danger)]"
                                    >
                                        消す
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </AdminShell>
    );
}

function FilterChip({
    label,
    count,
    isCurrent,
    onClick,
}: {
    label: string;
    count: number;
    isCurrent: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isCurrent}
            className={[
                "rounded-full border px-3.5 py-1.5 text-[11px]",
                isCurrent
                    ? "border-forest bg-forest-tint text-forest"
                    : "border-line text-muted hover:text-ink",
            ].join(" ")}
        >
            {label}
            {count > 0 && (
                <span className="ml-1.5 tabular-nums text-faint">{count}</span>
            )}
        </button>
    );
}

/** 「08/07 21:30」の形。年は同じ年なら出さない */
function formatWhen(value: string): string {
    const date = new Date(value);
    const stamp = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
        date.getDate(),
    ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
    ).padStart(2, "0")}`;

    const year = date.getFullYear();
    return year === new Date().getFullYear() ? stamp : `${year}/${stamp}`;
}
