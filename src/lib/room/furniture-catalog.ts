/**
 * ============================================================
 * 原石航路 Studio
 * 家具のカタログ
 *
 * まだドット絵が無いので、当面は図形で描く。
 * 置き場所の決まりと絵は別々にしてあるので、
 * 絵ができたら sprite を足すだけで差し替わる。
 *
 * 大きさ・層・向きの有無はここで決める。
 * 部屋のデータは品番しか持たない。
 * ============================================================
 */

import type { Facing, FurnitureLayer } from "@/types/room-layout";

/** 道具箱の仕切り。見本の画像と同じ並びにしてある */
export type FurnitureCategory =
    | "desk"
    | "seat"
    | "storage"
    | "bed"
    | "plant"
    | "light"
    | "decor"
    | "small";

export const CATEGORY_LABEL: Record<FurnitureCategory, string> = {
    desk: "机・台",
    seat: "椅子・ソファ",
    storage: "棚・収納",
    bed: "ベッド",
    plant: "植物",
    light: "灯り",
    decor: "壁の飾り",
    small: "小物",
};

export interface FurnitureDef {
    id: string;
    label: string;
    category: FurnitureCategory;
    layer: FurnitureLayer;

    /**
     * 床で占めるマス数（足元）。
     * ここは「置ける場所」を決めるためだけの値。
     */
    cols: number;
    rows: number;

    /**
     * 絵の大きさ（マス数）。省くと足元と同じ。
     *
     * 絵は足元より大きくてよい。
     * 本棚は床の 2×1 を占めるが、絵は上へ 3 マス伸びる。
     * 背の高いものを足元の枠に押し込めると、
     * 全部が同じ高さの板に見えてしまう。
     *
     * 絵は足元の下端に合わせて置き、上へはみ出す。
     */
    artCols?: number;
    artRows?: number;

    /**
     * 向きを変えられるか。
     *
     * 上から見て対称なもの（丸テーブル・鉢植え・時計）は回しても同じなので false。
     * 長方形のものは、回すと縦横が入れ替わるので true にしておく。
     */
    rotatable: boolean;

    /**
     * 絵。まだ無いので図形の名前を持つ。
     * ドット絵ができたら sprite に画像の道筋を入れる。
     */
    shape: ShapeKind;
    /** 主となる色。図形で描くときに使う */
    tone: string;

    /**
     * 描いた絵の道筋。
     *
     * 1 枚だけ渡すと、向きを変えたときにその絵を回して使う。
     * 回した絵は、机の脚や椅子の背もたれが不自然になる。
     *
     * 向きごとに描いた絵があれば、そちらを渡す。
     *   down  … 手前向き（正面図）
     *   up    … 奥向き（背面図）
     *   left  … 左向き（右側面図を裏返したもの）
     *   right … 右向き（右側面図）
     *
     * 絵の細かさはマス目と揃えなくてよい。
     * 1 マス 16px だが、6 マスの家具に 600px で描いた絵を入れてよい。
     */
    sprite?: string | Partial<Record<Facing, string>>;
    /**
     * ドット絵として粗いまま出すか。
     * きめの細かい絵は false にして、滑らかに縮める。
     */
    pixelated?: boolean;
}

export type ShapeKind =
    | "table"
    | "chair"
    | "sofa"
    | "shelf"
    | "cabinet"
    | "bed"
    | "rug"
    | "plant"
    | "lamp"
    | "candle"
    | "window"
    | "frame"
    | "clock"
    | "book"
    | "cup"
    | "vase"
    | "bin"
    | "cushion";

/**
 * 置けるもの。
 * 見本の画像に出ていたものを最初の一式として並べる。
 */
export const FURNITURE: FurnitureDef[] = [
    // ---- 机・台 ----
    {
        id: "desk", label: "机", category: "desk", layer: "floor",
        cols: 6, rows: 4, artCols: 6.00, artRows: 2.88,
        rotatable: true, shape: "table", tone: "#8a6a45",
        sprite: "/furniture/desk.png",
    },
    {
        id: "table-round", label: "丸テーブル", category: "desk", layer: "floor",
        cols: 4, rows: 4, artCols: 4.38, artRows: 4.50,
        rotatable: false, shape: "table", tone: "#96754d",
        sprite: "/furniture/table-round.png",
    },
    {
        id: "table-low", label: "ローテーブル", category: "desk", layer: "floor",
        cols: 4, rows: 2, rotatable: true, shape: "table", tone: "#7d6a4d",
    },

    // ---- 椅子・ソファ ----
    {
        id: "chair", label: "椅子", category: "seat", layer: "floor",
        cols: 2, rows: 2, artCols: 2.19, artRows: 3.50,
        rotatable: true, shape: "chair", tone: "#8a6a45",
        sprite: "/furniture/chair.png",
    },
    {
        /*
         * 四角い椅子。向きごとに描いた絵があるので回しても崩れない。
         * 足元と絵の大きさは丸椅子に揃えてある。
         * 同じ「椅子」で大きさが違うと、並べたとき不揃いに見える。
         */
        id: "chair-square", label: "四角椅子", category: "seat", layer: "floor",
        cols: 2, rows: 2, artCols: 2.31, artRows: 4.12,
        rotatable: true, shape: "chair", tone: "#a0703a",
        sprite: {
            down: "/furniture/chair-square-down.png",
            up: "/furniture/chair-square-up.png",
            left: "/furniture/chair-square-left.png",
            right: "/furniture/chair-square-right.png",
        },
        pixelated: true,
    },
    {
        id: "sofa", label: "ソファ", category: "seat", layer: "floor",
        cols: 6, rows: 4, artCols: 6.38, artRows: 2.25,
        rotatable: true, shape: "sofa", tone: "#5f7a8c",
        sprite: "/furniture/sofa.png",
    },
    {
        id: "cushion", label: "クッション", category: "seat", layer: "floor",
        cols: 2, rows: 2, artCols: 2.00, artRows: 1.31,
        rotatable: true, shape: "cushion", tone: "#a8846a",
        sprite: "/furniture/cushion.png",
    },

    // ---- 棚・収納 ----
    {
        id: "bookshelf", label: "本棚", category: "storage", layer: "floor",
        cols: 4, rows: 2, artCols: 4.38, artRows: 7.44,
        rotatable: true, shape: "shelf", tone: "#7a5c3d",
        sprite: "/furniture/bookshelf.png",
    },
    {
        id: "bookshelf-tall", label: "細い本棚", category: "storage", layer: "floor",
        cols: 2, rows: 2, artCols: 2.19, artRows: 4.94,
        rotatable: true, shape: "shelf", tone: "#7a5c3d",
        sprite: "/furniture/bookshelf-tall.png",
    },
    {
        id: "cabinet", label: "小物棚", category: "storage", layer: "floor",
        cols: 2, rows: 2, artCols: 2.81, artRows: 4.50,
        rotatable: true, shape: "cabinet", tone: "#6f5540",
        sprite: "/furniture/cabinet.png",
    },

    // ---- ベッド・敷物 ----
    {
        id: "bed", label: "ベッド", category: "bed", layer: "floor",
        cols: 6, rows: 8, artCols: 6.38, artRows: 2.81,
        rotatable: true, shape: "bed", tone: "#4a6a8c",
        sprite: "/furniture/bed.png",
    },
    {
        id: "rug", label: "ラグ", category: "bed", layer: "floor",
        cols: 8, rows: 6, artCols: 8.00, artRows: 5.19,
        rotatable: true, shape: "rug", tone: "#5f7a6a",
        sprite: "/furniture/rug.png",
    },

    // ---- 植物 ----
    {
        id: "plant-tall", label: "観葉植物", category: "plant", layer: "floor",
        cols: 2, rows: 2, artCols: 2.81, artRows: 3.25,
        rotatable: true, shape: "plant", tone: "#5f8a55",
        sprite: "/furniture/plant-tall.png",
    },
    {
        id: "vase", label: "花瓶", category: "plant", layer: "top",
        cols: 2, rows: 2, artCols: 1.62, artRows: 1.75,
        rotatable: true, shape: "vase", tone: "#8a9aa8",
        sprite: "/furniture/vase.png",
    },

    // ---- 灯り ----
    {
        id: "lamp-floor", label: "スタンド", category: "light", layer: "floor",
        cols: 2, rows: 2, artCols: 2.00, artRows: 3.00,
        rotatable: true, shape: "lamp", tone: "#c9a862",
        sprite: "/furniture/lamp-floor.png",
    },
    {
        id: "candle", label: "キャンドル", category: "light", layer: "top",
        cols: 2, rows: 2, artCols: 1.00, artRows: 0.94,
        rotatable: false, shape: "candle", tone: "#d9b877",
        sprite: "/furniture/candle.png",
    },

    // ---- 壁の飾り ----
    {
        id: "window", label: "窓", category: "decor", layer: "wall",
        cols: 2, rows: 4, artCols: 2.00, artRows: 5.06,
        rotatable: false, shape: "window", tone: "#a8c4d4",
        sprite: "/furniture/window.png",
    },
    {
        id: "poster", label: "額縁", category: "decor", layer: "wall",
        cols: 2, rows: 2, artCols: 2.19, artRows: 2.12,
        rotatable: false, shape: "frame", tone: "#8a7a62",
        sprite: "/furniture/poster.png",
    },
    {
        id: "clock", label: "時計", category: "decor", layer: "wall",
        cols: 2, rows: 2, artCols: 1.81, artRows: 2.25,
        rotatable: false, shape: "clock", tone: "#7a6a55",
        sprite: "/furniture/clock.png",
    },

    // ---- 小物 ----
    {
        id: "books", label: "本", category: "small", layer: "top",
        cols: 2, rows: 2, artCols: 1.69, artRows: 2.06,
        rotatable: true, shape: "book", tone: "#7a6a8c",
        sprite: "/furniture/books.png",
    },
    {
        id: "mug", label: "マグカップ", category: "small", layer: "top",
        cols: 2, rows: 2, artCols: 0.88, artRows: 1.19,
        rotatable: false, shape: "cup", tone: "#c4b8a8",
        sprite: "/furniture/mug.png",
    },
    {
        id: "bin", label: "ゴミ箱", category: "small", layer: "floor",
        cols: 2, rows: 2, artRows: 1.6,
        rotatable: true, shape: "bin", tone: "#8a8074",
    },
];

const BY_ID = new Map(FURNITURE.map((row) => [row.id, row]));

export function findFurniture(id: string): FurnitureDef | undefined {
    return BY_ID.get(id);
}

/**
 * 向きを変えたときの大きさ。
 * 横長の机を縦向きに置くと、縦横が入れ替わる。
 */
export function sizeOf(
    def: FurnitureDef,
    facing: string,
): { cols: number; rows: number } {
    const isSideways = facing === "left" || facing === "right";
    if (!def.rotatable || !isSideways) return { cols: def.cols, rows: def.rows };
    return { cols: def.rows, rows: def.cols };
}

/**
 * 絵の大きさ。足元より大きいことがある。
 * 絵は足元の下端に合わせ、上へはみ出す形で置く。
 */
/** 向きごとに描いた絵を持っているか */
export function hasDirectionalSprite(def: FurnitureDef): boolean {
    return typeof def.sprite === "object" && def.sprite !== null;
}

export function artSizeOf(
    def: FurnitureDef,
    facing: string,
): { cols: number; rows: number } {
    const foot = sizeOf(def, facing);
    /*
     * 絵は足元より小さくても大きくてもよい。
     * マグカップは 1 マスを占めるが、絵は半マスで足りる。
     * 逆に本棚は 1 マスしか占めないが、絵は 4 マス近く伸びる。
     */
    const isSideways = facing === "left" || facing === "right";
    const cols = def.artCols ?? foot.cols;
    const rows = def.artRows ?? foot.rows;

    /*
     * 横向きに置いたら、絵も縦横が入れ替わる。
     *
     * ただし向きごとに描いた絵は、その向きのまま出す。
     * 側面図は縦長に描かれているので、入れ替えると潰れる。
     */
    if (def.rotatable && isSideways && !hasDirectionalSprite(def)) {
        return { cols: rows, rows: cols };
    }
    return { cols, rows };
}

/**
 * ============================================================
 * 実際に塞ぐ範囲
 *
 * 足元 1 マスでも、絵が 2 マス分あれば見た目は 2 マス埋まる。
 * 置けるかどうかは絵の広がりで見ないと、家具どうしが重なる。
 *
 * ただし絵は上へ伸びるので、横は絵の幅、縦は足元だけを見る。
 * 縦まで絵で見ると、背の高い棚の手前に何も置けなくなる。
 * ============================================================
 */
export function blockingSizeOf(
    def: FurnitureDef,
    facing: string,
): { cols: number; rows: number } {
    const foot = sizeOf(def, facing);
    const art = artSizeOf(def, facing);

    return {
        cols: Math.max(foot.cols, Math.round(art.cols)),
        rows: Math.max(foot.rows, Math.round(Math.min(art.rows, foot.rows + 1))),
    };
}

/**
 * その向きの絵を返す。
 *
 * @returns 絵の道筋と、回す角度。
 *          向きごとの絵があれば回さない（0 度）。
 */
export function spriteFor(
    def: FurnitureDef,
    facing: Facing,
): { src: string; turn: number } | null {
    if (!def.sprite) return null;

    // 1 枚だけのときは、それを回して使う
    if (typeof def.sprite === "string") {
        return {
            src: def.sprite,
            turn: def.rotatable ? ROTATION[facing] : 0,
        };
    }

    // 向きごとの絵。無い向きは手前向きで代える
    const src = def.sprite[facing] ?? def.sprite.down;
    if (!src) return null;

    return { src, turn: def.sprite[facing] ? 0 : ROTATION[facing] };
}

/** 1 枚しか無いときの回し方（度） */
const ROTATION: Record<Facing, number> = {
    down: 0,
    left: -90,
    up: 180,
    right: 90,
};
