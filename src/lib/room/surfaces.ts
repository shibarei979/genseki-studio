/**
 * ============================================================
 * 原石航路 Studio
 * 床と壁の種類
 *
 * 絵ではなく色と模様で作る。
 * 敷き詰める絵は継ぎ目が出やすく、ドット絵が揃うまで待てない。
 * ============================================================
 */

export interface SurfaceDef {
    id: string;
    label: string;
    /** 地の色 */
    base: string;
    /** 目地・板の継ぎ目の色 */
    line: string;
    /** 板の向き。縦板・横板・市松 */
    pattern: "plank-h" | "plank-v" | "check" | "plain" | "tatami" | "brick";
}

export const FLOORS: SurfaceDef[] = [
    { id: "wood", label: "板張り", base: "#9a7549", line: "#83603a", pattern: "plank-h" },
    { id: "wood-dark", label: "濃い板", base: "#6f5236", line: "#5a412a", pattern: "plank-h" },
    { id: "wood-light", label: "白木", base: "#c4a67d", line: "#ab8d64", pattern: "plank-v" },
    { id: "tatami", label: "畳", base: "#a8ad7f", line: "#8f9a6a", pattern: "tatami" },
    { id: "tile", label: "タイル", base: "#cfc7b8", line: "#bdb3a2", pattern: "check" },
    { id: "carpet", label: "絨毯", base: "#7a6a72", line: "#6b5c63", pattern: "plain" },
    { id: "stone", label: "石床", base: "#a8a296", line: "#9a9388", pattern: "check" },
];

export const WALLS: SurfaceDef[] = [
    // ---- 木 ----
    { id: "wood-wall", label: "板壁", base: "#b3966d", line: "#96795a", pattern: "plank-h" },
    { id: "wood-dark-wall", label: "濃い板壁", base: "#7a6047", line: "#634c38", pattern: "plank-h" },
    { id: "wood-vert", label: "縦板壁", base: "#c0a377", line: "#a08760", pattern: "plank-v" },

    // ---- 石 ----
    { id: "stone-wall", label: "石壁", base: "#a8a49a", line: "#8e8a80", pattern: "check" },
    { id: "stone-dark", label: "暗い石壁", base: "#7d7a73", line: "#66635d", pattern: "check" },

    // ---- 煉瓦 ----
    { id: "brick", label: "煉瓦", base: "#a8735f", line: "#8a5a48", pattern: "brick" },
    { id: "brick-pale", label: "白煉瓦", base: "#c9b8a8", line: "#ab9a8a", pattern: "brick" },

    // ---- 塗り壁 ----
    { id: "cream", label: "クリーム", base: "#e3d9c4", line: "#cec3ac", pattern: "plain" },
    { id: "plaster", label: "白壁", base: "#ece6da", line: "#d6cfc0", pattern: "plain" },
    { id: "green", label: "深緑", base: "#4a5f4d", line: "#3d5040", pattern: "plain" },
    { id: "navy", label: "紺", base: "#3d4a5f", line: "#333e50", pattern: "plain" },
];

const FLOOR_BY_ID = new Map(FLOORS.map((row) => [row.id, row]));
const WALL_BY_ID = new Map(WALLS.map((row) => [row.id, row]));

export function findFloor(id: string): SurfaceDef {
    return FLOOR_BY_ID.get(id) ?? FLOORS[0];
}

export function findWall(id: string): SurfaceDef {
    return WALL_BY_ID.get(id) ?? WALLS[0];
}

/**
 * ============================================================
 * テーマ
 *
 * 床・壁・置いてある家具の組み合わせ。
 * 選ぶと一式が入る。そのあと個別に変えられる。
 * ============================================================
 */

export interface RoomThemeDef {
    id: string;
    label: string;
    description: string;
    floor: string;
    wall: string;
}

export const ROOM_THEMES: RoomThemeDef[] = [
    {
        id: "study",
        label: "木漏れ日の書斎",
        description: "板張りとクリーム色の壁。落ち着いて書く部屋",
        floor: "wood",
        wall: "cream",
    },
    {
        id: "night",
        label: "星降る夜の書斎",
        description: "濃い板と紺の壁。灯りが映える",
        floor: "wood-dark",
        wall: "navy",
    },
    {
        id: "cafe",
        label: "喫茶店風",
        description: "タイルと板壁。人の出入りがある場所",
        floor: "tile",
        wall: "wood-wall",
    },
    {
        id: "washitsu",
        label: "和室",
        description: "畳と白壁",
        floor: "tatami",
        wall: "plaster",
    },
    {
        id: "library",
        label: "図書館",
        description: "石床と深緑の壁。棚を並べる部屋",
        floor: "stone",
        wall: "green",
    },
    {
        id: "hideaway",
        label: "森の隠れ家",
        description: "白木と煉瓦",
        floor: "wood-light",
        wall: "brick",
    },
];
