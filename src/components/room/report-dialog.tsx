/**
 * ============================================================
 * 原石航路 Studio
 * ReportDialog — 通報する
 *
 * 執筆室で見かけた発言や人を、運営へ知らせる。
 *
 * ------------------------------------------------------------
 * 作りで気をつけたこと
 *
 * 出したあと「送りました」で終わらせ、
 * その後どうなるかは書かない。
 * 「対応します」と約束すると、対応できなかったときに嘘になる。
 *
 * 通報された発言の本文をここで控えて送る。
 * 相手が消したあとでは、運営が確かめようがない。
 *
 * 相手には知らせない。
 * 通報したことが伝わると、同じ部屋にいづらくなる。
 * ============================================================
 */

"use client";

import { useState } from "react";

import { getRepository } from "@/lib/repository";
import type { ReportReason, ReportTarget } from "@/types";
import { REPORT_REASON_LABEL } from "@/types";

interface Props {
    target: ReportTarget;
    roomId: string;
    roomName: string;
    accusedId: string;
    accusedName: string;
    /** 発言を通報するときの本文 */
    quotedBody?: string;
    reporterId: string;
    reporterName: string;
    onClose: () => void;
}

const REASONS: ReportReason[] = [
    "abuse",
    "harassment",
    "spam",
    "sexual",
    "danger",
    "other",
];

export default function ReportDialog({
    target,
    roomId,
    roomName,
    accusedId,
    accusedName,
    quotedBody,
    reporterId,
    reporterName,
    onClose,
}: Props) {
    const [reason, setReason] = useState<ReportReason>("abuse");
    const [note, setNote] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState("");

    async function send() {
        if (isSending) return;
        setIsSending(true);
        setError("");

        try {
            await getRepository().createReport({
                target,
                reason,
                note: note.trim(),
                room_id: roomId,
                room_name: roomName,
                accused_id: accusedId,
                accused_name: accusedName,
                quoted_body: quotedBody ?? "",
                reporter_id: reporterId,
                reporter_name: reporterName,
            });
            setIsSent(true);
        } catch (caught) {
            setError(
                caught instanceof Error ? caught.message : "送れませんでした",
            );
        } finally {
            setIsSending(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface px-6 py-6">
                {isSent ? (
                    <>
                        <h2 className="text-[16px] font-semibold text-ink">
                            運営に送りました
                        </h2>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                            内容を確認します。
                            相手にはあなたが通報したことは伝わりません。
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-4 w-full rounded-lg bg-forest-dark py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                        >
                            閉じる
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-[16px] font-semibold text-ink">
                            {target === "message"
                                ? "この発言を通報する"
                                : `${accusedName} さんを通報する`}
                        </h2>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                            運営だけが読みます。
                            相手には伝わりません。
                        </p>

                        {/* 何を通報するのか、その場で見せる */}
                        {quotedBody && (
                            <p className="mt-3 max-h-[6em] overflow-y-auto rounded-lg bg-canvas px-3.5 py-2.5 text-[12px] leading-relaxed text-ink">
                                {accusedName}：{quotedBody}
                            </p>
                        )}

                        <div className="mt-4">
                            <p className="text-[12px] text-ink">どれに当てはまりますか</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {REASONS.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setReason(key)}
                                        aria-pressed={reason === key}
                                        className={[
                                            "rounded-full border px-3.5 py-1.5 text-[11px]",
                                            reason === key
                                                ? "border-forest bg-forest-tint text-forest"
                                                : "border-line text-muted hover:text-ink",
                                        ].join(" ")}
                                    >
                                        {REPORT_REASON_LABEL[key]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-3">
                            <label
                                htmlFor="report-note"
                                className="block text-[12px] text-ink"
                            >
                                補足（任意）
                            </label>
                            <textarea
                                id="report-note"
                                rows={3}
                                value={note}
                                maxLength={300}
                                onChange={(event) => setNote(event.target.value)}
                                placeholder="いつ、どんなやりとりがあったか"
                                className="mt-1 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] leading-relaxed outline-none focus:border-forest focus:bg-surface"
                            />
                        </div>

                        {error && (
                            <p className="mt-2 rounded-lg bg-[var(--color-danger-tint)] px-3 py-2 text-[11px] text-[var(--color-danger)]">
                                {error}
                            </p>
                        )}

                        <div className="mt-4 space-y-2">
                            <button
                                type="button"
                                onClick={() => void send()}
                                disabled={isSending}
                                className="w-full rounded-lg bg-forest-dark py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                                {isSending ? "送っています" : "運営に送る"}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full py-1.5 text-[12px] text-muted hover:text-ink"
                            >
                                やめる
                            </button>
                        </div>

                        {/*
                         * 命に関わる話は、運営を待たせない。
                         * 通報は運営が読むまで時間がかかる。
                         */}
                        {reason === "danger" && (
                            <p className="mt-3 rounded-lg bg-amber-tint px-3.5 py-2.5 text-[11px] leading-relaxed text-amber">
                                いますぐ助けが要る状況なら、
                                運営を待たずに専門の窓口へ連絡してください。
                                通報は運営が読むまで時間がかかります。
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
