"use client";

import Link from "next/link";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * ============================================================
 * 原石航路 Studio
 * AdminCommentsClient — コメントの一覧と削除
 *
 * ★ 消す前に必ず聞く。
 *   コメントは書いた人のものなので、
 *   誤って消すと取り返しがつかない。
 *
 * ★ 消したものは、画面から外すだけにする。
 *   読み込み直すと、見ていた場所を見失う。
 * ============================================================
 */

export interface AdminComment {
    id: string;
    body: string;
    created_at: string;
    author: string;
    novelTitle: string;
    novelId: string;
    episodeId: string;
    /** 返信かどうか。話の流れを追うのに要る */
    isReply: boolean;
}

export default function AdminCommentsClient({
    comments,
}: {
    comments: AdminComment[];
}) {
    const [rows, setRows] = useState(comments);
    const [asking, setAsking] = useState<AdminComment | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    async function remove() {
        if (!asking || isBusy) return;

        setIsBusy(true);

        const { error } = await createClient()
            .from("comments")
            .delete()
            .eq("id", asking.id);

        setIsBusy(false);

        if (error) {
            window.alert("消せませんでした。時間をおいて試してください。");
            return;
        }

        setRows((prev) => prev.filter((one) => one.id !== asking.id));
        setAsking(null);
    }

    if (rows.length === 0) {
        return (
            <p
                style={{
                    padding: "40px 0",
                    textAlign: "center",
                    fontSize: 13,
                    color: "var(--admin-text-muted)",
                }}
            >
                コメントはありません
            </p>
        );
    }

    return (
        <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((one) => (
                    <div
                        key={one.id}
                        style={{
                            background: "var(--admin-bg-card)",
                            border: "1px solid var(--admin-border)",
                            borderRadius: 10,
                            padding: "14px 16px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                                marginBottom: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color: "var(--admin-text)",
                                }}
                            >
                                {one.author}
                            </span>

                            {one.isReply && (
                                <span
                                    style={{
                                        fontSize: 10,
                                        padding: "1px 6px",
                                        borderRadius: 3,
                                        background: "var(--admin-bg)",
                                        color: "var(--admin-text-muted)",
                                    }}
                                >
                                    返信
                                </span>
                            )}

                            <span
                                style={{
                                    fontSize: 11,
                                    color: "var(--admin-text-muted)",
                                }}
                            >
                                {new Date(one.created_at).toLocaleString("ja-JP")}
                            </span>

                            {/*
                              * 元の話へ行く道。
                              *
                              * 前後の流れを見ないと、
                              * 消してよいかは判断できない。
                              */}
                            <Link
                                href={`/novel/${one.novelId}/episode/${one.episodeId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    fontSize: 11,
                                    color: "var(--admin-stat-blue)",
                                    textDecoration: "none",
                                }}
                            >
                                {one.novelTitle} →
                            </Link>

                            <button
                                type="button"
                                onClick={() => setAsking(one)}
                                style={{
                                    marginLeft: "auto",
                                    padding: "4px 12px",
                                    border: "1px solid var(--admin-border)",
                                    borderRadius: 6,
                                    background: "transparent",
                                    color: "var(--color-danger)",
                                    fontSize: 11,
                                    cursor: "pointer",
                                }}
                            >
                                消す
                            </button>
                        </div>

                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                lineHeight: 1.85,
                                color: "var(--admin-text)",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {one.body}
                        </p>
                    </div>
                ))}
            </div>

            {/* 消してよいか聞く */}
            {asking && (
                <div
                    onClick={() => setAsking(null)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 300,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                        background: "rgba(0,0,0,.5)",
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "100%",
                            maxWidth: 420,
                            padding: 20,
                            borderRadius: 12,
                            background: "var(--admin-bg-card)",
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--admin-text)",
                            }}
                        >
                            このコメントを消しますか
                        </p>

                        <p
                            style={{
                                margin: "12px 0 0",
                                maxHeight: 140,
                                overflowY: "auto",
                                padding: "10px 12px",
                                borderRadius: 8,
                                background: "var(--admin-bg)",
                                fontSize: 12.5,
                                lineHeight: 1.85,
                                color: "var(--admin-text-muted)",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {asking.body}
                        </p>

                        <p
                            style={{
                                margin: "10px 0 0",
                                fontSize: 11,
                                color: "var(--admin-text-muted)",
                            }}
                        >
                            消したものは元に戻せません。
                        </p>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 8,
                                marginTop: 16,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setAsking(null)}
                                style={{
                                    padding: "8px 16px",
                                    border: "1px solid var(--admin-border)",
                                    borderRadius: 8,
                                    background: "transparent",
                                    color: "var(--admin-text-muted)",
                                    fontSize: 12.5,
                                    cursor: "pointer",
                                }}
                            >
                                やめる
                            </button>
                            <button
                                type="button"
                                onClick={() => void remove()}
                                disabled={isBusy}
                                style={{
                                    padding: "8px 18px",
                                    border: "none",
                                    borderRadius: 8,
                                    background: "var(--color-danger)",
                                    color: "#fff",
                                    fontSize: 12.5,
                                    cursor: "pointer",
                                    opacity: isBusy ? 0.5 : 1,
                                }}
                            >
                                {isBusy ? "消しています…" : "消す"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
