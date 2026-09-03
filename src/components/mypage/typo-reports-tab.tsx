/**
 * ============================================================
 * 原石航路 Studio
 * TypoReportsTab — 届いた誤字報告
 *
 * ★ 読めるのは 3 者だけ。
 *   作品の作者・報告した本人・運営。
 *   表の決まりでそう定めてあるので、
 *   ここでは自分の作品ぶんだけが返ってくる。
 *
 * ★ 消す操作には確認を出す。
 *   戻せないため。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

interface Row {
    id: string;
    novel_id: string;
    episode_id: string | null;
    original_text: string;
    suggested_text: string | null;
    note: string | null;
    created_at: string;
    novel_title?: string | null;
    episode_title?: string | null;
}

export default function TypoReportsTab() {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            const supabase = createClient();

            const { data, error: readError } = await supabase
                .from("typo_reports")
                .select("id, novel_id, episode_id, original_text, suggested_text, note, created_at")
                .order("created_at", { ascending: false })
                .limit(200);

            if (readError) throw readError;

            const list = (data ?? []) as Row[];

            /* 作品名と話名を足す。無くても一覧は出す */
            const novelIds = [...new Set(list.map((one) => one.novel_id))];
            const episodeIds = [
                ...new Set(list.map((one) => one.episode_id).filter(Boolean)),
            ] as string[];

            const [novels, episodes] = await Promise.all([
                novelIds.length
                    ? supabase.from("novels").select("id, title").in("id", novelIds)
                    : Promise.resolve({ data: [] }),
                episodeIds.length
                    ? supabase.from("episodes").select("id, title").in("id", episodeIds)
                    : Promise.resolve({ data: [] }),
            ]);

            const novelName = new Map(
                (novels.data ?? []).map((one: { id: string; title: string }) => [
                    one.id,
                    one.title,
                ]),
            );
            const episodeName = new Map(
                (episodes.data ?? []).map((one: { id: string; title: string }) => [
                    one.id,
                    one.title,
                ]),
            );

            setRows(
                list.map((one) => ({
                    ...one,
                    novel_title: novelName.get(one.novel_id) ?? null,
                    episode_title: one.episode_id
                        ? (episodeName.get(one.episode_id) ?? null)
                        : null,
                })),
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? `読み込めませんでした（${caught.message}）`
                    : "読み込めませんでした",
            );
            setRows([]);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function handleDelete(id: string) {
        if (!window.confirm("この報告を消します。元には戻せません。")) return;

        try {
            await createClient().from("typo_reports").delete().eq("id", id);
            setRows((prev) => (prev ?? []).filter((one) => one.id !== id));
        } catch {
            window.alert("消せませんでした。時間をおいて試してください。");
        }
    }

    if (rows === null) {
        return <p style={{ fontSize: 13, color: "var(--color-text-faint)" }}>読み込んでいます</p>;
    }

    return (
        <div>
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
                    誤字報告
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-muted)" }}>
                    読者から届いた指摘です。読めるのは、あなたと報告した人と運営だけです。
                </div>
            </div>

            {error && (
                <p style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</p>
            )}

            {rows.length === 0 && !error && (
                <p style={{ fontSize: 13, color: "var(--color-text-faint)" }}>
                    まだ届いていません。
                </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((row) => (
                    <div
                        key={row.id}
                        style={{
                            border: "1px solid var(--color-brand-border)",
                            borderRadius: 10,
                            padding: "12px 14px",
                            background: "var(--color-bg-card)",
                        }}
                    >
                        <div style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                            {row.novel_title || "作品"}
                            {row.episode_title ? ` ／ ${row.episode_title}` : ""}
                        </div>

                        <div style={{ marginTop: 8, fontSize: 13, color: "var(--color-text)", lineHeight: 1.8 }}>
                            <span style={{ color: "var(--color-danger)" }}>{row.original_text}</span>
                            {row.suggested_text && (
                                <>
                                    <span style={{ margin: "0 6px", color: "var(--color-text-faint)" }}>→</span>
                                    <span style={{ color: "var(--color-brand)" }}>{row.suggested_text}</span>
                                </>
                            )}
                        </div>

                        {row.note && (
                            <div
                                style={{
                                    marginTop: 8,
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    background: "var(--color-bg)",
                                    fontSize: 12.5,
                                    color: "var(--color-text-muted)",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {row.note}
                            </div>
                        )}

                        <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center" }}>
                            {row.episode_id && (
                                <Link
                                    href={`/workspace/${row.novel_id}?ep=${row.episode_id}`}
                                    style={{ fontSize: 12, color: "var(--color-brand)", textDecoration: "none" }}
                                >
                                    その話を直す →
                                </Link>
                            )}

                            <button
                                type="button"
                                onClick={() => void handleDelete(row.id)}
                                style={{
                                    marginLeft: "auto",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 11.5,
                                    color: "var(--color-danger)",
                                    padding: 0,
                                }}
                            >
                                消す
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
