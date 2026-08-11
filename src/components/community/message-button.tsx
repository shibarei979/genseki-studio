/**
 * ============================================================
 * 原石航路 Studio
 * MessageButton — この人にメッセージを送る
 *
 * 会話がまだ無ければ作り、あればそれを開く。
 *
 * ------------------------------------------------------------
 * 同じ 2 人で会話が 2 つできないようにする
 *
 * id の小さいほうを user_a に入れる、と決めてある。
 * 決めておかないと、A から始めた会話と
 * B から始めた会話が別々にでき、片方だけに返事が溜まる。
 * ============================================================
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function MessageButton({
    targetId,
    userId,
}: {
    targetId: string;
    userId: string | null;
}) {
    const router = useRouter();
    const [isWorking, setIsWorking] = useState(false);

    /* 自分自身には出さない */
    if (!userId || userId === targetId) return null;

    async function open() {
        if (isWorking || !userId) return;
        setIsWorking(true);

        const supabase = createClient();

        const [a, b] = userId < targetId ? [userId, targetId] : [targetId, userId];

        /* すでにあるか */
        const { data: found } = await supabase
            .from("conversations")
            .select("id")
            .eq("user_a", a)
            .eq("user_b", b)
            .maybeSingle();

        if (!found) {
            await supabase.from("conversations").insert({ user_a: a, user_b: b });
        }

        setIsWorking(false);
        router.push("/rooms?view=dm");
    }

    return (
        <button
            type="button"
            onClick={() => void open()}
            disabled={isWorking}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                border: "1px solid var(--color-brand-border)",
                borderRadius: 8,
                background: "var(--color-bg-card)",
                color: "var(--color-text-muted)",
                fontSize: 12.5,
                cursor: "pointer",
                opacity: isWorking ? 0.6 : 1,
            }}
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect x="3" y="5.5" width="18" height="13" rx="2" />
                <path d="m3.8 7 8.2 6 8.2-6" />
            </svg>
            {isWorking ? "開いています" : "メッセージ"}
        </button>
    );
}
