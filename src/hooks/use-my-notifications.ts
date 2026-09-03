/**
 * ============================================================
 * 原石航路 Studio
 * 自分あての知らせ
 *
 * 感想・返信・いいね など、自分に届いたもの。
 *
 * ★ 出す場所が 2 つある。
 *
 *   パソコン   ヘッダーのベルの中
 *   携帯       /notices（ベルを押すと、この頁へ行く）
 *
 *   同じ問い合わせを 2 か所に書くと、片方だけ古くなる。
 *   ここにまとめる。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export interface MyNotification {
    id: string;
    type: string;
    message: string;
    link: string | null;
    is_read: boolean;
    created_at: string;
}

/** 一度に読む数 */
const LIMIT = 30;

/**
 * 並びを整える。
 *
 * ★ 運営のお知らせは外す。
 *
 *   全員あてのお知らせは、この表にも入れている。
 *   ベルには「お知らせ」の一覧も並んでいるので、
 *   同じものが 2 行に出ていた。
 *
 * ★ 同じ中身は 1 行にまとめる。
 *
 *   送り直したぶんだけ行が増える。
 *   受け取る人には、同じ知らせが何度も届く理由が分からない。
 *   新しいほうを残す。
 */
function tidy(rows: MyNotification[]): MyNotification[] {
    const seen = new Set<string>();
    const result: MyNotification[] = [];

    for (const row of rows) {
        if (row.type === "announcement") continue;

        const key = `${row.type}\u0000${row.message}\u0000${row.link ?? ""}`;
        if (seen.has(key)) continue;

        seen.add(key);
        result.push(row);
    }

    return result;
}

export function useMyNotifications() {
    const [rows, setRows] = useState<MyNotification[]>([]);

    useEffect(() => {
        void (async () => {
            try {
                const supabase = createClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) return;

                const { data } = await supabase
                    .from("notifications")
                    .select("id, type, message, link, is_read, created_at")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(LIMIT);

                setRows(tidy((data ?? []) as MyNotification[]));
            } catch {
                /* 読めなくても、運営のお知らせだけは出す */
            }
        })();
    }, []);

    /*
     * 押したものだけ読んだ印を付ける。
     *
     * 開いただけで全部を読んだことにすると、
     * 見ていないものまで消えて、二度と気づけない。
     */
    const markRead = useCallback((id: string) => {
        setRows((prev) =>
            prev.map((row) => (row.id === id ? { ...row, is_read: true } : row)),
        );

        void (async () => {
            try {
                await createClient()
                    .from("notifications")
                    .update({ is_read: true })
                    .eq("id", id);
            } catch {
                /* 付かなくても、行き先へは進める */
            }
        })();
    }, []);

    const unreadCount = rows.filter((row) => !row.is_read).length;

    return { rows, unreadCount, markRead };
}
