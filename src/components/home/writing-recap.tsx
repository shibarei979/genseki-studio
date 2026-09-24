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

/**
 * 月初だけに出す。
 *
 * ★ 月の半ばや末に急に出ると、何の話か分からない。
 *   「先月はこうでした」は、月が変わってすぐに言う。
 *
 * ★ 1 日ちょうどだけにすると、その日に来なかった人が
 *   一度も見ないまま終わる。7 日までを月初とする。
 */
const OPEN_UNTIL_DAY = 7;

interface WorkRow {
    id: string;
    title: string;
    chars: number;
    /** その前の月の文字数。伸びを出すために持つ */
    prevChars: number;
    episodes: number;
    coverUrl: string | null;
    coverColor: number | null;
    /** "wide" なら横長の表紙。棚と同じ形で出す */
    coverShape: string | null;
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

        /* 月初を過ぎていたら、今月はもう出さない */
        const today = Number(
            now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(8, 10),
        );
        if (today > OPEN_UNTIL_DAY) return;

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
                    coverShape: (work as { cover_shape?: string | null }).cover_shape ?? null,
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

                {/*
                  * ── 見出し ─────────────────────
                  *
                  * ★ 絵は置かない。
                  *   代わりに、その月の数そのものを大きく置く。
                  *   見出しの右に数が並ぶので、横幅が余らない。
                  */}
                <div
                    className="wrec-head"
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 24,
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        paddingBottom: 18,
                        borderBottom: "1px solid #e4ecf1",
                    }}
                >
                    <div style={{ minWidth: 0 }}>
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
                        <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "#71818c" }}>
                            作品がどう育ったかを見る
                        </p>
                    </div>

                    {/* 文字数 */}
                    <div className="wrec-sum" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 20 }}>
                        <div>
                            <div style={{ fontSize: 11, color: "#71818c", letterSpacing: ".04em" }}>書いた文字数</div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                                <span
                                    style={{
                                        fontFamily: '"Hiragino Mincho ProN", garamond, serif',
                                        fontSize: 44,
                                        fontWeight: 700,
                                        lineHeight: 1.05,
                                        color: "#1f4e6b",
                                    }}
                                >
                                    {shown.chars.toLocaleString()}
                                </span>
                                <span style={{ fontSize: 14, color: "#33414b" }}>文字</span>
                            </div>
                        </div>

                        <div style={{ borderLeft: "1px solid #e1e9ee", paddingLeft: 20, fontSize: 13, color: "#33414b", lineHeight: 1.95 }}>
                            <div>
                                原稿用紙にすると <b style={{ fontSize: 16, color: "#17222b" }}>約{sheets.toLocaleString()}</b> 枚ぶん
                            </div>
                            {shown.prevChars > 0 && (
                                <div>
                                    その前の月（{shown.prevChars.toLocaleString()} 文字）より{" "}
                                    <b style={{ fontSize: 16, color: diff >= 0 ? "#2d6a4f" : "#8a6b4b" }}>
                                        {diff >= 0 ? "+" : "−"}
                                        {Math.abs(diff).toLocaleString()}
                                    </b>{" "}
                                    文字
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── 本体：左（作品とリズム）／右（記録と一言） ── */}
                <div className="wrec-body" style={{ display: "flex", gap: 22, marginTop: 22, alignItems: "stretch" }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        {/* 作品の伸び */}
                        <div className="wrec-worktop" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
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
                        .wrec-head { gap: 14px !important; padding-bottom: 14px !important; }
                        .wrec-sum { gap: 14px !important; }
                    }

                    /* 細い画面では、見出しと「すべての作品を見る」を縦に */
                    @media (max-width: 599px) {
                        .wrec-worktop { flex-direction: column; align-items: flex-start !important; gap: 6px !important; }
                    }

                    /* 見出しの数が、細い画面で折り返して散らからないように */
                    @media (max-width: 479px) {
                        .wrec-sum > div + div {
                            border-left: none !important;
                            padding-left: 0 !important;
                        }
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
    const isWide = work.coverShape === "wide";

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
                {/*
                  * 表紙。
                  *
                  * ★ 棚と同じ形で出す。
                  *   横長の表紙を縦長の枠に入れると、
                  *   絵の左右が切り落とされて別の絵になる。
                  *   高さは揃えたまま、横長だけ幅を 1.5 倍にする。
                  */}
                <div
                    style={{
                        width: isWide ? 96 : 64,
                        height: isWide ? 64 : 84,
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

/**
 * 日ごとの棒。
 *
 * ★ 目盛りは引かない。
 *   いくつ書いたかは、いちばん書いた日の数だけ上に置けば足りる。
 *   横線を何本も引くと、表計算の画面のようになる。
 *
 * ★ 帯も枠線も敷かない。
 *   縦に薄い柱が並ぶと、書いていない日にも棒が立って見える。
 *
 * ★ いちばん書いた日は、吹き出しではなく、棒の真上に書く。
 *   濃い箱を浮かせると、そこだけ別の画面から来たように見える。
 */
function Rhythm({ recap, month }: { recap: Recap; month: number }) {
    const best = recap.bestChars || 1;
    const marks = [1, 10, 20, recap.monthDays];

    /* 端に寄りすぎると、見出しが枠から出る */
    const bestLeft = Math.min(92, Math.max(8, ((recap.bestDay - 0.5) / recap.monthDays) * 100));

    /*
     * ★ 書いた日の平均を、薄い線で引く。
     *   棒の高さだけでは「多い日」しか見えない。
     *   ふだんどれくらい書く人なのかが、線一本で分かる。
     *   書かなかった日は割らない。休んだ日で薄まると、実感と合わない。
     */
    const average = recap.days > 0 ? Math.round(recap.chars / recap.days) : 0;

    return (
        <div
            style={{
                marginTop: 12,
                position: "relative",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "12px 16px 8px",
                borderRadius: 14,
                border: "1px solid #e9f0f5",
                background: "linear-gradient(180deg,#fbfdfe,#ffffff 70%)",
            }}
        >
            {/* いちばん書いた日を、棒の真上に置くための場所 */}
            <div style={{ position: "relative", height: 40, flex: "none" }}>
                <div
                    style={{
                        position: "absolute",
                        left: `${bestLeft}%`,
                        bottom: 2,
                        transform: "translateX(-50%)",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                    }}
                >
                    <div style={{ fontSize: 10, color: "#8b98a1", letterSpacing: ".02em" }}>
                        {month}月{recap.bestDay}日
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "center" }}>
                        <span
                            style={{
                                fontFamily: '"Hiragino Mincho ProN", garamond, serif',
                                fontSize: 17,
                                fontWeight: 700,
                                lineHeight: 1.2,
                                color: "#1f4e6b",
                            }}
                        >
                            {recap.bestChars.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 10, color: "#71818c" }}>文字</span>
                    </div>
                </div>
            </div>

            {/* 棒 */}
            <div
                style={{
                    position: "relative",
                    flex: 1,
                    minHeight: 110,
                    borderBottom: "1px solid #dde7ed",
                }}
            >
                {/*
                  * ★ 棒は細く、日の目盛りの真上に立てる。
                  *   枠いっぱいに太らせると、板が並んでいるように見える。
                  *   ひと月ぶんを一息で眺められる細さにする。
                  *
                  *   日ごとの枠を横一列に並べ、その真ん中に棒を置く。
                  *   こうすると、下の「10」「20」と必ず縦に揃う。
                  */}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "stretch" }}>
                    {recap.daily.map((one, index) => {
                        const isBest = index + 1 === recap.bestDay && one > 0;
                        return (
                            <span
                                key={index}
                                title={`${month}月${index + 1}日　${one.toLocaleString()} 文字`}
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    alignItems: "flex-end",
                                    justifyContent: "center",
                                }}
                            >
                                <span
                                    style={{
                                        width: "62%",
                                        maxWidth: 13,
                                        height: one > 0 ? `${Math.max(4, (one / best) * 100)}%` : 2,
                                        borderRadius: "2px 2px 0 0",
                                        background: one > 0
                                            ? (isBest ? "#1f4e6b" : "#9dbed2")
                                            : "#e8eef2",
                                    }}
                                />
                            </span>
                        );
                    })}
                </div>

                {/* 書いた日の平均 */}
                {average > 0 && (
                    <span
                        style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: `${(average / best) * 100}%`,
                            borderTop: "1px dashed #c3d5e0",
                            pointerEvents: "none",
                        }}
                    >
                        <span
                            style={{
                                position: "absolute",
                                right: 0,
                                top: -14,
                                fontSize: 9.5,
                                color: "#8b98a1",
                                background: "#fff",
                                padding: "0 3px",
                            }}
                        >
                            書いた日の平均 {average.toLocaleString()} 文字
                        </span>
                    </span>
                )}
            </div>

            {/* 日の目盛り */}
            <div style={{ position: "relative", height: 18, flex: "none", fontSize: 10, color: "#9aa6ae" }}>
                {marks.map((day) => (
                    <span
                        key={day}
                        style={{
                            position: "absolute",
                            left: `${((day - 0.5) / recap.monthDays) * 100}%`,
                            transform: day === recap.monthDays ? "translateX(-100%)" : "translateX(-50%)",
                            top: 4,
                        }}
                    >
                        {day === 1 ? `${month}/1` : day}
                    </span>
                ))}
            </div>
        </div>
    );
}

/* ============================================================
 * 絵と印
 * ========================================================== */

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
