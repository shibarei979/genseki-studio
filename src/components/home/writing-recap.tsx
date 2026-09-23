"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { coverFor } from "@/components/home/home-work-table";
import { SHEET_CHARS } from "@/components/mypage/reading-summary";
import { getRepository } from "@/lib/repository";
import type { Episode, WorkWithStats } from "@/types";

/**
 * ============================================================
 * 原石航路 Studio
 * WritingRecap — 先月どれだけ書いたかを、月が変わって最初に出す
 *
 * 読む人に出している「先月の読書」の、書く人版。
 * ただし見た目は分けている。読む人のまとめは「読んだ量」、
 * こちらは「作品がどう育ったか」を見せるため。
 *
 * ★ 出すのは、月ごとに 1 回だけ。
 *   出した月を端末に覚えておく。同じ月に何度来ても、二度は出ない。
 *
 * ★ 1 日でなくてもよい。
 *   月が変わって最初に来たときが、その人にとっての 1 日目。
 *
 * ★ 書いていない月は出さない。
 *   0 文字のまとめを見せられても、うれしくない。
 *   出さずに、覚えだけ立てて次の月へ回す。
 *
 * ★ 数えるのは「増えた文字数」。
 *   執筆の記録（writing_logs）に日ごとに残っている増分を足す。
 *   消した文字は差し引かない。書いた事実は残るため。
 *
 * ★ 言葉は、数から組み立てる。
 *   「今月の一言」も作品の一行も、決まりで選ぶ。
 *   外に問い合わせない。出すのに時間がかからないほうがよい。
 * ============================================================
 */

/** 出した月を覚えておく場所 */
const SEEN_KEY = "genseki:writing-recap";

interface WorkRow {
    id: string;
    title: string;
    chars: number;
    /** その前の月の文字数。伸びを出すために持つ */
    prevChars: number;
    episodes: number;
    coverUrl: string | null;
    coverColor: number | null;
    note: string;
}

interface Recap {
    /** "YYYY-MM" */
    key: string;
    chars: number;
    prevChars: number;
    days: number;
    prevDays: number;
    monthDays: number;
    /** 1 日が何曜日か（0=日）。升目を曜日に合わせるために持つ */
    firstWeekday: number;
    /** 日ごとの文字数（1 日目から末日まで） */
    daily: number[];
    bestDay: number;
    bestChars: number;
    /** いちばん長く続いた日数と、その始め・終わり */
    streak: number;
    streakFrom: number;
    streakTo: number;
    posted: number;
    prevPosted: number;
    postedChars: number;
    works: WorkRow[];
    workCount: number;
    word: string[];
}

/** 日本時間での "YYYY-MM" */
function monthKeyOf(date: Date) {
    return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
}

function labelOf(key: string) {
    const [year, month] = key.split("-");
    return `${year}年${Number(month)}月`;
}

export default function WritingRecap({
    works,
    episodes,
}: {
    works: WorkWithStats[];
    episodes: Episode[];
}) {
    const [shown, setShown] = useState<Recap | null>(null);

    useEffect(() => {
        if (works.length === 0) return;

        const now = new Date();
        const last = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        const before = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 2, 1));

        let seen: string | null = null;
        try {
            seen = window.localStorage.getItem(SEEN_KEY);
        } catch {
            /* 覚えられない端末では、毎月 1 回きりにできない。
             * それでも出さないよりはよい */
        }
        if (seen === last) return;

        let alive = true;

        void (async () => {
            const repository = getRepository();

            let lists;
            try {
                lists = await Promise.all(works.map((work) => repository.listWritingLogs(work.id)));
            } catch {
                /* 読めなければ出さない。次に来たときに、また試す */
                return;
            }

            const perDay = new Map<string, number>();
            const perDayBefore = new Set<string>();
            const rows: WorkRow[] = [];
            let chars = 0;
            let prevChars = 0;

            lists.forEach((logs, index) => {
                const work = works[index];
                let workChars = 0;
                let workPrev = 0;

                for (const log of logs) {
                    if (log.delta <= 0) continue;
                    const key = log.date.slice(0, 7);

                    if (key === before) {
                        workPrev += log.delta;
                        prevChars += log.delta;
                        perDayBefore.add(log.date);
                        continue;
                    }
                    if (key !== last) continue;

                    workChars += log.delta;
                    perDay.set(log.date, (perDay.get(log.date) ?? 0) + log.delta);
                }

                if (workChars <= 0) return;
                chars += workChars;

                rows.push({
                    id: work.id,
                    title: work.title || "名前のない作品",
                    chars: workChars,
                    prevChars: workPrev,
                    episodes: episodes.filter(
                        (episode) =>
                            episode.work_id === work.id &&
                            episode.is_published &&
                            (episode.posted_at ?? "").slice(0, 7) === last,
                    ).length,
                    coverUrl: work.cover_url ?? null,
                    coverColor: work.cover_color ?? null,
                    note: "",
                });
            });

            /* 書いていない月は出さず、覚えだけ立てる */
            if (chars <= 0) {
                try {
                    window.localStorage.setItem(SEEN_KEY, last);
                } catch {
                    /* 覚えられなくても、実害はない */
                }
                return;
            }

            rows.sort((a, b) => b.chars - a.chars);

            const [year, month] = last.split("-").map(Number);
            const monthDays = new Date(year, month, 0).getDate();
            const daily = Array.from({ length: monthDays }, (_, index) => {
                const day = String(index + 1).padStart(2, "0");
                return perDay.get(`${last}-${day}`) ?? 0;
            });

            /* いちばん書いた日 */
            let bestDay = 1;
            let bestChars = 0;
            daily.forEach((one, index) => {
                if (one > bestChars) {
                    bestChars = one;
                    bestDay = index + 1;
                }
            });

            /* いちばん長く続いた日並び */
            let streak = 0;
            let streakTo = 0;
            let run = 0;
            daily.forEach((one, index) => {
                run = one > 0 ? run + 1 : 0;
                if (run > streak) {
                    streak = run;
                    streakTo = index + 1;
                }
            });
            const streakFrom = streakTo - streak + 1;

            const postedList = episodes.filter(
                (episode) => episode.is_published && (episode.posted_at ?? "").slice(0, 7) === last,
            );
            const days = daily.filter((one) => one > 0).length;
            const prevPosted = episodes.filter(
                (episode) => episode.is_published && (episode.posted_at ?? "").slice(0, 7) === before,
            ).length;

            /* 作品ごとの一行 */
            rows.forEach((row, index) => {
                const growth = row.chars - row.prevChars;
                if (index === 0) {
                    row.note =
                        row.episodes > 0
                            ? `今月のかなめの作品です。${row.episodes}話を届けました。`
                            : "今月のかなめの作品です。物語が大きく進みました。";
                    return;
                }
                if (row.prevChars === 0) {
                    row.note = "今月から書きはじめました。これからが楽しみです。";
                    return;
                }
                if (growth > 0) {
                    row.note = `先月より ${growth.toLocaleString()} 文字ぶん進みました。`;
                    return;
                }
                row.note = "こつこつ書き進めました。";
            });

            /* 今月の一言 */
            const word: string[] = [];
            word.push(`今月は『${rows[0].title}』がいちばん進みました。`);
            if (days >= 20) word.push("ほとんど毎日、机に向かえた月でした。");
            else if (days >= 8) word.push("書くための時間を、よく守れています。");
            else word.push("書ける日に、まとめて進められた月でした。");

            const diff = chars - prevChars;
            if (prevChars > 0 && diff > 0) {
                word.push(`その前の月より ${diff.toLocaleString()} 文字多く書けました。`);
            } else if (prevChars > 0) {
                word.push("今月は控えめでしたが、続いていることが何よりです。");
            }
            if (word.length < 3) {
                word.push(
                    postedList.length > 0
                        ? `${postedList.length}話を読む人に届けました。この調子で続きも。`
                        : "書きためた分が、次の公開で効いてきます。",
                );
            }

            if (!alive) return;
            setShown({
                key: last,
                chars,
                prevChars,
                days,
                prevDays: perDayBefore.size,
                monthDays,
                firstWeekday: new Date(year, month - 1, 1).getDay(),
                daily,
                bestDay,
                bestChars,
                streak,
                streakFrom,
                streakTo,
                posted: postedList.length,
                prevPosted,
                postedChars: postedList.reduce((sum, episode) => sum + (episode.char_count ?? 0), 0),
                works: rows,
                workCount: works.length,
                word,
            });
        })();

        return () => {
            alive = false;
        };
    }, [works, episodes]);

    /*
     * ★ 逃げ道を用意する。
     *   Esc でも閉じられるようにし、開いている間は後ろを動かさない。
     *   後ろが動くと、閉じたときに読んでいた場所を見失う。
     */
    useEffect(() => {
        if (!shown) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") close();
        }

        const kept = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);

        return () => {
            document.body.style.overflow = kept;
            window.removeEventListener("keydown", onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shown]);

    function close() {
        if (shown) {
            try {
                window.localStorage.setItem(SEEN_KEY, shown.key);
            } catch {
                /* 覚えられなければ、次も出る。害はない */
            }
        }
        setShown(null);
    }

    if (!shown) return null;

    const monthLabel = labelOf(shown.key);
    const monthNumber = Number(shown.key.split("-")[1]);
    const sheets = Math.round(shown.chars / SHEET_CHARS);
    const diff = shown.chars - shown.prevChars;
    const top3 = shown.works.slice(0, 3);
    const topChars = top3[0]?.chars || 1;

    return (
        <div
            onClick={close}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 900,
                background: "rgba(26, 33, 29, .45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${monthLabel}の執筆`}
               
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 1040,
                    maxHeight: "92vh",
                    overflowY: "auto",
                    borderRadius: 20,
                    border: "1px solid #dfe8ee",
                    background: "linear-gradient(160deg,#f7fafc 0%,#ffffff 320px)",
                    boxShadow: "0 20px 50px rgba(20, 40, 55, .28)",
                    padding: "26px 28px 22px",
                }}
            >
                {/* 開いた合図。紙吹雪と、ひとすじの明かり */}
                <Confetti />

                {/* ── 見出しと絵 ───────────────────── */}
                <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2
                            style={{
                                margin: 0,
                                fontFamily: '"Hiragino Mincho ProN", garamond, serif',
                                fontSize: 27,
                                fontWeight: 700,
                                letterSpacing: ".04em",
                                color: "#17222b",
                            }}
                        >
                            {monthLabel}の執筆
                        </h2>
                        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#71818c" }}>
                            作品がどう育ったかを見る
                        </p>

                        {/* 文字数 */}
                        <div className="wrec-head" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 22, marginTop: 16 }}>
                            <div style={{ borderLeft: "3px solid #bcd3e2", paddingLeft: 14 }}>
                                <div style={{ fontSize: 11, color: "#71818c" }}>書いた文字数</div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                    <span
                                        style={{
                                            fontFamily: '"Hiragino Mincho ProN", garamond, serif',
                                            fontSize: 40,
                                            fontWeight: 700,
                                            lineHeight: 1.1,
                                            color: "#1f4e6b",
                                        }}
                                    >
                                        {shown.chars.toLocaleString()}
                                    </span>
                                    <span style={{ fontSize: 14, color: "#33414b" }}>文字</span>
                                </div>
                            </div>

                            <div style={{ borderLeft: "1px solid #e1e9ee", paddingLeft: 22, fontSize: 13.5, color: "#33414b", lineHeight: 2 }}>
                                <div>
                                    原稿用紙にすると <b style={{ fontSize: 17, color: "#17222b" }}>約{sheets.toLocaleString()}</b> 枚ぶん
                                </div>
                                {shown.prevChars > 0 && (
                                    <div>
                                        その前の月（{shown.prevChars.toLocaleString()} 文字）より{" "}
                                        <b style={{ fontSize: 17, color: diff >= 0 ? "#2d6a4f" : "#8a6b4b" }}>
                                            {diff >= 0 ? "+" : "−"}
                                            {Math.abs(diff).toLocaleString()}
                                        </b>{" "}
                                        文字
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DeskArt sheets={sheets} />
                </div>

                {/* ── 本体：左（作品とリズム）／右（記録と一言） ── */}
                <div className="wrec-body" style={{ display: "flex", gap: 22, marginTop: 22, alignItems: "stretch" }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        {/* 作品の伸び */}
                        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                            <div>
                                <SectionTitle icon={<RankIcon />} text="作品の伸び" />
                                <p style={{ margin: "2px 0 0 26px", fontSize: 11.5, color: "#8b98a1" }}>
                                    今月、たくさん書いた作品です
                                </p>
                            </div>
                            <a
                                href="/"
                                style={{ fontSize: 12, color: "#1f4e6b", textDecoration: "underline", whiteSpace: "nowrap" }}
                            >
                                すべての作品を見る（{shown.workCount}）→
                            </a>
                        </div>

                        <div className="wrec-works" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(top3.length, 1)}, minmax(0, 1fr))`, maxWidth: top3.length < 3 ? 640 : undefined, gap: 12, marginTop: 12 }}>
                            {top3.map((work, index) => (
                                <WorkCard key={work.id} work={work} rank={index + 1} topChars={topChars} />
                            ))}
                        </div>

                        {/* 執筆リズム */}
                        <div className="wrec-rhythm" style={{ marginTop: 20, flex: 1, display: "flex", flexDirection: "column", minHeight: 190 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                                <SectionTitle icon={<WaveIcon />} text="執筆リズム" />
                                <span style={{ fontSize: 11.5, color: "#8b98a1" }}>今月の書くペースです</span>
                            </div>
                            <Rhythm recap={shown} month={monthNumber} />
                        </div>
                    </div>

                    {/* 右の柱 */}
                    <div className="wrec-side" style={{ width: 306, flex: "none" }}>
                        <SectionTitle icon={<NoteIcon />} text="今月の記録" />

                        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                            <Tile
                                label="執筆日数"
                                value={`${shown.days}`}
                                unit={`日 / ${shown.monthDays}日`}
                                diff={shown.prevDays > 0 ? shown.days - shown.prevDays : undefined}
                                diffUnit="日"
                            >
                                <Calendar
                                    daily={shown.daily}
                                    best={shown.bestChars}
                                    firstWeekday={shown.firstWeekday}
                                />
                            </Tile>

                            <Tile
                                label="いちばん続いた日並び"
                                value={`${shown.streak}`}
                                unit="日"
                                right={`${monthNumber}月${shown.streakFrom}日 - ${monthNumber}月${shown.streakTo}日`}
                            >
                                <div style={{ display: "flex", gap: 3 }}>
                                    {Array.from({ length: Math.max(shown.streak, 5) }, (_, index) => (
                                        <span
                                            key={index}
                                            style={{
                                                width: 13,
                                                height: 13,
                                                borderRadius: 3,
                                                background: index < shown.streak ? "#4a7f9e" : "#dfe8ee",
                                            }}
                                        />
                                    ))}
                                </div>
                            </Tile>

                            <Tile
                                label="いちばん書いた日"
                                value={shown.bestChars.toLocaleString()}
                                unit="文字"
                                right={`${monthNumber}月${shown.bestDay}日`}
                            />

                            <Tile
                                label="公開した話"
                                value={`${shown.posted}`}
                                unit="話"
                                right={shown.postedChars > 0 ? `/ ${shown.postedChars.toLocaleString()} 文字` : undefined}
                                diff={shown.prevPosted > 0 ? shown.posted - shown.prevPosted : undefined}
                                diffUnit="話"
                            />
                        </div>

                        {/* 今月の一言 */}
                        <div
                            style={{
                                position: "relative",
                                overflow: "hidden",
                                marginTop: 12,
                                padding: "14px 16px",
                                borderRadius: 14,
                                border: "1px solid #dfe8ee",
                                background: "linear-gradient(140deg,#f7fbfa 0%,#ffffff 70%)",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                                <LeafIcon />
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#17222b" }}>今月の一言</span>
                            </div>
                            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.9, color: "#3a4750", position: "relative" }}>
                                {shown.word.map((one) => (
                                    <span key={one} style={{ display: "block" }}>
                                        {one}
                                    </span>
                                ))}
                            </p>
                            <LeafArt />
                        </div>
                    </div>
                </div>

                {/* ── 足元 ───────────────────────── */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                    {shown.works[0] && (
                        <a
                            href={`/workspace/${shown.works[0].id}`}
                            style={{
                                fontSize: 13,
                                color: "#1f4e6b",
                                textDecoration: "none",
                                border: "1px solid #cfdde6",
                                background: "#fff",
                                borderRadius: 10,
                                padding: "10px 20px",
                            }}
                        >
                            続きを書く
                        </a>
                    )}
                    <button
                        type="button"
                        onClick={close}
                        style={{
                            fontSize: 13,
                            color: "#fff",
                            background: "#1f4e6b",
                            border: "none",
                            borderRadius: 10,
                            padding: "10px 26px",
                            cursor: "pointer",
                        }}
                    >
                        閉じる
                    </button>
                </div>

                <style>{`
                    /*
                     * ★ 動きは、紙吹雪ひとつだけ。
                     *
                     *   窓・数字・棒・升目まで動かすと、
                     *   どこを見ればよいのか分からなくなる。
                     *   祝うのは一回でよい。
                     */
                    .wrec-fall { position: absolute; inset: 0; overflow: hidden; pointer-events: none; border-radius: 20px; z-index: 2; }
                    .wrec-fall span {
                        position: absolute; top: -24px; display: block;
                        animation: wrecConfetti 3s cubic-bezier(.35,.15,.55,1) both;
                    }
                    @keyframes wrecConfetti {
                        0%   { opacity: 0; transform: translate3d(0, -20px, 0) rotate(var(--turn, 0deg)) }
                        10%  { opacity: .95 }
                        50%  { transform: translate3d(var(--sway, 0px), 420px, 0) rotate(calc(var(--turn, 0deg) + 260deg)) }
                        85%  { opacity: .9 }
                        100% { opacity: 0; transform: translate3d(0, 900px, 0) rotate(calc(var(--turn, 0deg) + 560deg)) }
                    }

                    /* 画面が狭いときは、縦に積む */
                    @media (max-width: 899px) {
                        .wrec-body { flex-direction: column; }
                        .wrec-side { width: 100% !important; }
                        .wrec-works { grid-template-columns: 1fr !important; }
                        .wrec-art { display: none !important; }
                        .wrec-head { gap: 12px !important; }
                    }

                    /* 動きを減らしている人には、紙吹雪も出さない */
                    @media (prefers-reduced-motion: reduce) {
                        .wrec-fall { display: none !important; }
                    }
                `}</style>
            </div>
        </div>
    );
}

/* ============================================================
 * 部品
 * ========================================================== */

/**
 * 開いたときに、紙吹雪が降る。
 *
 * ★ 光る粒は使わない。
 *   落ちてくるのは紙。金・淡い青・白の三色だけにして、
 *   書く画面の色から外れないようにする。
 *
 * ★ 三秒で終わる。
 *   降り続けると、数字を読むのに邪魔になる。
 *   動きを減らしている人には、はじめから出さない。
 */
function Confetti() {
    /*
     * 落ちる場所と間は、あらかじめ決めておく。
     * 毎回でたらめにすると、開くたびに違う絵になって落ち着かない。
     */
    const colors = ["#d9b25c", "#e3c27f", "#8fb3c9", "#b9d2df", "#ffffff", "#cfe0d6"];
    const pieces = Array.from({ length: 46 }, (_, index) => {
        const spread = (index * 21.7) % 100;
        return {
            left: spread,
            color: colors[index % colors.length],
            width: 7 + ((index * 5) % 6),
            height: 11 + ((index * 7) % 8),
            delay: ((index * 13) % 12) / 10,
            duration: 2.4 + ((index * 3) % 9) / 10,
            turn: ((index * 53) % 90) - 45,
            sway: ((index % 5) - 2) * 30,
            round: index % 6 === 0,
        };
    });

    return (
        <div className="wrec-fall" aria-hidden="true">
            {pieces.map((one, index) => (
                <span
                    key={index}
                    style={{
                        left: `${one.left}%`,
                        width: one.width,
                        height: one.round ? one.width : one.height,
                        borderRadius: one.round ? "50%" : 1.5,
                        background: one.color,
                        boxShadow: one.color === "#ffffff" ? "0 0 0 1px #dde8ef inset" : "none",
                        animationDelay: `${one.delay}s`,
                        animationDuration: `${one.duration}s`,
                        ["--turn" as string]: `${one.turn}deg`,
                        ["--sway" as string]: `${one.sway}px`,
                    }}
                />
            ))}
        </div>
    );
}

function SectionTitle({ icon, text }: { icon: ReactNode; text: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon}
            <span style={{ fontSize: 15, fontWeight: 700, color: "#17222b", letterSpacing: ".03em" }}>{text}</span>
        </div>
    );
}

function Tile({
    label,
    value,
    unit,
    right,
    diff,
    diffUnit,
    children,
}: {
    label: string;
    value: string;
    unit: string;
    right?: string;
    /** 前の月との差。0 のときは出さない */
    diff?: number;
    diffUnit?: string;
    children?: ReactNode;
}) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#eef4f8", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#71818c" }}>{label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 1, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: '"Hiragino Mincho ProN", garamond, serif', fontSize: 22, fontWeight: 700, color: "#17222b", lineHeight: 1.2 }}>
                        {value}
                    </span>
                    <span style={{ fontSize: 11.5, color: "#71818c" }}>{unit}</span>
                    {typeof diff === "number" && diff !== 0 && (
                        <span
                            style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: diff > 0 ? "#2d6a4f" : "#8a6b4b",
                                background: diff > 0 ? "#e6f2ea" : "#f4eee7",
                                borderRadius: 7,
                                padding: "2px 6px",
                            }}
                        >
                            前の月より {diff > 0 ? "+" : "−"}
                            {Math.abs(diff)}
                            {diffUnit}
                        </span>
                    )}
                </div>
            </div>
            <div style={{ textAlign: "right" }}>
                {right && <div style={{ fontSize: 10.5, color: "#8b98a1", marginBottom: children ? 5 : 0 }}>{right}</div>}
                {children}
            </div>
        </div>
    );
}

/**
 * ひと月の升目。書いた日が濃くなる。
 *
 * ★ 曜日に合わせて並べる。
 *   ただ 7 つずつ折り返すと、ひと月の形に見えない。
 *   1 日の曜日から始めれば、暦と同じ並びになり、
 *   「週末しか書けていない」といったことも見て取れる。
 */
function Calendar({ daily, best, firstWeekday }: { daily: number[]; best: number; firstWeekday: number }) {
    return (
        <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 11px)", gap: 3, marginBottom: 3 }}>
                {["日", "月", "火", "水", "木", "金", "土"].map((one) => (
                    <span key={one} style={{ fontSize: 7.5, color: "#a4b1ba", textAlign: "center", lineHeight: 1 }}>
                        {one}
                    </span>
                ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 11px)", gap: 3 }}>
                {Array.from({ length: firstWeekday }, (_, index) => (
                    <span key={`blank-${index}`} style={{ width: 11, height: 11 }} />
                ))}
                {daily.map((one, index) => (
                    <span
                        key={index}
                        title={`${index + 1}日　${one.toLocaleString()} 文字`}
                        style={{
                            width: 11,
                            height: 11,
                            borderRadius: 3,
                            background: one > 0 ? `rgba(31, 78, 107, ${0.28 + (one / (best || 1)) * 0.72})` : "#dce6ec",
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

/** 作品の札 */
function WorkCard({ work, rank, topChars }: { work: WorkRow; rank: number; topChars: number }) {
    const growth = work.chars - work.prevChars;
    const ribbon = ["#d9b25c", "#adb7bd", "#b98a5e"][rank - 1] ?? "#adb7bd";
    const cover = coverFor({ id: work.id, title: work.title, cover_color: work.coverColor });

    return (
        <div style={{ position: "relative", border: "1px solid #e3ebf0", borderRadius: 14, background: "#fff", padding: "14px 14px 12px" }}>
            {/* 順位の札 */}
            <span
                style={{
                    position: "absolute",
                    left: 12,
                    top: -2,
                    width: 22,
                    padding: "3px 0 6px",
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    background: ribbon,
                    clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)",
                }}
            >
                {rank}
            </span>

            <div style={{ display: "flex", gap: 12 }}>
                {/* 表紙 */}
                <div
                    style={{
                        width: 62,
                        height: 88,
                        flex: "none",
                        borderRadius: "3px 6px 6px 3px",
                        overflow: "hidden",
                        background: work.coverUrl
                            ? "#e8eef2"
                            : `linear-gradient(100deg, rgba(0,0,0,.14) 0 4px, rgba(255,255,255,.35) 4px 7px, ${cover.base} 7px)`,
                        border: "1px solid rgba(20,40,55,.12)",
                        boxShadow: "2px 3px 8px rgba(20,40,55,.16)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 6,
                    }}
                >
                    {work.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={work.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                        <span
                            style={{
                                fontFamily: '"Hiragino Mincho ProN", serif',
                                fontSize: 10.5,
                                lineHeight: 1.5,
                                letterSpacing: ".02em",
                                color: cover.ink,
                                textAlign: "center",
                                wordBreak: "break-word",
                                marginLeft: 5,
                            }}
                        >
                            {work.title.length > 16 ? `${work.title.slice(0, 15)}…` : work.title}
                        </span>
                    )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        <span style={{ fontFamily: '"Hiragino Mincho ProN", garamond, serif', fontSize: 21, fontWeight: 700, color: "#17222b" }}>
                            {work.chars.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 11.5, color: "#71818c" }}>文字</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, fontSize: 11.5, color: "#5c6b75" }}>
                        <BookIcon />
                        {work.episodes} 話
                    </div>

                    {growth > 0 && (
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                marginTop: 8,
                                padding: "5px 9px",
                                borderRadius: 9,
                                background: "#e9f4ee",
                                color: "#2d6a4f",
                                fontSize: 11.5,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                            }}
                        >
                            ↗ +{growth.toLocaleString()} 文字
                        </div>
                    )}

                    <div style={{ height: 6, borderRadius: 999, background: "#eaf0f4", marginTop: 8 }}>
                        <span
                            style={{
                                display: "block",
                                height: "100%",
                                borderRadius: 999,
                                width: `${Math.max(6, (work.chars / topChars) * 100)}%`,
                                background: "linear-gradient(90deg,#5b8fae,#1f4e6b)",
                            }}
                        />
                    </div>
                </div>
            </div>

            <p style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.7, color: "#5c6b75" }}>{work.note}</p>
        </div>
    );
}

/** 日ごとの棒。いちばん書いた日には吹き出しを出す */
function Rhythm({ recap, month }: { recap: Recap; month: number }) {
    const best = recap.bestChars || 1;
    const marks = [1, 5, 10, 15, 20, 25, recap.monthDays];

    /*
     * ★ 書いた日の平均を、薄い線で引く。
     *   棒の高さだけでは「多い日」しか見えない。
     *   ふだんどれくらい書く人なのかが、線一本で分かる。
     *   書かなかった日は割らない。休んだ日で薄まると、実感と合わない。
     */
    const average = recap.days > 0 ? Math.round(recap.chars / recap.days) : 0;

    return (
        <div style={{ marginTop: 10, position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
            {/* 目盛り */}
            <div style={{ display: "flex", gap: 10, flex: 1, minHeight: 0 }}>
                <div style={{ width: 44, flex: "none", position: "relative", fontSize: 10, color: "#9aa6ae" }}>
                    <span style={{ position: "absolute", right: 0, top: -5 }}>{best.toLocaleString()}</span>
                    <span style={{ position: "absolute", right: 0, top: "50%" }}>{Math.round(best / 2).toLocaleString()}</span>
                    <span style={{ position: "absolute", right: 0, bottom: -5 }}>0</span>
                </div>

                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <div
                        style={{
                            position: "relative",
                            flex: 1,
                            minHeight: 150,
                            display: "flex",
                            alignItems: "flex-end",
                            gap: 2,
                            borderBottom: "1px solid #e1e9ee",
                        }}
                    >
                        {/* 目安の線。高さが変わってもずれないよう、割合で置く */}
                        {[0, 50].map((top) => (
                            <span
                                key={top}
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    top: `${top}%`,
                                    borderTop: "1px solid #eef3f6",
                                    pointerEvents: "none",
                                }}
                            />
                        ))}
                        {recap.daily.map((one, index) => {
                            const isBest = index + 1 === recap.bestDay && one > 0;
                            return (
                                <span
                                    key={index}
                                    title={`${month}月${index + 1}日　${one.toLocaleString()} 文字`}
                                    style={{
                                        flex: 1,
                                        height: one > 0 ? `${Math.max(3, (one / best) * 96)}%` : 2,
                                        borderRadius: "3px 3px 0 0",
                                        background: one > 0 ? (isBest ? "#1f4e6b" : "rgba(91, 143, 174, .55)") : "#e6edf1",
                                    }}
                                />
                            );
                        })}

                        {/* 書いた日の平均 */}
                        {average > 0 && (
                            <span
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    bottom: `${(average / best) * 96}%`,
                                    borderTop: "1px dashed #b7cbd8",
                                    pointerEvents: "none",
                                }}
                            >
                                <span
                                    style={{
                                        position: "absolute",
                                        left: 0,
                                        top: -13,
                                        fontSize: 9.5,
                                        color: "#7e929f",
                                        background: "rgba(255,255,255,.85)",
                                        padding: "0 4px",
                                        borderRadius: 4,
                                    }}
                                >
                                    書いた日の平均 {average.toLocaleString()} 文字
                                </span>
                            </span>
                        )}

                        {/* いちばん書いた日の吹き出し */}
                        <span
                            style={{
                                position: "absolute",
                                left: `${((recap.bestDay - 0.5) / recap.monthDays) * 100}%`,
                                bottom: `calc(${Math.max(3, (recap.bestChars / best) * 96)}% + 8px)`,
                                transform: "translateX(-50%)",
                                background: "#1f4e6b",
                                color: "#fff",
                                borderRadius: 8,
                                padding: "5px 9px",
                                fontSize: 10.5,
                                lineHeight: 1.45,
                                whiteSpace: "nowrap",
                                boxShadow: "0 4px 10px rgba(20,40,55,.2)",
                            }}
                        >
                            {month}月{recap.bestDay}日
                            <br />
                            <b style={{ fontSize: 12 }}>{recap.bestChars.toLocaleString()}</b> 文字
                        </span>
                    </div>

                    {/* 日の目盛り */}
                    <div style={{ position: "relative", height: 16, fontSize: 10, color: "#9aa6ae" }}>
                        {marks.map((day) => (
                            <span
                                key={day}
                                style={{
                                    position: "absolute",
                                    left: `${((day - 0.5) / recap.monthDays) * 100}%`,
                                    transform: day === recap.monthDays ? "translateX(-100%)" : "translateX(-50%)",
                                    top: 3,
                                }}
                            >
                                {day === 1 ? `${month}/1` : day}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ============================================================
 * 絵と印
 * ========================================================== */

/**
 * 右上の絵。原稿用紙の見開きと万年筆、そして書き上げた紙の束。
 *
 * ★ 紙の束は、その月の枚数で高くなる。
 *   絵がいつも同じだと、ただの飾りになる。
 *   たくさん書いた月ほど束が厚くなるので、
 *   数字を読む前に「書いたな」と分かる。
 *
 * ★ 束は紐で結んである。
 *   書き散らした紙ではなく、ひと月ぶんの仕事として置く。
 */
function DeskArt({ sheets }: { sheets: number }) {
    /* 下に重ねる枚数。原稿用紙 20 枚ごとに 1 枚、最大 6 枚 */
    const extra = Math.min(6, Math.max(1, Math.round(sheets / 20) + 1));

    return (
        <div className="wrec-art" style={{ width: 316, flex: "none", position: "relative", height: 154 }}>
            <svg width="316" height="154" viewBox="0 0 316 154" aria-hidden="true">
                <defs>
                    <radialGradient id="wrec-glow" cx="50%" cy="50%">
                        <stop offset="0" stopColor="#fbeed4" stopOpacity=".85" />
                        <stop offset="60%" stopColor="#f3e6d2" stopOpacity=".28" />
                        <stop offset="100%" stopColor="#f3e6d2" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="wrec-page-l" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#ffffff" />
                        <stop offset="1" stopColor="#eef5f9" />
                    </linearGradient>
                    <linearGradient id="wrec-page-r" x1="1" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#ffffff" />
                        <stop offset="1" stopColor="#eef5f9" />
                    </linearGradient>
                    <linearGradient id="wrec-pen" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#22394e" />
                        <stop offset="45%" stopColor="#3d5e79" />
                        <stop offset="100%" stopColor="#1d3145" />
                    </linearGradient>
                    <linearGradient id="wrec-ribbon" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#e3c27f" />
                        <stop offset="100%" stopColor="#c79d51" />
                    </linearGradient>
                </defs>

                {/* 朝の光 */}
                <circle cx="240" cy="44" r="66" fill="url(#wrec-glow)" />
                <circle cx="236" cy="48" r="54" fill="#eaf2f7" opacity=".85" />

                {/* 手書きの言葉 */}
                <text x="2" y="30" fontSize="11.5" fill="#8b98a1" fontFamily='"Hiragino Mincho ProN", serif' letterSpacing="1.6">
                    今月も、
                </text>
                <text x="16" y="50" fontSize="11.5" fill="#8b98a1" fontFamily='"Hiragino Mincho ProN", serif' letterSpacing="1.6">
                    よく書きました。
                </text>
                <path d="M6 60 C50 74 94 70 132 54" stroke="#c6d6e0" strokeWidth="1.6" fill="none" strokeLinecap="round" />

                {/* 置かれた影 */}
                <ellipse cx="60" cy="140" rx="46" ry="6" fill="#dbe5eb" opacity=".7" />
                <ellipse cx="180" cy="132" rx="82" ry="8" fill="#dbe5eb" opacity=".55" />

                {/* 書き上げた紙の束 */}
                <g>
                    {Array.from({ length: extra }, (_, index) => {
                        const step = extra - index;
                        return (
                            <rect
                                key={index}
                                x={10 + step * 1.8}
                                y={106 - step * 4.6}
                                width="66"
                                height="31"
                                rx="3"
                                fill="#f9fbfd"
                                stroke="#d5e1e9"
                                strokeWidth="1.3"
                                transform={`rotate(${-7.5 + step * 2} ${43 + step * 1.8} ${121 - step * 4.6})`}
                            />
                        );
                    })}

                    {/* いちばん上の一枚。ここに紐を掛ける */}
                    <g style={{ animationDelay: `${0.25 + extra * 0.08}s` }}>
                        <rect x="10" y="106" width="66" height="31" rx="3" fill="#ffffff" stroke="#cedbe4" strokeWidth="1.3" transform="rotate(-7.5 43 121)" />
                        <path d="M20 115 h46 M20 122 h46 M20 129 h30" stroke="#e0eaf0" strokeWidth="1.8" strokeLinecap="round" transform="rotate(-7.5 43 121)" />
                        <g transform="rotate(-7.5 43 121)">
                            <path d="M41 104 V139" stroke="#d3ab5c" strokeWidth="3" />
                            <path d="M11 121 H75" stroke="#dcb76b" strokeWidth="3" />
                            <path d="M41 118 C34 112 28 113 29 118 C30 122 36 122 41 118 Z" fill="#e3c27f" />
                            <path d="M41 118 C48 112 54 113 53 118 C52 122 46 122 41 118 Z" fill="#d9b25c" />
                            <path d="M41 119 c-3 5 -6 8 -9 10 M41 119 c3 5 6 8 10 9" stroke="#d9b25c" strokeWidth="2" fill="none" strokeLinecap="round" />
                            <circle cx="41" cy="118" r="2.6" fill="#c79d51" />
                        </g>
                    </g>
                </g>

                {/* 本の厚み */}
                <path d="M104 124 C132 110 160 110 180 118 V113 C160 105 132 105 104 119 Z" fill="#d5e3ec" />
                <path d="M180 118 C200 110 228 110 258 124 V119 C228 105 200 105 180 113 Z" fill="#d5e3ec" />
                <path d="M104 119 C132 105 160 105 180 113 V109 C160 101 132 101 104 115 Z" fill="#e6eef4" />
                <path d="M180 113 C200 105 228 105 258 119 V115 C228 101 200 101 180 109 Z" fill="#e6eef4" />

                {/* 開いた本 */}
                <path d="M104 115 C132 101 160 101 180 109 V50 C160 42 132 42 104 56 Z" fill="url(#wrec-page-l)" stroke="#bed2df" strokeWidth="1.7" />
                <path d="M180 109 C200 101 228 101 258 115 V56 C228 42 200 42 180 50 Z" fill="url(#wrec-page-r)" stroke="#bed2df" strokeWidth="1.7" />

                {/* 原稿用紙の升 */}
                <g stroke="#e3edf3" strokeWidth="1">
                    <path d="M116 64 h54 M116 74 h54 M116 84 h54 M116 94 h54" />
                    <path d="M128 56 v48 M140 54 v50 M152 53 v52 M164 52 v53" />
                    <path d="M192 58 h54 M192 68 h54 M192 78 h54 M192 88 h54" />
                    <path d="M204 48 v48 M216 49 v49 M228 51 v50 M240 53 v51" />
                </g>
                <path d="M180 50 V109" stroke="#bed2df" strokeWidth="1.7" />
                <path d="M176 52 C178 70 178 90 176 107" stroke="#dae7ef" strokeWidth="3" fill="none" />

                {/* 書かれた行と、書きかけの行 */}
                <path d="M120 60 h42 M120 70 h42 M120 80 h42 M120 90 h26" stroke="#b6cbda" strokeWidth="2" strokeLinecap="round" />
                <path d="M196 64 h36" stroke="#1f4e6b" strokeWidth="2" strokeLinecap="round" opacity=".5" />

                {/* しおり */}
                <path d="M170 46 h10 v32 l-5 -5 l-5 5 z" fill="url(#wrec-ribbon)" />

                {/* 万年筆 */}
                <g transform="rotate(38 240 62)">
                    <rect x="233" y="0" width="14" height="52" rx="7" fill="url(#wrec-pen)" />
                    <rect x="236" y="4" width="3" height="44" rx="1.5" fill="#ffffff" opacity=".22" />
                    <rect x="233" y="14" width="14" height="7" rx="2" fill="#dcc38a" />
                    <path d="M233 52 h14 l-7 17 z" fill="#cbd9e2" />
                    <path d="M233 52 h7 v17 z" fill="#b9cad6" />
                    <path d="M240 56 v10" stroke="#5d7484" strokeWidth="1.3" />
                </g>

                {/* 葉 */}
                <path d="M98 146 c-9 -7 -9 -21 -3 -29 c9 6 11 20 3 29 z" fill="#d3e3da" />
                <path d="M95 142 c1 -9 2 -16 1 -22" stroke="#c0d6c9" strokeWidth="1" fill="none" />
                <path d="M268 130 c8 -8 21 -9 29 -5 c-7 9 -20 11 -29 5 z" fill="#dfeae4" />
                <path d="M272 129 c8 -3 15 -4 21 -3" stroke="#cbded4" strokeWidth="1" fill="none" />
            </svg>
        </div>
    );
}

function LeafArt() {
    return (
        <svg width="86" height="76" viewBox="0 0 86 76" aria-hidden="true" style={{ position: "absolute", right: -6, bottom: -6, opacity: 0.5 }}>
            <path d="M60 66 c-14 -6 -20 -24 -14 -40 c16 6 22 24 14 40 z" fill="#dbe9e2" />
            <path d="M64 68 c4 -16 20 -26 34 -26 c-6 16 -20 26 -34 26 z" fill="#e6eff3" />
        </svg>
    );
}

function RankIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#1f4e6b" aria-hidden="true">
            <rect x="3" y="12" width="5" height="9" rx="1" />
            <rect x="10" y="7" width="5" height="14" rx="1" />
            <rect x="17" y="3" width="5" height="18" rx="1" opacity=".6" />
        </svg>
    );
}

function WaveIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1f4e6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 15 L7 8 L12 16 L17 6 L22 13" />
        </svg>
    );
}

function NoteIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1f4e6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="17" rx="3" />
            <path d="M3 9h18M8 2v4M16 2v4M8 14l3 3 5-5" />
        </svg>
    );
}

function BookIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7d8d97" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
            <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
        </svg>
    );
}

function LeafIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#5f9e7e" aria-hidden="true">
            <path d="M20 3c0 9-5 15-13 15-1 0-2-.1-3-.4C5 9.6 11 4 20 3z" />
            <path d="M4 21c2-5 6-9 11-11" stroke="#5f9e7e" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
    );
}
