/**
 * ============================================================
 * 原石航路 Studio
 * UserJoinPetals — 人が増えたら花が舞う
 *
 * 運営のダッシュボードで、登録した人が増えたときに
 * 花びらを降らせる。1 人につき 50 枚。
 *
 * 数字が 1 増えたことに、そのままでは気づけない。
 * 気づけたところで嬉しくもない。
 * せめて舞わせる。
 *
 * 前に見たときの数は端末に覚えておく。
 * 覚えないと、開くたびに毎回舞ってしまう。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

/** 1 人につき何枚舞うか */
const PETALS_PER_USER = 50;

/** 一度に舞う上限。増えすぎると画面が埋まって重い */
const PETALS_MAX = 400;

const SEEN_KEY = "genseki:admin-user-count";

/* 花びらの色。桜から山吹まで、淡いものだけ */
const COLORS = ["#f6c6d0", "#f7d9e0", "#efd6a8", "#f2e3c7", "#e8b7c4"];

export default function UserJoinPetals({ count }: { count: number }) {
    const [petals, setPetals] = useState(0);

    useEffect(() => {
        if (!Number.isFinite(count)) return;

        const seen = Number(window.localStorage.getItem(SEEN_KEY));
        window.localStorage.setItem(SEEN_KEY, String(count));

        /* 初めて開いた日は舞わせない。今までの全員ぶんが降ってしまう */
        if (!Number.isFinite(seen) || seen <= 0) return;

        const grew = count - seen;
        if (grew <= 0) return;

        setPetals(Math.min(PETALS_MAX, grew * PETALS_PER_USER));

        /* 降り終わったら片づける。置いたままだと次の描き直しで重なる */
        const timer = window.setTimeout(() => setPetals(0), 6000);
        return () => window.clearTimeout(timer);
    }, [count]);

    if (petals === 0) return null;

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
        >
            {Array.from({ length: petals }, (_, index) => (
                <span
                    key={index}
                    className="petal-piece absolute top-[-8%] block"
                    style={{
                        left: `${(index * 37) % 100}%`,
                        width: index % 3 === 0 ? 9 : 12,
                        height: index % 3 === 0 ? 7 : 9,
                        background: COLORS[index % COLORS.length],
                        animationDelay: `${(index % 20) * 0.14}s`,
                        animationDuration: `${3.2 + (index % 6) * 0.4}s`,
                    }}
                />
            ))}
        </div>
    );
}
