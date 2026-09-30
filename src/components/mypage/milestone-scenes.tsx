/**
 * ============================================================
 * 原石航路 Studio
 * 航路のお祝いの景色（PV の節目ごとに 1 つずつ、9 種類）
 *
 *   100     最初の灯        夜明けの海      着くと朝日がのぼり、光の道が海に伸びる
 *   500     小さな港町      夕暮れの港町    着くと窓と桟橋の提灯がともり、煙突から煙
 *   1,000   灯台の岬        月夜の灯台      着くと灯台がともり、光が首を振る。岩に白波
 *   3,000   外洋の入り口    昼の大海原      着くとくじらが潮を吹き、しぶきに虹がかかる
 *   5,000   星読みの海      星の海          着くと導きの星が輝き、星座がつながり、流れ星。海に夜光虫
 *   1万     新しい大陸      新しい大陸      着くと浜に旗が立ち、鳥が飛び立つ。滝が光る
 *   3万     風の群島        風の群島        着くと風車が回りだし、風が吹き抜ける
 *   5万     黄金の航路      黄金の夕凪      着くと海一面が金にきらめき、光の柱が立つ
 *   10万    世界の果ての灯台 オーロラの果て  着くと大灯台がともり、オーロラが揺れ、花火が上がる
 *
 * ★ 船・航跡・通ってきた港の灯は、どの景色にも共通。
 * ★ 着いた瞬間の光の粒は、id="ms-lighthouse" の場所から広がる（景色ごとの目的地に付ける）。
 * ★ 動きを減らす設定の人には、着いたあとの姿を最初から出す。
 * ============================================================
 */

"use client";

import type { CSSProperties, ReactNode } from "react";

export type SceneKind =
    | "dawn" | "town" | "lighthouse" | "ocean" | "stars" | "land" | "isles" | "golden" | "aurora";

export const SCENE_OF: Record<number, SceneKind> = {
    100: "dawn",
    500: "town",
    1000: "lighthouse",
    3000: "ocean",
    5000: "stars",
    10000: "land",
    30000: "isles",
    50000: "golden",
    100000: "aurora",
};

/** 札の下半分の色（景色の海から続ける） */
export const SCENE_BODY: Record<SceneKind, string> = {
    dawn: "linear-gradient(180deg, #243a63 0%, #2b3466 100%)",
    town: "linear-gradient(180deg, #1e2a4d 0%, #29224a 100%)",
    lighthouse: "linear-gradient(180deg, #0f2f48 0%, #123a57 100%)",
    ocean: "linear-gradient(180deg, #0f4f78 0%, #0f3d5f 100%)",
    stars: "linear-gradient(180deg, #06162a 0%, #0c2240 100%)",
    land: "linear-gradient(180deg, #15607c 0%, #134a66 100%)",
    isles: "linear-gradient(180deg, #1a5d78 0%, #1a4863 100%)",
    golden: "linear-gradient(180deg, #4a2c3a 0%, #2f2240 100%)",
    aurora: "linear-gradient(180deg, #061a26 0%, #0b2433 100%)",
};

type Palette = { sky: string[]; sea: [string, string]; wave: string };
const PALETTE: Record<SceneKind, Palette> = {
    dawn: { sky: ["#1f2a57", "#4b4f8a", "#b77f9d", "#f3a98a", "#ffd9a2"], sea: ["#5a6a9b", "#243a63"], wave: "rgba(255,230,210,.18)" },
    town: { sky: ["#241f4b", "#5d3f78", "#b2587b", "#ee8a5a", "#ffc47c"], sea: ["#3f4a7c", "#1e2a4d"], wave: "rgba(255,210,180,.16)" },
    lighthouse: { sky: ["#07182b", "#11304e", "#1d4a6b", "#5d6782", "#d9ad78"], sea: ["#1d4a6b", "#0f2f48"], wave: "rgba(255,255,255,.14)" },
    ocean: { sky: ["#2f8fd1", "#57a9de", "#8ec6ea", "#cfe7f5", "#f4fbff"], sea: ["#1f7cb5", "#0f4f78"], wave: "rgba(255,255,255,.35)" },
    stars: { sky: ["#030a17", "#07152d", "#0d2446", "#173660", "#23466f"], sea: ["#0f2c4b", "#06162a"], wave: "rgba(150,200,255,.12)" },
    land: { sky: ["#4ea5d8", "#7fc1e6", "#b7dcef", "#e6f3f7", "#fff3d8"], sea: ["#2a97b3", "#15607c"], wave: "rgba(255,255,255,.3)" },
    isles: { sky: ["#6ab3d9", "#94c9e3", "#c5e1ea", "#f1ead0", "#ffdca0"], sea: ["#3496ae", "#1a5d78"], wave: "rgba(255,255,255,.3)" },
    golden: { sky: ["#3b2447", "#7e3b58", "#d0645a", "#f3a14e", "#ffd47a"], sea: ["#a2604e", "#4a2c3a"], wave: "rgba(255,220,150,.3)" },
    aurora: { sky: ["#02080f", "#061722", "#0b2533", "#123446", "#1b4556"], sea: ["#0f2e3d", "#061a26"], wave: "rgba(160,255,220,.12)" },
};

export const ARRIVE = 1.95;
/**
 * 船が止まる場所。景色ごとに、陸や町にかからない海の上にする。
 * （港町・大陸・群島は陸が手前まで来ているので、その手前の海で止める）
 */
const ROUTE_END: Record<SceneKind, [number, number]> = {
    dawn: [318, 170],
    town: [268, 180],
    lighthouse: [312, 172],
    ocean: [318, 172],
    stars: [318, 172],
    land: [256, 184],
    isles: [270, 188],
    golden: [318, 172],
    aurora: [318, 174],
};
/** 航路。左から右の目的地へ */
function routeFor(kind: SceneKind): string {
    const [ex, ey] = ROUTE_END[kind];
    return `M 18 206 C 90 214, 120 190, 170 190 S ${ex - 50} ${ey}, ${ex} ${ey}`;
}

/** 着いたら現れる */
const lit = (reduce: boolean, delay = ARRIVE, dur = 0.7): CSSProperties =>
    reduce ? {} : { opacity: 0, animation: `vs-in ${dur}s ${delay}s ease-out forwards` };
/** 繰り返す動き */
const loop = (reduce: boolean, name: string, dur: number, delay = 0, extra: CSSProperties = {}): CSSProperties =>
    reduce ? {} : { ...extra, animation: `${name} ${dur}s ${delay}s ease-in-out infinite` };
const box: CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

/* ============================================================
 * 全体
 * ============================================================ */

export function VoyageScene({ kind, passed, reduce }: { kind: SceneKind; passed: number[]; reduce: boolean }) {
    const p = PALETTE[kind];
    const route = routeFor(kind);
    const [endX, endY] = ROUTE_END[kind];
    /* 通ってきた港の灯は、航路の上に等間隔に置く */
    const buoyAt = [0.25, 0.5, 0.75].map((t) => pointOn(route, t)).slice(3 - passed.length);

    return (
        <svg viewBox="0 0 440 240" width="100%" style={{ display: "block" }} aria-hidden="true">
            <defs>
                <linearGradient id="vs-sky" x1="0" y1="0" x2="0" y2="1">
                    {p.sky.map((c, i) => <stop key={i} offset={i / (p.sky.length - 1)} stopColor={c} />)}
                </linearGradient>
                <linearGradient id="vs-sea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={p.sea[0]} />
                    <stop offset="1" stopColor={p.sea[1]} />
                </linearGradient>
                <radialGradient id="vs-glow">
                    <stop offset="0" stopColor="rgba(255,232,170,.95)" />
                    <stop offset="1" stopColor="rgba(255,232,170,0)" />
                </radialGradient>
                <radialGradient id="vs-sunglow">
                    <stop offset=".15" stopColor="rgba(255,226,150,.7)" />
                    <stop offset="1" stopColor="rgba(255,226,150,0)" />
                </radialGradient>
                <radialGradient id="vs-sun">
                    <stop offset="0" stopColor="#fffbe8" />
                    <stop offset=".6" stopColor="#ffe19a" />
                    <stop offset="1" stopColor="#ffc166" />
                </radialGradient>
                <linearGradient id="vs-reflect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="rgba(255,226,160,.55)" />
                    <stop offset="1" stopColor="rgba(255,226,160,0)" />
                </linearGradient>
                <linearGradient id="vs-beam" x1="1" y1="0" x2="0" y2="0">
                    <stop offset="0" stopColor="rgba(255,236,180,.8)" />
                    <stop offset="1" stopColor="rgba(255,236,180,0)" />
                </linearGradient>
                <linearGradient id="vs-horizon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="rgba(255,255,255,.28)" />
                    <stop offset="1" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
            </defs>

            {/* 空 */}
            <rect width="440" height="240" fill="url(#vs-sky)" />
            <Layer kind={kind} layer="sky" reduce={reduce} />

            {/* 海 */}
            <rect y="160" width="440" height="80" fill="url(#vs-sea)" />
            <rect y="160" width="440" height="6" fill="url(#vs-horizon)" opacity=".5" />
            <g style={loop(reduce, "vs-drift", 7)}>
                {[176, 194, 214, 232].map((y, i) => (
                    <path key={y} d={wave(y, 5 + i * 1.6, 30 + i * 8)} fill="none" stroke={p.wave} strokeWidth={1 + i * 0.25} opacity={1 - i * 0.15} />
                ))}
            </g>
            {!reduce &&
                GLINTS.map(([x, y, d], i) => (
                    <rect key={i} x={x} y={y} width="7" height="1.3" rx=".65" fill="#fff" style={{ opacity: 0, animation: `vs-glint 3.2s ${d}s ease-in-out infinite` }} />
                ))}
            <Layer kind={kind} layer="sea" reduce={reduce} />

            {/* 航跡と、通ってきた港の灯 */}
            <path d={route} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1.4" strokeDasharray="2 6" />
            <path
                d={route} fill="none" stroke="#f0cf86" strokeWidth="2.2" strokeLinecap="round"
                strokeDasharray="340" strokeDashoffset={reduce ? 0 : 340}
                style={reduce ? undefined : { animation: `vs-draw 1.9s .2s cubic-bezier(.45,0,.3,1) forwards` }}
            />
            {passed.map((v, i) => (
                <g key={v}>
                    <circle cx={buoyAt[i].x} cy={buoyAt[i].y} r="8" fill="url(#vs-glow)" opacity={reduce ? 0.7 : 0}
                        style={reduce ? undefined : { ...box, animation: `vs-buoy 1s ${0.2 + (buoyAt[i].x / endX) * 1.6}s ease-out forwards` }} />
                    <circle cx={buoyAt[i].x} cy={buoyAt[i].y} r="2.6" fill="#ffe7a6" />
                    <text x={buoyAt[i].x} y={buoyAt[i].y + 16} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,.75)" fontFamily="sans-serif"
                        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,.25)", strokeWidth: 2 }}>
                        {v.toLocaleString("ja-JP")}
                    </text>
                </g>
            ))}

            {/* 船 */}
            <g>
                {!reduce && <animateMotion dur="1.9s" begin="0.2s" fill="freeze" path={route} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .3 1" />}
                <g transform={reduce ? `translate(${endX} ${endY})` : undefined}>
                    <g style={loop(reduce, "vs-bob", 2.4, 2.1)}>
                        <ellipse cx="0" cy="5" rx="13" ry="1.6" fill="rgba(0,0,0,.18)" />
                        <path d="M -12 -2 L 12 -2 L 8 5 L -8 5 Z" fill="#f3ead6" />
                        <path d="M -12 -2 L 12 -2 L 11.4 -.6 L -11.4 -.6 Z" fill="#b8322a" />
                        <path d="M 0 -3 L 0 -24 L 13 -5 Z" fill="#fff" />
                        <path d="M -1 -4 L -1 -19 L -11 -5 Z" fill="#f0cf86" />
                        <path d="M 0 -24 L 6.5 -22.5 L 0 -21 Z" fill="#b8322a" />
                    </g>
                </g>
            </g>

            <Layer kind={kind} layer="over" reduce={reduce} />
            <style>{KEYFRAMES}</style>
        </svg>
    );
}

/* ============================================================
 * 景色ごと
 * ============================================================ */

type LayerName = "sky" | "sea" | "over";

function Layer({ kind, layer, reduce }: { kind: SceneKind; layer: LayerName; reduce: boolean }) {
    const f = SCENES[kind];
    return <>{f(layer, reduce)}</>;
}

const SCENES: Record<SceneKind, (layer: LayerName, reduce: boolean) => ReactNode> = {
    /* ---------- 100 夜明けの海 ---------- */
    dawn: (layer, reduce) => {
        if (layer === "sky")
            return (
                <>
                    {/* 消えていく星 */}
                    {STARS.slice(0, 9).map(([x, y, r], i) => (
                        <circle key={i} cx={x} cy={y * 0.8} r={r} fill="#fff" style={reduce ? { opacity: 0.2 } : { opacity: 0.8, animation: `vs-out 1.4s ${ARRIVE}s ease-out forwards` }} />
                    ))}
                    {/* 朝焼けの雲（下が光る） */}
                    <LitCloud x={70} y={70} w={120} light="#ffb49a" dark="#6a5a8c" />
                    <LitCloud x={250} y={50} w={90} light="#ffc2a0" dark="#5d5487" />
                    <LitCloud x={160} y={112} w={70} light="#ffd0a8" dark="#8a6f9a" />
                    {/* 着くと空が明るくなる */}
                    <rect width="440" height="161" fill="url(#vs-dawnwash)" style={lit(reduce, ARRIVE, 1.6)} />
                    <defs>
                        <linearGradient id="vs-dawnwash" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0" stopColor="rgba(255,214,150,.8)" />
                            <stop offset=".7" stopColor="rgba(255,190,170,.2)" />
                            <stop offset="1" stopColor="rgba(255,190,170,0)" />
                        </linearGradient>
                    </defs>
                    {/* 光の筋 */}
                    <g style={lit(reduce, ARRIVE + 0.2, 1.4)}>
                        <g style={loop(reduce, "vs-spin", 60, 0, { transformOrigin: "372px 158px" })}>
                            {[-70, -45, -20, 5, 30, 55, 80].map((a) => (
                                <polygon key={a} points="372,158 366,20 378,20" fill="rgba(255,236,190,.14)" transform={`rotate(${a} 372 158)`} />
                            ))}
                        </g>
                    </g>
                    {/* 朝日（水平線の下からのぼる） */}
                    <g id="ms-lighthouse" style={reduce ? undefined : { transform: "translateY(28px)", animation: `vs-rise 1.8s ${ARRIVE - 0.15}s cubic-bezier(.2,.8,.3,1) forwards` }}>
                        <circle cx="372" cy="152" r="54" fill="url(#vs-sunglow)" />
                        <circle cx="372" cy="152" r="18" fill="url(#vs-sun)" />
                    </g>
                    {/* 遠くの山影 */}
                    <path d="M 0 161 L 0 150 Q 30 138 58 146 Q 84 132 118 144 Q 150 140 170 152 L 176 161 Z" fill="#7c6e9f" opacity=".75" />
                    <path d="M 0 161 L 0 154 Q 40 146 80 153 Q 110 148 140 158 L 140 161 Z" fill="#574e82" />
                    {/* かもめ */}
                    {[[118, 72, 0], [146, 60, 0.5], [96, 88, 1]].map(([x, y, d], i) => (
                        <Gull key={i} x={x} y={y} delay={d} reduce={reduce} color="#43385c" />
                    ))}
                </>
            );
        if (layer === "sea")
            return (
                <g style={lit(reduce, ARRIVE + 0.2, 1.4)}>
                    {/* 朝日の光の道 */}
                    {Array.from({ length: 11 }).map((_, i) => (
                        <rect key={i} x={372 - (8 + i * 4) + ((i * 7) % 5) - 2} y={165 + i * 6.5} width={16 + i * 8} height="1.8" rx=".9" fill="#ffd98f"
                            style={loop(reduce, "vs-shimmer", 1.6 + (i % 3) * 0.4, i * 0.13, { opacity: 0.85 - i * 0.05 })} />
                    ))}
                </g>
            );
        return null;
    },

    /* ---------- 500 夕暮れの港町 ---------- */
    town: (layer, reduce) => {
        if (layer === "sky")
            return (
                <>
                    {/* 一番星 */}
                    <path d="M 300 36 l 1.2 3.6 3.6 1.2 -3.6 1.2 -1.2 3.6 -1.2 -3.6 -3.6 -1.2 3.6 -1.2z" fill="#fff5d6" style={loop(reduce, "vs-tw", 2.4)} />
                    {/* 夕日と雲 */}
                    <circle cx="86" cy="156" r="56" fill="url(#vs-sunglow)" />
                    <circle cx="86" cy="156" r="17" fill="url(#vs-sun)" />
                    <LitCloud x={40} y={100} w={100} light="#ffb07a" dark="#7a4a78" />
                    <LitCloud x={180} y={60} w={130} light="#ff9f86" dark="#5b3c72" />
                    <LitCloud x={300} y={92} w={80} light="#ffb98a" dark="#6f4677" />
                </>
            );
        if (layer === "sea")
            return (
                <>
                    {/* 夕日の映り込み */}
                    {Array.from({ length: 7 }).map((_, i) => (
                        <rect key={i} x={86 - (6 + i * 4)} y={165 + i * 9} width={12 + i * 8} height="1.8" rx=".9" fill="#ffc47c" style={loop(reduce, "vs-shimmer", 1.8 + (i % 3) * 0.3, i * 0.15, { opacity: 0.8 - i * 0.1 })} />
                    ))}
                    {/* 町の灯りの映り込み */}
                    <g style={lit(reduce, ARRIVE + 0.7, 1)}>
                        {[318, 336, 356, 376, 398, 420].map((x, i) => (
                            <rect key={i} x={x} y={176 + (i % 2) * 6} width="2.4" height={16 + (i % 3) * 5} rx="1.2" fill="rgba(255,214,130,.5)" style={loop(reduce, "vs-shimmer", 1.4, i * 0.2)} />
                        ))}
                    </g>
                    {/* 丘と町 */}
                    <path d="M 286 172 Q 330 150 380 146 Q 420 142 440 140 L 440 174 L 286 174 Z" fill="#2c2148" />
                    <g id="ms-lighthouse">
                        {HOUSES.map(([x, y, w, h, roof], i) => (
                            <g key={i}>
                                <rect x={x} y={y} width={w} height={h} fill={i % 2 ? "#3a2b5e" : "#33275a"} />
                                <path d={`M ${x - 1.5} ${y} L ${x + w / 2} ${y - roof} L ${x + w + 1.5} ${y} Z`} fill={i % 3 === 0 ? "#5a3a6e" : "#48325f"} />
                            </g>
                        ))}
                        {/* 教会の塔 */}
                        <rect x="394" y="120" width="10" height="34" fill="#3a2b5e" />
                        <path d="M 392 120 L 399 104 L 406 120 Z" fill="#5a3a6e" />
                        <circle cx="399" cy="128" r="2.2" fill="#ffd98a" style={lit(reduce, ARRIVE + 0.1, 0.4)} />
                        {/* 煙突の煙 */}
                        {[[334, 138], [372, 132]].map(([x, y], i) => (
                            <g key={i}>
                                <rect x={x} y={y} width="3" height="6" fill="#2c2148" />
                                {[0, 1, 2].map((k) => (
                                    <circle key={k} cx={x + 1.5} cy={y - 2} r="2.4" fill="rgba(230,210,230,.35)"
                                        style={reduce ? { opacity: 0 } : { opacity: 0, animation: `vs-smoke 3s ${ARRIVE + k + i * 0.5}s ease-out infinite` }} />
                                ))}
                            </g>
                        ))}
                        {/* 窓 */}
                        {TOWN_WINDOWS.map(([x, y], i) => (
                            <rect key={i} x={x} y={y} width="2.6" height="3.2" rx=".5" fill="#ffd98a"
                                style={reduce ? undefined : { opacity: 0, animation: `vs-in .3s ${ARRIVE + 0.1 + i * 0.06}s ease-out forwards` }} />
                        ))}
                    </g>
                    {/* 桟橋と提灯 */}
                    <path d="M 290 174 L 344 174 L 344 176 L 290 176 Z" fill="#23193c" />
                    {[296, 310, 324, 338].map((x) => <rect key={x} x={x} y="176" width="1.6" height="7" fill="#23193c" />)}
                    <path d="M 292 166 Q 316 172 342 166" fill="none" stroke="rgba(40,30,60,.8)" strokeWidth=".6" />
                    {[298, 310, 322, 334].map((x, i) => (
                        <circle key={x} cx={x} cy={167 + (i === 1 || i === 2 ? 2.4 : 1)} r="1.6" fill="#ffb86b"
                            style={reduce ? undefined : { opacity: 0, animation: `vs-in .3s ${ARRIVE + 0.4 + i * 0.12}s ease-out forwards` }} />
                    ))}
                    {/* 泊まっている小舟 */}
                    <g transform="translate(360 180)">
                        <path d="M -8 0 L 8 0 L 5 3 L -5 3 Z" fill="#2c2148" />
                        <path d="M 0 0 L 0 -13" stroke="#2c2148" strokeWidth=".8" />
                    </g>
                </>
            );
        return null;
    },

    /* ---------- 1,000 月夜の灯台 ---------- */
    lighthouse: (layer, reduce) => {
        if (layer === "sky")
            return (
                <>
                    {STARS.map(([x, y, r, d], i) => (
                        <circle key={i} cx={x} cy={y} r={r} fill="#fff" style={reduce ? { opacity: 0.7 } : { animation: `vs-tw 2.4s ${d}s ease-in-out infinite`, transformOrigin: `${x}px ${y}px` }} />
                    ))}
                    {/* 月（満月に近い。うっすら模様） */}
                    <circle cx="72" cy="46" r="44" fill="url(#vs-moonglow)" />
                    <circle cx="72" cy="46" r="14" fill="#fdf3d8" />
                    <circle cx="67" cy="43" r="3" fill="#ece0bf" opacity=".7" />
                    <circle cx="77" cy="50" r="2.2" fill="#ece0bf" opacity=".6" />
                    <circle cx="74" cy="40" r="1.4" fill="#ece0bf" opacity=".6" />
                    <defs>
                        <radialGradient id="vs-moonglow">
                            <stop offset=".25" stopColor="rgba(253,241,210,.22)" />
                            <stop offset="1" stopColor="rgba(253,241,210,0)" />
                        </radialGradient>
                    </defs>
                    {/* 月にかかる薄い雲 */}
                    <g opacity=".5" style={loop(reduce, "vs-cloudmove", 18)}>
                        <rect x="30" y="54" width="80" height="3" rx="1.5" fill="#8fa6bf" />
                        <rect x="52" y="60" width="50" height="2.4" rx="1.2" fill="#8fa6bf" />
                    </g>
                    {/* 遠くの島 */}
                    <path d="M 0 161 L 0 152 Q 30 146 56 150 Q 90 142 124 154 L 128 161 Z" fill="#163a57" />
                    <path d="M 196 161 Q 222 152 252 158 L 256 161 Z" fill="#163a57" opacity=".8" />
                    {/* 灯台の光 */}
                    <g style={lit(reduce)}>
                        <g style={loop(reduce, "vs-beam", 6, 2, { transformOrigin: "374px 110px" })}>
                            <polygon points="374,104 130,70 130,150 374,116" fill="url(#vs-beam)" />
                        </g>
                    </g>
                    <circle cx="374" cy="110" r="30" fill="url(#vs-glow)" style={lit(reduce, ARRIVE, 0.6)} />
                </>
            );
        if (layer === "sea")
            return (
                <>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <rect key={i} x={64 - i * 3} y={168 + i * 9} width={16 + i * 6} height="1.6" rx=".8" fill="#fdf1d2" style={loop(reduce, "vs-shimmer", 1.8, i * 0.2, { opacity: 0.45 - i * 0.07 })} />
                    ))}
                    <rect x="366" y="172" width="16" height="62" fill="url(#vs-reflect)" style={lit(reduce, 2, 1)} />
                    {/* 岬（草と岩） */}
                    <path d="M 326 176 Q 340 150 364 146 Q 396 140 424 150 Q 436 156 440 164 L 440 178 L 326 178 Z" fill="#0b2236" />
                    <path d="M 346 154 Q 366 144 392 144 Q 412 144 428 152 Q 404 148 380 150 Q 360 150 346 154 Z" fill="#1d4a4a" opacity=".8" />
                    {/* 岩に当たる白波 */}
                    {[[330, 176, 0], [350, 178, 0.6], [424, 176, 1.1]].map(([x, y, d], i) => (
                        <path key={i} d={`M ${x - 6} ${y} q 6 -6 12 0`} fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" strokeLinecap="round"
                            style={loop(reduce, "vs-foam", 2.2, d, { transformBox: "fill-box", transformOrigin: "bottom" })} />
                    ))}
                    {/* 灯台 */}
                    <g id="ms-lighthouse">
                        <polygon points="366,146 382,146 379,114 369,114" fill="#f3ead6" />
                        <polygon points="374,146 382,146 379,114 374,114" fill="rgba(0,0,0,.12)" />
                        <rect x="368" y="124" width="12" height="5" fill="#b8322a" />
                        <rect x="367" y="136" width="14" height="5" fill="#b8322a" />
                        <rect x="365" y="112" width="18" height="2" fill="#1b2f40" />
                        <rect x="367" y="102" width="14" height="10" rx="1.5" fill="#1b2f40" />
                        <rect x="369" y="104" width="10" height="7" rx="1" fill="#ffe7a6" style={reduce ? undefined : { opacity: 0.25, animation: `vs-in .4s ${ARRIVE}s ease-out forwards` }} />
                        <path d="M 365 102 L 374 94 L 383 102 Z" fill="#1b2f40" />
                        <rect x="373" y="91" width="2" height="3" fill="#1b2f40" />
                        {/* 小屋 */}
                        <rect x="386" y="138" width="14" height="9" fill="#e8dcc4" />
                        <path d="M 384.5 138 L 393 131 L 401.5 138 Z" fill="#8a3a30" />
                        <rect x="391" y="141" width="3" height="3" fill="#ffd98a" style={lit(reduce, ARRIVE + 0.2, 0.4)} />
                    </g>
                </>
            );
        return null;
    },

    /* ---------- 3,000 昼の大海原 ---------- */
    ocean: (layer, reduce) => {
        if (layer === "sky")
            return (
                <>
                    <circle cx="380" cy="34" r="46" fill="url(#vs-sunglow)" opacity=".8" />
                    <circle cx="380" cy="34" r="13" fill="#fffbe8" />
                    <BigCloud x={80} y={76} s={1.1} reduce={reduce} />
                    <BigCloud x={250} y={58} s={0.8} reduce={reduce} delay={1} />
                    <BigCloud x={176} y={120} s={0.6} reduce={reduce} delay={2} />
                    {/* 水平線の遠い船 */}
                    <g transform="translate(120 158)" opacity=".55">
                        <path d="M -6 0 L 6 0 L 4 2 L -4 2 Z" fill="#35607e" />
                        <path d="M 0 0 L 0 -9 L 5 -1 Z" fill="#35607e" />
                    </g>
                </>
            );
        if (layer === "sea")
            return (
                <>
                    {/* 白波 */}
                    {[[60, 186], [140, 204], [228, 196], [96, 226], [300, 222], [206, 232]].map(([x, y], i) => (
                        <path key={i} d={`M ${x - 7} ${y} q 7 -5 14 0`} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="1.2" strokeLinecap="round"
                            style={loop(reduce, "vs-foam", 2.6, i * 0.4, { transformBox: "fill-box", transformOrigin: "bottom" })} />
                    ))}
                </>
            );
        /* over：くじら（船より手前に） */
        return (
            <g id="ms-lighthouse">
                {/* 潮吹き */}
                <g style={reduce ? undefined : { opacity: 0, transformBox: "fill-box", transformOrigin: "bottom", animation: `vs-spout 1.6s ${ARRIVE + 0.3}s ease-out forwards` }}>
                    <path d="M 386 168 Q 380 140 368 128 M 386 168 Q 386 136 386 120 M 386 168 Q 392 140 404 128" fill="none" stroke="rgba(235,248,255,.95)" strokeWidth="3" strokeLinecap="round" />
                    {[[368, 126], [386, 118], [404, 126], [376, 122], [396, 122]].map(([x, y], i) => (
                        <circle key={i} cx={x} cy={y} r="2.6" fill="rgba(235,248,255,.9)" />
                    ))}
                </g>
                {/* しぶきにかかる虹 */}
                <g style={lit(reduce, ARRIVE + 0.9, 1)}>
                    {["#ff8a80", "#ffd180", "#fff59d", "#a5d6a7", "#90caf9", "#b39ddb"].map((c, i) => (
                        <path key={c} d={`M ${350 + i * 2.2} 150 A ${36 - i * 2.2} ${30 - i * 2} 0 0 1 ${422 - i * 2.2} 150`} fill="none" stroke={c} strokeWidth="2" opacity=".45" />
                    ))}
                </g>
                {/* くじらの背（浮かんでくる） */}
                <g style={reduce ? undefined : { transform: "translateY(12px)", animation: `vs-surface 1s ${ARRIVE - 0.1}s cubic-bezier(.2,.8,.3,1) forwards` }}>
                    <path d="M 356 174 Q 372 156 394 160 Q 410 162 416 172 Z" fill="#23506d" />
                    <path d="M 364 168 Q 380 160 396 163" fill="none" stroke="#3a7195" strokeWidth="1.2" />
                    <circle cx="364" cy="170" r="1.2" fill="#0d2a3c" />
                    {/* 尾 */}
                    <path d="M 414 172 Q 424 160 432 156 Q 428 166 422 170 Q 432 170 438 164 Q 434 174 420 176 Z" fill="#1d465f" />
                </g>
                {/* 水しぶき */}
                {!reduce &&
                    [[-10, -14], [-4, -20], [4, -18], [12, -12], [0, -24]].map(([dx, dy], i) => (
                        <circle key={i} cx="386" cy="170" r="1.6" fill="#eaf6ff" style={{ opacity: 0, ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`, animation: `vs-splash .9s ${ARRIVE + 0.1 + i * 0.03}s ease-out forwards` } as CSSProperties} />
                    ))}
            </g>
        );
    },

    /* ---------- 5,000 星の海 ---------- */
    stars: (layer, reduce) => {
        if (layer === "sky")
            return (
                <>
                    {/* 天の川（光の帯と、細かい星） */}
                    <g transform="rotate(-16 220 70)">
                        <ellipse cx="220" cy="70" rx="280" ry="30" fill="url(#vs-milky)" />
                        {MILKY.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#dfe8ff" opacity=".6" />)}
                    </g>
                    <defs>
                        <radialGradient id="vs-milky" cx=".5" cy=".5" r=".5">
                            <stop offset="0" stopColor="rgba(200,215,255,.22)" />
                            <stop offset=".6" stopColor="rgba(170,190,255,.08)" />
                            <stop offset="1" stopColor="rgba(160,190,255,0)" />
                        </radialGradient>
                        <linearGradient id="vs-shoot" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0" stopColor="rgba(255,255,255,0)" />
                            <stop offset="1" stopColor="rgba(255,255,255,.95)" />
                        </linearGradient>
                    </defs>
                    {[...STARS, ...MORE_STARS].map(([x, y, r, d], i) => (
                        <circle key={i} cx={x} cy={y} r={r} fill="#fff" style={reduce ? { opacity: 0.75 } : { animation: `vs-tw 2.4s ${d}s ease-in-out infinite`, transformOrigin: `${x}px ${y}px` }} />
                    ))}
                    {/* 星座（着くとつながる）：船の形 */}
                    <g fill="none" stroke="rgba(255,236,180,.6)" strokeWidth=".9" strokeDasharray="260" strokeDashoffset={reduce ? 0 : 260}
                        style={reduce ? undefined : { animation: `vs-draw 1.6s ${ARRIVE + 0.2}s ease-out forwards` }}>
                        <path d="M 140 70 L 170 84 L 230 84 L 256 70" />
                        <path d="M 196 84 L 196 30 L 234 70" />
                        <path d="M 196 40 L 166 70" />
                    </g>
                    {[[140, 70], [170, 84], [230, 84], [256, 70], [196, 30], [234, 70], [166, 70], [196, 84]].map(([x, y], i) => (
                        <circle key={i} cx={x} cy={y} r="1.9" fill="#fff4d0" style={lit(reduce, ARRIVE + 0.2 + i * 0.08, 0.4)} />
                    ))}
                    {/* 導きの星 */}
                    <g id="ms-lighthouse">
                        <circle cx="374" cy="104" r="36" fill="url(#vs-glow)" style={lit(reduce, ARRIVE, 0.6)} />
                        <g style={reduce ? undefined : { ...box, transform: "scale(.4)", animation: `vs-bloom .9s ${ARRIVE}s cubic-bezier(.2,1.6,.4,1) forwards` }}>
                            <path d="M 374 80 L 377.5 100.5 L 398 104 L 377.5 107.5 L 374 128 L 370.5 107.5 L 350 104 L 370.5 100.5 Z" fill="#fff6d8" />
                            <path d="M 374 92 L 376 102 L 386 104 L 376 106 L 374 116 L 372 106 L 362 104 L 372 102 Z" fill="#fff" />
                        </g>
                    </g>
                    {/* 流れ星 */}
                    {!reduce &&
                        [[40, 24, 150, 58, 0.5], [230, 16, 320, 44, 1.6]].map(([x1, y1, x2, y2, d], i) => (
                            <path key={i} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="url(#vs-shoot)" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="130" strokeDashoffset="130"
                                style={{ animation: `vs-shootstar 1.1s ${ARRIVE + d}s ease-out forwards` }} />
                        ))}
                    <path d="M 0 161 L 0 153 Q 30 146 58 150 Q 92 143 126 155 L 130 161 Z" fill="#0b2138" />
                </>
            );
        if (layer === "sea")
            return (
                <>
                    {[[60, 190], [130, 206], [200, 184], [250, 222], [300, 196], [90, 228], [180, 232], [40, 176], [230, 178]].map(([x, y], i) => (
                        <circle key={i} cx={x} cy={y} r=".9" fill="#fff" style={loop(reduce, "vs-tw", 2.6, i * 0.3, { opacity: 0.5 })} />
                    ))}
                    <rect x="368" y="164" width="12" height="64" fill="url(#vs-reflect)" style={lit(reduce, ARRIVE, 1)} />
                    {/* 夜光虫（船のまわりの青い光） */}
                    {!reduce &&
                        BIOLUM.map(([x, y, d], i) => (
                            <circle key={i} cx={x} cy={y} r="1.3" fill="#7fe6ff" style={{ opacity: 0, filter: "drop-shadow(0 0 2px #7fe6ff)", animation: `vs-biolum 2.6s ${ARRIVE + d}s ease-in-out infinite` }} />
                        ))}
                </>
            );
        return null;
    },

    /* ---------- 1万 新しい大陸 ---------- */
    land: (layer, reduce) => {
        if (layer === "sky")
            return (
                <>
                    <circle cx="70" cy="42" r="48" fill="url(#vs-sunglow)" />
                    <circle cx="70" cy="42" r="14" fill="#fffbe8" />
                    <BigCloud x={170} y={50} s={0.8} reduce={reduce} />
                    <BigCloud x={290} y={34} s={0.6} reduce={reduce} delay={1.5} />
                    <BigCloud x={40} y={110} s={0.5} reduce={reduce} delay={0.8} />
                    {/* 遠い山並み */}
                    <path d="M 240 161 L 268 138 L 286 150 L 312 120 L 340 146 L 350 161 Z" fill="#9cc4cf" opacity=".8" />
                    {/* 鳥（着くと飛び立つ） */}
                    {[[352, 128, 0], [364, 118, 0.15], [342, 112, 0.3], [372, 132, 0.45]].map(([x, y, d], i) => (
                        <path key={i} d={`M ${x - 5} ${y} q 2.5 -3.5 5 0 q 2.5 -3.5 5 0`} fill="none" stroke="#2c4a5e" strokeWidth="1.3" strokeLinecap="round"
                            style={reduce ? undefined : { animation: `vs-fly 2.6s ${ARRIVE + d}s ease-in forwards` }} />
                    ))}
                </>
            );
        if (layer === "sea")
            return (
                <>
                    {/* 山（陰と日なた、雪） */}
                    <path d="M 296 170 L 346 112 L 360 124 L 392 88 L 440 138 L 440 170 Z" fill="#4a8c73" />
                    <path d="M 392 88 L 440 138 L 440 170 L 404 170 Z" fill="#3a735e" />
                    <path d="M 346 112 L 360 124 L 352 170 L 330 170 Z" fill="#3f7e67" />
                    <path d="M 392 88 L 402 99 L 396 97 L 390 104 L 384 97 Z" fill="#f1f7f8" />
                    <path d="M 346 112 L 351 118 L 346 117 L 342 120 Z" fill="#f1f7f8" />
                    {/* 滝 */}
                    <rect x="410" y="118" width="3" height="40" fill="#dff4fb" style={loop(reduce, "vs-shimmer", 1, 0, { opacity: 0.9 })} />
                    <ellipse cx="411.5" cy="160" rx="6" ry="2" fill="rgba(255,255,255,.7)" />
                    {/* 森 */}
                    <path d="M 284 170 Q 320 150 360 156 Q 400 146 440 158 L 440 176 L 284 176 Z" fill="#5aa77a" />
                    {TREES.map(([x, y, s], i) => (
                        <path key={i} d={`M ${x} ${y} l ${4 * s} ${-10 * s} l ${4 * s} ${10 * s} Z`} fill={i % 2 ? "#2f6a4f" : "#3a7d5a"} />
                    ))}
                    {/* ヤシ */}
                    <g transform="translate(300 172)">
                        <path d="M 0 0 Q 2 -10 -1 -18" fill="none" stroke="#7a5a3a" strokeWidth="1.6" />
                        <path d="M -1 -18 q -8 -2 -12 4 M -1 -18 q 8 -3 12 3 M -1 -18 q -4 -6 -10 -6 M -1 -18 q 5 -6 10 -5" fill="none" stroke="#3a8a5a" strokeWidth="2" strokeLinecap="round"
                            style={loop(reduce, "vs-sway", 3, 0, { transformBox: "fill-box", transformOrigin: "bottom" })} />
                    </g>
                    {/* 浜と波打ち際 */}
                    <path d="M 272 176 Q 330 168 440 174 L 440 181 L 272 181 Z" fill="#efdfb2" />
                    <path d="M 272 181 Q 330 176 440 180" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.2" style={loop(reduce, "vs-shore", 2.4)} />
                    {/* 旗（着くと立つ） */}
                    <g id="ms-lighthouse" style={reduce ? undefined : { transformBox: "fill-box", transformOrigin: "bottom", transform: "scaleY(0)", animation: `vs-flag .6s ${ARRIVE}s cubic-bezier(.2,1.6,.4,1) forwards` }}>
                        <rect x="344" y="146" width="1.8" height="28" fill="#f3ead6" />
                        <path d="M 345.8 147 L 362 151.5 L 345.8 156 Z" fill="#f0cf86" style={loop(reduce, "vs-flagwave", 1.6, ARRIVE + 0.6, { transformBox: "fill-box", transformOrigin: "left" })} />
                    </g>
                </>
            );
        return null;
    },

    /* ---------- 3万 風の群島 ---------- */
    isles: (layer, reduce) => {
        if (layer === "sky")
            return (
                <>
                    <circle cx="96" cy="60" r="44" fill="url(#vs-sunglow)" opacity=".8" />
                    <circle cx="96" cy="60" r="12" fill="#fffbe8" />
                    <BigCloud x={210} y={46} s={0.7} reduce={reduce} delay={0.4} />
                    <BigCloud x={340} y={70} s={0.55} reduce={reduce} delay={1.2} />
                    {/* 風の筋（着くと吹き抜ける） */}
                    {!reduce &&
                        [[40, 90, 0], [120, 118, 0.3], [200, 76, 0.6], [80, 134, 0.9], [260, 104, 1.2]].map(([x, y, d], i) => (
                            <path key={i} d={`M ${x} ${y} q 30 -8 60 0 t 60 0`} fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="130" strokeDashoffset="130"
                                style={{ animation: `vs-wind 2.2s ${ARRIVE + d}s ease-out infinite` }} />
                        ))}
                    {/* 遠い島々 */}
                    {[[30, 50, "#7fb0bf"], [140, 36, "#8fbccb"], [220, 30, "#94c0cd"]].map(([x, w, c], i) => (
                        <path key={i} d={`M ${x} 161 Q ${(x as number) + (w as number) / 2} ${150 - i * 2} ${(x as number) + (w as number)} 161 Z`} fill={c as string} />
                    ))}
                    {/* 遠くの帆船 */}
                    {[[64, 156], [190, 157]].map(([x, y], i) => (
                        <g key={i} transform={`translate(${x} ${y})`} opacity=".7" style={loop(reduce, "vs-bob", 3, i)}>
                            <path d="M -5 0 L 5 0 L 3 2 L -3 2 Z" fill="#fff" />
                            <path d="M 0 0 L 0 -9 L 5 -1 Z" fill="#fff" />
                        </g>
                    ))}
                </>
            );
        if (layer === "sea")
            return (
                <>
                    {/* 小島（手前） */}
                    <path d="M 240 168 Q 262 150 288 166 Z" fill="#5da47d" />
                    {/* 大きい島と風車 */}
                    <path d="M 300 172 Q 330 138 372 140 Q 414 136 440 150 L 440 176 L 300 176 Z" fill="#6cb58a" />
                    <path d="M 300 172 Q 330 150 372 152 Q 414 150 440 160 L 440 176 L 300 176 Z" fill="#58a07a" />
                    <path d="M 296 176 Q 360 168 440 174 L 440 180 L 296 180 Z" fill="#f1e2b6" />
                    {/* 花（着くと咲く） */}
                    {FLOWERS.map(([x, y, c], i) => (
                        <circle key={i} cx={x} cy={y} r="1.5" fill={c as string} style={lit(reduce, ARRIVE + 0.2 + i * 0.04, 0.3)} />
                    ))}
                    <g id="ms-lighthouse">
                        {[[352, 140, 1], [404, 136, 0.8], [262, 158, 0.55]].map(([x, y, s], i) => (
                            <Windmill key={i} x={x} y={y} s={s} reduce={reduce} delay={ARRIVE + i * 0.2} />
                        ))}
                    </g>
                </>
            );
        return null;
    },

    /* ---------- 5万 黄金の夕凪 ---------- */
    golden: (layer, reduce) => {
        if (layer === "sky")
            return (
                <>
                    {/* 大きな夕日 */}
                    <g id="ms-lighthouse">
                        <circle cx="300" cy="148" r="90" fill="url(#vs-sunglow)" />
                        <circle cx="300" cy="148" r="26" fill="url(#vs-sun)" />
                    </g>
                    {/* 金色に縁どられた雲 */}
                    <LitCloud x={40} y={70} w={130} light="#ffd07a" dark="#8a3f5c" />
                    <LitCloud x={220} y={48} w={140} light="#ffc46e" dark="#7a3654" />
                    <LitCloud x={330} y={100} w={90} light="#ffdc8a" dark="#9a4a5a" />
                    {/* 光の柱（着くと立つ） */}
                    <g style={lit(reduce, ARRIVE, 1.2)}>
                        <rect x="294" y="0" width="12" height="160" fill="url(#vs-pillar)" />
                        <defs>
                            <linearGradient id="vs-pillar" x1="0" y1="1" x2="0" y2="0">
                                <stop offset="0" stopColor="rgba(255,230,160,.7)" />
                                <stop offset="1" stopColor="rgba(255,230,160,0)" />
                            </linearGradient>
                        </defs>
                    </g>
                    {/* かもめ */}
                    {[[120, 96, 0], [150, 84, 0.4], [180, 100, 0.8]].map(([x, y, d], i) => (
                        <Gull key={i} x={x} y={y} delay={d} reduce={reduce} color="#5a2c3e" />
                    ))}
                    <path d="M 0 161 L 0 152 Q 40 144 80 150 Q 120 142 160 156 L 164 161 Z" fill="#6a3450" opacity=".85" />
                </>
            );
        if (layer === "sea")
            return (
                <>
                    {/* 金の光の道（広く） */}
                    {Array.from({ length: 12 }).map((_, i) => (
                        <rect key={i} x={300 - (10 + i * 6)} y={165 + i * 6} width={20 + i * 12} height="2" rx="1" fill="#ffd98f" style={loop(reduce, "vs-shimmer", 1.4 + (i % 3) * 0.4, i * 0.1, { opacity: 0.85 - i * 0.05 })} />
                    ))}
                    {/* 海一面のきらめき（着くと広がる） */}
                    {!reduce &&
                        GOLD_SPARKS.map(([x, y, d], i) => (
                            <path key={i} d={`M ${x} ${y - 3} L ${x + 0.8} ${y} L ${x} ${y + 3} L ${x - 0.8} ${y} Z M ${x - 3} ${y} L ${x} ${y - 0.8} L ${x + 3} ${y} L ${x} ${y + 0.8} Z`} fill="#fff1c4"
                                style={{ opacity: 0, animation: `vs-sparkle 1.8s ${ARRIVE + d}s ease-in-out infinite` }} />
                        ))}
                </>
            );
        return null;
    },

    /* ---------- 10万 オーロラの果て ---------- */
    aurora: (layer, reduce) => {
        if (layer === "sky")
            return (
                <>
                    {[...STARS, ...MORE_STARS].map(([x, y, r, d], i) => (
                        <circle key={i} cx={x} cy={y} r={r} fill="#fff" style={reduce ? { opacity: 0.7 } : { animation: `vs-tw 2.6s ${d}s ease-in-out infinite`, transformOrigin: `${x}px ${y}px` }} />
                    ))}
                    <defs>
                        <linearGradient id="vs-au1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="rgba(120,255,200,0)" />
                            <stop offset=".6" stopColor="rgba(120,255,200,.55)" />
                            <stop offset="1" stopColor="rgba(120,255,200,0)" />
                        </linearGradient>
                        <linearGradient id="vs-au2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="rgba(180,140,255,0)" />
                            <stop offset=".55" stopColor="rgba(180,140,255,.45)" />
                            <stop offset="1" stopColor="rgba(120,220,255,0)" />
                        </linearGradient>
                    </defs>
                    {/* オーロラ（うっすら → 着くと強く、揺れる） */}
                    <g style={reduce ? { opacity: 0.9 } : { opacity: 0.25, animation: `vs-auroraup 1.6s ${ARRIVE}s ease-out forwards` }}>
                        <g style={loop(reduce, "vs-aurora", 6)}>
                            <path d="M -20 90 C 60 40, 120 110, 200 60 S 340 80, 460 40 L 460 110 C 340 140, 260 110, 200 130 S 60 110, -20 150 Z" fill="url(#vs-au1)" />
                        </g>
                        <g style={loop(reduce, "vs-aurora", 8, 1)}>
                            <path d="M -20 60 C 80 20, 150 80, 230 40 S 360 50, 460 20 L 460 70 C 360 100, 280 70, 220 90 S 80 80, -20 110 Z" fill="url(#vs-au2)" />
                        </g>
                    </g>
                    {/* 氷山 */}
                    <path d="M 20 161 L 44 132 L 58 140 L 74 124 L 96 161 Z" fill="#dff1f7" />
                    <path d="M 58 140 L 74 124 L 96 161 L 70 161 Z" fill="#a9cfdd" />
                    <path d="M 170 161 L 184 148 L 196 154 L 206 161 Z" fill="#cfe7ef" />
                    {/* 大灯台の光（二筋） */}
                    <g style={lit(reduce)}>
                        <g style={loop(reduce, "vs-beam", 7, 2, { transformOrigin: "386px 92px" })}>
                            <polygon points="386,86 110,40 110,140 386,98" fill="url(#vs-beam)" />
                        </g>
                    </g>
                    <circle cx="386" cy="92" r="36" fill="url(#vs-glow)" style={lit(reduce, ARRIVE, 0.6)} />
                </>
            );
        if (layer === "sea")
            return (
                <>
                    {/* オーロラの映り込み */}
                    <rect x="0" y="164" width="440" height="30" fill="url(#vs-au1)" opacity=".25" style={lit(reduce, ARRIVE + 0.4, 1.4)} />
                    <rect x="378" y="164" width="16" height="66" fill="url(#vs-reflect)" style={lit(reduce, 2, 1)} />
                    {/* 流氷 */}
                    {[[120, 200, 16], [220, 222, 12], [60, 226, 10]].map(([x, y, w], i) => (
                        <path key={i} d={`M ${x} ${y} l ${w} 0 l -3 3 l ${-w + 6} 0 Z`} fill="#dff1f7" opacity=".9" style={loop(reduce, "vs-bob", 3, i * 0.6)} />
                    ))}
                    {/* 断崖と大灯台 */}
                    <path d="M 340 176 L 350 128 L 372 118 L 404 116 L 424 124 L 440 118 L 440 178 Z" fill="#0a1d28" />
                    <path d="M 350 128 L 372 118 L 404 116 L 424 124 L 440 118 L 440 124 L 420 130 L 400 122 L 372 124 Z" fill="#e9f4f8" />
                    <g id="ms-lighthouse">
                        <polygon points="376,120 396,120 393,80 379,80" fill="#f3ead6" />
                        <polygon points="386,120 396,120 393,80 386,80" fill="rgba(0,0,0,.12)" />
                        {[88, 100, 112].map((y) => <rect key={y} x="378" y={y} width="16" height="4" fill="#b8322a" />)}
                        <rect x="375" y="78" width="22" height="2" fill="#1b2f40" />
                        <rect x="378" y="66" width="16" height="12" rx="1.5" fill="#1b2f40" />
                        <rect x="380" y="68" width="12" height="9" rx="1" fill="#ffe7a6" style={reduce ? undefined : { opacity: 0.25, animation: `vs-in .4s ${ARRIVE}s ease-out forwards` }} />
                        <path d="M 376 66 L 386 56 L 396 66 Z" fill="#1b2f40" />
                    </g>
                </>
            );
        /* over：花火 */
        if (reduce) return null;
        return (
            <>
                {[[140, 50, "#ffd98a", 0.4], [230, 34, "#9ff5d0", 0.9], [80, 30, "#ffb3c8", 1.4], [300, 44, "#b8c8ff", 1.9]].map(([x, y, c, d], i) => (
                    <g key={i} transform={`translate(${x} ${y})`}>
                        {/* 花火。中心から広がって、消える（くり返す） */}
                        <g opacity="0">
                            <animateTransform attributeName="transform" type="scale" values="0.1;1;1.12" keyTimes="0;0.55;1" dur="2.2s" begin={`${ARRIVE + (d as number)}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0;1;0.9;0" keyTimes="0;0.08;0.6;1" dur="2.2s" begin={`${ARRIVE + (d as number)}s`} repeatCount="indefinite" />
                            {Array.from({ length: 14 }).map((_, k) => (
                                <g key={k} transform={`rotate(${(k * 360) / 14})`}>
                                    <line x1="0" y1="-6" x2="0" y2="-18" stroke={c as string} strokeWidth="1.5" strokeLinecap="round" />
                                    <circle cx="0" cy="-20" r="1.1" fill={c as string} />
                                </g>
                            ))}
                            <circle r="2" fill="#fff" />
                        </g>
                    </g>
                ))}
            </>
        );
    },
};

/* ============================================================
 * 部品
 * ============================================================ */

/** 下が光に照らされた雲 */
function LitCloud({ x, y, w, light, dark }: { x: number; y: number; w: number; light: string; dark: string }) {
    const h = w * 0.16;
    return (
        <g opacity=".85">
            <path d={`M ${x} ${y} q ${w * 0.15} ${-h} ${w * 0.35} ${-h * 0.6} q ${w * 0.2} ${-h * 0.9} ${w * 0.4} ${-h * 0.2} q ${w * 0.15} ${h * 0.1} ${w * 0.25} ${h * 0.8} Z`} fill={dark} />
            <path d={`M ${x + w * 0.04} ${y} L ${x + w * 0.98} ${y} q ${-w * 0.2} ${h * 0.35} ${-w * 0.47} ${h * 0.3} q ${-w * 0.3} ${h * 0.05} ${-w * 0.47} ${-h * 0.3} Z`} fill={light} />
        </g>
    );
}

/** ふっくらした雲（ゆっくり流れる） */
function BigCloud({ x, y, s, reduce, delay = 0 }: { x: number; y: number; s: number; reduce: boolean; delay?: number }) {
    return (
        <g style={loop(reduce, "vs-cloudmove", 16, delay)}>
            <g transform={`translate(${x} ${y}) scale(${s})`}>
                <ellipse cx="0" cy="4" rx="36" ry="9" fill="#dde9f2" />
                <circle cx="-16" cy="-2" r="12" fill="#fff" />
                <circle cx="2" cy="-9" r="16" fill="#fff" />
                <circle cx="20" cy="-1" r="11" fill="#fff" />
                <ellipse cx="0" cy="3" rx="34" ry="7" fill="#fff" />
                <ellipse cx="0" cy="8" rx="30" ry="3" fill="#cddfeb" opacity=".8" />
            </g>
        </g>
    );
}

/** はばたくかもめ */
function Gull({ x, y, delay, reduce, color }: { x: number; y: number; delay: number; reduce: boolean; color: string }) {
    return (
        <g style={loop(reduce, "vs-glide", 5, delay)}>
            <path d={`M ${x - 7} ${y} q 3.5 -4 7 0 q 3.5 -4 7 0`} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"
                style={loop(reduce, "vs-flap", 0.9, delay, { transformBox: "fill-box", transformOrigin: "center" })} />
        </g>
    );
}

/** 風車（着くと回りだす） */
function Windmill({ x, y, s, reduce, delay }: { x: number; y: number; s: number; reduce: boolean; delay: number }) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
            <path d="M -4 22 L 4 22 L 2.4 0 L -2.4 0 Z" fill="#f3ead6" />
            <path d="M -4.5 0 L 0 -4 L 4.5 0 Z" fill="#b8322a" />
            {/* 羽根。羽根の中心（0, -1）を軸に回す */}
            <g transform="translate(0 -1)">
                <g>
                    {!reduce && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />}
                    {[0, 90, 180, 270].map((a) => (
                        <path key={a} d="M 0 0 L -1.6 -20 L 3 -20 L 1.2 0 Z" fill="#fff" stroke="rgba(0,0,0,.1)" strokeWidth=".4" transform={`rotate(${a + 20})`} />
                    ))}
                </g>
                <circle r="1.6" fill="#8a6a4a" />
            </g>
        </g>
    );
}

/** 航路（M と C・S の 2 区間）の上の点。t は 0〜1 */
function pointOn(d: string, t: number): { x: number; y: number } {
    const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    /* M x0 y0 C c1x c1y c2x c2y x1 y1 S c3x c3y x2 y2 */
    const [x0, y0, c1x, c1y, c2x, c2y, x1, y1, c3x, c3y, x2, y2] = n;
    const r1x = 2 * x1 - c2x;
    const r1y = 2 * y1 - c2y;
    const bez = (a: number, b: number, c: number, e: number, u: number) =>
        (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * e;
    if (t < 0.5) {
        const u = t * 2;
        return { x: bez(x0, c1x, c2x, x1, u), y: bez(y0, c1y, c2y, y1, u) };
    }
    const u = (t - 0.5) * 2;
    return { x: bez(x1, r1x, c3x, x2, u), y: bez(y1, r1y, c3y, y2, u) };
}

/** 横に長い波線 */
function wave(y: number, amp: number, len: number): string {
    let d = `M -60 ${y}`;
    for (let x = -60; x < 520; x += len) d += ` q ${len / 4} ${-amp / 3} ${len / 2} 0 t ${len / 2} 0`;
    return d;
}

/* ============================================================
 * 数（位置など）
 * ============================================================ */

/* 星。x, y, 大きさ, またたきの遅れ */
const STARS: [number, number, number, number][] = [
    [30, 22, 1, 0], [110, 18, 1.2, 0.6], [160, 40, 0.8, 1.2], [205, 14, 1.1, 0.3], [250, 34, 0.9, 1.6],
    [298, 20, 1.3, 0.9], [340, 48, 0.8, 0.2], [400, 16, 1, 1.4], [424, 60, 0.8, 0.7], [128, 70, 0.7, 1.9],
    [225, 68, 0.8, 1.1], [18, 84, 0.7, 0.5], [312, 84, 0.7, 1.7], [186, 96, 0.6, 0.4],
];
const MORE_STARS: [number, number, number, number][] = [
    [60, 30, 0.8, 0.9], [84, 60, 1, 0.2], [140, 100, 0.7, 1.3], [260, 100, 0.9, 0.5], [290, 120, 0.7, 1.8],
    [330, 26, 1.1, 1.1], [360, 64, 0.8, 0.6], [410, 90, 0.9, 1.5], [20, 130, 0.7, 2.2], [214, 130, 0.8, 0.8],
    [100, 124, 0.6, 1.6], [176, 16, 0.9, 0.1],
];
/* 天の川の細かい星 */
const MILKY: [number, number, number][] = Array.from({ length: 70 }, (_, i) => {
    const x = -40 + ((i * 97) % 520);
    const y = 70 + Math.sin(i * 1.7) * 18 + ((i * 13) % 9) - 4;
    return [x, y, 0.35 + ((i * 7) % 5) * 0.12];
});
/* 水面のきらめき。x, y, 遅れ */
const GLINTS: [number, number, number][] = [
    [110, 184, 0.3], [150, 214, 1.2], [230, 196, 0.7], [290, 226, 1.9], [40, 214, 2.4], [200, 230, 1.5], [320, 196, 1],
];
/* 夜光虫。x, y, 遅れ */
const BIOLUM: [number, number, number][] = [
    [296, 178, 0], [306, 184, 0.3], [284, 182, 0.6], [330, 180, 0.9], [270, 176, 1.2], [318, 188, 0.4], [258, 184, 1.5], [290, 190, 0.8],
];
/* 金のきらめき。x, y, 遅れ */
const GOLD_SPARKS: [number, number, number][] = [
    [60, 180, 0.1], [110, 200, 0.5], [160, 186, 0.9], [210, 214, 0.3], [250, 178, 1.2], [340, 196, 0.7], [390, 184, 0.2], [420, 214, 1], [80, 226, 1.4], [180, 232, 0.6], [360, 228, 1.1],
];
/* 町の家。x, y, 幅, 高さ, 屋根の高さ */
const HOUSES: [number, number, number, number, number][] = [
    [300, 158, 14, 14, 6], [316, 152, 12, 20, 6], [330, 144, 16, 28, 7], [348, 148, 12, 24, 6], [362, 138, 14, 34, 7],
    [378, 146, 14, 26, 6], [406, 142, 14, 30, 7], [422, 146, 18, 26, 6],
];
/* 町の窓。x, y */
const TOWN_WINDOWS: [number, number][] = [
    [304, 162], [309, 166], [319, 157], [319, 164], [334, 149], [340, 149], [334, 158], [340, 164],
    [351, 153], [351, 162], [366, 143], [372, 143], [366, 152], [372, 160], [381, 151], [387, 158],
    [409, 147], [415, 155], [426, 151], [432, 151], [426, 160],
];
/* 木。x, y, 大きさ */
const TREES: [number, number, number][] = [
    [312, 160, 1], [320, 158, 1.2], [330, 157, 0.9], [372, 152, 1.1], [382, 150, 1], [420, 154, 1.2], [430, 156, 0.9], [396, 150, 0.8],
];
/* 花。x, y, 色 */
const FLOWERS: [number, number, string][] = [
    [314, 162, "#ffd1dc"], [322, 158, "#fff4b0"], [334, 154, "#ffd1dc"], [366, 150, "#ffffff"], [382, 152, "#fff4b0"], [396, 150, "#ffd1dc"], [418, 154, "#ffffff"], [428, 158, "#fff4b0"], [344, 156, "#ffffff"],
];

const KEYFRAMES = `
@keyframes vs-in { to { opacity: 1 } }
@keyframes vs-out { to { opacity: 0 } }
@keyframes vs-tw { 0%, 100% { opacity: .25; transform: scale(.7) } 50% { opacity: 1; transform: scale(1) } }
@keyframes vs-draw { to { stroke-dashoffset: 0 } }
@keyframes vs-drift { 0%, 100% { transform: translateX(0) } 50% { transform: translateX(-14px) } }
@keyframes vs-glint { 0%, 100% { opacity: 0 } 50% { opacity: .8 } }
@keyframes vs-shimmer { 0%, 100% { transform: translateX(0) scaleX(1) } 50% { transform: translateX(2px) scaleX(.85) } }
@keyframes vs-buoy { 0% { opacity: 0 } 40% { opacity: 1; transform: scale(1.5) } 100% { opacity: .7; transform: scale(1) } }
@keyframes vs-bob { 0%, 100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(1.6px) rotate(2deg) } }
@keyframes vs-rise { to { transform: translateY(0) } }
@keyframes vs-spin { to { transform: rotate(360deg) } }
@keyframes vs-glide { 0%, 100% { transform: translate(0, 0) } 50% { transform: translate(10px, -4px) } }
@keyframes vs-flap { 0%, 100% { transform: scaleY(1) } 50% { transform: scaleY(-.4) } }
@keyframes vs-smoke { 0% { opacity: 0; transform: translate(0, 0) scale(.6) } 20% { opacity: .8 } 100% { opacity: 0; transform: translate(6px, -16px) scale(1.6) } }
@keyframes vs-cloudmove { 0%, 100% { transform: translateX(0) } 50% { transform: translateX(-12px) } }
@keyframes vs-beam { 0%, 100% { transform: rotate(-3deg) } 50% { transform: rotate(7deg) } }
@keyframes vs-foam { 0%, 100% { transform: scaleY(.4); opacity: .3 } 50% { transform: scaleY(1.2); opacity: 1 } }
@keyframes vs-spout { 0% { opacity: 0; transform: scaleY(.1) } 30% { opacity: 1; transform: scaleY(1.1) } 70% { opacity: 1; transform: scaleY(1) } 100% { opacity: .15; transform: scaleY(1) } }
@keyframes vs-surface { to { transform: translateY(0) } }
@keyframes vs-splash { 0% { opacity: 1; transform: translate(0, 0) } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) } }
@keyframes vs-bloom { 0% { transform: scale(.4) } 60% { transform: scale(1.4) } 100% { transform: scale(1) } }
@keyframes vs-shootstar { 0% { stroke-dashoffset: 130; opacity: 1 } 60% { stroke-dashoffset: 0; opacity: 1 } 100% { stroke-dashoffset: 0; opacity: 0 } }
@keyframes vs-biolum { 0%, 100% { opacity: 0 } 50% { opacity: .9 } }
@keyframes vs-fly { to { transform: translate(-70px, -80px); opacity: 0 } }
@keyframes vs-flag { to { transform: scaleY(1) } }
@keyframes vs-flagwave { 0%, 100% { transform: skewY(0) scaleX(1) } 50% { transform: skewY(-8deg) scaleX(.9) } }
@keyframes vs-sway { 0%, 100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
@keyframes vs-shore { 0%, 100% { transform: translateY(0); opacity: .9 } 50% { transform: translateY(1.4px); opacity: .4 } }
@keyframes vs-wind { 0% { stroke-dashoffset: 130; opacity: 0 } 20% { opacity: .9 } 70% { stroke-dashoffset: 0; opacity: .6 } 100% { stroke-dashoffset: -130; opacity: 0 } }
@keyframes vs-sparkle { 0%, 100% { opacity: 0; transform: scale(.4) } 50% { opacity: 1; transform: scale(1) } }
@keyframes vs-auroraup { to { opacity: 1 } }
@keyframes vs-aurora { 0%, 100% { transform: translateX(0) skewX(0) } 50% { transform: translateX(-16px) skewX(-6deg) } }
`;
