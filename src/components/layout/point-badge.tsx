"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";


/**
 * ============================================================
 * 原石航路 Studio
 * PointBadge — 頭の帯に出す、いまの無料ポイント
 *
 * ★ 2 段で出す。
 *
 *     無料pt
 *      50
 *
 *   横に並べると帯が狭くなる。
 *   縦に積めば、幅を取らずに数が大きく見える。
 *
 * ★ 入っている人にだけ出す。
 *   入っていない人に 0 を見せても、意味がない。
 *
 * ★ 有料ポイントは、まだ無い。
 *
 *   できたら「有料pt ｜ 無料pt」と並べる。
 *   いま器だけ作って 0 を並べても、
 *   何か月も 0 のままになる。
 * ============================================================
 */


/**
 * この人は運営か。
 *
 * ★ ポイントは、まだ試している最中。
 *
 *   読む人に見えてしまうと、
 *   「これは何に使えるのか」と聞かれることになる。
 *   中身が揃うまでは、運営だけに見せる。
 *
 * ★ 開けるときは、この gate を外すだけでよい。
 */
function useIsOperator(): boolean | null {
    const [isOperator, setIsOperator] = useState<boolean | null>(null);

    useEffect(() => {
        let alive = true;

        void (async () => {
            try {
                const supabase = createClient();
                const { data: auth } = await supabase.auth.getUser();
                const userId = auth.user?.id;

                if (!userId) {
                    if (alive) setIsOperator(false);
                    return;
                }

                const { data } = await supabase
                    .from("profiles")
                    .select("is_admin")
                    .eq("user_id", userId)
                    .maybeSingle();

                if (alive) {
                    setIsOperator(
                        (data as { is_admin?: boolean } | null)?.is_admin ===
                            true,
                    );
                }
            } catch {
                /* 調べられなければ、出さない */
                if (alive) setIsOperator(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    return isOperator;
}

/*
 * ★ ポイントは、みんなに開けた（ミッション・毎日ログインで貯まり、
 *   アイテムツリーで交換できるようになったため）。
 *   また運営だけに戻すときは false にする。
 */
const POINTS_OPEN = true;

export default function PointBadge() {
    const [points, setPoints] = useState<number | null>(null);
    const isOperator = useIsOperator();
    const canSee = POINTS_OPEN || isOperator === true;

    useEffect(() => {
        if (!canSee) return;

        let alive = true;

        const load = async () => {
            try {
                const response = await fetch("/api/points/me");
                if (!response.ok) return;

                const data = (await response.json()) as { free?: number };
                if (alive && typeof data.free === "number") {
                    setPoints(data.free);
                }
            } catch {
                /* 読めなくても、ほかは動く */
            }
        };
        void load();

        /* 毎日ログインのハンコを押したら、読み直す */
        const onStamp = () => void load();
        window.addEventListener("gk-login-stamp", onStamp);

        return () => {
            alive = false;
            window.removeEventListener("gk-login-stamp", onStamp);
        };
    }, [canSee]);

    if (!canSee) return null;

    /* 読めていないあいだは、場所を取らない */
    if (points === null) return null;

    return (
        <Link
            href="/mypage"
            aria-label={`無料ポイント ${points}`}
            /*
             * ★ 枠で囲う。
             *
             *   ただ字が並んでいるだけだと、
             *   隣の切り替えと地続きに見えて、
             *   どこからどこまでが何なのか分からない。
             *
             * ★ 右に間を空ける。
             *   切り替えに近すぎて、押し間違える。
             */
            style={{
                display: "flex",
                alignItems: "baseline",
                gap: 5,
                marginRight: 6,
                padding: "3px 11px",
                borderRadius: 999,
                border: "1px solid var(--color-brand-border)",
                background: "var(--color-brand-light)",
                textDecoration: "none",
                lineHeight: 1.2,
            }}
        >
            <span
                style={{
                    fontSize: 9.5,
                    letterSpacing: ".04em",
                    color: "var(--color-text-muted)",
                }}
            >
                無料
            </span>

            <span
                style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "var(--color-brand)",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {points.toLocaleString()}
            </span>

            <span
                style={{
                    fontSize: 9.5,
                    color: "var(--color-text-muted)",
                }}
            >
                pt
            </span>
        </Link>
    );
}
