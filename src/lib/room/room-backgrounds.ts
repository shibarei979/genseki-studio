/**
 * ============================================================
 * 原石航路 Studio
 * 部屋の背景
 *
 * 部屋の中身は 1 枚の絵で持つ。
 * 家具を 1 点ずつ置いて組み立てるのはやめた。
 *
 * 置く仕組みは、絵の数だけ手当てが要る。
 * 机 1 つに 4 面ぶんの絵、当たり判定、向きごとの縮尺。
 * それを全部揃えるまで、部屋はいつまでも
 * 「置きかけの床」のままになる。
 *
 * 1 枚の絵なら、描いたその日から完成した部屋として出せる。
 * 自由に模様替えはできなくなるが、
 * 誰が立てても見られる部屋になるほうが先だと判断した。
 *
 * ------------------------------------------------------------
 * 歩ける範囲
 *
 * 人の位置は 0〜1 の割合で持っている。
 * 絵の端まで歩けると、本棚や壁の中に立ってしまうので、
 * 絵ごとに「床として使ってよい四角」を割合で決めておく。
 *
 * 数字は絵を見て決めたもの。絵を差し替えたら測り直すこと。
 *
 * ------------------------------------------------------------
 * 置き場所
 *
 * 絵は public/images/rooms/ に置く。public/rooms/ には置かない。
 * /rooms/xxx は部屋を開く入り口（app/rooms/[roomId]）と同じ形なので、
 * 画像の名前が部屋の ID として読まれて 404 になる。
 * ============================================================
 */

/** 絵に対する割合で持つ四角 */
export interface FloorRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/**
 * 入れない場所。
 *
 * 机・棚・壁ぎわなど、足を置けない範囲を四角で並べる。
 * 絵に対する割合で持つので、画面の大きさが変わっても同じ場所を指す。
 *
 * 家具の形は四角ではないが、四角で近似する。
 * 輪郭どおりに判定しても、遊ぶ人にはその差が分からない。
 * 分かるのは「机の上に立てた」ときだけなので、そこだけ塞げばよい。
 *
 * 数字は絵に目盛りを引いて読んだもの。
 * 絵を差し替えたら測り直すこと。
 */
export type BlockedRect = FloorRect;

/** 椅子 1 脚 */
export interface Seat {
    x: number;
    y: number;
}

/**
 * 机のまわりに椅子を並べる。
 *
 * 1 脚ずつ座標を書くと、長机 3 卓で 40 行を超える。
 * 並びが規則的なので、中心と間隔から割り出す。
 *
 * @param centerX 机の中心（横）
 * @param sideGap 中心から椅子までの距離
 * @param rows    椅子を置く高さの一覧
 * @param heads   上下の端に 1 脚ずつ置くか。置くなら [上, 下] の高さ
 */
function tableSeats(
    centerX: number,
    sideGap: number,
    rows: number[],
    heads?: [number, number],
): Seat[] {
    const seats: Seat[] = [];
    for (const y of rows) {
        seats.push({ x: centerX - sideGap, y });
        seats.push({ x: centerX + sideGap, y });
    }
    if (heads) {
        seats.push({ x: centerX, y: heads[0] });
        seats.push({ x: centerX, y: heads[1] });
    }
    return seats;
}

export interface RoomBackground {
    id: string;
    label: string;
    /** この人数までがこの部屋 */
    maxCapacity: number;
    src: string;
    /** 絵の原寸。縦横比と、人の大きさを合わせるのに使う */
    width: number;
    height: number;
    /** 歩ける範囲 */
    floor: FloorRect;
    /** その中でも入れない場所 */
    blocked: BlockedRect[];
    /**
     * 椅子の場所。
     *
     * 机の当たり判定の中にある。
     * 押したときだけ、そこへ入れるようにする。
     */
    seats: Seat[];
    /** 出入口の前。ここに立ったら退室を尋ねる */
    door: { left: number; right: number; top: number };
}

export const ROOM_BACKGROUNDS: RoomBackground[] = [
    {
        id: "small",
        label: "書斎",
        maxCapacity: 5,
        src: "/images/rooms/room-small.png",
        width: 878,
        height: 495,
        floor: { left: 0.03, top: 0.33, right: 0.97, bottom: 0.95 },
        blocked: [
            /* 奥の壁と本棚の列。両端の鉢と灯りも含む */
            { left: 0, top: 0, right: 1, bottom: 0.33 },
            /* 左の作業机と椅子、その下の鉢 */
            { left: 0, top: 0.33, right: 0.16, bottom: 0.82 },
            /* 右の飾り棚 */
            { left: 0.9, top: 0.3, right: 1, bottom: 1 },
            /* 中央の机と椅子。ラグの上は歩ける */
            { left: 0.34, top: 0.42, right: 0.64, bottom: 0.78 },
            /* 手前の飾り棚 */
            { left: 0.12, top: 0.86, right: 0.31, bottom: 1 },
        ],
        seats: [
            /* 中央の机、向かい合わせの 2 脚 */
            { x: 0.372, y: 0.565 },
            { x: 0.605, y: 0.565 },
            /* 左の作業机 */
            { x: 0.137, y: 0.545 },
        ],
        door: { left: 0.44, right: 0.58, top: 0.9 },
    },
    {
        id: "medium",
        label: "作業室",
        maxCapacity: 10,
        src: "/images/rooms/room-medium.png",
        width: 904,
        height: 678,
        floor: { left: 0.03, top: 0.27, right: 0.97, bottom: 0.94 },
        blocked: [
            /* 奥の壁と本棚の列 */
            { left: 0, top: 0, right: 1, bottom: 0.27 },
            /* 左右の袖机と椅子 */
            { left: 0, top: 0.27, right: 0.155, bottom: 0.87 },
            { left: 0.845, top: 0.27, right: 1, bottom: 0.87 },
            /* 長机 2 卓。椅子の外側まで塞ぐ */
            { left: 0.22, top: 0.32, right: 0.47, bottom: 0.79 },
            { left: 0.53, top: 0.32, right: 0.76, bottom: 0.79 },
            /* 手前の飾り棚 */
            { left: 0.15, top: 0.89, right: 0.34, bottom: 1 },
        ],
        seats: [
            ...tableSeats(0.335, 0.097, [0.435, 0.538, 0.642], [0.362, 0.757]),
            ...tableSeats(0.647, 0.097, [0.435, 0.538, 0.642], [0.362, 0.757]),
            /* 左右の袖机 */
            { x: 0.103, y: 0.382 },
            { x: 0.103, y: 0.672 },
            { x: 0.897, y: 0.382 },
            { x: 0.897, y: 0.672 },
        ],
        door: { left: 0.44, right: 0.58, top: 0.92 },
    },
    {
        id: "large",
        label: "大部屋",
        maxCapacity: 20,
        src: "/images/rooms/room-large.png",
        width: 1097,
        height: 758,
        floor: { left: 0.02, top: 0.19, right: 0.98, bottom: 0.96 },
        blocked: [
            /* 奥の壁と本棚の列 */
            { left: 0, top: 0, right: 1, bottom: 0.19 },
            /* 左右の壁ぎわに並んだ個人席 */
            { left: 0, top: 0.19, right: 0.115, bottom: 0.82 },
            { left: 0.885, top: 0.19, right: 1, bottom: 0.82 },
            /* 長机 3 卓 */
            { left: 0.185, top: 0.26, right: 0.335, bottom: 0.75 },
            { left: 0.425, top: 0.26, right: 0.575, bottom: 0.75 },
            { left: 0.65, top: 0.26, right: 0.815, bottom: 0.75 },
            /* 手前に並んだ棚・掲示板・給湯まわり */
            { left: 0, top: 0.85, right: 0.3, bottom: 1 },
            { left: 0.62, top: 0.85, right: 1, bottom: 1 },
        ],
        seats: [
            ...tableSeats(0.26, 0.058, [0.36, 0.44, 0.52, 0.6, 0.68], [0.305, 0.735]),
            ...tableSeats(0.5, 0.058, [0.36, 0.44, 0.52, 0.6, 0.68], [0.305, 0.735]),
            ...tableSeats(0.733, 0.058, [0.36, 0.44, 0.52, 0.6, 0.68], [0.305, 0.735]),
            /* 左右の壁ぎわの個人席 */
            { x: 0.1, y: 0.27 },
            { x: 0.1, y: 0.38 },
            { x: 0.1, y: 0.49 },
            { x: 0.1, y: 0.6 },
            { x: 0.1, y: 0.71 },
            { x: 0.9, y: 0.27 },
            { x: 0.9, y: 0.38 },
            { x: 0.9, y: 0.49 },
            { x: 0.9, y: 0.6 },
            { x: 0.9, y: 0.71 },
        ],
        door: { left: 0.44, right: 0.58, top: 0.95 },
    },
];

/**
 * その人数に合う部屋。
 *
 * 上限を超える人数（21 人以上）は、いちばん大きい部屋を返す。
 * 「合うものが無い」で何も出さないと、
 * 人数を増やしたせいで部屋が消えた、という結果になる。
 */
export function backgroundFor(capacity: number): RoomBackground {
    return (
        ROOM_BACKGROUNDS.find((row) => capacity <= row.maxCapacity) ??
        ROOM_BACKGROUNDS[ROOM_BACKGROUNDS.length - 1]
    );
}

/** その点が四角の中か */
function isInside(rect: FloorRect, x: number, y: number): boolean {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** 机や壁の上か */
export function isBlocked(
    background: RoomBackground,
    x: number,
    y: number,
): boolean {
    return background.blocked.some((rect) => isInside(rect, x, y));
}

/**
 * 四角の外へ、いちばん近い縁まで押し出す。
 *
 * 上下左右のうち、出るのにいちばん近い向きを選ぶ。
 * 机の手前を押したら手前へ、奥を押したら奥へ出る。
 */
function pushOut(
    rect: FloorRect,
    x: number,
    y: number,
): { x: number; y: number } {
    /* 縁からわずかに離す。ちょうど縁だと、また中と判定される */
    const gap = 0.004;

    const toLeft = x - rect.left;
    const toRight = rect.right - x;
    const toTop = y - rect.top;
    const toBottom = rect.bottom - y;
    const nearest = Math.min(toLeft, toRight, toTop, toBottom);

    if (nearest === toLeft) return { x: rect.left - gap, y };
    if (nearest === toRight) return { x: rect.right + gap, y };
    if (nearest === toTop) return { x, y: rect.top - gap };
    return { x, y: rect.bottom + gap };
}

/**
 * 立てる場所に直す。
 *
 * 部屋の外なら中へ、机や壁の上ならその手前へ寄せる。
 * 「押しても何も起きない」を避ける。
 * 動かないと、押す場所が悪いのか不具合なのか分からない。
 *
 * 押し出したら、また別の家具に入ることがある。
 * 何度か繰り返して、それでも空かなければ諦めてその場に留める。
 */
export function clampToFloor(
    background: RoomBackground,
    x: number,
    y: number,
): { x: number; y: number } | null {
    const { left, top, right, bottom } = background.floor;

    let px = Math.min(right, Math.max(left, x));
    let py = Math.min(bottom, Math.max(top, y));

    for (let step = 0; step < 4; step += 1) {
        const hit = background.blocked.find((rect) => isInside(rect, px, py));
        if (!hit) return { x: px, y: py };

        const next = pushOut(hit, px, py);
        px = Math.min(right, Math.max(left, next.x));
        py = Math.min(bottom, Math.max(top, next.y));
    }

    /* 押し出せなかった。動かさない */
    return isBlocked(background, px, py) ? null : { x: px, y: py };
}

/** 出入口の前にいるか */
export function isAtRoomDoor(
    background: RoomBackground,
    x: number,
    y: number,
): boolean {
    const { left, right, top } = background.door;
    return y >= top && x >= left && x <= right;
}

/**
 * ============================================================
 * 道を探す
 *
 * 押した場所へ一直線に飛ぶと、机の上を突っ切ってしまう。
 * 床を細かい格子に割って、空いている升だけを辿る。
 *
 * 升の細かさは 56 × 42。
 * これより粗いと椅子と机の隙間を通れなくなり、
 * 細かくすると通り道が増えるぶん、遠回りしても
 * まっすぐに見えて、歩いている感じが薄れる。
 * ============================================================
 */

const GRID_COLS = 56;
const GRID_ROWS = 42;

/** 升の中心の座標 */
function cellCenter(col: number, row: number): { x: number; y: number } {
    return { x: (col + 0.5) / GRID_COLS, y: (row + 0.5) / GRID_ROWS };
}

/** 座標がどの升か */
function cellOf(x: number, y: number): { col: number; row: number } {
    return {
        col: Math.min(GRID_COLS - 1, Math.max(0, Math.floor(x * GRID_COLS))),
        row: Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(y * GRID_ROWS))),
    };
}

/**
 * 通れる升の表。
 *
 * 部屋ごとに一度だけ作って覚えておく。
 * 押すたびに作り直すと、大部屋では毎回 2000 升を調べることになる。
 */
const walkableCache = new Map<string, boolean[]>();

function walkableGrid(background: RoomBackground): boolean[] {
    const cached = walkableCache.get(background.id);
    if (cached) return cached;

    const grid: boolean[] = new Array(GRID_COLS * GRID_ROWS);
    for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < GRID_COLS; col += 1) {
            const { x, y } = cellCenter(col, row);
            const inFloor =
                x >= background.floor.left &&
                x <= background.floor.right &&
                y >= background.floor.top &&
                y <= background.floor.bottom;
            grid[row * GRID_COLS + col] = inFloor && !isBlocked(background, x, y);
        }
    }
    walkableCache.set(background.id, grid);
    return grid;
}

/** そこから最も近い通れる升 */
function nearestWalkable(
    background: RoomBackground,
    x: number,
    y: number,
): number | null {
    const grid = walkableGrid(background);
    const start = cellOf(x, y);
    let best: number | null = null;
    let bestDistance = Infinity;

    for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < GRID_COLS; col += 1) {
            const index = row * GRID_COLS + col;
            if (!grid[index]) continue;
            const distance =
                (col - start.col) * (col - start.col) +
                (row - start.row) * (row - start.row);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = index;
            }
        }
    }
    return best;
}

/**
 * 空いている所だけを通って、そこまでの道を返す。
 *
 * 幅優先で探す。升は 2000 ほどしかないので、
 * 重み付きの探索にしても速さは変わらず、読みにくくなるだけ。
 *
 * 斜めにも進む。ただし角を擦り抜けないよう、
 * 縦横の両方が空いているときだけ通す。
 *
 * 返すのは曲がり角だけ。まっすぐ進む途中の升は落とす。
 * 全部の升を返すと、1 升ずつ刻んで歩くことになって遅い。
 */
export function findPath(
    background: RoomBackground,
    from: { x: number; y: number },
    to: { x: number; y: number },
): { x: number; y: number }[] {
    const grid = walkableGrid(background);

    const startIndex = nearestWalkable(background, from.x, from.y);
    const goalIndex = nearestWalkable(background, to.x, to.y);
    if (startIndex === null || goalIndex === null) return [];
    if (startIndex === goalIndex) return [];

    const cameFrom = new Int32Array(GRID_COLS * GRID_ROWS).fill(-1);
    const queue: number[] = [startIndex];
    cameFrom[startIndex] = startIndex;

    const steps = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
    ];

    let head = 0;
    let found = false;

    while (head < queue.length) {
        const index = queue[head];
        head += 1;
        if (index === goalIndex) {
            found = true;
            break;
        }

        const col = index % GRID_COLS;
        const row = (index - col) / GRID_COLS;

        for (const [dx, dy] of steps) {
            const nextCol = col + dx;
            const nextRow = row + dy;
            if (nextCol < 0 || nextCol >= GRID_COLS) continue;
            if (nextRow < 0 || nextRow >= GRID_ROWS) continue;

            const nextIndex = nextRow * GRID_COLS + nextCol;
            if (!grid[nextIndex] || cameFrom[nextIndex] !== -1) continue;

            /* 斜めは、縦と横の両方が空いているときだけ */
            if (dx !== 0 && dy !== 0) {
                if (!grid[row * GRID_COLS + nextCol]) continue;
                if (!grid[nextRow * GRID_COLS + col]) continue;
            }

            cameFrom[nextIndex] = index;
            queue.push(nextIndex);
        }
    }

    if (!found) return [];

    /* 辿ってきた道を逆にたどる */
    const cells: number[] = [];
    let cursor = goalIndex;
    while (cursor !== startIndex) {
        cells.push(cursor);
        cursor = cameFrom[cursor];
    }
    cells.reverse();

    /* 曲がり角だけ残す */
    const points: { x: number; y: number }[] = [];
    let lastDx = 0;
    let lastDy = 0;
    let prev = startIndex;

    for (const index of cells) {
        const dx = (index % GRID_COLS) - (prev % GRID_COLS);
        const dy = Math.floor(index / GRID_COLS) - Math.floor(prev / GRID_COLS);
        if (dx !== lastDx || dy !== lastDy) {
            const col = prev % GRID_COLS;
            points.push(cellCenter(col, (prev - col) / GRID_COLS));
            lastDx = dx;
            lastDy = dy;
        }
        prev = index;
    }

    const goalCol = goalIndex % GRID_COLS;
    points.push(cellCenter(goalCol, (goalIndex - goalCol) / GRID_COLS));

    /* 最初の 1 点はいまいる場所なので落とす */
    return points.slice(1);
}

/**
 * 押した場所の近くに椅子があるか。
 *
 * 椅子は机の当たり判定の中にあるので、
 * ここで拾わないと「机の手前」へ押し出されてしまう。
 */
export function seatNear(
    background: RoomBackground,
    x: number,
    y: number,
): Seat | null {
    /* 指の太さぶんの余裕。絵の上では 30px ほどにあたる */
    const reach = 0.035;

    let best: Seat | null = null;
    let bestDistance = reach * reach;

    for (const seat of background.seats) {
        const distance = (seat.x - x) ** 2 + (seat.y - y) ** 2;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = seat;
        }
    }
    return best;
}
