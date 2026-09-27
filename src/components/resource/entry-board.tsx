/**
 * ============================================================
 * 原石航路 Studio
 * EntryBoard — 資料の「格子」（Pro）
 *
 * ★ 作品の登場人物（や場所・用語）を、一枚の板に貼って眺める見方。
 *   関係図とは役目を分ける。関係図は「つながり」を見る所、ここは「顔ぶれ」を見る所。
 *   だから線は引かない。代わりに、一枚ずつの札で「その人らしさ」を見せる。
 *
 *   ・絵が主役。札の大部分は絵。
 *   ・中心の人ほど大きく貼る（主要 → 関係・出番の多い順）。大・縦長・小を混ぜて詰める。
 *     全員同じ大きさだと表にしか見えず、誰が物語の中心なのかも見えない。
 *   ・大きい札には、本文から拾ったその人の台詞をひとつ添える。
 *     名前と絵だけでは分からない「声」が見える。一覧には無い、この見方だけのもの。
 *   ・札は少しずつ傾け、上下左右にずらして、板いっぱいに散らす。
 *     指を乗せると、まっすぐになって持ち上がる（おすすめの掲示板と同じ）。
 *
 * ★ 雰囲気は、作品のジャンルから決める（作者が選び直せる）。
 *   ジャンルごとに「その世界の机の上にありそうな物」に寄せる。
 *   模様や記号を貼り足すのではなく、紙・額・字・留め具の選び方で分ける。
 *     ファンタジー：羊皮紙の板に、金の縁の肖像。明朝の名前と、飾り罫
 *     恋愛　　　　：便箋（罫線と薄紅の縁）の板に、余白の広い写真。細い明朝と、真珠の留め針
 *     ミステリー　：捜査板に、クリップで留めた写真とタイプ打ちの札。台詞は「証言」
 *     学園・日常　：黒板に、名札つきの写真とマグネット。台詞は吹き出し
 *     SF・アクション：設計図の方眼に、識別番号つきの記録票。台詞は交信記録
 *     それ以外（文芸・歴史など）：ファンタジーと同じ羊皮紙の板
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import EntryImage from "@/components/common/entry-image";
import type { ResourceEntry } from "@/types";

export type BoardMood = "fantasy" | "romance" | "mystery" | "school" | "sf";

export const BOARD_MOOD_LABEL: Record<BoardMood, string> = {
    fantasy: "ファンタジー",
    romance: "恋愛",
    mystery: "ミステリー",
    school: "学園・日常",
    sf: "SF・アクション",
};

/** ジャンルから板の雰囲気を決める */
export function moodOfGenre(genre: string | null | undefined): BoardMood {
    const g = genre ?? "";
    if (/ファンタジー/.test(g)) return "fantasy";
    if (/恋愛|BL|GL/.test(g)) return "romance";
    if (/ミステリー|ホラー/.test(g)) return "mystery";
    if (/学園|日常|コメディ/.test(g)) return "school";
    if (/SF|アクション/.test(g)) return "sf";
    /* 文芸・歴史など、上に当てはまらないものは、落ち着いた羊皮紙の板に */
    return "fantasy";
}

const MINCHO = "'Shippori Mincho','Yu Mincho','Hiragino Mincho ProN',serif";
const TYPEWRITER = "'Courier New','Osaka-Mono','MS Gothic',monospace";

/* ---------- 板の地 ---------- */

const BOARDS: Record<BoardMood, CSSProperties> = {
    fantasy: {
        backgroundColor: "#e6d6b2",
        backgroundImage: [
            "repeating-radial-gradient(circle at 18% 26%, transparent 0 26px, rgba(120,84,40,.06) 26px 27px)",
            "repeating-radial-gradient(circle at 82% 74%, transparent 0 34px, rgba(120,84,40,.05) 34px 35px)",
            "radial-gradient(ellipse at center, rgba(255,248,228,.65) 0%, rgba(255,248,228,0) 58%, rgba(110,70,25,.32) 100%)",
        ].join(","),
        border: "14px solid #573a20",
        boxShadow: "inset 0 0 0 1px #9a7449, inset 0 0 0 5px #573a20, inset 0 0 0 6px #b8925a, inset 0 0 70px rgba(90,55,20,.35)",
        borderRadius: 6,
    },
    romance: {
        /*
         * 便箋。手紙の罫線と、左の余白の縦線、薄紅の縁。
         * ★ 一色べたの布だと、恋愛らしい空気が出なかった。恋文を広げた机に寄せる。
         */
        backgroundColor: "#fbf5f1",
        backgroundImage: [
            "linear-gradient(90deg, transparent 0 46px, rgba(181,101,122,.20) 46px 47px, transparent 47px)",
            "repeating-linear-gradient(180deg, transparent 0 27px, rgba(181,101,122,.16) 27px 28px)",
            "radial-gradient(ellipse at 20% 10%, rgba(255,255,255,.7), transparent 55%)",
        ].join(","),
        border: "10px solid #c98a98",
        boxShadow: "inset 0 0 0 1px #b87888, inset 0 0 40px rgba(150,80,95,.08)",
        borderRadius: 3,
    },
    mystery: {
        backgroundColor: "#2b241f",
        backgroundImage: [
            "radial-gradient(circle at 17% 23%, rgba(0,0,0,.3) 0 2px, transparent 2.4px)",
            "radial-gradient(circle at 68% 61%, rgba(255,235,200,.05) 0 1.4px, transparent 1.8px)",
            "radial-gradient(ellipse at 50% 40%, rgba(255,226,170,.10), rgba(0,0,0,.5) 95%)",
        ].join(","),
        backgroundSize: "29px 29px, 19px 19px, 100% 100%",
        border: "12px solid #15100d",
        boxShadow: "inset 0 0 70px rgba(0,0,0,.6)",
        borderRadius: 3,
    },
    school: {
        backgroundColor: "#2c4b3d",
        backgroundImage: [
            "radial-gradient(ellipse at 22% 18%, rgba(255,255,255,.09), transparent 55%)",
            "radial-gradient(ellipse at 78% 88%, rgba(255,255,255,.06), transparent 50%)",
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,.028) 0 1px, transparent 1.5px)",
        ].join(","),
        backgroundSize: "100% 100%, 100% 100%, 7px 7px",
        border: "13px solid #b48854",
        boxShadow: "inset 0 0 0 2px #8e683a, inset 0 -18px 0 -6px rgba(0,0,0,0), inset 0 0 44px rgba(0,0,0,.35)",
        borderRadius: 3,
    },
    sf: {
        backgroundColor: "#0a1826",
        backgroundImage: [
            "linear-gradient(rgba(86,190,230,.12) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(86,190,230,.12) 1px, transparent 1px)",
            "linear-gradient(rgba(86,190,230,.045) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(86,190,230,.045) 1px, transparent 1px)",
            "radial-gradient(ellipse at 50% 0%, rgba(86,190,230,.14), transparent 60%)",
        ].join(","),
        backgroundSize: "64px 64px, 64px 64px, 16px 16px, 16px 16px, 100% 100%",
        border: "1px solid rgba(86,190,230,.5)",
        boxShadow: "0 0 0 5px #0a1826, 0 0 0 6px rgba(86,190,230,.22), inset 0 0 60px rgba(0,0,0,.45)",
        borderRadius: 3,
    },
};

const SWATCH: Record<BoardMood, string> = {
    fantasy: "#c9a86a",
    romance: "#c98a98",
    mystery: "#3a2f28",
    school: "#2c4b3d",
    sf: "#0a1826",
};

/* 1 枚ずつの傾きと、ずれ（決まった並びを回す。開くたびに変わらないように） */
const TILT = [-1.3, 0.9, -0.5, 1.4, -1, 0.6, -1.5, 1.1, -0.3];
const SHIFT_X = [0, 7, -5, 4, -8, 3, 6, -3, 2];
const SHIFT_Y = [0, 10, -4, 14, 5, -2, 12, 7, -5];
/* SF は傾けない。記録票は、まっすぐ並んでいるもの */
const TILT_SCALE: Record<BoardMood, number> = { fantasy: 1, romance: 0.8, mystery: 1.4, school: 1.1, sf: 0 };

const MOOD_KEY = "gk-board-mood:";

type Size = "hero" | "tall" | "base";

interface CardData {
    entry: ResourceEntry;
    size: Size;
    index: number;
    label: string;
    speech: string;
    relations: number;
    body: number;
    isOn: boolean;
    isWide: boolean;
}

interface Props {
    /** 板の見出しに出す名前（ページの名前。「人物」など） */
    title: string;
    entries: ResourceEntry[];
    workId: string;
    genre?: string | null;
    isWide: boolean;
    selectedId: string | null;
    relationCountById: Map<string, number>;
    bodyCountById: Map<string, number>;
    speechById: Map<string, string>;
    /** 役割・種類。札の名前の下に出す */
    labelOf: (entry: ResourceEntry) => string;
    onSelect: (entryId: string) => void;
}

export default function EntryBoard({
    title,
    entries,
    workId,
    genre,
    isWide,
    selectedId,
    relationCountById,
    bodyCountById,
    speechById,
    labelOf,
    onSelect,
}: Props) {
    /* ---- 雰囲気 ---- */
    const [picked, setPicked] = useState<BoardMood | "">("");
    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(MOOD_KEY + workId);
            if (saved && saved in BOARDS) setPicked(saved as BoardMood);
        } catch {
            /* 覚えられない端末では、毎回ジャンルから */
        }
    }, [workId]);
    function pick(next: BoardMood | "") {
        setPicked(next);
        try {
            if (next) window.localStorage.setItem(MOOD_KEY + workId, next);
            else window.localStorage.removeItem(MOOD_KEY + workId);
        } catch {
            /* 覚えられなくても、いまの画面では効く */
        }
    }
    const auto = moodOfGenre(genre);
    const mood = picked || auto;

    /* ---- 札の大きさ。中心の人ほど大きく ---- */
    const sizeById = useMemo(() => {
        const scored = entries
            .map((entry) => ({
                id: entry.id,
                score:
                    (entry.is_major ? 1000 : 0) +
                    (relationCountById.get(entry.id) ?? 0) * 10 +
                    (bodyCountById.get(entry.id) ?? 0),
            }))
            .sort((a, b) => b.score - a.score);
        const heroes = Math.min(3, Math.max(1, Math.round(entries.length / 7)));
        const talls = Math.round(entries.length / 4);
        const map = new Map<string, Size>();
        scored.forEach((row, rank) => {
            map.set(row.id, rank < heroes ? "hero" : rank < heroes + talls ? "tall" : "base");
        });
        return map;
    }, [entries, relationCountById, bodyCountById]);

    return (
        <div className="p-3 sm:p-4">
            {/* 板の雰囲気 */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-[11.5px] text-muted">板の雰囲気</span>
                <MoodChip label={`自動（${BOARD_MOOD_LABEL[auto]}）`} swatch={SWATCH[auto]} isOn={!picked} onClick={() => pick("")} />
                {(Object.keys(BOARD_MOOD_LABEL) as BoardMood[]).map((key) => (
                    <MoodChip key={key} label={BOARD_MOOD_LABEL[key]} swatch={SWATCH[key]} isOn={picked === key} onClick={() => pick(key)} />
                ))}
            </div>

            <div style={BOARDS[mood]} className="relative overflow-hidden">
                <BoardTitle mood={mood} title={title} count={entries.length} />
                <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-x-3 gap-y-3 px-3 pb-9 pt-4 [grid-auto-flow:dense] [grid-auto-rows:42px] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-x-7 sm:gap-y-5 sm:px-9 sm:pb-12 sm:pt-6 sm:[grid-auto-rows:54px]">
                    {entries.map((entry, index) => {
                        const size = sizeById.get(entry.id) ?? "base";
                        const tilt = TILT[index % TILT.length] * TILT_SCALE[mood];
                        const span = isWide
                            ? size === "hero"
                                ? "col-span-2 row-span-5"
                                : "col-span-2 row-span-4"
                            : size === "hero"
                              ? "col-span-2 row-span-6"
                              : size === "tall"
                                ? "row-span-4"
                                : "row-span-3";
                        const data: CardData = {
                            entry,
                            size,
                            index,
                            label: labelOf(entry),
                            speech: speechById.get(entry.id) ?? "",
                            relations: relationCountById.get(entry.id) ?? 0,
                            body: bodyCountById.get(entry.id) ?? 0,
                            isOn: entry.id === selectedId,
                            isWide,
                        };
                        return (
                            <div
                                key={entry.id}
                                className={["group relative min-h-0", span].join(" ")}
                                style={{
                                    transform: `translate(${SHIFT_X[index % SHIFT_X.length]}px, ${SHIFT_Y[index % SHIFT_Y.length]}px)`,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => onSelect(entry.id)}
                                    style={{ ["--tilt" as string]: `${tilt}deg` } as CSSProperties}
                                    className={[
                                        "relative block h-full w-full text-left transition-transform duration-200 ease-out",
                                        "[transform:rotate(var(--tilt))] hover:z-20 hover:[transform:rotate(0deg)_translateY(-5px)_scale(1.02)] focus-visible:[transform:rotate(0deg)] focus-visible:outline-none",
                                        data.isOn ? "z-20 [transform:rotate(0deg)]" : "z-10",
                                    ].join(" ")}
                                >
                                    {mood === "fantasy" && <FantasyCard {...data} />}
                                    {mood === "romance" && <RomanceCard {...data} />}
                                    {mood === "mystery" && <MysteryCard {...data} />}
                                    {mood === "school" && <SchoolCard {...data} />}
                                    {mood === "sf" && <SfCard {...data} />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <p className="mt-2 text-[11px] text-faint">
                主要な人・関係や出番の多い人ほど大きく貼っています。大きい札には、本文から拾った台詞を添えています。
            </p>
        </div>
    );
}

/* ============================================================
 * 札。雰囲気ごとに作りを変える
 * ============================================================ */

/**
 * 絵。
 * ★ 絵がまだ無い人は、色の塊に頭文字ではなく、薄い人影の「肖像の空き枠」にする。
 *   塊が並ぶと重たく見えた。空き枠なら「まだ描いていない」と分かり、板の雰囲気も崩さない。
 */
function Photo({
    entry,
    className = "",
    big,
    blank,
}: {
    entry: ResourceEntry;
    className?: string;
    big: boolean;
    /** 空き枠の地と、人影の色 */
    blank: { ground: string; ink: string };
}) {
    if (!entry.image_url) {
        return (
            <span className="relative flex h-full w-full items-end justify-center overflow-hidden" style={{ background: blank.ground }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" className="h-[78%] w-[78%]" aria-hidden>
                    <circle cx="50" cy="38" r="17" fill={blank.ink} opacity=".16" />
                    <path d="M16 100 C18 72 34 60 50 60 C66 60 82 72 84 100 Z" fill={blank.ink} opacity=".16" />
                </svg>
                <span className={["absolute left-0 right-0 top-2 text-center tracking-[.3em]", big ? "text-[11px]" : "text-[9px]"].join(" ")} style={{ color: blank.ink, opacity: 0.45 }}>
                    図案なし
                </span>
            </span>
        );
    }
    return (
        <EntryImage
            src={entry.image_url}
            fallback={Array.from(entry.name)[0] ?? "?"}
            className={["h-full w-full object-cover", className].join(" ")}
        />
    );
}

/** 選んでいる札の縁取り */
function selectedRing(isOn: boolean, color: string): CSSProperties {
    return isOn ? { outline: `3px solid ${color}`, outlineOffset: 3 } : {};
}

const LIFT = "0 1px 1px rgba(40,28,15,.18), 0 5px 8px -4px rgba(40,28,15,.32), 0 14px 22px -12px rgba(40,28,15,.5)";

/* ---- ファンタジー：金の縁の肖像 ---- */
function FantasyCard({ entry, size, label, speech, isOn }: CardData) {
    const big = size === "hero";
    return (
        <span
            className="flex h-full flex-col rounded-[2px] p-2 pb-2.5 sm:p-2.5"
            style={{ background: "#fbf4e2", boxShadow: `0 0 0 1px #d6c195, ${LIFT}`, color: "#3a2b17", ...selectedRing(isOn, "#8c2f23") }}
        >
            <Tack color="#b8923f" />
            {/* 金の二重縁 */}
            <span className="relative block min-h-0 flex-1 p-[3px]" style={{ boxShadow: "inset 0 0 0 1px #b8925a, inset 0 0 0 3px #fbf4e2, inset 0 0 0 4px #c9a86a" }}>
                <span className="block h-full w-full overflow-hidden">
                    <Photo entry={entry} big={big} blank={{ ground: "#efe3c6", ink: "#6b4a2b" }} />
                </span>
            </span>
            <span className="mt-1.5 block text-center">
                <span className={["block truncate font-bold tracking-wide", big ? "text-[17px] sm:text-[19px]" : "text-[13px] sm:text-[14.5px]"].join(" ")} style={{ fontFamily: MINCHO }}>
                    {entry.name || "（名前未設定）"}
                </span>
                <span className="mx-auto my-1 block h-px w-10" style={{ background: "linear-gradient(90deg, transparent, #b8925a, transparent)" }} />
                <span className="block truncate text-[10.5px] tracking-wider" style={{ color: "#8a6a3c" }}>
                    {entry.is_major ? "主要" : ""}
                    {entry.is_major && label ? "・" : ""}
                    {label}
                </span>
                {big && speech && (
                    <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed" style={{ fontFamily: MINCHO, color: "#5b4526" }}>
                        「{speech}」
                    </span>
                )}
            </span>
        </span>
    );
}

/* ---- 恋愛：余白の広い写真 ---- */
function RomanceCard({ entry, size, label, speech, isOn }: CardData) {
    const big = size === "hero";
    return (
        <span
            className="flex h-full flex-col p-2 pb-3 sm:p-2.5 sm:pb-3.5"
            style={{ background: "#fffdfa", boxShadow: `0 0 0 1px #efe0e0, ${LIFT}`, color: "#4a3035", ...selectedRing(isOn, "#b5657a") }}
        >
            <Pearl />
            <span className="block min-h-0 flex-1 overflow-hidden">
                <Photo entry={entry} big={big} blank={{ ground: "#f6ecec", ink: "#b5657a" }} className="[filter:saturate(.92)_contrast(.97)]" />
            </span>
            <span className="mt-2 block px-0.5">
                <span className={["block truncate", big ? "text-[17px] sm:text-[19px]" : "text-[13px] sm:text-[14px]"].join(" ")} style={{ fontFamily: MINCHO, fontWeight: 600, letterSpacing: ".06em" }}>
                    {entry.name || "（名前未設定）"}
                </span>
                {(label || entry.is_major) && (
                    <span className="mt-0.5 block truncate text-[10.5px] tracking-wider" style={{ color: "#b5657a" }}>
                        {entry.is_major ? "主要" : ""}
                        {entry.is_major && label ? " — " : ""}
                        {label}
                    </span>
                )}
                {big && speech && (
                    <span className="mt-1.5 line-clamp-2 block border-l pl-2 text-[12px] leading-relaxed" style={{ borderColor: "#d9a3b0", color: "#7b5360", fontFamily: MINCHO }}>
                        {speech}
                    </span>
                )}
            </span>
        </span>
    );
}

/* ---- ミステリー：クリップの写真とタイプ打ちの札 ---- */
function MysteryCard({ entry, size, index, label, speech, isOn }: CardData) {
    const big = size === "hero";
    return (
        <span className="relative flex h-full flex-col" style={selectedRing(isOn, "#c0281f")}>
            <PaperClip />
            {/* 写真 */}
            <span className="block min-h-0 flex-1 p-1.5 pb-5" style={{ background: "#f1ece0", boxShadow: `0 0 0 1px #cfc6b2, ${LIFT}` }}>
                <span className="relative block h-full w-full overflow-hidden">
                    <Photo entry={entry} big={big} blank={{ ground: "#d9d2c2", ink: "#3a3128" }} className="[filter:sepia(.28)_contrast(1.05)]" />
                </span>
            </span>
            {/* タイプ打ちの札。写真の下に少し重ねて貼る */}
            <span
                className="relative -mt-3 ml-2 mr-1 block px-2 py-1.5"
                style={{ background: "#fbf8ef", boxShadow: "0 0 0 1px #d9d0bc, 0 3px 5px -2px rgba(0,0,0,.4)", transform: "rotate(-1.2deg)", fontFamily: TYPEWRITER, color: "#24201b" }}
            >
                <span className="flex items-baseline gap-1.5">
                    <span className="shrink-0 text-[10px]" style={{ color: "#b3261e" }}>
                        No.{String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={["min-w-0 truncate font-bold", big ? "text-[15px] sm:text-[17px]" : "text-[12px] sm:text-[13px]"].join(" ")}>
                        {entry.name || "（名前未設定）"}
                    </span>
                </span>
                {(label || entry.is_major) && (
                    <span className="block truncate text-[10px]" style={{ color: "#6f6454" }}>
                        {entry.is_major && <span style={{ color: "#b3261e" }}>［要注意］</span>}
                        {label}
                    </span>
                )}
                {big && speech && (
                    <span className="mt-1 line-clamp-2 block text-[11px] leading-snug" style={{ color: "#3c342b" }}>
                        <span style={{ color: "#b3261e" }}>証言：</span>「{speech}」
                    </span>
                )}
            </span>
        </span>
    );
}

/* ---- 学園・日常：名札つきの写真とマグネット ---- */
const MAGNETS = ["#d9544a", "#3b83c9", "#e3b53a", "#3e9e66", "#9b6bc4"];
function SchoolCard({ entry, size, index, label, speech, isOn }: CardData) {
    const big = size === "hero";
    const color = MAGNETS[index % MAGNETS.length];
    return (
        <span className="relative flex h-full flex-col" style={selectedRing(isOn, "#f2c14e")}>
            <Magnet color={color} />
            <span className="flex min-h-0 flex-1 flex-col p-1.5 pb-2" style={{ background: "#ffffff", boxShadow: `0 0 0 1px #e2e2d8, ${LIFT}`, color: "#26332c" }}>
                <span className="block min-h-0 flex-1 overflow-hidden rounded-[1px]">
                    <Photo entry={entry} big={big} blank={{ ground: "#eef1ee", ink: "#2c4b3d" }} />
                </span>
                {/* 名札 */}
                <span className="mt-1.5 flex items-center gap-1.5">
                    <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ background: color }} />
                    <span className={["min-w-0 truncate font-bold", big ? "text-[16px] sm:text-[18px]" : "text-[12.5px] sm:text-[14px]"].join(" ")}>
                        {entry.name || "（名前未設定）"}
                    </span>
                </span>
                {(label || entry.is_major) && (
                    <span className="mt-0.5 block truncate pl-2.5 text-[10.5px] text-[#6b776f]">
                        {entry.is_major ? "主要" : ""}
                        {entry.is_major && label ? "・" : ""}
                        {label}
                    </span>
                )}
            </span>
            {/* 台詞は、黒板に書いた吹き出しに */}
            {big && speech && (
                <span
                    className="relative mt-2 block rounded-md border px-2 py-1 text-[12px] leading-snug text-white/90"
                    style={{ borderColor: "rgba(255,255,255,.55)", fontFamily: "'Klee One','Yomogi','Hiragino Maru Gothic ProN',sans-serif" }}
                >
                    <span className="absolute -top-[7px] left-5 h-3 w-3 rotate-45 border-l border-t" style={{ borderColor: "rgba(255,255,255,.55)", background: "#2c4b3d" }} />
                    <span className="line-clamp-2">「{speech}」</span>
                </span>
            )}
        </span>
    );
}

/* ---- SF・アクション：識別番号つきの記録票 ---- */
function SfCard({ entry, size, index, label, speech, isOn }: CardData) {
    const big = size === "hero";
    return (
        <span
            className="relative flex h-full flex-col p-1.5 pb-2"
            style={{ background: "rgba(15,39,64,.92)", boxShadow: `0 0 0 1px rgba(86,190,230,.5), 0 10px 20px -10px rgba(0,0,0,.7)`, color: "#e4f4fb", ...selectedRing(isOn, "#56d0f0") }}
        >
            <Corners />
            <span className="mb-1 flex items-center justify-between font-mono text-[9.5px] tracking-widest text-[#6fc6e2]">
                <span>ID-{String(index + 1).padStart(4, "0")}</span>
                {entry.is_major && <span className="text-[#ffd166]">PRIORITY</span>}
            </span>
            <span className="relative block min-h-0 flex-1 overflow-hidden">
                <Photo entry={entry} big={big} blank={{ ground: "#0c2136", ink: "#56d0f0" }} className="[filter:saturate(.8)]" />
                {/* 走査線 */}
                <span className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(10,24,38,.18) 0 1px, transparent 1px 3px)" }} />
            </span>
            <span className={["mt-1.5 block truncate font-semibold tracking-wider", big ? "text-[16px] sm:text-[18px]" : "text-[12.5px] sm:text-[13.5px]"].join(" ")}>
                {entry.name || "（名前未設定）"}
            </span>
            {label && <span className="block truncate font-mono text-[10px] text-[#86bdd2]">ROLE / {label}</span>}
            {big && speech && (
                <span className="mt-1 line-clamp-2 block font-mono text-[11px] leading-snug text-[#9fe3f6]">
                    &gt; {speech}
                </span>
            )}
        </span>
    );
}

/* ============================================================
 * 板の見出し。板そのものに書いた・貼った札として出す
 * ============================================================ */

function BoardTitle({ mood, title, count }: { mood: BoardMood; title: string; count: number }) {
    if (mood === "fantasy") {
        return (
            <div className="flex justify-center pt-5 sm:pt-6">
                <span className="relative px-8 py-1.5 text-center" style={{ fontFamily: MINCHO, color: "#4a331b" }}>
                    <span className="absolute inset-0 -skew-x-6" style={{ background: "#f5e9cc", boxShadow: "0 0 0 1px #c9a86a, 0 3px 6px -3px rgba(60,40,15,.5)" }} />
                    <span className="relative text-[15px] font-bold tracking-[.35em] sm:text-[17px]">{title}</span>
                    <span className="relative ml-2 text-[11px] tracking-wider" style={{ color: "#8a6a3c" }}>
                        {count}名
                    </span>
                </span>
            </div>
        );
    }
    if (mood === "romance") {
        return (
            <div className="px-5 pt-5 sm:px-9 sm:pt-7">
                <span className="text-[15px] tracking-[.3em] sm:text-[17px]" style={{ fontFamily: MINCHO, color: "#6b3e49" }}>
                    {title}
                </span>
                <span className="ml-3 inline-block h-px w-16 align-middle" style={{ background: "#d9a3b0" }} />
                <span className="ml-2 text-[11px]" style={{ color: "#b5657a" }}>
                    {count}
                </span>
            </div>
        );
    }
    if (mood === "mystery") {
        return (
            <div className="px-4 pt-5 sm:px-9 sm:pt-7">
                <span
                    className="inline-block -rotate-1 px-3 py-1 text-[12px] tracking-[.18em] sm:text-[13px]"
                    style={{ background: "#efe9da", color: "#24201b", fontFamily: TYPEWRITER, boxShadow: "0 3px 6px -2px rgba(0,0,0,.6)" }}
                >
                    <span style={{ color: "#b3261e" }}>CASE FILE</span> — {title}（{count}）
                </span>
            </div>
        );
    }
    if (mood === "school") {
        return (
            <div className="px-5 pt-5 sm:px-9 sm:pt-6">
                <span className="text-[17px] tracking-[.2em] text-white/85 sm:text-[20px]" style={{ fontFamily: "'Klee One','Yomogi','Hiragino Maru Gothic ProN',sans-serif", textShadow: "0 0 1px rgba(255,255,255,.4)" }}>
                    {title}
                </span>
                <span className="ml-3 text-[12px] text-white/55">{count}人</span>
                <span className="mt-1 block h-[2px] w-24 rounded-full bg-white/30" />
            </div>
        );
    }
    if (mood === "sf") {
        return (
            <div className="flex items-center gap-3 px-4 pt-5 font-mono sm:px-9 sm:pt-6">
                <span className="text-[11px] tracking-[.3em] text-[#56d0f0]">PERSONNEL</span>
                <span className="text-[13px] tracking-widest text-[#e4f4fb]">{title}</span>
                <span className="h-px flex-1 bg-[rgba(86,190,230,.35)]" />
                <span className="text-[11px] text-[#86bdd2]">{String(count).padStart(3, "0")}</span>
            </div>
        );
    }
    return null;
}

/* ============================================================
 * 留め具
 * ============================================================ */

function Wrap({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <span aria-hidden className={["pointer-events-none absolute z-10", className].join(" ")}>
            {children}
        </span>
    );
}

function Tack({ color }: { color: string }) {
    return (
        <Wrap className="left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <span
                className="block h-3.5 w-3.5 rounded-full"
                style={{ background: `radial-gradient(circle at 35% 30%, #fff6d8 0 1.5px, ${color} 3px, #6e5222 100%)`, boxShadow: "0 2px 3px rgba(40,25,5,.45)" }}
            />
        </Wrap>
    );
}

function Pearl() {
    return (
        <Wrap className="left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <span
                className="block h-3 w-3 rounded-full"
                style={{ background: "radial-gradient(circle at 35% 30%, #ffffff 0 1.5px, #f4f1ef 3px, #c9bcb8 100%)", boxShadow: "0 1.5px 2.5px rgba(90,50,60,.35)" }}
            />
        </Wrap>
    );
}

function Magnet({ color }: { color: string }) {
    return (
        <Wrap className="left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <span
                className="block h-5 w-5 rounded-full"
                style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.55) 0 2px, ${color} 4px)`, boxShadow: "0 2px 4px rgba(0,0,0,.45)" }}
            />
        </Wrap>
    );
}

/** 金属のクリップ（ミステリー） */
function PaperClip() {
    return (
        <Wrap className="-top-3 left-4">
            <span
                className="relative block h-9 w-3.5 rounded-full border-2 border-b-transparent"
                style={{ borderColor: "#b9bec4", borderBottomColor: "transparent", boxShadow: "inset 1px 0 0 rgba(255,255,255,.6), 1px 1px 2px rgba(0,0,0,.4)" }}
            >
                <span className="absolute inset-x-[3px] bottom-[-2px] top-[5px] rounded-full border-[1.5px] border-b-0" style={{ borderColor: "#9aa0a7" }} />
            </span>
        </Wrap>
    );
}

/** SF の四隅の目印 */
function Corners() {
    const base = "pointer-events-none absolute h-2.5 w-2.5 border-[#56d0f0]";
    return (
        <>
            <span aria-hidden className={`${base} -left-1 -top-1 border-l-2 border-t-2`} />
            <span aria-hidden className={`${base} -right-1 -top-1 border-r-2 border-t-2`} />
            <span aria-hidden className={`${base} -bottom-1 -left-1 border-b-2 border-l-2`} />
            <span aria-hidden className={`${base} -bottom-1 -right-1 border-b-2 border-r-2`} />
        </>
    );
}

function MoodChip({ label, swatch, isOn, onClick }: { label: string; swatch: string; isOn: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isOn}
            className={[
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]",
                isOn ? "border-forest bg-forest-tint text-forest" : "border-line bg-surface text-muted hover:border-forest-line",
            ].join(" ")}
        >
            <span className="h-3 w-3 rounded-full" style={{ background: swatch, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />
            {label}
        </button>
    );
}
