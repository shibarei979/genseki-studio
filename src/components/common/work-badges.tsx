/**
 * ============================================================
 * 原石航路 Studio
 * 作品の札（ジャンル・連載中／完結・長編／短編・R18・AI・新人・NEW）
 *
 * ★ どの画面でも、同じ札を同じ形で出す。
 *
 *   前は画面ごとに書いていて、「連載中」が 6 通り、「完結」が 5 通りの色と形だった。
 *   ランキングには「完結」が出ず、作品ページには「R18」が出ず、
 *   AI の札は作品ページにしか無かった。
 *   ここにまとめて、直すときも 1 か所で済むようにする。
 *
 * ★ 形：文字 11px・角丸 6px・細い線・太字。色は「デザイン点検」の案の見本どおり。
 *     ジャンル  紺の淡い地
 *     長編・短編 青灰
 *     連載中   緑
 *     完結     灰
 *     新人     琥珀
 *     R18     淡い赤
 *     AI 生成  藤色
 *     NEW     紺の塗り（案に無かったので、前と同じ）
 *
 * ★ 並びも固定：NEW → ジャンル → 長編/短編 → 連載中/完結 → 新人 → R18 → AI 生成
 * ============================================================
 */

import type React from "react";

export type WorkBadgeKind = "new" | "newbie" | "genre" | "serial" | "complete" | "type" | "r18" | "ai";

const TONE: Record<WorkBadgeKind, { bg: string; fg: string; line: string; dashed?: boolean; bold?: boolean }> = {
    /*
     * ★ 色は「デザイン点検」の案（作品の札をそろえる）の見本どおり。
     *   NEW だけは案に無かったので、前と同じ紺の塗りにした。
     */
    new: { bg: "#1f4e6b", fg: "#ffffff", line: "#1f4e6b", bold: true },
    genre: { bg: "#e6eef4", fg: "#1f4e6b", line: "#b4cede", bold: true },
    type: { bg: "#eef3f6", fg: "#2f5f7f", line: "#c9d9e4", bold: true },
    serial: { bg: "#e9f1ea", fg: "#2f5f37", line: "#bcd6c0", bold: true },
    complete: { bg: "#f1f2f0", fg: "#4a524c", line: "#d6d9d4", bold: true },
    newbie: { bg: "#fbf0dd", fg: "#7a4d08", line: "#ecd3a4", bold: true },
    r18: { bg: "#fbeceb", fg: "#962c23", line: "#efc4bf", bold: true },
    ai: { bg: "#f3eff8", fg: "#5b4580", line: "#d8cce6", bold: true },
};

const LABEL: Partial<Record<WorkBadgeKind, string>> = {
    new: "NEW",
    newbie: "新人",
    serial: "連載中",
    complete: "完結",
    r18: "R18",
    ai: "AI 生成",
};

/** 札 1 枚 */
export function WorkBadge({
    kind,
    children,
    size = "md",
    title,
}: {
    kind: WorkBadgeKind;
    /** 長編／短編・ジャンルのように、中身が決まっていないものだけ渡す */
    children?: React.ReactNode;
    /** sm は狭い所（ランキングの行・小窓）。md がふつう */
    size?: "sm" | "md";
    title?: string;
}) {
    const tone = TONE[kind];
    const sm = size === "sm";
    return (
        <span
            title={title}
            style={{
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0,
                whiteSpace: "nowrap",
                fontSize: sm ? 10.5 : 11,
                lineHeight: 1,
                fontWeight: tone.bold ? 700 : 500,
                padding: sm ? "3px 6px" : "4px 8px",
                borderRadius: 6,
                background: tone.bg,
                color: tone.fg,
                border: `1px ${tone.dashed ? "dashed" : "solid"} ${tone.line}`,
                letterSpacing: kind === "new" ? ".04em" : undefined,
            }}
        >
            {children ?? LABEL[kind]}
        </span>
    );
}

/**
 * 作品の札をまとめて出す。持っている情報だけ渡せばよい。
 *
 * ★ 連載中か完結かは、必ずどちらかを出す（前はランキングなどで完結が出なかった）。
 * ★ R18 は、新しい印（age_rating）と古い印（is_r18）のどちらかが立っていれば出す。
 */
export function WorkBadges({
    genre,
    novelType,
    isSerial,
    ageRating,
    isR18,
    aiUsage,
    isNewbie,
    isNew,
    size = "md",
    children,
}: {
    genre?: string | null;
    novelType?: string | null;
    /** 連載中なら true、完結なら false。分からないときは渡さない（出さない） */
    isSerial?: boolean | null;
    ageRating?: string | null;
    isR18?: boolean | null;
    /** 'generated' のとき「AI作品」を出す（作品ページと同じ決まり） */
    aiUsage?: string | null;
    isNewbie?: boolean;
    isNew?: boolean;
    size?: "sm" | "md";
    /** 札の並びの後ろに足すもの（コンテストの札など） */
    children?: React.ReactNode;
}) {
    const r18 = ageRating === "r18" || isR18 === true;
    return (
        <>
            {isNew && <WorkBadge kind="new" size={size} />}
            {genre && <WorkBadge kind="genre" size={size}>{genre}</WorkBadge>}
            {novelType && <WorkBadge kind="type" size={size}>{novelType}</WorkBadge>}
            {isSerial === true && <WorkBadge kind="serial" size={size} />}
            {isSerial === false && <WorkBadge kind="complete" size={size} />}
            {isNewbie && <WorkBadge kind="newbie" size={size} />}
            {r18 && <WorkBadge kind="r18" size={size} />}
            {aiUsage === "generated" && <WorkBadge kind="ai" size={size} title="AI で生成した作品です" />}
            {children}
        </>
    );
}

export default WorkBadges;
