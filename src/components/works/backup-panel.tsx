/**
 * ============================================================
 * 原石航路 Studio
 * BackupPanel — 全体のバックアップと復元
 *
 * 保存先がブラウザの中だけである以上、
 * 端末を変える、履歴を消す、それだけで作品は消える。
 * 書いたものが消えるのは、機能が足りないことよりずっと重い。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

import type { BackupFile, BackupSummary } from "@/lib/backup/format";
import { BACKUP_TABLE_LABEL, validateBackup } from "@/lib/backup/format";
import { getRepository } from "@/lib/repository";
import { downloadTextFile } from "@/lib/utils/manuscript";
import { formatDateTime, formatNumber } from "@/lib/utils/text";

const LAST_BACKUP_KEY = "genseki:last-backup-at";
/** これ以上あいたら知らせる */
const REMIND_AFTER_DAYS = 7;

interface Props {
    onRestored: () => void;
}

export default function BackupPanel({ onRestored }: Props) {
    const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
    const [pending, setPending] = useState<BackupFile | null>(null);
    const [summary, setSummary] = useState<BackupSummary | null>(null);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLastBackupAt(window.localStorage.getItem(LAST_BACKUP_KEY));
    }, []);

    const daysSince = lastBackupAt
        ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000)
        : null;
    const shouldRemind = daysSince === null || daysSince >= REMIND_AFTER_DAYS;

    async function handleExport() {
        const backup = await getRepository().exportAll();
        const stamp = new Date().toISOString().slice(0, 10);
        downloadTextFile(`原石航路-バックアップ-${stamp}.json`, JSON.stringify(backup));

        const now = new Date().toISOString();
        window.localStorage.setItem(LAST_BACKUP_KEY, now);
        setLastBackupAt(now);
    }

    async function handleSelectFile(file: File | undefined) {
        if (!file) return;
        setError("");
        setSummary(null);

        try {
            const text = await file.text();
            const result = validateBackup(JSON.parse(text));
            if (!result.ok) {
                setError(result.reason);
                return;
            }
            setPending(result.file);
        } catch {
            setError("ファイルを読み取れませんでした。");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleRestore(mode: "replace" | "merge") {
        if (!pending) return;

        const message =
            mode === "replace"
                ? "いまブラウザに入っているデータをすべて消してから、バックアップの内容を入れます。\n元に戻せません。"
                : "いまのデータは残したまま、バックアップにしか無いものを足します。";
        if (!window.confirm(message)) return;

        const result = await getRepository().importAll(pending, mode);
        setSummary(result);
        setPending(null);
        onRestored();
    }

    return (
        <div className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-6 py-5">
                <h2 className="text-base font-medium text-ink">バックアップ</h2>
                <p className="mt-1 text-sm text-muted">
                    すべての作品・原稿・資料・設定を 1 つのファイルに取り出せます。
                </p>
            </div>

            <div className="px-6 py-5">
                <div
                    className={[
                        "rounded-md border px-4 py-3",
                        shouldRemind
                            ? "border-[var(--color-amber)] bg-[var(--color-amber-tint)]"
                            : "border-forest-line bg-forest-tint/50",
                    ].join(" ")}
                >
                    {lastBackupAt ? (
                        <p className="text-sm text-ink">
                            最後のバックアップ：{formatDateTime(lastBackupAt)}
                            {daysSince !== null && daysSince > 0 && (
                                <span className="ml-1 text-muted">（{daysSince}日前）</span>
                            )}
                        </p>
                    ) : (
                        <p className="text-sm text-ink">まだ一度も取り出していません。</p>
                    )}
                    {shouldRemind && (
                        <p className="mt-1 text-xs text-muted">
                            いまの保存先はこのブラウザの中だけです。
                            履歴を消したり端末を変えたりすると作品は失われます。
                        </p>
                    )}
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <section>
                        <h3 className="text-sm font-medium text-ink">取り出す</h3>
                        <p className="mt-1 text-xs text-muted">
                            JSON ファイルとして保存します。別の端末で読み込めます。
                        </p>
                        <button
                            type="button"
                            onClick={() => void handleExport()}
                            className="mt-3 rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark"
                        >
                            すべてを書き出す
                        </button>
                    </section>

                    <section>
                        <h3 className="text-sm font-medium text-ink">戻す</h3>
                        <p className="mt-1 text-xs text-muted">
                            書き出したファイルを読み込みます。
                        </p>

                        <input
                            ref={fileInputRef}
                            id="backup-file"
                            type="file"
                            accept=".json,application/json"
                            onChange={(e) => void handleSelectFile(e.target.files?.[0])}
                            className="hidden"
                        />
                        <label
                            htmlFor="backup-file"
                            className="mt-3 inline-block cursor-pointer rounded-md border border-line px-4 py-2 text-sm text-ink hover:border-forest-line hover:text-forest"
                        >
                            バックアップを選ぶ
                        </label>

                        {error && (
                            <p className="mt-2 text-xs text-[var(--color-amber)]">{error}</p>
                        )}
                    </section>
                </div>

                {pending && (
                    <div className="mt-5 rounded-md border border-forest-line bg-forest-tint/40 p-4">
                        <p className="text-sm text-ink">
                            {formatDateTime(pending.meta.exported_at)} のバックアップ
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {Object.entries(pending.meta.counts)
                                .filter(([, count]) => count > 0)
                                .map(([table, count]) => (
                                    <li key={table}>
                                        {BACKUP_TABLE_LABEL[table] ?? table}{" "}
                                        <span className="text-ink">{formatNumber(count)}</span>
                                    </li>
                                ))}
                        </ul>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => void handleRestore("merge")}
                                className="rounded-md bg-forest px-4 py-2 text-sm text-white hover:bg-forest-dark"
                            >
                                いまのデータに足す
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleRestore("replace")}
                                className="rounded-md border border-[var(--color-amber)] px-4 py-2 text-sm text-[var(--color-amber)] hover:bg-[var(--color-amber-tint)]"
                            >
                                すべて置き換える
                            </button>
                            <button
                                type="button"
                                onClick={() => setPending(null)}
                                className="rounded-md px-4 py-2 text-sm text-faint hover:text-ink"
                            >
                                やめる
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-muted">
                            「足す」は、同じ作品がすでにあれば飛ばします。上書きはしません。
                        </p>
                    </div>
                )}

                {summary && (
                    <div className="mt-5 rounded-md border border-line bg-canvas p-4">
                        <p className="text-sm text-ink">読み込みました。</p>
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {Object.entries(summary.imported)
                                .filter(([, count]) => count > 0)
                                .map(([table, count]) => (
                                    <li key={table}>
                                        {BACKUP_TABLE_LABEL[table] ?? table}{" "}
                                        <span className="text-ink">{count}</span>
                                    </li>
                                ))}
                        </ul>
                        {summary.skipped > 0 && (
                            <p className="mt-1.5 text-xs text-faint">
                                すでにあった{summary.skipped}件は飛ばしました。
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
