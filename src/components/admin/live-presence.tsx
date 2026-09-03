/**
 * ============================================================
 * 原石航路 Studio
 * LivePresence — いま開いている人
 *
 * ★ 自分だけで数を取りに行く。
 *
 *   運営のホームの数字は Promise.all の並びで作られていて、
 *   そこへ 1 つ足すと、そのあとの値が全部ずれる。
 *   実際に、登録者数・閲覧数・いいね数が入れ違ったことがある。
 *   だからこの部品は、その並びに触らない。
 *
 * ★ 15 秒ごとに数え直す。
 *   合図は 30 秒ごとに届くので、これより細かくしても意味がない。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

interface Counts {
    total: number;
    signedIn: number;
    guests: number;
}

/** 数え直す間隔 */
const EVERY_MS = 15_000;

export default function LivePresence() {
    const [counts, setCounts] = useState<Counts | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;

        const load = async () => {
            try {
                const response = await fetch("/api/presence");
                const data = await response.json();

                if (!alive) return;

                if (data?.error) {
                    setError(data.error);
                    return;
                }

                setError("");
                setCounts(data as Counts);
            } catch {
                if (alive) setError("数を取れませんでした");
            }
        };

        void load();
        const timer = window.setInterval(() => void load(), EVERY_MS);

        return () => {
            alive = false;
            window.clearInterval(timer);
        };
    }, []);

    return (
        <div className="rounded-lg border border-line bg-surface px-5 py-4">
            <div className="flex items-center gap-2">
                {/* 動いていることが見て分かるように、点を灯す */}
                <span className="h-2 w-2 shrink-0 rounded-full bg-forest" />
                <p className="text-[12px] text-muted">いま開いている人</p>
            </div>

            {error ? (
                <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p>
            ) : (
                <>
                    <p className="mt-1 text-[28px] font-semibold leading-tight text-ink">
                        {counts ? counts.total.toLocaleString() : "—"}
                    </p>

                    <p className="mt-1 text-[11.5px] text-faint">
                        {counts
                            ? `入っている人 ${counts.signedIn} ／ 入っていない人 ${counts.guests}`
                            : "数えています"}
                    </p>

                    <p className="mt-2 text-[11px] leading-relaxed text-faint">
                        直近 1 分に合図のあった画面の数です。
                        <br />
                        同じ人が 2 枚開いていれば 2 と数えます。
                    </p>
                </>
            )}
        </div>
    );
}
