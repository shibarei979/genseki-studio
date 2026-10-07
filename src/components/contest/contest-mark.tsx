/**
 * ============================================================
 * 原石航路 Studio
 * コンテスト応募の印
 *
 *   ContestCoverMark … 表紙（本の絵）の上の端から垂らす栞（しおり）のリボン。縦書きで「応募中」
 *   ContestChip      … タグの並びに置く「乗船券」の形の札。押すと、そのコンテストの応募作を探せる
 *
 * ★ 応募した作品だと、ぱっと見て分かるようにする。
 *   読む人は応援しやすく、書いた人も「これ出したっけ？」がすぐ分かる。
 * ★ 出すのは、募集中（応募中）と審査中だけ。結果発表のあとは出さない（lib/contest-marks.ts）。
 * ★ 見た目は本と航海の世界に合わせる。
 *   表紙は、本に挟んだ栞の紐（上から垂れて、先が燕の尾に割れている）。
 *   札は、半券の切り取り線がある乗船券。左が「応募中」、右がコンテストの名前。
 * ★ 色は航路の紺に、夜明けの金を細く差す。審査中は深い緑。
 * ============================================================
 */

import Link from "next/link";
import type React from "react";

import { CONTEST_MARK_LABEL, contestSearchHref, type ContestMark } from "@/lib/contest-marks";

/** 状態ごとの色。募集中は航路の紺、審査中は深い緑 */
const TONE: Record<ContestMark["status"], { light: string; base: string; dark: string; paper: string; line: string }> = {
    open: { light: "#2f6f95", base: "#1f4e6b", dark: "#143a52", paper: "#f2f7fa", line: "#b4cede" },
    judging: { light: "#3f7a64", base: "#2d5c4b", dark: "#1f4537", paper: "#f1f7f3", line: "#b5d3c3" },
};

/** 夜明けの金。航路の紺に細く差す */
const GOLD = "#e8b769";

/**
 * 表紙に垂らす栞。親は position: relative にしておく。
 *
 * ★ 上の端から垂らす。下の端は、題名の帯や状態の字があることが多い。
 * ★ AI の判子は右上に置かれることが多いので、栞は左寄り（背の影のぶん内へ）。
 *   判子が左上の表紙では、右へよける（side="right"）。
 */
export function ContestCoverMark({
    mark,
    size = "sm",
    side = "left",
    inset = 0,
}: {
    mark: ContestMark;
    /** 棚の本は sm、作品ページの大きな表紙は md、携帯の小さな本は xs */
    size?: "xs" | "sm" | "md";
    side?: "left" | "right";
    /** 本の背（左の影）のぶん、内へ寄せる量 */
    inset?: number;
}) {
    const md = size === "md";
    const xs = size === "xs";
    const tone = TONE[mark.status];
    const width = md ? 26 : xs ? 17 : 21;
    const tail = md ? 8 : xs ? 5 : 6;
    const gap = md ? 14 : xs ? 7 : 10;
    const fontSize = md ? 12.5 : xs ? 9 : 10.5;
    const padTop = md ? 9 : xs ? 5 : 7;
    const padBottom = tail + (md ? 7 : xs ? 4 : 5);
    const diamond = md ? 5 : xs ? 3 : 4;
    const top = md ? -3 : -2;
    const label = CONTEST_MARK_LABEL[mark.status];
    /* 栞の下の端（名前の札をその下に出す） */
    const ribbonBottom = Math.ceil(
        top + padTop + diamond + (md ? 5 : xs ? 3 : 4) + Array.from(label).length * fontSize * (md ? 1.22 : 1.18) + padBottom,
    );

    return (
        <>
        <span
            /*
             * ★ 本に指（カーソル）を乗せている間は薄くして、表紙の絵を見せる。
             *   栞そのものに乗せたら濃く戻し、下にコンテストの名前を出す。
             *   動きは CSS（styles/items.css の .gk-ribbon）で付ける。
             * ★ title は空にする。本に付いている題名の吹き出しが、栞の上で重なって出ないように。
             */
            className="gk-ribbon"
            title=""
            aria-label={`${mark.title}に${CONTEST_MARK_LABEL[mark.status]}`}
            style={{
                position: "absolute",
                top,
                left: side === "left" ? gap + inset : undefined,
                right: side === "right" ? gap : undefined,
                zIndex: 2,
                lineHeight: 1,
                /* 切り抜いた形にも影が落ちるよう、影は外側の箱で付ける */
                filter: "drop-shadow(0 2px 2px rgba(0,0,0,.28)) drop-shadow(0 0 1px rgba(0,0,0,.18))",
            }}
        >
            <span
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width,
                    padding: `${padTop}px 0 ${padBottom}px`,
                    background: `linear-gradient(90deg, ${tone.dark} 0%, ${tone.light} 45%, ${tone.base} 100%)`,
                    /* 先を燕の尾に割る */
                    clipPath: `polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - ${tail}px), 0 100%)`,
                    boxShadow: `inset 0 2px 0 ${GOLD}`,
                }}
            >
                {/* 金の小さな菱（栞の留め） */}
                <span
                    aria-hidden="true"
                    style={{
                        width: diamond,
                        height: diamond,
                        background: GOLD,
                        transform: "rotate(45deg)",
                        marginBottom: md ? 5 : xs ? 3 : 4,
                    }}
                />
                {/*
                  * 縦に 1 字ずつ積む。
                  * ★ writing-mode の縦書きは、端末や書体によって高さが出ず、字が切れることがあった。
                  */}
                {Array.from(CONTEST_MARK_LABEL[mark.status]).map((char, at) => (
                    <span
                        key={at}
                        style={{
                            display: "block",
                            color: "#fff",
                            fontFamily: "'Noto Serif JP', serif",
                            fontWeight: 700,
                            fontSize,
                            lineHeight: md ? 1.22 : 1.18,
                            textShadow: "0 1px 1px rgba(0,0,0,.35)",
                        }}
                    >
                        {char}
                    </span>
                ))}
            </span>

        </span>

        {/*
          * 栞に乗せたときに出す、コンテストの名前。
          * ★ 栞の中に入れると、栞の幅に縛られて表紙の外へはみ出し、切れていた。
          *   表紙そのものを基準に置き、表紙の幅に収める。
          */}
        <span
            className="gk-ribbon-tip"
            aria-hidden="true"
            style={{
                position: "absolute",
                top: ribbonBottom + 4,
                left: side === "left" ? inset + 4 : undefined,
                right: side === "right" ? 4 : undefined,
                width: "max-content",
                maxWidth: md ? `min(240px, calc(100% - ${inset + 8}px))` : `calc(100% - ${inset + 8}px)`,
                padding: md ? "6px 10px" : "4px 7px",
                borderRadius: 6,
                background: "#fff",
                border: `1px solid ${tone.line}`,
                boxShadow: "0 4px 12px rgba(20,40,55,.18)",
                color: tone.base,
                textAlign: "left",
                whiteSpace: "normal",
                lineHeight: 1.45,
                fontFamily: "'Noto Sans JP', sans-serif",
            }}
        >
            {/* 「応募中」「審査中」は栞に書いてあるので、ここは短く */}
            <span style={{ display: "block", fontSize: md ? 10 : 8.5, color: "#7d867f", letterSpacing: ".08em", whiteSpace: "nowrap" }}>
                コンテスト
            </span>
            <span style={{ display: "block", fontSize: md ? 12 : xs ? 9.5 : 10.5, fontWeight: 700 }}>
                {mark.title}
            </span>
        </span>
        </>
    );
}

/**
 * タグの並びに置く乗船券の札。押すとそのコンテストの応募作の一覧（探す）へ。
 *
 *   ┌────┬┄┄┄┄┄┄┄┄┄┄┄┄┐
 *   │応募中 ┊ 第1回 原石航路 短編賞 › │
 *   └────┴┄┄┄┄┄┄┄┄┄┄┄┄┘
 *   半券の境目に、上下から小さく切り欠きを入れる。
 */
export function ContestChip({
    mark,
    compact = false,
    asLink = true,
}: {
    mark: ContestMark;
    compact?: boolean;
    /**
     * 押せる札にするか。
     * カードごと押すと小窓が開く所（探すの一覧など）では、押せない札にする
     * （札だけ別の所へ飛ぶと、押した人が迷う）。
     */
    asLink?: boolean;
}) {
    const tone = TONE[mark.status];
    const stub = compact ? 50 : 58;
    const height = compact ? 20 : 23;
    const notch = compact ? 3 : 3.5;

    /* 半券の境目の上下に、丸い切り欠き */
    const holes = `radial-gradient(circle ${notch}px at ${stub}px 0, #0000 96%, #000 100%), radial-gradient(circle ${notch}px at ${stub}px 100%, #0000 96%, #000 100%)`;

    const style: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "stretch",
        maxWidth: "100%",
        height,
        borderRadius: 5,
        overflow: "hidden",
        textDecoration: "none",
        verticalAlign: "middle",
        WebkitMaskImage: holes,
        maskImage: holes,
        WebkitMaskComposite: "source-in",
        maskComposite: "intersect",
    };

    const body = (
        <>
            {/* 半券：状態 */}
            <span
                style={{
                    flex: `0 0 ${stub}px`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    background: `linear-gradient(135deg, ${tone.light}, ${tone.base} 60%, ${tone.dark})`,
                    color: "#fff",
                    fontFamily: "'Noto Serif JP', serif",
                    fontWeight: 700,
                    fontSize: compact ? 10.5 : 11.5,
                    letterSpacing: ".06em",
                }}
            >
                <span
                    aria-hidden="true"
                    style={{ width: compact ? 3.5 : 4, height: compact ? 3.5 : 4, background: GOLD, transform: "rotate(45deg)", flexShrink: 0 }}
                />
                {CONTEST_MARK_LABEL[mark.status]}
            </span>
            {/* 本券：コンテストの名前 */}
            <span
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    minWidth: 0,
                    padding: compact ? "0 8px 0 7px" : "0 10px 0 9px",
                    background: tone.paper,
                    color: tone.base,
                    border: `1px solid ${tone.line}`,
                    borderLeft: `1.5px dashed ${tone.line}`,
                    borderRadius: "0 5px 5px 0",
                    fontSize: compact ? 10 : 11,
                    fontWeight: 600,
                }}
            >
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {mark.title}
                </span>
                {asLink && (
                    <span aria-hidden="true" style={{ flexShrink: 0, fontSize: compact ? 11 : 12, opacity: 0.7 }}>
                        ›
                    </span>
                )}
            </span>
        </>
    );

    if (!asLink) {
        return (
            <span title={`${mark.title}　${CONTEST_MARK_LABEL[mark.status]}`} style={style}>
                {body}
            </span>
        );
    }
    return (
        <Link href={contestSearchHref(mark.id)} title={`「${mark.title}」の応募作を探す`} style={style}>
            {body}
        </Link>
    );
}
