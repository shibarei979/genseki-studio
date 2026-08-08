/**
 * ============================================================
 * 原石航路 Studio
 * 資料の図案づくり
 *
 * 【方針】
 * 本文と表紙は作らない。作るのは資料の中の図案だけ。
 * 王国が増えれば紋章が並び、人物が増えれば肖像が並ぶ。
 * それは物語そのものではなく、書き手が世界を見渡すための目印。
 *
 * 【いまの実装】
 * 名前から決まる値をもとに SVG を組み立てる。
 * 同じ名前なら必ず同じ図案になり、消しても作り直せる。
 * サーバーもモデルも要らないので、いつでも動く。
 *
 * 実モデルに繋ぐときは apiImageGenerator を使う。
 * ============================================================
 */

import type { ImageStyle } from "@/types";

export interface ImageGenerator {
    generate(
        name: string,
        style: ImageStyle,
        hint?: string,
        era?: string,
    ): Promise<string>;
}

/**
 * ============================================================
 * 名前から決まる値
 * ============================================================
 */

function hashOf(text: string): number {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
}

/** 種から 0〜max-1 の値を順に取り出す */
function makeRandom(seed: number) {
    let state = seed || 1;
    return (max: number) => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state % max;
    };
}

/**
 * 配色。
 * 緑を基調にした画面に置くので、彩度は抑えめにする。
 * 資料が図案の派手さで競い合うと、本文へ戻れなくなる。
 */
const PALETTES = [
    ["#2f6b3d", "#8fbfa0", "#eef4ef"],
    ["#3a5a7d", "#93b3cd", "#eef2f6"],
    ["#7d4a3a", "#cd9c8b", "#f6efec"],
    ["#5a4a7d", "#a99ccd", "#f1eff6"],
    ["#7d6b3a", "#cdbc8b", "#f6f3ec"],
    ["#3a7d75", "#8bcdc4", "#ecf6f4"],
    ["#6b3a5a", "#cd8bb3", "#f6ecf1"],
    ["#4a5a3a", "#9fb08b", "#f0f3ec"],
];

function wrap(inner: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${inner}</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * ============================================================
 * 図案
 * ============================================================
 */

/** 紋章。組織・国家・グループ向け */
function drawCrest(name: string): string {
    const seed = hashOf(name);
    const random = makeRandom(seed);
    const [dark, mid, light] = PALETTES[seed % PALETTES.length];
    const initial = Array.from(name)[0] ?? "?";

    const shield = "M60 8 L106 24 V64 Q106 96 60 114 Q14 96 14 64 V24 Z";
    const bandKind = random(3);
    const band =
        bandKind === 0
            ? `<path d="M14 52 H106 V70 H14 Z" fill="${mid}" opacity="0.55"/>`
            : bandKind === 1
              ? `<path d="M60 8 L106 24 V44 L60 60 L14 44 V24 Z" fill="${mid}" opacity="0.5"/>`
              : `<path d="M60 8 V114 M14 56 H106" stroke="${mid}" stroke-width="7" opacity="0.5" fill="none"/>`;

    const star = random(2) === 0
        ? `<path d="M60 34 L64 46 L77 46 L67 54 L70 66 L60 59 L50 66 L53 54 L43 46 L56 46 Z" fill="${light}" opacity="0.9"/>`
        : `<circle cx="60" cy="48" r="12" fill="none" stroke="${light}" stroke-width="3"/>`;

    return wrap(`
        <path d="${shield}" fill="${dark}"/>
        ${band}
        ${star}
        <path d="${shield}" fill="none" stroke="${light}" stroke-width="2.5" opacity="0.6"/>
        <text x="60" y="98" text-anchor="middle" font-size="22" fill="${light}"
              font-family="serif" opacity="0.95">${escapeXml(initial)}</text>
    `);
}

/** 肖像。人物向け */
function drawPortrait(name: string): string {
    const seed = hashOf(name);
    const random = makeRandom(seed);
    const [dark, mid, light] = PALETTES[seed % PALETTES.length];
    const initial = Array.from(name)[0] ?? "?";

    const hair = random(3);
    const hairShape =
        hair === 0
            ? `<path d="M38 54 Q38 26 60 26 Q82 26 82 54 L82 44 Q76 36 60 36 Q44 36 38 44 Z" fill="${dark}"/>`
            : hair === 1
              ? `<path d="M36 58 Q36 24 60 24 Q84 24 84 58 L78 58 Q78 34 60 34 Q42 34 42 58 Z" fill="${dark}"/>`
              : `<path d="M40 50 Q46 24 60 24 Q74 24 80 50 L74 46 Q68 32 60 32 Q52 32 46 46 Z" fill="${dark}"/>`;

    return wrap(`
        <rect width="120" height="120" fill="${light}"/>
        <circle cx="60" cy="96" r="42" fill="${mid}" opacity="0.55"/>
        <ellipse cx="60" cy="56" rx="21" ry="25" fill="${mid}"/>
        ${hairShape}
        <text x="60" y="64" text-anchor="middle" font-size="20" fill="${light}"
              font-family="serif" opacity="0.9">${escapeXml(initial)}</text>
    `);
}

/** 風景。場所向け */
function drawScene(name: string): string {
    const seed = hashOf(name);
    const random = makeRandom(seed);
    const [dark, mid, light] = PALETTES[seed % PALETTES.length];

    const layers: string[] = [];
    for (let i = 0; i < 3; i += 1) {
        const baseY = 56 + i * 14;
        const peak = 16 + random(26);
        const shift = random(30) - 15;
        layers.push(
            `<path d="M0 ${baseY + 8} L${20 + shift} ${baseY - peak} L${50 + shift} ${baseY} L${80 + shift} ${baseY - peak * 0.7} L120 ${baseY + 4} L120 120 L0 120 Z"
                fill="${i === 0 ? mid : dark}" opacity="${0.35 + i * 0.28}"/>`,
        );
    }

    const sky = random(2) === 0
        ? `<circle cx="${28 + random(60)}" cy="30" r="11" fill="${light}" opacity="0.85"/>`
        : `<circle cx="${28 + random(60)}" cy="30" r="11" fill="none" stroke="${light}" stroke-width="3" opacity="0.85"/>`;

    return wrap(`
        <rect width="120" height="120" fill="${light}"/>
        ${sky}
        ${layers.join("")}
    `);
}

/**
 * 地図。図・マップ向け。
 *
 * 海岸線・山脈・森・川・道・町を、名前から決まる値で置く。
 * 同じ名前なら必ず同じ地図になるので、
 * 「思っていたのと違う」ときは名前を変えれば作り直せる。
 */
function drawMap(name: string): string {
    const seed = hashOf(name);
    const random = makeRandom(seed);

    const paper = "#f2ead7";
    const sea = "#cbdbdc";
    const land = "#e4dcc2";
    const forest = "#a9bd9a";
    const mountain = "#c3b79c";
    const ink = "#7d6f56";

    /** 海岸線。上下に揺らしながら横断させる */
    const coast: string[] = [`M0 ${34 + random(20)}`];
    for (let x = 20; x <= 180; x += 20) {
        coast.push(`Q${x - 10} ${28 + random(30)} ${x} ${34 + random(26)}`);
    }
    coast.push("L180 120 L0 120 Z");

    /** 川。陸を縦断させる */
    const riverX = 40 + random(90);
    const river = `M${riverX} ${40 + random(10)} Q${riverX + 12 - random(24)} 62 ${riverX + 8 - random(16)} 78 Q${riverX + 14 - random(28)} 96 ${riverX + 6 - random(12)} 118`;

    /** 山脈 */
    const mountains: string[] = [];
    const mountainBase = 52 + random(16);
    for (let i = 0; i < 5 + random(4); i += 1) {
        const x = 18 + i * (14 + random(6));
        const h = 8 + random(9);
        mountains.push(`M${x} ${mountainBase} l${h * 0.8} -${h} l${h * 0.8} ${h} Z`);
    }

    /** 森 */
    const trees: string[] = [];
    for (let i = 0; i < 14 + random(10); i += 1) {
        const x = 12 + random(160);
        const y = 68 + random(44);
        trees.push(`<circle cx="${x}" cy="${y}" r="${2.4 + random(2)}" fill="${forest}" opacity="0.8"/>`);
    }

    /** 町と道 */
    const towns: { x: number; y: number }[] = [];
    for (let i = 0; i < 3 + random(3); i += 1) {
        towns.push({ x: 24 + random(140), y: 52 + random(56) });
    }
    const roads = towns
        .slice(1)
        .map(
            (town, index) =>
                `M${towns[index].x} ${towns[index].y} Q${(towns[index].x + town.x) / 2} ${(towns[index].y + town.y) / 2 - 6 + random(12)} ${town.x} ${town.y}`,
        )
        .join(" ");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 120">
        <rect width="180" height="120" fill="${paper}"/>
        <rect width="180" height="120" fill="${sea}" opacity="0.5"/>
        <path d="${coast.join(" ")}" fill="${land}"/>
        <path d="${coast.join(" ")}" fill="none" stroke="${ink}" stroke-width="0.7" opacity="0.6"/>
        ${trees.join("")}
        <g fill="${mountain}" stroke="${ink}" stroke-width="0.5" opacity="0.9">${mountains.map((d) => `<path d="${d}"/>`).join("")}</g>
        <path d="${river}" fill="none" stroke="${sea}" stroke-width="1.6" opacity="0.95"/>
        <path d="${roads}" fill="none" stroke="${ink}" stroke-width="0.6" stroke-dasharray="2 2" opacity="0.7"/>
        ${towns.map((town) => `<circle cx="${town.x}" cy="${town.y}" r="2" fill="${paper}" stroke="${ink}" stroke-width="0.8"/>`).join("")}
        <g opacity="0.55" stroke="${ink}" stroke-width="0.7" fill="none">
            <circle cx="160" cy="24" r="8"/>
            <path d="M160 14 v20 M150 24 h20"/>
            <path d="M160 14 l2.5 8 l-2.5 -1 l-2.5 1 Z" fill="${ink}"/>
        </g>
        <rect x="1" y="1" width="178" height="118" fill="none" stroke="${ink}" stroke-width="1.2" opacity="0.5"/>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** 記号。用語・道具向け */
function drawIcon(name: string): string {
    const seed = hashOf(name);
    const random = makeRandom(seed);
    const [dark, mid, light] = PALETTES[seed % PALETTES.length];

    const sides = 3 + random(5);
    const points: string[] = [];
    for (let i = 0; i < sides; i += 1) {
        const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
        points.push(`${60 + Math.cos(angle) * 36},${60 + Math.sin(angle) * 36}`);
    }

    const inner = random(3);
    const innerShape =
        inner === 0
            ? `<circle cx="60" cy="60" r="15" fill="${light}" opacity="0.9"/>`
            : inner === 1
              ? `<rect x="46" y="46" width="28" height="28" fill="${light}" opacity="0.9" transform="rotate(45 60 60)"/>`
              : `<path d="M60 42 L74 78 L46 78 Z" fill="${light}" opacity="0.9"/>`;

    return wrap(`
        <rect width="120" height="120" fill="${light}"/>
        <polygon points="${points.join(" ")}" fill="${dark}"/>
        <polygon points="${points.join(" ")}" fill="none" stroke="${mid}" stroke-width="3"/>
        ${innerShape}
    `);
}

function escapeXml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * ============================================================
 * 実装
 * ============================================================
 */

export const proceduralImageGenerator: ImageGenerator = {
    async generate(name, style) {
        const key = name.trim() || "無題";
        if (style === "crest") return drawCrest(key);
        if (style === "portrait") return drawPortrait(key);
        if (style === "scene") return drawScene(key);
        if (style === "map") return drawMap(key);
        return drawIcon(key);
    },
};

/**
 * サーバー経由でモデルに図案を描かせる。
 *
 * 失敗したら手元の図案に戻す。
 * 図案が出ないより、簡素でも出るほうがよい。
 */
export const apiImageGenerator: ImageGenerator = {
    async generate(name, style, hint, era) {
        try {
            const response = await fetch("/api/ai/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, style, hint, era }),
            });
            if (!response.ok) throw new Error("failed");

            const data = (await response.json()) as { image?: string };
            if (!data.image?.startsWith("data:image/")) throw new Error("invalid");

            return data.image;
        } catch {
            return proceduralImageGenerator.generate(name, style);
        }
    },
};

export function getImageGenerator(useModel: boolean): ImageGenerator {
    return useModel ? apiImageGenerator : proceduralImageGenerator;
}
