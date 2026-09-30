/**
 * ============================================================
 * 原石航路 Studio
 * MilestoneCelebration — 節目のお祝い
 *
 * マイページ・ダッシュボードを開いたとき、まだ祝っていない節目があれば出す。
 *
 * ★ 節目の種類ごとに、見た目を変える（3 種類）。
 *
 *   PV          航路  紺の海図に金の航路が伸び、節目の灯に届く。次の灯まであと何か
 *   いいね      原石  白い札に青い原石が光り、きらめきが舞い上がる
 *   ランキング  祝    和紙の賞状に「祝」の判が押され、金箔と紅の花びらが降る
 *
 *   サイトの名（原石・航路）と、落ち着いた紺と金の色に合わせた。
 *   ゲームの景品のような派手さ（金貨・回る光・紙吹雪）はやめた。
 *
 * ★ 出した時点で「見た」にする。閉じ忘れても、次から同じものは出ない。
 * ★ 動きを減らす設定の人には、舞うものと数え上げを出さない。
 * ★ まとめて届いたときは、いちばん大きいものを札に、ほかは下に並べる。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";

import { appConfig } from "@/config";
import { SCENE_BODY, SCENE_OF, VoyageScene, type SceneKind } from "@/components/mypage/milestone-scenes";
import { LIKE_STEPS, milestoneHeadline, PERIOD_LABEL, pvCycle, pvIndex, pvNext, pvStepsUpTo, type Milestone } from "@/lib/milestones";

const SERIF = "var(--font-serif), 'Noto Serif JP', 'Noto Serif CJK JP', serif";
const NAVY = "#1f4e6b";
const INK = "#173a52";
const GOLD = "#c9a35a";

export default function MilestoneCelebration() {
    const [items, setItems] = useState<Milestone[]>([]);
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        let alive = true;
        /* 画面が落ち着いてから聞く。開いた瞬間の読み込みの邪魔をしない */
        const timer = window.setTimeout(async () => {
            try {
                const res = await fetch("/api/mypage/milestones", { cache: "no-store" });
                const data = (await res.json()) as { items?: Milestone[]; skipKeys?: string[] };
                if (!alive) return;
                const got = data.items ?? [];
                const keys = [...got.map((m) => m.key), ...(data.skipKeys ?? [])];
                if (keys.length > 0) {
                    /* 出した時点で見たことにする */
                    void fetch("/api/mypage/milestones", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ keys }),
                        keepalive: true,
                    }).catch(() => {});
                }
                if (got.length > 0) {
                    setItems(got);
                    setOpen(true);
                }
            } catch {
                /* 祝えなくても困らない */
            }
        }, 700);
        return () => {
            alive = false;
            window.clearTimeout(timer);
        };
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    if (!mounted || !open || items.length === 0) return null;
    return createPortal(<Celebration items={items} onClose={() => setOpen(false)} />, document.body);
}

/* ============================================================
 * 枠（3 種類に共通）
 * ============================================================ */

type Style = "voyage" | "gem" | "seal";
const styleOf = (m: Milestone): Style => (m.kind === "pv" ? "voyage" : m.kind === "like" ? "gem" : "seal");

function Celebration({ items, onClose }: { items: Milestone[]; onClose: () => void }) {
    /*
     * ★ いくつも届いたときは、1 つずつ札を出し、左右の矢印（← →）で見て回る。
     *   前は 2 つ目から先を下に小さく並べていたが、どれも同じようにうれしい節目なので。
     */
    const [pos, setPos] = useState(0);
    const total = items.length;
    const go = (d: number) => setPos((p) => (p + d + total) % total);
    useEffect(() => {
        if (total < 2) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [total]);
    const main = items[pos];
    const rest: Milestone[] = [];
    const more = 0;
    const reduce = usePrefersReducedMotion();
    const style = styleOf(main);

    const share = () => {
        /* 報告の文も、ふつうの言葉で */
        const head = main.kind === "pv" ? `「${main.novelTitle}」が${main.value.toLocaleString("ja-JP")}回読まれました！` : `「${main.novelTitle}」が${sentence(main)}`;
        const text = `${head}\n読んでくださった皆さん、ありがとうございます。\n#原石航路\n`;
        const url = `${appConfig.siteUrl}/novel/${main.novelId}?from=x`;
        window.open(
            `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
            "_blank",
            "noopener,noreferrer",
        );
    };

    /*
     * ★ 切り替えの段：‹ 「白書の魔女」も 500 PV 達成 ›
     *   まん中には、次に見られる節目を書く（押す前に、何があるか分かるように）。
     */
    const upcoming = total > 1 ? items[(pos + 1) % total] : null;
    const pager =
        upcoming ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                <PagerArrow side="left" onClick={() => go(-1)} />
                <button
                    type="button"
                    onClick={() => go(1)}
                    style={{ flex: 1, minWidth: 0, border: "none", background: "none", cursor: "pointer", fontSize: 13.5, lineHeight: 1.5, color: "var(--color-text, #1a211d)", textAlign: "center" }}
                >
                    {/* 題名が長いときは題名だけを「…」で切り、「も 500 PV 達成」は必ず見せる */}
                    <span style={{ display: "flex", justifyContent: "center", minWidth: 0 }}>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {upcoming.novelId === main.novelId ? "この作品" : `「${upcoming.novelTitle}」`}
                        </span>
                        <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                            {upcoming.novelId === main.novelId ? "は" : "も"}
                            <b style={{ color: "var(--color-brand, #1f4e6b)" }}>{upcoming.kind === "pv" ? ` ${upcoming.value.toLocaleString("ja-JP")} PV ` : ` ${milestoneHeadline(upcoming)} `}</b>
                            達成
                        </span>
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--color-text-muted, #55605a)" }}>{pos + 1} / {total}</span>
                </button>
                <PagerArrow side="right" onClick={() => go(1)} />
            </div>
        ) : null;
    const props = { main, rest, more, reduce, onClose, share, pager };
    const backdrop =
        style === "voyage" ? "rgba(0,0,0,.45)" : style === "gem" ? "rgba(12,32,48,.5)" : "rgba(30,24,16,.5)";

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="節目のお祝い"
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 1000, maxWidth: "none",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
                background: backdrop, ...(style === "voyage" ? {} : { backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }),
                animation: reduce ? undefined : "ms-fade .4s ease-out",
                overflowY: "auto",
            }}
        >
            {/* 航路は、光の粒はやめて紙吹雪だけ（着いた瞬間に左右から） */}
            {/* 紙吹雪は、最初に出てきたときだけ。矢印で切り替えたあとは出さない */}
            {!reduce && <Particles style={styleOf(items[0])} />}
            <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", zIndex: 1, width: style === "voyage" ? "min(420px, 100%)" : "min(420px, 100%)", margin: "auto" }}>
                {/* key を変えると、次の札でも船が港へ進むところから見られる */}
                {style === "voyage" && <Voyage key={pos} {...props} />}
                {style === "gem" && <Gem key={pos} {...props} />}
                {style === "seal" && <Seal key={pos} {...props} />}

            </div>
            <style>{`
                @keyframes ms-fade { from { opacity: 0 } to { opacity: 1 } }
                @keyframes ms-rise { from { opacity: 0; transform: translateY(24px) scale(.96) } to { opacity: 1; transform: none } }
                @keyframes ms-tw { 0%, 100% { opacity: .2; transform: scale(.6) } 50% { opacity: 1; transform: scale(1) } }
                @keyframes ms-sweep { 0% { transform: translateX(-120%) rotate(20deg) } 60%, 100% { transform: translateX(260%) rotate(20deg) } }
                @keyframes ms-draw { to { stroke-dashoffset: 0 } }
                @keyframes ms-pulse { 0% { r: 9; opacity: .9 } 100% { r: 26; opacity: 0 } }
                @keyframes ms-stamp { 0% { opacity: 0; transform: scale(2.6) rotate(-18deg) } 55% { opacity: 1; transform: scale(.92) rotate(-8deg) } 75% { transform: scale(1.04) rotate(-8deg) } 100% { transform: scale(1) rotate(-8deg) } }
                @keyframes ms-ink { from { opacity: 0; transform: scale(.6) } to { opacity: .22; transform: scale(1.3) } }
                @keyframes ms-grow { from { width: 0 } }
                @keyframes ms-beam { 0%, 100% { transform: rotate(-3deg) } 50% { transform: rotate(7deg) } }
                @keyframes ms-light { to { opacity: 1 } }
                @keyframes ms-wave { from { transform: translateX(0) } to { transform: translateX(-40px) } }
                @keyframes ms-rough { 0% { transform: none } 55% { transform: rotate(-2deg) scale(1.02) } 65% { transform: rotate(2deg) } 75% { transform: rotate(-2deg) scale(1.04); filter: brightness(1.2) } 92% { opacity: 1; filter: brightness(2.2) } 100% { opacity: 0; transform: scale(1.1); filter: brightness(3) } }
                @keyframes ms-cut { 0% { opacity: 0; transform: scale(.5) rotate(-10deg) } 100% { opacity: 1; transform: none } }
                @keyframes ms-flash { 0% { opacity: 0; transform: scale(.4) } 30% { opacity: 1 } 100% { opacity: 0; transform: scale(1.4) } }
                @keyframes ms-glowpulse { 0%, 100% { filter: drop-shadow(0 0 6px rgba(255,210,240,.6)) } 50% { filter: drop-shadow(0 0 18px rgba(170,220,255,.95)) } }
                @keyframes ms-spin { to { transform: rotate(360deg) } }
                @keyframes ms-title { 0% { opacity: 0; letter-spacing: .6em; filter: blur(6px) } 100% { opacity: 1; letter-spacing: .14em; filter: blur(0) } }
                @keyframes ms-bob { 0%, 100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(2px) rotate(2deg) } }
                @keyframes ms-glint { 0%, 100% { opacity: 0 } 50% { opacity: .8 } }
                @keyframes ms-stamp-in { 0% { opacity: 0; transform: scale(.2) } 70% { opacity: 1; transform: scale(1.25) } 100% { opacity: 1; transform: scale(1) } }
                @keyframes ms-harbor { 0%, 100% { box-shadow: 0 0 0 4px rgba(232,201,131,.22), 0 0 16px rgba(255,226,160,.7) } 50% { box-shadow: 0 0 0 8px rgba(232,201,131,.08), 0 0 26px rgba(255,226,160,.95) } }
                @keyframes ms-wait { 0% { opacity: 0 } 20%, 80% { opacity: 1 } 100% { opacity: 0 } }
                @keyframes ms-buoy { 0% { opacity: 0 } 40% { opacity: 1; transform: scale(1.4) } 100% { opacity: .7; transform: scale(1) } }
                @keyframes ms-shine { from { background-position: 100% 0 } to { background-position: 0% 0 } }
                @keyframes ms-popnum { 0% { transform: scale(1) } 40% { transform: scale(1.08) } 100% { transform: scale(1) } }
                @keyframes ms-sunrise { to { transform: translateY(0) } }
                @keyframes ms-gull { 0%, 100% { transform: translate(0, 0) } 50% { transform: translate(8px, -4px) } }
                @keyframes ms-cloud { from { transform: translateX(0) } to { transform: translateX(-60px) } }
                @keyframes ms-starbloom { 0% { transform: scale(.5) } 60% { transform: scale(1.5) } 100% { transform: scale(1.15) } }
                @keyframes ms-shoot { 0% { stroke-dashoffset: 100; opacity: 1 } 60% { stroke-dashoffset: 0; opacity: 1 } 100% { stroke-dashoffset: 0; opacity: 0 } }
                @keyframes ms-fly { to { transform: translate(-60px, -70px); opacity: 0 } }
                @keyframes ms-flag { to { transform: scaleY(1) } }
                @keyframes ms-wave-flag { 0%, 100% { transform: skewY(0) } 50% { transform: skewY(-8deg) } }
                @keyframes ms-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
            `}</style>
        </div>
    );
}

interface VariantProps {
    main: Milestone;
    rest: Milestone[];
    more: number;
    reduce: boolean;
    onClose: () => void;
    share: () => void;
    /** ほかの節目へ切り替える段（ボタンのすぐ上に置く）。1 件だけなら無い */
    pager?: ReactNode;
}

/* ============================================================
 * PV：航路
 *
 * ★ もらってうれしい形にする。
 *   ・夜の海を小さな船が進み、節目の灯台に着く。着いた瞬間に灯台がともり、光が広がる
 *   ・節目ごとに「港の名前」がある（100 PV＝最初の灯 … 10万 PV＝世界の果ての灯台）。
 *     数字だけでなく、どこまで来たかが名前で分かる。集めたくなる
 *   ・航海を始めた日から何日目か。自分の歩みとして受け取れる
 *   ・次の港の名前と、あとどれくらいか
 * ============================================================ */

/** 二巡目から先の呼び方 */
const LAP_NAME: Record<number, string> = { 2: "二巡目", 3: "三巡目", 4: "四巡目", 5: "五巡目" };

/** 節目ごとの港の名前 */
const HARBORS: Record<number, { name: string }> = {
    100: { name: "最初の灯" },
    500: { name: "小さな港町" },
    1000: { name: "灯台の岬" },
    3000: { name: "外洋の入り口" },
    5000: { name: "星読みの海" },
    10000: { name: "新しい大陸" },
    30000: { name: "風の群島" },
    50000: { name: "黄金の航路" },
    100000: { name: "世界の果ての灯台" },
};

/* 海の上の航路。左から右の灯台へ */
const SEA_ROUTE = "M 18 206 C 90 214, 120 178, 180 186 S 270 170, 318 170";

function Voyage({ main, rest, more, reduce, onClose, share, pager }: VariantProps) {
    /* 数は船と一緒に進み、灯台に着いたときにちょうど届く */
    const shown = useCountUp(main.value, reduce, 200, 1900, true);
    /*
     * ★ 10 万 PV から先も 10 万ごとに祝う（二巡目・三巡目の航海）。
     *   港の名前と景色は、最初の 9 つをもう一周する。
     */
    const index = pvIndex(main.value);
    const cycle = pvCycle(main.value);
    const harbor = HARBORS[cycle.base] ?? { name: "新しい港" };
    const next = pvNext(main.value);
    const nextHarbor = HARBORS[pvCycle(next).base];
    const scene: SceneKind = SCENE_OF[cycle.base] ?? "lighthouse";
    const days = main.startedAt ? Math.max(1, Math.floor((Date.now() - new Date(main.startedAt).getTime()) / 86400000) + 1) : null;
    /* 通ってきた港（航路の上の小さな灯）。最大 3 つ */
    const passed = pvStepsUpTo(main.value).filter((v) => v < main.value).slice(-3);

    return (
        <div
            style={{
                /*
                 * ★ サイトのふつうの札と同じ見た目にする（白い地・いつもの文字と押し具）。
                 *   金の縁どり・光る粒・字間を空けた見出し・〈〉付きの題などは、
                 *   作り物っぽく見えたのでやめた。飾りは上の景色の絵だけ。
                 */
                borderRadius: 16, overflow: "hidden", textAlign: "left",
                background: "var(--color-bg-card, #fff)", color: "var(--color-text, #1a211d)",
                border: "1px solid var(--color-brand-border, #b4cede)",
                boxShadow: "0 20px 60px rgba(0,0,0,.25)",
                animation: reduce ? undefined : "ms-fade .3s ease-out",
            }}
        >
            <VoyageScene kind={scene} passed={passed} reduce={reduce} />

            {/*
              * ★ 札の下半分の並び。
              *   ① 港の名前（小さな印） ② いちばん大きく「1,000 PV」 ③ 作品名の一文とお祝い
              *   ④ 細かいこと（公開からの日数・次の港）は、薄い地の中に 2 行でまとめる
              *   ⑤ ボタンは左右に半分ずつ（携帯で押しやすい）
              *   文字はまん中にそろえ、大きさの段を 3 つに絞った。
              */}
            <div id="ms-body" style={{ padding: "18px 20px 20px", textAlign: "center" }}>
                <span
                    style={{
                        display: "inline-block", fontSize: 12, fontWeight: 600, padding: "3px 12px", borderRadius: 999,
                        color: "var(--color-brand, #1f4e6b)", background: "var(--color-brand-light, #e6eef4)",
                    }}
                >
                    {cycle.lap > 1 ? `${LAP_NAME[cycle.lap] ?? `${cycle.lap}巡目`}・` : ""}{harbor.name}に到着
                </span>

                <div style={{ marginTop: 8, lineHeight: 1.1, color: "var(--color-brand, #1f4e6b)" }}>
                    <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-.01em", fontVariantNumeric: "tabular-nums" }}>
                        {Math.round(shown).toLocaleString("ja-JP")}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, marginLeft: 4 }}>PV</span>
                </div>

                {/* 数はすぐ上に大きく出ているので、ここでは繰り返さない */}
                <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, marginTop: 6, color: "var(--color-text, #1a211d)" }}>「{main.novelTitle}」</p>
                <p style={{ fontSize: 17, fontWeight: 700, marginTop: 2, color: "var(--color-text, #1a211d)" }}>おめでとうございます！</p>

                {(days || nextHarbor) && (
                    <div
                        style={{
                            marginTop: 14, padding: "10px 14px", borderRadius: 10, textAlign: "left",
                            background: "#f3f6f8", fontSize: 13, lineHeight: 1.9, color: "var(--color-text, #1a211d)",
                        }}
                    >
                        {days && (
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <span style={{ color: "var(--color-text-muted, #55605a)" }}>最初の公開から</span>
                                <span style={{ fontWeight: 600 }}>{days.toLocaleString("ja-JP")}日</span>
                            </div>
                        )}
                        {nextHarbor && (
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <span style={{ color: "var(--color-text-muted, #55605a)" }}>次の節目まで</span>
                                <span style={{ fontWeight: 600 }}>あと {(next - main.value).toLocaleString("ja-JP")} PV（{next.toLocaleString("ja-JP")} PV）</span>
                            </div>
                        )}
                    </div>
                )}

                {rest.length > 0 && (
                    <div style={{ marginTop: 12, textAlign: "left", fontSize: 13, lineHeight: 1.9, color: "var(--color-text, #1a211d)" }}>
                        <span style={{ color: "var(--color-text-muted, #55605a)" }}>ほかの作品も：</span>
                        {rest.map((m, i) => (
                            <span key={m.key}>
                                {i > 0 ? "、" : ""}「{m.novelTitle}」{milestoneHeadline(m)}
                            </span>
                        ))}
                        {more > 0 && <span>　ほか {more} 件</span>}
                    </div>
                )}

                {pager}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 14, cursor: "pointer", border: "1px solid var(--color-brand-border, #b4cede)", background: "var(--color-bg-card, #fff)", color: "var(--color-text, #1a211d)" }}
                    >
                        とじる
                    </button>
                    <button
                        type="button"
                        onClick={share}
                        style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none", background: "var(--color-brand, #1f4e6b)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                    >
                        <XLogo /> X で報告する
                    </button>
                </div>
            </div>
        </div>
    );
}

/** 次の港の印（小さな灯台） */
function MiniLighthouse() {
    return (
        <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
            <path d="M3.5 13 L8.5 13 L7.6 5 L4.4 5 Z" fill="#f3ead6" />
            <rect x="4.6" y="8" width="2.8" height="1.4" fill="#b8322a" />
            <rect x="4" y="2.4" width="4" height="2.6" rx=".5" fill="#e8c983" />
            <path d="M3.6 2.4 L6 .4 L8.4 2.4 Z" fill="#c7d8e5" />
        </svg>
    );
}

/* ============================================================
 * いいね：原石
 *
 * ★ もらってうれしい形にする。
 *   ・読者の「いいね」が小さなハートになって四方から飛んできて、灰色の原石に吸い込まれる。
 *     集まりきった瞬間に光が走り、原石が宝石に磨き上がる（いちばんうれしい一瞬）
 *   ・節目ごとに宝石が変わる（色・名前）。10 は〈光る原石〉… 1,000 は〈伝説の宝石〉。
 *     次はどんな宝石になるのか、集めたくなる
 *   ・「○人が『好き』を押してくれました」と、人の数として受け取れる言葉にする
 *   ・次の宝石の名前と、あとどれくらいか
 * ============================================================ */

type GemTier = { name: string; colors: [string, string, string, string]; line: string };

/** 節目ごとの宝石。色は 明るい面 → 暗い面 */
const GEMS: Record<number, GemTier> = {
    10: { name: "光る原石", colors: ["#e6edf2", "#bccbd6", "#8fa5b5", "#667f91"], line: "最初のひと磨き。光が差しはじめました。" },
    30: { name: "磨かれた石", colors: ["#dcf0f8", "#a9d3e8", "#6eaacd", "#467fa6"], line: "角がとれて、なめらかに光っています。" },
    50: { name: "青の結晶", colors: ["#cfe6f6", "#9fcbea", "#5a9bc8", "#2c6a93"], line: "透きとおった結晶になりました。" },
    100: { name: "蒼玉", colors: ["#d2e1ff", "#8fb2f2", "#4a78d6", "#213f95"], line: "深い青の、本物の宝石です。" },
    300: { name: "星の宝石", colors: ["#ebe4ff", "#bfb1f4", "#8069d8", "#4a3aa7"], line: "中に星がやどる、めずらしい宝石です。" },
    500: { name: "王冠の宝石", colors: ["#fff3cf", "#f4d487", "#d6a640", "#9a6e16"], line: "王冠に飾られるほどの輝きです。" },
    1000: { name: "伝説の宝石", colors: ["#ffe6f3", "#c7ecff", "#9a86f2", "#3c4fb9"], line: "語り継がれる、伝説の輝きです。" },
};

function Gem({ main, rest, more, reduce, onClose, share }: VariantProps) {
    const shown = useCountUp(main.value, reduce, 1900);
    const index = LIKE_STEPS.indexOf(main.value);
    const tier = GEMS[main.value] ?? GEMS[50];
    const next = index >= 0 ? LIKE_STEPS[index + 1] : undefined;
    const nextTier = next ? GEMS[next] : undefined;
    const progress = next ? Math.max(0.02, Math.min(1, (main.actual - main.value) / (next - main.value))) : 1;
    const [c0, c1, c2, c3] = tier.colors;
    const legend = main.value >= 1000;

    return (
        <div
            style={{
                background: "#fdfcf9", borderRadius: 22, overflow: "hidden", textAlign: "center",
                boxShadow: "0 40px 100px rgba(5,20,32,.45)",
                animation: reduce ? undefined : "ms-rise .7s cubic-bezier(.2,.9,.3,1.1)",
            }}
        >
            {/* 原石が磨かれる舞台 */}
            <div
                style={{
                    position: "relative", height: 210, overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `radial-gradient(90% 80% at 50% 58%, ${c1}55 0%, #f3f8fc 55%, #fdfcf9 100%)`,
                }}
            >
                {/* 後ろの光の筋（磨き上がってから） */}
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute", width: 420, height: 420, left: "50%", top: "50%", marginLeft: -210, marginTop: -210,
                        background: `repeating-conic-gradient(from 0deg, ${c1}40 0deg 6deg, transparent 6deg 24deg)`,
                        maskImage: "radial-gradient(circle, #000 18%, transparent 60%)",
                        WebkitMaskImage: "radial-gradient(circle, #000 18%, transparent 60%)",
                        opacity: reduce ? 0.8 : 0,
                        animation: reduce ? undefined : "ms-light .8s 1.75s ease-out forwards, ms-spin 30s linear infinite",
                    }}
                />
                {/* 小さな星のまたたき */}
                {([[24, 24, 0, 12], [74, 18, 0.5, 9], [80, 64, 0.9, 14], [18, 70, 1.2, 9], [64, 82, 0.3, 7], [34, 12, 1.5, 7]] as const).map(([x, y, d, s], i) => (
                    <svg key={i} viewBox="0 0 24 24" width={s} height={s} aria-hidden="true"
                        style={{ position: "absolute", left: `${x}%`, top: `${y}%`, opacity: reduce ? 0.8 : 0, animation: reduce ? undefined : `ms-light .3s ${1.8 + d * 0.2}s forwards, ms-tw 1.8s ${2 + d}s ease-in-out infinite` }}>
                        <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill={GOLD} />
                    </svg>
                ))}

                <div id="ms-gem" style={{ position: "relative", width: 120, height: 120 }}>
                    {/* 磨く前の原石（ハートを受けて、ふるえ、光って消える） */}
                    {!reduce && (
                        <svg viewBox="0 0 100 100" width="120" height="120" aria-hidden="true"
                            style={{ position: "absolute", inset: 0, animation: "ms-rough 1.8s ease-in forwards" }}>
                            <polygon points="30,22 62,14 86,36 90,66 70,88 36,90 14,68 12,40" fill="#8b9197" />
                            <polygon points="30,22 62,14 58,44 34,48" fill="#a3a9ae" />
                            <polygon points="62,14 86,36 70,52 58,44" fill="#7a8187" />
                            <polygon points="12,40 30,22 34,48 22,64" fill="#9aa0a6" />
                            <polygon points="34,48 58,44 70,52 64,76 40,78" fill="#838a90" />
                            <polygon points="14,68 22,64 40,78 36,90" fill="#6f767c" />
                            <polygon points="70,52 86,36 90,66 70,88 64,76" fill="#6a7177" />
                        </svg>
                    )}
                    {/* 磨き上がった宝石 */}
                    <div style={{ position: "absolute", inset: 0, opacity: reduce ? 1 : 0, animation: reduce ? undefined : "ms-cut .7s 1.7s cubic-bezier(.2,1.5,.4,1) forwards", filter: `drop-shadow(0 14px 24px ${c3}66)` }}>
                        <svg viewBox="0 0 100 100" width="120" height="120" aria-hidden="true" style={legend && !reduce ? { animation: "ms-glowpulse 2.4s ease-in-out infinite" } : undefined}>
                            <polygon points="50,8 92,34 78,92 22,92 8,34" fill={c3} />
                            <polygon points="50,8 72,34 50,40 28,34" fill={c1} />
                            <polygon points="50,8 92,34 72,34" fill={c2} />
                            <polygon points="50,8 8,34 28,34" fill={c0} />
                            <polygon points="28,34 50,40 36,92 22,92 8,34" fill={c2} />
                            <polygon points="72,34 92,34 78,92 64,92 50,40" fill={c3} />
                            <polygon points="50,40 64,92 36,92" fill={c2} opacity=".85" />
                            <polygon points="28,34 50,40 72,34 50,8" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".8" />
                            {main.value >= 300 && <path d="M50 52 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#fff" opacity=".9" />}
                        </svg>
                        {!reduce && (
                            <div style={{ position: "absolute", inset: 0, overflow: "hidden", clipPath: "polygon(50% 8%, 92% 34%, 78% 92%, 22% 92%, 8% 34%)" }}>
                                <i style={{ position: "absolute", top: "-30%", left: 0, width: "30%", height: "160%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.9), transparent)", animation: "ms-sweep 3s 2.2s ease-in-out infinite" }} />
                            </div>
                        )}
                    </div>
                    {/* 磨き上がる瞬間の白い閃き */}
                    {!reduce && <div style={{ position: "absolute", inset: -40, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 60%)", opacity: 0, animation: "ms-flash .7s 1.62s ease-out" }} />}
                </div>
            </div>

            <div style={{ padding: "4px 30px 26px" }}>
                <div style={{ fontSize: 11, letterSpacing: ".28em", color: c3, fontWeight: 700 }}>
                    {index >= 0 ? `第${index + 1}の輝き` : "新しい輝き"}
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, marginTop: 6, letterSpacing: ".08em", color: INK }}>
                    〈 {tier.name} 〉
                </div>
                <p style={{ fontSize: 12, color: "#7a8a95", marginTop: 4 }}>{tier.line}</p>

                <BigNumber value={shown} unit="いいね" color={INK} unitColor="#6d7f8b" size={60} />
                <Ornament />
                <p style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.8, color: "#1d2b35" }}>
                    「{main.novelTitle}」を、
                    <br />
                    <b style={{ fontWeight: 600, color: c3 }}>{main.value.toLocaleString("ja-JP")}人</b> が「好き」と押してくれました。
                </p>

                {next && nextTier ? (
                    <div style={{ marginTop: 16, padding: "11px 14px", borderRadius: 12, background: "#f3f6f9", textAlign: "left" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#56656f", gap: 8 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <MiniGem colors={nextTier.colors} />
                                次は〈{nextTier.name}〉{next.toLocaleString("ja-JP")} いいね
                            </span>
                            <span style={{ whiteSpace: "nowrap" }}>あと {Math.max(0, next - main.actual).toLocaleString("ja-JP")}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "#e2e8ee", overflow: "hidden", marginTop: 7 }}>
                            <i style={{ display: "block", height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg, ${nextTier.colors[2]}, ${nextTier.colors[1]})`, borderRadius: 3, animation: reduce ? undefined : "ms-grow 1.2s 2.2s both ease-out" }} />
                        </div>
                    </div>
                ) : (
                    <p style={{ marginTop: 12, fontSize: 12.5, color: "#7a8a95" }}>いまは {main.actual.toLocaleString("ja-JP")} いいね。いちばん上の輝きです。</p>
                )}

                <Others items={rest} more={more} tone="light" reduce={reduce} />
                <Buttons tone="light" onClose={onClose} share={share} />
            </div>
        </div>
    );
}

/** 次の宝石の小さな見本 */
function MiniGem({ colors }: { colors: [string, string, string, string] }) {
    const [c0, c1, c2, c3] = colors;
    return (
        <svg viewBox="0 0 100 100" width="16" height="16" aria-hidden="true">
            <polygon points="50,8 92,34 78,92 22,92 8,34" fill={c3} />
            <polygon points="50,8 72,34 50,40 28,34" fill={c1} />
            <polygon points="50,8 8,34 28,34" fill={c0} />
            <polygon points="28,34 50,40 36,92 22,92 8,34" fill={c2} />
        </svg>
    );
}

/* ============================================================
 * ランキング：祝
 * ============================================================ */

function Seal({ main, rest, more, reduce, onClose, share }: VariantProps) {
    const period = PERIOD_LABEL[main.period ?? ""] ?? "";
    return (
        <div
            style={{
                background: "#fbf6ea", borderRadius: 6, padding: 14,
                boxShadow: "0 30px 90px rgba(0,0,0,.4)",
                animation: reduce ? undefined : "ms-rise .7s cubic-bezier(.2,.9,.3,1.1)",
            }}
        >
            <div
                style={{
                    position: "relative", border: `1.5px solid ${NAVY}`, outline: `1px solid ${GOLD}`, outlineOffset: -7,
                    padding: "34px 24px 22px", textAlign: "center",
                    background: "radial-gradient(circle at 20% 10%, rgba(201,163,90,.08), transparent 40%), radial-gradient(circle at 90% 90%, rgba(31,78,107,.06), transparent 45%)",
                }}
            >
                {/* 判 */}
                <div style={{ position: "absolute", top: 22, right: 22, width: 62, height: 62, animation: reduce ? undefined : "ms-stamp .55s .35s both cubic-bezier(.3,1.4,.5,1)", transform: reduce ? "rotate(-8deg)" : undefined }}>
                    <div style={{ position: "absolute", inset: 6, borderRadius: "50%", background: "#c0392b", filter: "blur(10px)", opacity: 0.2, animation: reduce ? undefined : "ms-ink .5s .6s both" }} />
                    <div style={{ position: "relative", width: "100%", height: "100%", border: "3px solid #b8322a", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#b8322a", fontFamily: SERIF, fontSize: 36, fontWeight: 700 }}>
                        祝
                    </div>
                </div>

                <div style={{ fontFamily: SERIF, fontSize: 13, letterSpacing: ".5em", color: "#8a6d3b" }}>{period}ランキング</div>
                <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 76, lineHeight: 1.05, color: "#1b3347", marginTop: 12 }}>
                    {main.actual}
                    <span style={{ fontSize: 26, marginLeft: 4 }}>位</span>
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 18, letterSpacing: ".3em", color: "#1b3347", marginTop: 2 }}>
                    {main.value === 1 ? "首 位" : main.value === 3 ? "三 位 以 内" : "十 位 以 内"}
                </div>
                <p style={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.9, color: "#2b2b2b", marginTop: 16 }}>
                    「{main.novelTitle}」が
                    <br />
                    {period}ランキングで {main.actual}位 に入りました。
                </p>
                <p style={{ fontSize: 12, color: "#8a7f6c", marginTop: 4 }}>読んでくれた方々に、感謝をこめて。</p>
                <div style={{ fontFamily: SERIF, fontSize: 12, color: "#8a7f6c", marginTop: 14, textAlign: "right" }}>{kanjiDate(new Date())}</div>

                <Others items={rest} more={more} tone="paper" reduce={reduce} />
                <Buttons tone="paper" onClose={onClose} share={share} />
            </div>
        </div>
    );
}

/** 「二〇二六年九月二十九日」 */
function kanjiDate(d: Date): string {
    const t = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const digit = "〇一二三四五六七八九";
    const year = String(t.getUTCFullYear()).split("").map((c) => digit[Number(c)]).join("");
    const num = (n: number) => (n < 10 ? digit[n] : n === 10 ? "十" : n < 20 ? `十${digit[n - 10]}` : `${digit[Math.floor(n / 10)]}十${n % 10 ? digit[n % 10] : ""}`);
    return `${year}年${num(t.getUTCMonth() + 1)}月${num(t.getUTCDate())}日`;
}

/* ============================================================
 * 部品
 * ============================================================ */

function Eyebrow({ color, children }: { color: string; children: ReactNode }) {
    return <div style={{ fontSize: 10.5, letterSpacing: ".32em", color, fontWeight: 600 }}>{children}</div>;
}

function BigNumber({ value, unit, color, unitColor, size }: { value: number; unit: string; color: string; unitColor: string; size: number }) {
    return (
        <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: size, lineHeight: 1, color, marginTop: 12, letterSpacing: "-.01em", fontVariantNumeric: "tabular-nums" }}>
            {Math.round(value).toLocaleString("ja-JP")}
            <small style={{ fontFamily: "inherit", fontSize: 16, fontWeight: 600, color: unitColor, marginLeft: 6, letterSpacing: ".04em" }}>{unit}</small>
        </div>
    );
}

function Ornament() {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", margin: "18px auto 14px", width: 180 }} aria-hidden="true">
            <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
            <b style={{ width: 7, height: 7, background: GOLD, transform: "rotate(45deg)" }} />
            <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
        </div>
    );
}

type Tone = "dark" | "light" | "paper";

function Others({ items, more, tone, reduce }: { items: Milestone[]; more: number; tone: Tone; reduce: boolean }) {
    if (items.length === 0) return null;
    const line = tone === "dark" ? "rgba(255,255,255,.1)" : tone === "light" ? "#ece7dc" : "#e3d8c2";
    const text = tone === "dark" ? "#c7d8e5" : tone === "light" ? "#445" : "#4a4336";
    const strong = tone === "dark" ? "#f0d59a" : tone === "light" ? INK : "#1b3347";
    const mark = tone === "dark" ? GOLD : tone === "light" ? "#7fb0d3" : "#b8322a";
    return (
        <div style={{ marginTop: 18, textAlign: "left", borderTop: `1px solid ${line}`, paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: text, opacity: 0.75, margin: "2px 0 4px" }}>ほかにも届いた節目</div>
            {items.map((m, i) => (
                <div key={m.key} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, padding: "6px 0", color: text, animation: reduce ? undefined : `ms-in .45s ${0.9 + i * 0.12}s both` }}>
                    <i style={{ width: 8, height: 8, background: mark, transform: "rotate(45deg)", flexShrink: 0 }} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.novelTitle}</span>
                    <em style={{ fontStyle: "normal", marginLeft: "auto", fontWeight: 600, color: strong, fontFamily: SERIF, whiteSpace: "nowrap" }}>{milestoneHeadline(m)}</em>
                </div>
            ))}
            {more > 0 && <div style={{ fontSize: 11, color: text, opacity: 0.7, marginTop: 2 }}>ほか {more} 件</div>}
        </div>
    );
}

function Buttons({ tone, onClose, share }: { tone: Tone; onClose: () => void; share: () => void }) {
    const base: CSSProperties = { flex: 1, height: 46, borderRadius: tone === "paper" ? 8 : 12, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
    const ghost: CSSProperties =
        tone === "dark"
            ? { background: "transparent", border: "1px solid rgba(255,255,255,.25)", color: "#dfe9f1" }
            : tone === "light"
              ? { background: "#fff", border: "1px solid #d6dee4", color: "#56656f" }
              : { background: "transparent", border: "1px solid #cfc4ad", color: "#6b604d" };
    const primary: CSSProperties =
        tone === "dark"
            ? { background: "linear-gradient(180deg, #f0d59a, #c9a35a)", border: "none", color: "#0d2b42" }
            : { background: NAVY, border: "none", color: "#fff" };
    return (
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={{ ...base, ...ghost }}>とじる</button>
            <button type="button" onClick={share} style={{ ...base, ...primary }}>
                <XLogo /> シェアする
            </button>
        </div>
    );
}

/** 切り替えの矢印（ボタンの上の段の左右） */
function PagerArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={side === "left" ? "前の節目" : "次の節目"}
            style={{
                width: 38, height: 38, flexShrink: 0, borderRadius: "50%", cursor: "pointer",
                border: "1px solid var(--color-brand-border, #b4cede)", background: "var(--color-bg-card, #fff)", color: "var(--color-brand, #1f4e6b)",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {side === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
            </svg>
        </button>
    );
}

function XLogo() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );
}

function sentence(m: Milestone): string {
    if (m.kind === "pv") return `${m.value.toLocaleString("ja-JP")} PV を突破しました！`;
    if (m.kind === "like") return `いいね ${m.value.toLocaleString("ja-JP")} を突破しました！`;
    const label = PERIOD_LABEL[m.period ?? ""] ?? "";
    return m.actual === 1 ? `${label}ランキングで 1位 になりました！` : `${label}ランキングで ${m.actual}位 に入りました！`;
}

/* ============================================================
 * 舞うもの（札の後ろ）
 *   航路  現在地から金と白の光の粒が広がる
 *   原石  きらめき（小さな菱形）が弾けて、下からも昇る
 *   祝    金箔と紅・生成りの花びらが、上から揺れながら降る
 * ============================================================ */

type Piece = { x: number; y: number; vx: number; vy: number; g: number; sz: number; c: string; shape: "dia" | "dot" | "leaf" | "heart" | "paper"; r: number; life: number; dec: number; tx?: number; ty?: number; at?: number };

function Particles({ style }: { style: Style }) {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = window.innerWidth;
        const H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        const P: Piece[] = [];
        let burstTimer = 0;
        const pick = <T,>(list: T[], i: number) => list[i % list.length];
        const cardTop = Math.max(16, H / 2 - 300);

        if (style === "gem") {
            /*
             * 読者の「いいね」がハートになって四方から飛んできて、原石に吸い込まれる（0.2〜1.5 秒）。
             * 集まりきったら（1.7 秒）、宝石から光のかけらが弾ける。
             */
            const el = document.getElementById("ms-gem");
            const box = el?.getBoundingClientRect();
            const tx = box ? box.left + box.width / 2 : W / 2;
            const ty = box ? box.top + box.height / 2 : cardTop + 105;
            for (let i = 0; i < 44; i++) {
                const a = Math.random() * Math.PI * 2;
                const dist = Math.min(W, H) * (0.35 + Math.random() * 0.3) + 60;
                P.push({ x: tx + Math.cos(a) * dist, y: ty + Math.sin(a) * dist, vx: 0, vy: 0, g: 0, sz: 11 + Math.random() * 9, c: pick(["#e86a8e", "#f59ab4", "#ffffff", "#f3c8d6"], i), shape: "heart", r: (Math.random() - 0.5) * 0.6, life: 1, dec: 0, tx, ty, at: 120 + i * 30 });
            }
            burstTimer = window.setTimeout(() => {
                for (let i = 0; i < 110; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const s = 2 + Math.random() * 5.5;
                    P.push({ x: tx, y: ty, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: 0.04, sz: 2 + Math.random() * 4.5, c: pick(["#c9a35a", "#f3dca4", "#9fcbea", "#ffffff", "#f59ab4"], i), shape: "dia", r: 0, life: 1, dec: 0.006 + Math.random() * 0.006 });
                }
                for (let i = 0; i < 40; i++) {
                    P.push({ x: Math.random() * W, y: H + 10 + Math.random() * 200, vx: (Math.random() - 0.5) * 0.3, vy: -(0.6 + Math.random() * 1.2), g: 0, sz: 1.5 + Math.random() * 3, c: pick(["#f3dca4", "#ffffff", "#bcdcf2"], i), shape: "dia", r: 0, life: 1, dec: 0.002 });
                }
            }, 1700);
        } else if (style === "voyage") {
            /* 船が灯台に着いた瞬間（約 2 秒後）に、灯台から光の粒が広がる */
            burstTimer = window.setTimeout(() => {
                /*
                 * 紙吹雪。画面の左右の下から、斜め上へ打ち上げる。
                 * 色はサイトに合わせて、金・生成り・空色・珊瑚・若葉。ひらひら裏返りながら落ちる。
                 */
                for (let i = 0; i < 150; i++) {
                    const left = i % 2 === 0;
                    const a = ((left ? -62 : -118) + (Math.random() - 0.5) * 34) * (Math.PI / 180);
                    const sp = 9 + Math.random() * 8;
                    P.push({
                        x: left ? -8 : W + 8, y: H * (0.72 + Math.random() * 0.18),
                        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.22,
                        sz: 6 + Math.random() * 5,
                        c: pick(["#e8c983", "#fff3d6", "#9fcbea", "#ef8d7a", "#9fd8bf", "#f5d98f", "#6f9fc4"], i),
                        shape: "paper", r: Math.random() * Math.PI * 2, life: 1, dec: 0,
                    });
                }
            }, 1950);
        } else {
            for (let i = 0; i < 80; i++) {
                P.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.7, vx: (Math.random() - 0.5) * 0.8, vy: 1 + Math.random() * 1.6, g: 0, sz: 5 + Math.random() * 7, c: pick(["#d4af61", "#e9cf8f", "#c0392b", "#f7efe0"], i), shape: "leaf", r: Math.random() * 6, life: 1, dec: 0 });
            }
        }

        let raf = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = now - start;
            ctx.clearRect(0, 0, W, H);
            for (const p of P) {
                /* 飛んでいくハート。出る時刻まで待ち、的へ近づいて、着いたら消える */
                if (p.tx !== undefined && p.ty !== undefined) {
                    if (p.life <= 0 || t < (p.at ?? 0)) continue;
                    const dx = p.tx - p.x;
                    const dy = p.ty - p.y;
                    const d = Math.hypot(dx, dy);
                    const speed = Math.min(d, 3 + (t - (p.at ?? 0)) * 0.018);
                    if (d < 10) {
                        p.life = 0;
                        continue;
                    }
                    p.x += (dx / d) * speed + Math.sin(t / 120 + p.r * 10) * 0.8;
                    p.y += (dy / d) * speed;
                    p.vx = 0;
                    p.vy = 0;
                }
                p.vy += p.g;
                if (p.shape === "paper") {
                    /* 紙は空気でふわっと止まり、ゆれながら落ちる */
                    p.vx *= 0.975;
                    if (p.vy > 2.1) p.vy = 2.1;
                    p.x += Math.sin(now / 380 + p.r * 3) * 0.7;
                }
                p.x += p.vx + (p.shape === "leaf" ? Math.sin(now / 500 + p.r) * 0.8 : 0);
                p.y += p.vy;
                p.life -= p.dec;
                if (t > 7000) p.life -= 0.02;
                if (p.life <= 0) continue;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.translate(p.x, p.y);
                ctx.fillStyle = p.c;
                if (p.shape === "dia") {
                    ctx.rotate(Math.PI / 4);
                    ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz);
                } else if (p.shape === "dot") {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.sz, 0, Math.PI * 2);
                    ctx.shadowColor = p.c;
                    ctx.shadowBlur = 8;
                    ctx.fill();
                } else if (p.shape === "paper") {
                    ctx.rotate(p.r + now / 700);
                    ctx.scale(1, Math.abs(Math.cos(now / 220 + p.r * 2)) + 0.08);
                    ctx.fillRect(-p.sz / 2, -p.sz * 0.3, p.sz, p.sz * 0.6);
                } else if (p.shape === "heart") {
                    const k = p.sz / 10;
                    ctx.rotate(p.r);
                    ctx.scale(k, k);
                    ctx.beginPath();
                    ctx.moveTo(0, 4);
                    ctx.bezierCurveTo(-7, -1, -5, -8, 0, -4);
                    ctx.bezierCurveTo(5, -8, 7, -1, 0, 4);
                    ctx.shadowColor = "rgba(232,106,142,.6)";
                    ctx.shadowBlur = 6;
                    ctx.fill();
                } else {
                    ctx.rotate(now / 600 + p.r);
                    ctx.scale(1, Math.abs(Math.cos(now / 300 + p.r)) + 0.05);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, p.sz, p.sz * 0.55, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
            if (t < 8500) raf = requestAnimationFrame(tick);
            else ctx.clearRect(0, 0, W, H);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(burstTimer);
        };
    }, [style]);

    /*
     * 航路と原石は札の手前に重ねる（紙吹雪が見えるように）。祝は札の後ろ。
     */
    return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: style === "seal" ? 0 : 2 }} />;
}

/* ============================================================
 * 小物
 * ============================================================ */

function useCountUp(target: number, skip: boolean, delay = 350, duration = 1400, easeInOut = false) {
    const [value, setValue] = useState(skip ? target : 0);
    useEffect(() => {
        if (skip) {
            setValue(target);
            return;
        }
        let raf = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, Math.max(0, (now - start - delay) / duration));
            /* 航路は船の進み方（ゆっくり出て、ゆっくり着く）に合わせる */
            const eased = easeInOut ? (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) : 1 - Math.pow(1 - t, 3);
            setValue(target * eased);
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, skip, delay, duration, easeInOut]);
    return value;
}

function usePrefersReducedMotion() {
    const [reduce, setReduce] = useState(false);
    useEffect(() => {
        try {
            setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        } catch {
            /* 分からなければ動かす */
        }
    }, []);
    return reduce;
}
