/**
 * ============================================================
 * 原石航路 Studio
 * 部屋の間取り
 *
 * 疑似トップダウン。床は真上から、家具は斜め前から見た形で描く。
 * 本当の真上にすると本棚が長方形、椅子が丸になって
 * 何なのか分からなくなる。
 *
 * 絵は後から差し替えられるよう、置き場所と種類だけを持つ。
 * 描き方はカタログ側の仕事にする。
 * ============================================================
 */

/**
 * 1 マスの大きさ（画面上の px）。
 *
 * 絵の仕様に合わせて 16px にした。
 * 机は 6 マス × 4 マス（96px × 64px）という数え方になる。
 * 細かいぶん、家具を思った場所へ置きやすい。
 */
export const TILE_SIZE = 16;

/** 部屋の広さ。マス数で持つ */
export const ROOM_COLS = 40;
export const ROOM_ROWS = 22;

/**
 * 壁の厚み（マス数）。
 * 上下左右の 4 面を囲う。
 * 大きすぎると床が狭くなるので、家具が半分覗く程度に留める。
 */
export const WALL_THICKNESS = 3;

/** 出入口の幅（マス数） */
export const DOOR_WIDTH = 6;

/**
 * 出入口の前は物を置けない。
 * 入ってきた人が家具に埋まらないようにする。
 */
export const DOOR_CLEARANCE = 4;

/** 出入口を置ける面 */
export type DoorSide = "top" | "bottom" | "left" | "right";

export interface RoomDoor {
    side: DoorSide;
    /** その面の何マス目から始まるか */
    offset: number;
}

/**
 * 家具の置ける層。
 *
 * rug   … 床に敷く。ラグ。何よりも下
 * floor … 床に置く。机・椅子・棚。人と重なる
 * wall  … 壁に掛ける。窓・額縁・時計。人より奥
 * top   … 机の上に乗せる小物。人より手前
 *
 * 層を分けないと、壁の絵の上に人が立ってしまったり、
 * 机の上のカップが机の下に潜ったりする。
 *
 * ラグを floor から分けたのは、机を載せられないため。
 * 重なりを見るのは同じ層だけなので、同じ層にあると
 * 「ラグの上に机」が置けない。敷物は敷物だけで場所を争う。
 */
export type FurnitureLayer = "rug" | "floor" | "wall" | "top";

/** 家具の向き。4 方向まで */
export type Facing = "down" | "left" | "up" | "right";

export const FACING_ORDER: Facing[] = ["down", "left", "up", "right"];

/**
 * 部屋に置かれた家具ひとつ。
 * 位置は左上のマス。大きさはカタログ側が持つ。
 */
export interface PlacedFurniture {
    id: string;
    /** カタログの品番 */
    catalog_id: string;
    /** 左上のマス。0 から数える */
    col: number;
    row: number;
    facing: Facing;
    /** 色替え。カタログが対応していれば使う */
    variant?: string;
}

/**
 * 床と壁の見た目。
 * テーマを選ぶと既定値が入り、そのあと個別に変えられる。
 */
export interface RoomSurface {
    floor: string;
    wall: string;
}

export interface RoomLayout {
    surface: RoomSurface;
    furniture: PlacedFurniture[];
    /** 出入口。1 つだけ置ける */
    door: RoomDoor;
}

export function emptyLayout(): RoomLayout {
    return {
        surface: { floor: "wood", wall: "cream" },
        furniture: [],
        // 既定は下の面の真ん中。手前から入ってくる形になる
        door: { side: "bottom", offset: Math.floor((ROOM_COLS - DOOR_WIDTH) / 2) },
    };
}

/**
 * 出入口の前の、物を置けないマス。
 * 「col,row」の形で持つ。
 */
export function doorClearance(door: RoomDoor): Set<string> {
    const cells = new Set<string>();

    for (let i = 0; i < DOOR_WIDTH; i += 1) {
        for (let depth = 0; depth < DOOR_CLEARANCE; depth += 1) {
            let col = 0;
            let row = 0;

            if (door.side === "top") {
                col = door.offset + i;
                row = depth;
            } else if (door.side === "bottom") {
                col = door.offset + i;
                row = ROOM_ROWS - 1 - depth;
            } else if (door.side === "left") {
                col = depth;
                row = door.offset + i;
            } else {
                col = ROOM_COLS - 1 - depth;
                row = door.offset + i;
            }

            if (col >= 0 && col < ROOM_COLS && row >= 0 && row < ROOM_ROWS) {
                cells.add(`${col},${row}`);
            }
        }
    }

    return cells;
}

/** その面に置ける出入口の位置の上限 */
export function maxDoorOffset(side: DoorSide): number {
    const length = side === "top" || side === "bottom" ? ROOM_COLS : ROOM_ROWS;
    return Math.max(0, length - DOOR_WIDTH);
}

/**
 * ============================================================
 * 重なりの順
 *
 * 同じ層の中では、下にあるものほど手前に描く。
 * 奥にある机の向こう側に人が立てるようにするため。
 *
 * 渡すのは「足元の下端の行」。上端ではない。
 * 上端で比べると、背の高いものが必ず奥へ回ってしまう。
 * 行 10 から 4 マスぶんの机（下端 13）と、行 12 の椅子を比べたとき、
 * 上端では机が奥になるが、実際は椅子のほうが奥にいる。
 *
 * 下端が同じものどうしは、並び順が後にあるほうが手前になる。
 * 「手前へ／奥へ」はこの並びを入れ替えて決める。
 * ============================================================
 */

/** 奥行きを決める行。足元の下端 */
export function depthRowOf(row: number, rows: number): number {
    return row + Math.max(1, rows) - 1;
}

export function zIndexOf(layer: FurnitureLayer, row: number): number {
    if (layer === "wall") return 10 + row;
    /*
     * 敷物は床の絵のすぐ上、家具より下。
     * 奥行きで前後させる意味がないので、行でずらすだけに留める。
     */
    if (layer === "rug") return 50 + row;
    if (layer === "floor") return 100 + row * 2;
    return 100 + row * 2 + 1;
}

/** 人の重なり順。床の家具と同じ規則で混ぜる */
export function zIndexOfPerson(row: number): number {
    return 100 + row * 2 + 1;
}

/**
 * ============================================================
 * 出入口の前にいるか
 *
 * 扉まで歩いたら退室を尋ねる。
 * 「退室」ボタンを探すより、扉から出るほうが自然。
 * ============================================================
 */

/** 扉の前とみなす範囲（マス数） */
const DOOR_REACH = 2;

export function isAtDoor(
    door: RoomDoor,
    x: number,
    y: number,
): boolean {
    // 位置は 0〜1 の割合で持っているので、マスに直す
    const col = x * ROOM_COLS;
    const row = y * ROOM_ROWS;

    const from = door.offset;
    const to = door.offset + DOOR_WIDTH;

    if (door.side === "top") {
        return row <= DOOR_REACH && col >= from && col <= to;
    }
    if (door.side === "bottom") {
        return row >= ROOM_ROWS - DOOR_REACH && col >= from && col <= to;
    }
    if (door.side === "left") {
        return col <= DOOR_REACH && row >= from && row <= to;
    }
    return col >= ROOM_COLS - DOOR_REACH && row >= from && row <= to;
}
